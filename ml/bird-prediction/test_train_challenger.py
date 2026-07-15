import argparse
import hashlib
import json
import math
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

import joblib
import numpy as np

from train_challenger import (
    CHAMPION_BASELINE_NOT_OOF,
    GateThresholds,
    assert_champion,
    assert_snapshot,
    brier_score,
    evaluate_replacement,
    expected_calibration_error,
    hybrid_recall_delta,
    load_candidate_taxa,
    recall_at_k,
    run,
    validate_options,
    verify_sha256_sidecar,
)


TRAINING_DATA_CONTRACT = "beaubird-unified-quality-filter-v2"


def write_sha256_sidecar(path: Path) -> str:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    Path(f"{path}.sha256").write_text(f"{digest}  {path.name}\n", encoding="utf-8")
    return digest


def make_snapshot(root: Path, name: str = "snapshot.sqlite", unstable: bool = False):
    path = root / name
    connection = sqlite3.connect(path)
    connection.executescript(
        """
        CREATE TABLE reports(report_id TEXT PRIMARY KEY);
        CREATE TABLE observations(report_id TEXT,taxon_id TEXT);
        CREATE TABLE crawl_meta(run_id TEXT,status TEXT,started_at TEXT,completed_at TEXT);
        INSERT INTO reports VALUES ('report-1');
        INSERT INTO observations VALUES ('report-1','bird-00');
        INSERT INTO crawl_meta VALUES ('copied-running-run','running','2026-07-15T00:00:00Z',NULL);
        """
    )
    connection.close()
    digest = write_sha256_sidecar(path)
    manifest = {
        "schemaVersion": 1,
        "trainingDataContract": TRAINING_DATA_CONTRACT,
        "sourceChangedDuringSnapshot": unstable,
        "sourceDataVersionAtStart": 1,
        "sourceDataVersionAtEnd": 2 if unstable else 1,
        "sourceFingerprintAtStart": "stable-source-fingerprint",
        "sourceFingerprintAtEnd": "changed-source-fingerprint" if unstable else "stable-source-fingerprint",
        "snapshotCounts": {"reports": 1, "observations": 1, "taxa": 1},
        "sha256": digest,
    }
    Path(f"{path}.manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False), encoding="utf-8"
    )
    return path, digest


def make_champion(
    root: Path,
    snapshot_sha256: str,
    name: str = "champion.sqlite",
    include_private_tables: bool = False,
):
    path = root / name
    connection = sqlite3.connect(path)
    connection.executescript(
        """
        CREATE TABLE manifest(key TEXT PRIMARY KEY,value TEXT);
        CREATE TABLE taxa(
          taxon_id TEXT PRIMARY KEY,
          positive_count INTEGER,
          is_sensitive INTEGER,
          vagrant_candidate INTEGER
        );
        CREATE TABLE space_units(id TEXT PRIMARY KEY);
        CREATE TABLE location_lookup(lookup_type TEXT,lookup_key TEXT,space_unit_id TEXT);
        CREATE TABLE location_predictions(
          space_unit_id TEXT,season_bucket INTEGER,taxon_id TEXT,
          probability REAL,ranking_score REAL,temporal_granularity TEXT
        );
        """
    )
    if include_private_tables:
        connection.executescript(
            """
            CREATE TABLE training_reports(report_id TEXT);
            CREATE TABLE training_detections(report_id TEXT,taxon_id TEXT);
            """
        )
    manifests = {
        "schema_version": "2",
        "model_version": "fixture-champion",
        "source_snapshot_sha256": snapshot_sha256,
        "training_data_contract": TRAINING_DATA_CONTRACT,
        "data_cutoff_date": "2026-07-15",
        "quality_gate": {"passed": True},
        "test_only": False,
    }
    connection.executemany(
        "INSERT INTO manifest VALUES (?,?)",
        [(key, json.dumps(value, ensure_ascii=False)) for key, value in manifests.items()],
    )
    connection.executemany(
        "INSERT INTO taxa VALUES (?,?,0,0)",
        [(f"bird-{index:02d}", 250 if index == 0 else 1) for index in range(21)],
    )
    connection.execute("INSERT INTO taxa VALUES ('vagrant-00',500,0,1)")
    connection.commit()
    connection.close()
    return path, write_sha256_sidecar(path)


