"use strict";

const { readdirSync, statSync } = require("node:fs");
const { basename, join, resolve } = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const DEFAULT_MODEL_FILE = "zhejiang-v1-20260715.sqlite";
const REQUIRED_TABLES = Object.freeze(["manifest", "taxa", "space_units", "location_predictions"]);

function parseManifestValue(value) {
  if (value == null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function readManifest(database) {
  const manifest = new Map();
  for (const row of database.prepare("SELECT key, value FROM manifest").iterate()) {
    manifest.set(String(row.key), parseManifestValue(row.value));
  }
  return manifest;
}

function tableNames(database) {
  return new Set(
    database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => String(row.name))
  );
}

function inspectModel(filePath) {
  const database = new DatabaseSync(filePath, { readOnly: true });
  try {
    database.exec("PRAGMA query_only = ON");
    const tables = tableNames(database);
    if (!REQUIRED_TABLES.every((table) => tables.has(table))) return null;
    if (!database.prepare("SELECT 1 AS available FROM location_predictions LIMIT 1").get()) return null;

    const manifest = readManifest(database);
    const qualityGate = manifest.get("quality_gate");
    const qualityPassed = Boolean(qualityGate && typeof qualityGate === "object" && qualityGate.passed === true);
    const internalBuild = Boolean(qualityGate && typeof qualityGate === "object" && qualityGate.internalBuild === true);
    const testOnly = manifest.get("test_only") === true;
    if (internalBuild || testOnly) return null;
    const releaseEligible = qualityPassed && !internalBuild && !testOnly;
    const stats = statSync(filePath);

    return {
      id: basename(filePath),
      filePath,
      modelVersion: String(manifest.get("model_version") || basename(filePath, ".sqlite")),
      builtAt: String(manifest.get("built_at") || ""),
      dataCutoffDate: String(manifest.get("data_cutoff_date") || ""),
      probabilityDefinition: String(manifest.get("probability_definition") || ""),
      schemaVersion: String(manifest.get("schema_version") || ""),
      forwardTopK: Number(manifest.get("forward_top_k")) || 100,
      predictionCount: null,
      hotspotCount: null,
      qualityPassed,
      internalBuild,
      testOnly,
      releaseEligible,
      status: releaseEligible ? "正式可用" : "实验版",
      statusMessage: releaseEligible
        ? "已通过模型内置质量检查"
        : "未通过正式发布条件，仅供本机实验参考",
      sizeBytes: stats.size,
      modifiedAt: stats.mtime.toISOString()
    };
  } finally {
    database.close();
  }
}

function publicModel(model) {
  const { filePath, ...safe } = model;
  return safe;
}

class OfflineModelCatalog {
  constructor(options = {}) {
    this.modelDirectory = resolve(options.modelDirectory);
    this.preferredModel = basename(options.preferredModel || DEFAULT_MODEL_FILE);
    this.models = [];
    this.byId = new Map();
    this.databases = new Map();
    this.refresh();
  }

  refresh() {
    const models = [];
    for (const entry of readdirSync(this.modelDirectory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".sqlite") || entry.name.includes(".building-")) {
        continue;
      }
      try {
        const model = inspectModel(join(this.modelDirectory, entry.name));
        if (model) models.push(model);
      } catch {
        // A partial, locked, or unrelated SQLite file is not a selectable model.
      }
    }
    models.sort((left, right) => {
      if (left.id === this.preferredModel) return -1;
      if (right.id === this.preferredModel) return 1;
      if (left.releaseEligible !== right.releaseEligible) return left.releaseEligible ? -1 : 1;
      return String(right.builtAt || right.modifiedAt).localeCompare(String(left.builtAt || left.modifiedAt));
    });
    this.models = models;
    this.byId = new Map(models.map((model) => [model.id, model]));
    return this.list();
  }

  list() {
    return {
      defaultModelId: this.models[0]?.id || null,
      models: this.models.map(publicModel)
    };
  }

  get(modelId) {
    const id = basename(String(modelId || this.models[0]?.id || ""));
    if (id !== String(modelId || id) || !this.byId.has(id)) {
      const error = new Error("所选模型不存在或不能用于离线预测");
      error.code = "UNKNOWN_MODEL";
      error.statusCode = 404;
      throw error;
    }
    return this.byId.get(id);
  }

  database(modelId) {
    const model = this.get(modelId);
    if (!this.databases.has(model.id)) {
      const database = new DatabaseSync(model.filePath, { readOnly: true });
      database.exec("PRAGMA query_only = ON; PRAGMA busy_timeout = 3000");
      this.databases.set(model.id, database);
    }
    return { model, database: this.databases.get(model.id) };
  }

  close() {
    for (const database of this.databases.values()) {
      try {
        database.close();
      } catch {
        // Best-effort shutdown of read-only handles.
      }
    }
    this.databases.clear();
  }
}

module.exports = {
  DEFAULT_MODEL_FILE,
  OfflineModelCatalog,
  inspectModel,
  parseManifestValue,
  publicModel
};
