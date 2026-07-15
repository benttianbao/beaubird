"""Fail-closed offline GBDT challenger audit for the Zhejiang bird model.

The released Bayesian SQLite artifact is intentionally sanitized and contains
no checklist-level training rows.  Until a shared snapshot-derived cohort and
same-fold OOF Bayesian baseline exist, this script validates artifact bindings
and writes an audit bundle with no approved taxa or fitted models.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sqlite3
import subprocess
import sys
from collections import Counter, defaultdict
from contextlib import closing
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import quote

import joblib
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier


ROOT = Path(__file__).resolve().parents[2]
GEO_HELPER = ROOT / "tools" / "prediction-geo-batch.js"
CHAMPION_SCHEMA_VERSION = "2"
CHAMPION_BASELINE_NOT_OOF = "champion_baseline_not_oof"
PRODUCTION_MINIMUM_POSITIVES = 200
PRODUCTION_MINIMUM_BRIER_IMPROVEMENT = 0.03
PRODUCTION_MAXIMUM_ECE_REGRESSION = 0.01
PRODUCTION_MINIMUM_TOPK_DELTA = 0.0
LOCAL_HISTORY_YEARS = 5
RECENCY_HALF_LIFE_YEARS = 3.0


class ChallengerError(RuntimeError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class GateThresholds:
    minimum_brier_improvement: float = 0.03
    maximum_ece_regression: float = 0.01
    minimum_topk_delta: float = 0.0
    minimum_time_folds: int = 2
    minimum_training_positives: int = 30
    minimum_validation_positives: int = 10
    minimum_training_negatives: int = 30
    minimum_validation_negatives: int = 20


def clamp_probability(value: float) -> float:
    return float(min(1 - 1e-6, max(1e-6, value)))


def _sample_weights(y_true: np.ndarray, sample_weight: np.ndarray | None) -> np.ndarray:
    if sample_weight is None:
        return np.ones(y_true.shape[0], dtype=np.float64)
    weights = np.asarray(sample_weight, dtype=np.float64)
    if weights.shape != (y_true.shape[0],) or not np.isfinite(weights).all() or (weights < 0).any():
        raise ValueError("sample_weight 必须是与样本等长的有限非负向量。")
    return weights


def brier_score(
    y_true: np.ndarray, probability: np.ndarray, sample_weight: np.ndarray | None = None
) -> float:
    if y_true.size == 0:
        return math.nan
    weights = _sample_weights(y_true, sample_weight)
    total = float(weights.sum())
    if total <= 0:
        return math.nan
    return float(np.average((probability - y_true) ** 2, weights=weights))


def expected_calibration_error(
    y_true: np.ndarray,
    probability: np.ndarray,
    bins: int = 10,
    sample_weight: np.ndarray | None = None,
) -> float:
    if y_true.size == 0:
        return math.nan
    weights = _sample_weights(y_true, sample_weight)
    total = float(weights.sum())
    if total <= 0:
        return math.nan
    edges = np.linspace(0.0, 1.0, bins + 1)
    value = 0.0
    for index in range(bins):
        lower, upper = edges[index], edges[index + 1]
        mask = (probability >= lower) & (
            probability <= upper if index == bins - 1 else probability < upper
        )
        bin_weight = float(weights[mask].sum())
        if bin_weight <= 0:
            continue
        mean_probability = float(np.average(probability[mask], weights=weights[mask]))
        mean_outcome = float(np.average(y_true[mask], weights=weights[mask]))
        value += bin_weight / total * abs(mean_probability - mean_outcome)
    return float(value)


def recall_at_k(
    labels: np.ndarray,
    probabilities: np.ndarray,
    k: int = 20,
    sample_weight: np.ndarray | None = None,
) -> float:
    if labels.ndim != 2 or probabilities.shape != labels.shape or labels.shape[0] == 0:
        return math.nan
    if not np.isfinite(probabilities).all():
        return math.nan
    width = min(k, labels.shape[1])
    order = np.argpartition(-probabilities, width - 1, axis=1)[:, :width]
    recalls: list[float] = []
    recall_weights: list[float] = []
    weights = _sample_weights(labels[:, 0], sample_weight)
    for row_index, selected in enumerate(order):
        positives = int(labels[row_index].sum())
        if positives:
            recalls.append(float(labels[row_index, selected].sum()) / positives)
            recall_weights.append(float(weights[row_index]))
    if not recalls or sum(recall_weights) <= 0:
        return math.nan
    return float(np.average(np.asarray(recalls), weights=np.asarray(recall_weights)))


def recall_at_k_with_single_replacement(
    labels: np.ndarray,
    champion_ranking: np.ndarray,
    column_index: int,
    replacement: np.ndarray,
    k: int = 20,
    sample_weight: np.ndarray | None = None,
) -> float:
    """Checklist Recall@K after replacing exactly one champion score column.

    The top-(K+1) champion pool is sufficient because changing one column can
    alter membership by at most one taxon.  This avoids copying the full online
    taxon matrix once per challenger.
    """
    if (
        labels.ndim != 2
        or champion_ranking.shape != labels.shape
        or replacement.shape != (labels.shape[0],)
        or labels.shape[0] == 0
        or not 0 <= column_index < labels.shape[1]
        or not np.isfinite(champion_ranking).all()
        or not np.isfinite(replacement).all()
    ):
        return math.nan
    width = min(k, labels.shape[1])
    if labels.shape[1] <= width:
        return recall_at_k(labels, champion_ranking, k, sample_weight)

    pool_width = width + 1
    pool = np.argpartition(-champion_ranking, pool_width - 1, axis=1)[:, :pool_width]
    pool_scores = np.take_along_axis(champion_ranking, pool, axis=1)
    pool_scores = np.where(pool == column_index, -np.inf, pool_scores)
    competitor_positions = np.argpartition(-pool_scores, width - 1, axis=1)[:, :width]
    competitors = np.take_along_axis(pool, competitor_positions, axis=1)
    competitor_scores = np.take_along_axis(champion_ranking, competitors, axis=1)
    lowest_position = np.argmin(competitor_scores, axis=1)
    row_numbers = np.arange(labels.shape[0])
    evicted = competitors[row_numbers, lowest_position]
    enters = replacement > competitor_scores[row_numbers, lowest_position]
    competitor_hits = np.take_along_axis(labels, competitors, axis=1).sum(axis=1)
    hybrid_hits = competitor_hits + enters * (
        labels[:, column_index].astype(np.int64) - labels[row_numbers, evicted].astype(np.int64)
    )
    positives = labels.sum(axis=1)
    eligible = positives > 0
    weights = _sample_weights(labels[:, 0], sample_weight)
    eligible &= weights > 0
    if not eligible.any():
        return math.nan
    return float(np.average(hybrid_hits[eligible] / positives[eligible], weights=weights[eligible]))


def evaluate_replacement(
    metrics: list[dict[str, Any]], topk_deltas: dict[str, float], thresholds: GateThresholds
) -> dict[str, Any]:
    time_folds = {row["fold"] for row in metrics if row.get("kind") == "time" and row.get("valid")}
    required_kinds = {"spatial", "observer"}
    present_kinds = {row.get("kind") for row in metrics if row.get("valid")}
    failures: list[str] = []
    if len(time_folds) < thresholds.minimum_time_folds:
        failures.append("insufficient_time_folds")
    for kind in sorted(required_kinds - present_kinds):
        failures.append(f"missing_{kind}_holdout")
    for row in metrics:
        if not row.get("valid"):
            failures.append(f"{row.get('fold', 'unknown')}.invalid")
            continue
        numeric_metrics = [
            "brierImprovement", "championEce", "challengerEce",
            "trainingIndependentPositives", "validationIndependentPositives",
            "trainingIndependentNegatives", "validationIndependentNegatives",
        ]
        if any(not math.isfinite(float(row.get(key, math.nan))) for key in numeric_metrics):
            failures.append(f"{row.get('fold', 'unknown')}.non_finite")
            continue
        if row["trainingIndependentPositives"] < thresholds.minimum_training_positives:
            failures.append(f"{row['fold']}.training_positives")
        if row["validationIndependentPositives"] < thresholds.minimum_validation_positives:
            failures.append(f"{row['fold']}.validation_positives")
        if row["trainingIndependentNegatives"] < thresholds.minimum_training_negatives:
            failures.append(f"{row['fold']}.training_negatives")
        if row["validationIndependentNegatives"] < thresholds.minimum_validation_negatives:
            failures.append(f"{row['fold']}.validation_negatives")
        if row["brierImprovement"] < thresholds.minimum_brier_improvement:
            failures.append(f"{row['fold']}.brier")
        if row["challengerEce"] - row["championEce"] > thresholds.maximum_ece_regression:
            failures.append(f"{row['fold']}.ece")
    metric_folds = {str(row.get("fold")) for row in metrics}
    for fold in metric_folds:
        delta = topk_deltas.get(fold, math.nan)
        if not math.isfinite(delta) or delta < thresholds.minimum_topk_delta:
            failures.append(f"{fold}.topk")
    return {"approved": not failures, "failures": sorted(set(failures))}


def stable_bucket(value: str, modulo: int = 5) -> int:
    return int.from_bytes(hashlib.sha256(value.encode("utf-8")).digest()[:4], "big") % modulo


def find_observer(value: Any, depth: int = 0) -> str | None:
    if not isinstance(value, (dict, list)) or depth > 4:
        return None
    keys = {
        "observerid", "observer_id", "userid", "user_id", "memberid", "member_id",
        "creatorid", "creator_id", "createby", "username", "user_name",
    }
    if isinstance(value, dict):
        for key, candidate in value.items():
            if str(key).lower() in keys and isinstance(candidate, (str, int, float)):
                text = str(candidate).strip()
                if text:
                    return text
        children: Iterable[Any] = value.values()
    else:
        children = value
    for candidate in children:
        found = find_observer(candidate, depth + 1)
        if found:
            return found
    return None


def seasonal_day(value: str) -> int:
    parsed = date.fromisoformat(value[:10])
    reference = date(2001, parsed.month, min(parsed.day, 28 if parsed.month == 2 else parsed.day))
    if parsed.month == 2 and parsed.day == 29:
        return 59
    return (reference - date(2001, 1, 1)).days + 1


def season_week(value: str) -> int:
    return min(52, (seasonal_day(value) - 1) // 7 + 1)


def transform_coordinates(coordinates: list[list[float]]) -> list[dict[str, Any] | None]:
    process = subprocess.run(
        ["node", str(GEO_HELPER)],
        input=json.dumps({"coordinates": coordinates}, ensure_ascii=False),
        text=True,
        capture_output=True,
        cwd=ROOT,
        check=False,
    )
    if process.returncode != 0:
        raise ChallengerError("H3_HELPER_FAILED", process.stderr.strip() or "H3 坐标转换失败。")
    return json.loads(process.stdout)["coordinates"]


def neighboring_cells(cells: set[str]) -> dict[str, list[str]]:
    if not cells:
        return {}
    process = subprocess.run(
        ["node", str(GEO_HELPER)],
        input=json.dumps({"r6Cells": sorted(cells)}),
        text=True,
        capture_output=True,
        cwd=ROOT,
        check=False,
    )
    if process.returncode != 0:
        raise ChallengerError("H3_HELPER_FAILED", process.stderr.strip() or "H3 邻格计算失败。")
    return json.loads(process.stdout)["neighbors"]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_sha256_sidecar(path: Path) -> str:
    if not path.is_file():
        raise ChallengerError("ARTIFACT_MISSING", f"文件不存在：{path}")
    sidecar = Path(f"{path}.sha256")
    if not sidecar.is_file():
        raise ChallengerError("SHA256_REQUIRED", f"缺少 SHA-256 旁车文件：{sidecar}")
    fields = sidecar.read_text(encoding="utf-8").strip().split()
    expected = fields[0].lower() if fields else ""
    if len(expected) != 64 or any(character not in "0123456789abcdef" for character in expected):
        raise ChallengerError("SHA256_INVALID", f"SHA-256 旁车格式无效：{sidecar}")
    actual = sha256_file(path)
    if actual != expected:
        raise ChallengerError(
            "SHA256_MISMATCH", f"文件与 SHA-256 旁车不一致：{path}（expected={expected}, actual={actual}）"
        )
    return actual


def validate_options(options: argparse.Namespace) -> GateThresholds:
    numeric = {
        "minimum_brier_improvement": float(options.minimum_brier_improvement),
        "maximum_ece_regression": float(options.maximum_ece_regression),
        "minimum_topk_delta": float(options.minimum_topk_delta),
    }
    if not all(math.isfinite(value) for value in numeric.values()):
        raise ChallengerError("INVALID_OPTIONS", "所有 challenger 门槛必须是有限数值。")
    if numeric["minimum_brier_improvement"] < PRODUCTION_MINIMUM_BRIER_IMPROVEMENT:
        raise ChallengerError("UNSAFE_THRESHOLDS", "Brier 改善门槛不得低于生产基线 3%。")
    if numeric["maximum_ece_regression"] > PRODUCTION_MAXIMUM_ECE_REGRESSION:
        raise ChallengerError("UNSAFE_THRESHOLDS", "ECE 退化上限不得高于生产基线 0.01。")
    if numeric["minimum_topk_delta"] < PRODUCTION_MINIMUM_TOPK_DELTA:
        raise ChallengerError("UNSAFE_THRESHOLDS", "Top-20 门槛不得允许退化。")
    if int(options.minimum_positives) < PRODUCTION_MINIMUM_POSITIVES:
        raise ChallengerError("UNSAFE_THRESHOLDS", "minimum-positives 不得低于 200 个独立正例。")
    if int(options.max_taxa) < 1:
        raise ChallengerError("INVALID_OPTIONS", "max-taxa 必须是正整数。")
    return GateThresholds(
        minimum_brier_improvement=numeric["minimum_brier_improvement"],
        maximum_ece_regression=numeric["maximum_ece_regression"],
        minimum_topk_delta=numeric["minimum_topk_delta"],
    )


def load_snapshot_sidecar(
    snapshot_path: Path, snapshot_sha256: str
) -> dict[str, Any]:
    manifest_path = Path(f"{snapshot_path}.manifest.json")
    if not manifest_path.is_file():
        raise ChallengerError(
            "SNAPSHOT_MANIFEST_REQUIRED", f"缺少训练快照稳定性旁车：{manifest_path}"
        )
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ChallengerError(
            "SNAPSHOT_MANIFEST_INVALID", f"训练快照稳定性旁车无效：{manifest_path}"
        ) from error
    if not isinstance(manifest, dict):
        raise ChallengerError("SNAPSHOT_MANIFEST_INVALID", "训练快照稳定性旁车必须是 JSON 对象。")
    recorded_sha256 = str(manifest.get("sha256") or "").strip().lower()
    if recorded_sha256 != snapshot_sha256:
        raise ChallengerError(
            "SNAPSHOT_MANIFEST_MISMATCH",
            f"训练快照稳定性旁车与实际 SHA-256 不一致（manifest={recorded_sha256 or 'missing'}, actual={snapshot_sha256}）。",
        )
    if manifest.get("sourceChangedDuringSnapshot") is not False:
        raise ChallengerError(
            "SNAPSHOT_UNSTABLE", "训练快照旁车未明确证明复制期间源库保持稳定。"
        )
    start_fingerprint = str(manifest.get("sourceFingerprintAtStart") or "").strip()
    end_fingerprint = str(manifest.get("sourceFingerprintAtEnd") or "").strip()
    if not start_fingerprint or start_fingerprint != end_fingerprint:
        raise ChallengerError("SNAPSHOT_UNSTABLE", "训练快照复制前后的源库指纹不一致。")
    start_version = manifest.get("sourceDataVersionAtStart")
    end_version = manifest.get("sourceDataVersionAtEnd")
    if start_version is None or start_version != end_version:
        raise ChallengerError("SNAPSHOT_UNSTABLE", "训练快照复制前后的 SQLite data_version 不一致。")
    return manifest


def assert_snapshot(
    connection: sqlite3.Connection,
    snapshot_path: Path,
    snapshot_sha256: str,
) -> dict[str, Any]:
    integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
    if integrity != "ok":
        raise ChallengerError("SNAPSHOT_INVALID", f"训练快照完整性异常：{integrity}")
    tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if not {"reports", "observations"}.issubset(tables):
        raise ChallengerError("SNAPSHOT_INVALID", "训练快照缺少 reports/observations 表。")
    manifest = load_snapshot_sidecar(snapshot_path, snapshot_sha256)
    expected_counts = manifest.get("snapshotCounts")
    if not isinstance(expected_counts, dict):
        raise ChallengerError("SNAPSHOT_MANIFEST_INVALID", "训练快照旁车缺少 snapshotCounts。")
    actual_counts = {
        "reports": int(connection.execute("SELECT COUNT(*) FROM reports").fetchone()[0]),
        "observations": int(connection.execute("SELECT COUNT(*) FROM observations").fetchone()[0]),
    }
    for key, actual in actual_counts.items():
        try:
            expected = int(expected_counts[key])
        except (KeyError, TypeError, ValueError) as error:
            raise ChallengerError(
                "SNAPSHOT_MANIFEST_INVALID", f"训练快照旁车缺少有效的 {key} 数量。"
            ) from error
        if expected != actual:
            raise ChallengerError(
                "SNAPSHOT_MANIFEST_MISMATCH",
                f"训练快照旁车中的 {key} 数量不一致（manifest={expected}, actual={actual}）。",
            )
    return manifest


def load_manifest(connection: sqlite3.Connection) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, raw in connection.execute("SELECT key,value FROM manifest"):
        try:
            result[key] = json.loads(raw)
        except json.JSONDecodeError:
            result[key] = raw
    return result


def assert_champion(
    connection: sqlite3.Connection, snapshot_sha256: str, champion_sha256: str
) -> dict[str, Any]:
    integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
    if integrity != "ok":
        raise ChallengerError("CHAMPION_INVALID", f"champion SQLite 完整性异常：{integrity}")
    tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    required = {
        "manifest", "taxa", "space_units", "location_lookup", "location_predictions",
    }
    if not required.issubset(tables):
        raise ChallengerError("CHAMPION_INVALID", f"champion 缺少表：{sorted(required - tables)}")
    private_tables = {
        "training_reports", "training_detections", "taxon_catalog",
        "training_taxon_event_summary", "occurrence_events", "reverse_candidates",
    }
    surviving_private_tables = sorted(private_tables.intersection(tables))
    if surviving_private_tables:
        raise ChallengerError(
            "CHAMPION_NOT_SANITIZED",
            f"公共 champion 仍含私有训练表：{surviving_private_tables}",
        )
    manifest = load_manifest(connection)
    if str(manifest.get("schema_version")) != CHAMPION_SCHEMA_VERSION:
        raise ChallengerError(
            "CHAMPION_INVALID",
            f"champion schema_version 必须为 {CHAMPION_SCHEMA_VERSION}，实际为 {manifest.get('schema_version')}",
        )
    model_version = str(manifest.get("model_version") or "").strip()
    if not model_version:
        raise ChallengerError("CHAMPION_INVALID", "champion manifest 缺少 model_version。")
    source_hash = str(manifest.get("source_snapshot_sha256") or "").strip().lower()
    if source_hash != snapshot_sha256:
        raise ChallengerError(
            "ARTIFACT_MISMATCH",
            f"champion 与当前快照 SHA-256 不一致（champion={source_hash or 'missing'}, snapshot={snapshot_sha256}）。",
        )
    quality_gate = manifest.get("quality_gate")
    if not isinstance(quality_gate, dict) or quality_gate.get("passed") is not True:
        raise ChallengerError("CHAMPION_QUALITY_FAILED", "champion 未通过公共模型发布质量门槛。")
    if quality_gate.get("internalBuild") is True or manifest.get("test_only") is True:
        raise ChallengerError("CHAMPION_INVALID", "构建中间或 test-only champion 不可用于 challenger。")
    cutoff = str(manifest.get("data_cutoff_date") or "")
    try:
        date.fromisoformat(cutoff)
    except ValueError as error:
        raise ChallengerError("CHAMPION_INVALID", "champion data_cutoff_date 无效。") from error
    manifest["verified_champion_sha256"] = champion_sha256
    return manifest


def load_candidate_taxa(
    artifact: sqlite3.Connection, minimum_positives: int, max_taxa: int
) -> tuple[list[str], int]:
    columns = {str(row[1]) for row in artifact.execute("PRAGMA table_info(taxa)")}
    required = {"taxon_id", "positive_count", "is_sensitive", "vagrant_candidate"}
    if not required.issubset(columns):
        raise ChallengerError("CHAMPION_INVALID", f"champion.taxa 缺少列：{sorted(required - columns)}")
    rows = artifact.execute(
        "SELECT taxon_id FROM taxa "
        "WHERE is_sensitive=0 AND vagrant_candidate=0 AND positive_count>=? "
        "ORDER BY positive_count DESC,taxon_id LIMIT ?",
        (minimum_positives, max_taxa),
    ).fetchall()
    total = int(artifact.execute("SELECT COUNT(*) FROM taxa WHERE is_sensitive=0").fetchone()[0])
    return [str(row[0]) for row in rows], total


def administrative_id(level: str, city: str = "", district: str = "") -> str:
    if level == "province":
        return "province:zhejiang"
    if level == "city":
        return f"city:{quote(city.strip() or '未知', safe='')}"
    return f"district:{quote(city.strip() or '未知', safe='')}:{quote(district.strip() or '未知', safe='')}"


def load_dataset_from_private_cohort(
    cohort: sqlite3.Connection,
    artifact: sqlite3.Connection,
    minimum_positives: int,
    max_taxa: int,
):
    """Reserved for a future snapshot-derived, non-public in-memory cohort.

    `cohort` must never be the released champion.  The current fail-closed run
    path deliberately does not call this function because neither the shared
    cohort exporter nor a same-fold OOF Bayesian baseline exists yet.
    """
    candidate_rows = artifact.execute(
        "SELECT taxon_id, positive_count FROM taxa "
        "WHERE is_sensitive=0 AND vagrant_candidate=0 AND positive_count>=? "
        "ORDER BY positive_count DESC, taxon_id LIMIT ?",
        (minimum_positives, max_taxa),
    ).fetchall()
    if not candidate_rows:
        raise ChallengerError("NO_ELIGIBLE_TAXA", "没有鸟种达到 GBDT challenger 的独立正例门槛。")
    taxon_ids = [str(row[0]) for row in candidate_rows]
    positive_counts = {str(row[0]): int(row[1]) for row in candidate_rows}
    all_taxon_ids = [str(row[0]) for row in artifact.execute(
        "SELECT taxon_id FROM taxa WHERE is_sensitive=0 ORDER BY taxon_id"
    )]
    if len(all_taxon_ids) <= 20:
        raise ChallengerError("TOPK_CATALOG_TOO_SMALL", "完整线上鸟种目录不超过 20，Recall@20 门槛没有区分度。")

    units = {
        str(row[0]): {
            "supported": bool(row[1]),
            "longitude": float(row[2]) if row[2] is not None else math.nan,
            "latitude": float(row[3]) if row[3] is not None else math.nan,
        }
        for row in artifact.execute(
            "SELECT id,supported,centroid_longitude,centroid_latitude FROM space_units"
        )
    }
    raw_reports = cohort.execute(
        "SELECT report_id,report_date,report_year,observer_hash,observer_known,group_key,weight,"
        "province_unit,city_unit,district_unit,grid_r6_unit,grid_r7_unit,point_unit "
        "FROM training_reports WHERE is_recent=1 ORDER BY report_date,report_id"
    ).fetchall()
    if not raw_reports:
        raise ChallengerError("NO_REPORTS", "champion 没有最近五年的公共训练清单。")
    reports: list[tuple[Any, ...]] = []
    resolved_units: list[str] = []
    geo: list[dict[str, Any]] = []
    for report in raw_reports:
        candidates = [report[12], report[11], report[10], report[9], report[8], report[7]]
        coordinate_unit = next((units.get(str(value)) for value in candidates if value and str(value) in units
                                and math.isfinite(units[str(value)]["longitude"])
                                and math.isfinite(units[str(value)]["latitude"])), None)
        resolved = next((str(value) for value in candidates if value and units.get(str(value), {}).get("supported")), None)
        if coordinate_unit is None or resolved is None:
            continue
        reports.append(report)
        resolved_units.append(resolved)
        geo.append({
            "longitude": coordinate_unit["longitude"],
            "latitude": coordinate_unit["latitude"],
            "r6": str(report[10] or ""),
            "r7": str(report[11] or ""),
        })
    report_index = {str(row[0]): index for index, row in enumerate(reports)}
    labels = np.zeros((len(reports), len(taxon_ids)), dtype=np.uint8)
    taxon_index = {taxon_id: index for index, taxon_id in enumerate(taxon_ids)}
    actual_taxa: list[set[str]] = [set() for _ in reports]
    for report_id, taxon_id in cohort.execute("SELECT report_id,taxon_id FROM training_detections"):
        row_index = report_index.get(str(report_id))
        if row_index is None:
            continue
        identifier = str(taxon_id)
        actual_taxa[row_index].add(identifier)
        candidate_index = taxon_index.get(identifier)
        if candidate_index is not None:
            labels[row_index, candidate_index] = 1

    dates = [str(row[1]) for row in reports]
    years = np.asarray([int(row[2]) for row in reports], dtype=np.int16)
    days = np.asarray([seasonal_day(value) for value in dates], dtype=np.float64)
    radians = 2 * np.pi * (days - 1) / 365.0
    minimum_year, maximum_year = int(years.min()), int(years.max())
    features = np.column_stack([
        np.sin(radians),
        np.cos(radians),
        np.asarray([item["longitude"] for item in geo]),
        np.asarray([item["latitude"] for item in geo]),
        (years - minimum_year) / max(1, maximum_year - minimum_year),
    ]).astype(np.float64)
    return {
        "reports": reports,
        "geo": geo,
        "features": features,
        "labels": labels,
        "years": years,
        "observerGroups": np.asarray([str(row[3]) for row in reports], dtype=object),
        "independentGroups": np.asarray([str(row[5]) for row in reports], dtype=object),
        "weights": np.asarray([float(row[6]) for row in reports], dtype=np.float64),
        "taxonIds": taxon_ids,
        "positiveCounts": positive_counts,
        "allTaxonIds": all_taxon_ids,
        "actualTaxa": actual_taxa,
        "dates": dates,
        "resolvedUnits": resolved_units,
        "yearMinimum": minimum_year,
        "yearMaximum": maximum_year,
    }


def champion_matrix(dataset: dict[str, Any], artifact: sqlite3.Connection) -> np.ndarray:
    taxon_ids = dataset["taxonIds"]
    units = dataset["resolvedUnits"]
    matrix = np.zeros(dataset["labels"].shape, dtype=np.float64)
    coverage = load_manifest(artifact).get("coverage") or {}
    checklist_count = max(1, int(coverage.get("insertedTrainingReports") or coverage.get("completeCount") or len(units)))
    global_rates = {
        str(row[0]): clamp_probability(float(row[1]) / checklist_count)
        for row in artifact.execute(
            f"SELECT taxon_id,positive_count FROM taxa WHERE taxon_id IN ({','.join('?' for _ in taxon_ids)})",
            taxon_ids,
        )
    }
    rows = artifact.execute(
        f"SELECT space_unit_id,season_bucket,taxon_id,probability FROM location_predictions "
        f"WHERE temporal_granularity='week' AND taxon_id IN ({','.join('?' for _ in taxon_ids)})",
        taxon_ids,
    ).fetchall()
    predictions = {
        (str(row[0]), int(row[1]), str(row[2])): float(row[3])
        for row in rows if row[3] is not None
    }
    for row_index, (unit, date_text) in enumerate(zip(units, dataset["dates"], strict=True)):
        week = season_week(date_text)
        for taxon_index, taxon_id in enumerate(taxon_ids):
            value = predictions.get((unit, week, taxon_id))
            if value is None:
                value = predictions.get(("province:zhejiang", week, taxon_id), global_rates[taxon_id])
            matrix[row_index, taxon_index] = clamp_probability(value)
    return matrix


def champion_rankings(dataset: dict[str, Any], artifact: sqlite3.Connection, width: int = 21):
    rows = artifact.execute(
        "SELECT space_unit_id,season_bucket,taxon_id,ranking_score FROM location_predictions "
        "WHERE temporal_granularity='week' ORDER BY space_unit_id,season_bucket,ranking_score DESC,taxon_id"
    )
    ranking_index: dict[tuple[str, int], list[tuple[str, float]]] = defaultdict(list)
    for unit, bucket, taxon_id, score in rows:
        key = (str(unit), int(bucket))
        if len(ranking_index[key]) < width:
            ranking_index[key].append((str(taxon_id), float(score)))
    result = []
    for unit, date_text in zip(dataset["resolvedUnits"], dataset["dates"], strict=True):
        week = season_week(date_text)
        ranking = ranking_index.get((unit, week)) or ranking_index.get(("province:zhejiang", week)) or []
        result.append(ranking[:width])
    return result


def hybrid_recall_delta(
    actual_taxa: list[set[str]], rankings: list[list[tuple[str, float]]], taxon_id: str,
    replacement: np.ndarray, sample_weight: np.ndarray, k: int = 20
) -> float:
    champion_values: list[float] = []
    hybrid_values: list[float] = []
    weights: list[float] = []
    for index, (actual, ranking) in enumerate(zip(actual_taxa, rankings, strict=True)):
        if not actual:
            continue
        if len(ranking) < min(k, 21):
            return math.nan
        champion = [identifier for identifier, _score in ranking[:k]]
        competitors = [(identifier, score) for identifier, score in ranking if identifier != taxon_id][:k]
        hybrid = sorted(
            [*competitors, (taxon_id, float(replacement[index]))],
            key=lambda item: (-item[1], item[0]),
        )[:k]
        champion_values.append(len(actual.intersection(champion)) / len(actual))
        hybrid_values.append(len(actual.intersection(identifier for identifier, _score in hybrid)) / len(actual))
        weights.append(float(sample_weight[index]))
    if not weights or sum(weights) <= 0:
        return math.nan
    return float(np.average(np.asarray(hybrid_values) - np.asarray(champion_values), weights=np.asarray(weights)))


def make_folds(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    years = dataset["years"]
    folds: list[dict[str, Any]] = []
    unique_years = sorted(int(value) for value in np.unique(years))
    for validation_year in unique_years[-3:]:
        train = years < validation_year
        validation = years == validation_year
        if train.any() and validation.any():
            folds.append({"name": f"time_{validation_year}", "kind": "time", "train": train, "validation": validation})

    r6 = np.asarray([item["r6"] for item in dataset["geo"]], dtype=object)
    held_cells = {str(cell) for cell in np.unique(r6) if stable_bucket(str(cell)) == 0}
    neighbors = neighboring_cells(held_cells)
    excluded_train = set(held_cells)
    for values in neighbors.values():
        excluded_train.update(values)
    spatial_validation = np.asarray([cell in held_cells for cell in r6], dtype=bool)
    spatial_train = np.asarray([cell not in excluded_train for cell in r6], dtype=bool)
    if spatial_train.any() and spatial_validation.any():
        folds.append({"name": "spatial_h3_r6", "kind": "spatial", "train": spatial_train, "validation": spatial_validation})

    observer_holdout = np.asarray([stable_bucket(str(value)) == 0 for value in dataset["observerGroups"]], dtype=bool)
    if observer_holdout.any() and (~observer_holdout).any():
        folds.append({"name": "observer_group", "kind": "observer", "train": ~observer_holdout, "validation": observer_holdout})
    return folds


def new_classifier(random_state: int) -> HistGradientBoostingClassifier:
    return HistGradientBoostingClassifier(
        learning_rate=0.05,
        max_iter=180,
        max_leaf_nodes=31,
        min_samples_leaf=20,
        l2_regularization=1.0,
        early_stopping=False,
        random_state=random_state,
    )


def train_and_evaluate(dataset: dict[str, Any], champion: np.ndarray, thresholds: GateThresholds):
    folds = make_folds(dataset)
    fold_reports: list[dict[str, Any]] = []
    metrics_by_taxon: dict[str, list[dict[str, Any]]] = {taxon: [] for taxon in dataset["taxonIds"]}
    topk_deltas: dict[str, dict[str, float]] = {taxon: {} for taxon in dataset["taxonIds"]}
    for fold_index, fold in enumerate(folds):
        train_mask, validation_mask = fold["train"], fold["validation"]
        validation_labels = dataset["labels"][validation_mask]
        training_weights = dataset["weights"][train_mask]
        validation_weights = dataset["weights"][validation_mask]
        validation_rankings = [
            dataset["championRankings"][index]
            for index in np.flatnonzero(validation_mask)
        ]
        validation_actual = [dataset["actualTaxa"][index] for index in np.flatnonzero(validation_mask)]
        valid_taxa = np.zeros(len(dataset["taxonIds"]), dtype=bool)
        for taxon_index, taxon_id in enumerate(dataset["taxonIds"]):
            y_train = dataset["labels"][train_mask, taxon_index]
            y_validation = validation_labels[:, taxon_index]
            if np.unique(y_train).size < 2 or np.unique(y_validation).size < 2:
                metrics_by_taxon[taxon_id].append({"fold": fold["name"], "kind": fold["kind"], "valid": False})
                continue
            train_groups = dataset["independentGroups"][train_mask]
            validation_groups = dataset["independentGroups"][validation_mask]
            support = {
                "trainingIndependentPositives": len(set(train_groups[y_train == 1])),
                "validationIndependentPositives": len(set(validation_groups[y_validation == 1])),
                "trainingIndependentNegatives": len(set(train_groups[y_train == 0])),
                "validationIndependentNegatives": len(set(validation_groups[y_validation == 0])),
            }
            model = new_classifier(fold_index * 1000 + taxon_index)
            model.fit(dataset["features"][train_mask], y_train, sample_weight=training_weights)
            probability = model.predict_proba(dataset["features"][validation_mask])[:, 1]
            if not np.isfinite(probability).all():
                metrics_by_taxon[taxon_id].append({
                    "fold": fold["name"], "kind": fold["kind"], "valid": False,
                    **support, "failure": "non_finite_probability",
                })
                continue
            valid_taxa[taxon_index] = True
            champion_probability = champion[validation_mask, taxon_index]
            champion_brier = brier_score(y_validation, champion_probability, validation_weights)
            challenger_brier = brier_score(y_validation, probability, validation_weights)
            topk_delta = hybrid_recall_delta(
                validation_actual, validation_rankings, taxon_id, probability, validation_weights
            )
            topk_deltas[taxon_id][fold["name"]] = topk_delta
            metrics_by_taxon[taxon_id].append({
                "fold": fold["name"],
                "kind": fold["kind"],
                "valid": True,
                "validationRows": int(validation_mask.sum()),
                "validationPositives": int(y_validation.sum()),
                **support,
                "championBrier": champion_brier,
                "challengerBrier": challenger_brier,
                "brierImprovement": (champion_brier - challenger_brier) / max(champion_brier, 1e-12),
                "championEce": expected_calibration_error(y_validation, champion_probability, sample_weight=validation_weights),
                "challengerEce": expected_calibration_error(y_validation, probability, sample_weight=validation_weights),
                "recallAt20Delta": topk_delta,
            })
        valid_deltas = [
            topk_deltas[taxon_id].get(fold["name"])
            for taxon_id in dataset["taxonIds"] if valid_taxa[dataset["taxonIds"].index(taxon_id)]
        ]
        valid_deltas = [value for value in valid_deltas if math.isfinite(float(value))]
        fold_reports.append({
            "fold": fold["name"],
            "kind": fold["kind"],
            "trainRows": int(train_mask.sum()),
            "validationRows": int(validation_mask.sum()),
            "validTaxa": int(valid_taxa.sum()),
            "minimumPerTaxonRecallAt20Delta": min(valid_deltas) if valid_deltas else None,
        })

    decisions = {
        taxon: evaluate_replacement(metrics, topk_deltas[taxon], thresholds)
        for taxon, metrics in metrics_by_taxon.items()
    }
    return folds, fold_reports, metrics_by_taxon, topk_deltas, decisions


def run(options: argparse.Namespace) -> dict[str, Any]:
    thresholds = validate_options(options)
    snapshot_path = Path(options.snapshot).resolve()
    artifact_path = Path(options.champion).resolve()
    output_path = Path(options.output).resolve()
    report_path = Path(options.report).resolve()
    if any(path.exists() for path in [
        output_path, report_path, Path(f"{output_path}.sha256"), Path(f"{report_path}.sha256")
    ]):
        raise ChallengerError("OUTPUT_EXISTS", "输出模型或报告已存在，拒绝覆盖。")
    snapshot_sha256 = verify_sha256_sidecar(snapshot_path)
    champion_sha256 = verify_sha256_sidecar(artifact_path)
    with closing(sqlite3.connect(f"file:{snapshot_path.as_posix()}?mode=ro", uri=True)) as snapshot, closing(sqlite3.connect(
        f"file:{artifact_path.as_posix()}?mode=ro", uri=True
    )) as artifact:
        snapshot.execute("PRAGMA query_only=ON")
        artifact.execute("PRAGMA query_only=ON")
        snapshot_manifest = assert_snapshot(snapshot, snapshot_path, snapshot_sha256)
        manifest = assert_champion(artifact, snapshot_sha256, champion_sha256)
        snapshot_contract = str(snapshot_manifest.get("trainingDataContract") or "").strip()
        champion_contract = str(manifest.get("training_data_contract") or "").strip()
        if not snapshot_contract or not champion_contract or snapshot_contract != champion_contract:
            raise ChallengerError(
                "ARTIFACT_MISMATCH",
                "训练快照与 champion 的 training data contract 不一致或缺失。",
            )
        candidate_taxa, full_taxon_count = load_candidate_taxa(
            artifact, options.minimum_positives, options.max_taxa
        )
        decisions = {
            taxon_id: {
                "approved": False,
                "failures": [CHAMPION_BASELINE_NOT_OOF],
            }
            for taxon_id in candidate_taxa
        }
        approved: list[str] = []
        models: dict[str, Any] = {}
        report = {
            "schemaVersion": 2,
            "reportType": "gbdt_challenger_fail_closed_audit",
            "championModelVersion": manifest.get("model_version"),
            "championSha256": champion_sha256,
            "sourceSnapshotSha256": snapshot_sha256,
            "trainingDataContract": champion_contract,
            "candidateTaxa": candidate_taxa,
            "fullOnlineTaxonCount": full_taxon_count,
            "approvedTaxa": approved,
            "formalEvaluationEligible": False,
            "evaluationStatus": CHAMPION_BASELINE_NOT_OOF,
            "thresholds": thresholds.__dict__,
            "folds": [],
            "metricsByTaxon": {taxon_id: [] for taxon_id in candidate_taxa},
            "topKDeltaByTaxonAndFold": {taxon_id: {} for taxon_id in candidate_taxa},
            "decisions": decisions,
            "championBaseline": {
                "sameFoldOutOfFold": False,
                "failure": CHAMPION_BASELINE_NOT_OOF,
                "note": "发布制品只含全量拟合后的聚合预测，不能伪装成同折 OOF champion 基线。",
            },
            "preprocessing": {
                "materialized": False,
                "featureNames": [],
                "localHistoryYears": LOCAL_HISTORY_YEARS,
                "recencyHalfLifeYears": RECENCY_HALF_LIFE_YEARS,
                "sampleWeightSource": None,
                "note": "公共 champion 不含逐报告训练表；当前版本不从聚合发布制品反推训练样本。",
            },
        }
        report_bytes = (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        report_sha256 = hashlib.sha256(report_bytes).hexdigest()
        bundle = {
            "schemaVersion": 2,
            "createdAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "championModelVersion": manifest.get("model_version"),
            "championSha256": champion_sha256,
            "sourceSnapshotSha256": snapshot_sha256,
            "evaluationReportSha256": report_sha256,
            "formalEvaluationEligible": False,
            "evaluationStatus": CHAMPION_BASELINE_NOT_OOF,
            "featureNames": [],
            "preprocessing": report["preprocessing"],
            "approvedTaxa": approved,
            "models": models,
        }
        output_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(bundle, output_path)
        report_path.write_bytes(report_bytes)
        output_sha256 = sha256_file(output_path)
        Path(f"{output_path}.sha256").write_text(f"{output_sha256}  {output_path.name}\n", encoding="utf-8")
        Path(f"{report_path}.sha256").write_text(f"{report_sha256}  {report_path.name}\n", encoding="utf-8")
        return {
            "output": str(output_path),
            "report": str(report_path),
            "approvedTaxa": approved,
            "folds": 0,
            "evaluationStatus": CHAMPION_BASELINE_NOT_OOF,
        }


def parser() -> argparse.ArgumentParser:
    value = argparse.ArgumentParser(description="校验并审计浙江鸟种 GBDT challenger（离线、fail-closed）")
    value.add_argument("--snapshot", required=True, help="带 SHA-256 和稳定性 manifest 的只读训练快照")
    value.add_argument("--champion", required=True, help="已清理私有训练表的公共贝叶斯 SQLite 制品")
    value.add_argument("--output", required=True, help="fail-closed challenger 审计 joblib 输出")
    value.add_argument("--report", required=True, help="fail-closed challenger 审计 JSON")
    value.add_argument("--minimum-positives", type=int, default=200)
    value.add_argument("--max-taxa", type=int, default=50)
    value.add_argument("--minimum-brier-improvement", type=float, default=0.03)
    value.add_argument("--maximum-ece-regression", type=float, default=0.01)
    value.add_argument("--minimum-topk-delta", type=float, default=0.0)
    return value


def main() -> int:
    try:
        result = run(parser().parse_args())
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except ChallengerError as error:
        print(json.dumps({"code": error.code, "message": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