class ChallengerGateTests(unittest.TestCase):
    def test_metrics_are_finite_and_top_k_uses_checklist_recall(self):
        labels = np.asarray([0, 0, 1, 1], dtype=float)
        probability = np.asarray([0.05, 0.2, 0.8, 0.95], dtype=float)
        self.assertLess(brier_score(labels, probability), 0.05)
        self.assertTrue(math.isfinite(expected_calibration_error(labels, probability)))
        matrix_labels = np.asarray([[1, 0, 1], [0, 1, 0]], dtype=np.uint8)
        matrix_probability = np.asarray([[0.9, 0.1, 0.8], [0.2, 0.7, 0.1]])
        self.assertEqual(recall_at_k(matrix_labels, matrix_probability, 2), 1.0)

    def test_replacement_requires_two_time_spatial_observer_and_all_metric_gates(self):
        good = {
            "valid": True,
            "brierImprovement": 0.04,
            "championEce": 0.04,
            "challengerEce": 0.045,
            "trainingIndependentPositives": 50,
            "validationIndependentPositives": 15,
            "trainingIndependentNegatives": 100,
            "validationIndependentNegatives": 30,
        }
        metrics = [
            {**good, "fold": "time_2024", "kind": "time"},
            {**good, "fold": "time_2025", "kind": "time"},
            {**good, "fold": "spatial_h3_r6", "kind": "spatial"},
            {**good, "fold": "observer_group", "kind": "observer"},
        ]
        topk = {row["fold"]: 0.0 for row in metrics}
        decision = evaluate_replacement(metrics, topk, GateThresholds())
        self.assertTrue(decision["approved"])
        metrics[0] = {**metrics[0], "brierImprovement": 0.029}
        decision = evaluate_replacement(metrics, topk, GateThresholds())
        self.assertFalse(decision["approved"])
        self.assertIn("time_2024.brier", decision["failures"])

    def test_non_finite_metrics_and_relaxed_cli_thresholds_fail_closed(self):
        row = {
            "valid": True,
            "fold": "time_2024",
            "kind": "time",
            "brierImprovement": math.nan,
            "championEce": 0.01,
            "challengerEce": 0.01,
            "trainingIndependentPositives": 50,
            "validationIndependentPositives": 15,
            "trainingIndependentNegatives": 100,
            "validationIndependentNegatives": 30,
        }
        decision = evaluate_replacement([row], {"time_2024": 0.0}, GateThresholds(minimum_time_folds=1))
        self.assertFalse(decision["approved"])
        self.assertIn("time_2024.non_finite", decision["failures"])

        unsafe = argparse.Namespace(
            minimum_brier_improvement=0.02,
            maximum_ece_regression=0.01,
            minimum_topk_delta=0.0,
            minimum_positives=200,
            max_taxa=50,
        )
        with self.assertRaisesRegex(Exception, "3%"):
            validate_options(unsafe)
        unsafe.minimum_brier_improvement = math.nan
        with self.assertRaisesRegex(Exception, "有限"):
            validate_options(unsafe)

    def test_top20_is_computed_per_taxon_against_full_champion_ranking(self):
        ranking = [[(f"bird-{index:02d}", 1 - index / 100) for index in range(21)]]
        delta = hybrid_recall_delta(
            [{"target"}], ranking, "target", np.asarray([0.999]), np.asarray([1.0])
        )
        self.assertEqual(delta, 1.0)

    def test_snapshot_uses_hash_and_stability_sidecar_not_copied_running_state(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            snapshot_path, snapshot_sha = make_snapshot(root)
            self.assertEqual(verify_sha256_sidecar(snapshot_path), snapshot_sha)
            with closing(sqlite3.connect(
                f"file:{snapshot_path.as_posix()}?mode=ro", uri=True
            )) as connection:
                manifest = assert_snapshot(connection, snapshot_path, snapshot_sha)
            self.assertFalse(manifest["sourceChangedDuringSnapshot"])

            unstable_path, unstable_sha = make_snapshot(root, "unstable.sqlite", unstable=True)
            with closing(sqlite3.connect(
                f"file:{unstable_path.as_posix()}?mode=ro", uri=True
            )) as connection:
                with self.assertRaisesRegex(Exception, "稳定"):
                    assert_snapshot(connection, unstable_path, unstable_sha)

    def test_public_champion_must_be_sanitized_and_vagrants_are_excluded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _snapshot_path, snapshot_sha = make_snapshot(root)
            champion_path, champion_sha = make_champion(root, snapshot_sha)
            with closing(sqlite3.connect(
                f"file:{champion_path.as_posix()}?mode=ro", uri=True
            )) as connection:
                assert_champion(connection, snapshot_sha, champion_sha)
                candidates, total = load_candidate_taxa(connection, 200, 50)
            self.assertEqual(candidates, ["bird-00"])
            self.assertEqual(total, 22)

            private_path, private_sha = make_champion(
                root, snapshot_sha, "private-champion.sqlite", include_private_tables=True
            )
            with closing(sqlite3.connect(
                f"file:{private_path.as_posix()}?mode=ro", uri=True
            )) as connection:
                with self.assertRaisesRegex(Exception, "私有训练表"):
                    assert_champion(connection, snapshot_sha, private_sha)

    def test_end_to_end_audit_has_no_approval_without_same_fold_oof_champion(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            snapshot_path, snapshot_sha = make_snapshot(root)
            champion_path, champion_sha = make_champion(root, snapshot_sha)
            output_path = root / "challenger.joblib"
            report_path = root / "challenger.json"
            result = run(
                argparse.Namespace(
                    snapshot=str(snapshot_path),
                    champion=str(champion_path),
                    output=str(output_path),
                    report=str(report_path),
                    minimum_positives=200,
                    max_taxa=50,
                    minimum_brier_improvement=0.03,
                    maximum_ece_regression=0.01,
                    minimum_topk_delta=0.0,
                )
            )
            self.assertEqual(result["folds"], 0)
            self.assertEqual(result["approvedTaxa"], [])
            self.assertEqual(result["evaluationStatus"], CHAMPION_BASELINE_NOT_OOF)

            report = json.loads(report_path.read_text(encoding="utf-8"))
            self.assertEqual(report["sourceSnapshotSha256"], snapshot_sha)
            self.assertEqual(report["championSha256"], champion_sha)
            self.assertEqual(report["candidateTaxa"], ["bird-00"])
            self.assertNotIn("vagrant-00", report["candidateTaxa"])
            self.assertFalse(report["formalEvaluationEligible"])
            self.assertEqual(
                report["decisions"]["bird-00"]["failures"],
                [CHAMPION_BASELINE_NOT_OOF],
            )

            bundle = joblib.load(output_path)
            self.assertEqual(bundle["approvedTaxa"], [])
            self.assertEqual(bundle["models"], {})
            self.assertFalse(bundle["formalEvaluationEligible"])
            self.assertEqual(bundle["sourceSnapshotSha256"], snapshot_sha)
            self.assertEqual(bundle["championSha256"], champion_sha)
            self.assertEqual(
                bundle["evaluationReportSha256"],
                hashlib.sha256(report_path.read_bytes()).hexdigest(),
            )
            self.assertEqual(verify_sha256_sidecar(output_path), hashlib.sha256(output_path.read_bytes()).hexdigest())
            self.assertEqual(verify_sha256_sidecar(report_path), hashlib.sha256(report_path.read_bytes()).hexdigest())


if __name__ == "__main__":
    unittest.main()
