"use strict";

const { Worker, isMainThread, parentPort } = require("node:worker_threads");

const ADMIN_CAP_TASK_WIDTH = 10;
const DEFAULT_ADMIN_CAP_CHUNK_RECORDS = 4096;

function cappedEvidence(exposure, detections, cap) {
  if (exposure <= 0) return [0, 0];
  if (cap === null || exposure <= cap) return [exposure, detections];
  if (cap === 0) return [0, 0];
  return [cap, (detections / exposure) * cap];
}

function applyChild(alpha, beta, exposure, detections, strength, cap) {
  const [effectiveExposure, effectiveDetections] = cappedEvidence(exposure, detections, cap);
  if (effectiveExposure <= 0) return [alpha, beta];
  const parentProbability = alpha / (alpha + beta);
  return [
    parentProbability * strength + effectiveDetections,
    (1 - parentProbability) * strength + Math.max(0, effectiveExposure - effectiveDetections)
  ];
}

function scoreAdminCapChunk(values, candidates) {
  if (!(values instanceof Float64Array) || values.length % ADMIN_CAP_TASK_WIDTH !== 0) {
    throw new Error("invalid admin-cap task buffer");
  }
  const modelLosses = new Float64Array(candidates.length);
  let baselineLoss = 0;
  let evaluatedWeight = 0;
  for (let offset = 0; offset < values.length; offset += ADMIN_CAP_TASK_WIDTH) {
    const actualPositive = values[offset];
    const total = values[offset + 1];
    const provinceExposure = values[offset + 2];
    const provinceDetections = values[offset + 3];
    const cityExposure = values[offset + 4];
    const cityDetections = values[offset + 5];
    const cityStrength = values[offset + 6];
    const districtExposure = values[offset + 7];
    const districtDetections = values[offset + 8];
    const districtStrength = values[offset + 9];
    let provinceAlpha = 1;
    let provinceBeta = 1;
    if (provinceExposure > 0) {
      provinceAlpha += provinceDetections;
      provinceBeta += Math.max(0, provinceExposure - provinceDetections);
    }
    const baselineProbability = provinceAlpha / (provinceAlpha + provinceBeta);
    baselineLoss +=
      actualPositive * (1 - baselineProbability) ** 2 +
      (total - actualPositive) * baselineProbability ** 2;
    evaluatedWeight += total;
    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
      const candidate = candidates[candidateIndex];
      let alpha = provinceAlpha;
      let beta = provinceBeta;
      [alpha, beta] = applyChild(
        alpha,
        beta,
        cityExposure,
        cityDetections,
        cityStrength,
        candidate.caps.city
      );
      [alpha, beta] = applyChild(
        alpha,
        beta,
        districtExposure,
        districtDetections,
        districtStrength,
        candidate.caps.district
      );
      const probability = alpha / (alpha + beta);
      modelLosses[candidateIndex] +=
        actualPositive * (1 - probability) ** 2 +
        (total - actualPositive) * probability ** 2;
    }
  }
  return { modelLosses: [...modelLosses], baselineLoss, evaluatedWeight };
}

if (!isMainThread) {
  parentPort.on("message", (message) => {
    try {
      const values = new Float64Array(message.buffer);
      parentPort.postMessage({
        jobId: message.jobId,
        ok: true,
        result: scoreAdminCapChunk(values, message.candidates)
      });
    } catch (error) {
      parentPort.postMessage({
        jobId: message.jobId,
        ok: false,
        error: { message: error.message, stack: error.stack }
      });
    }
  });
}

function buildJobs(tasksByPrevalence, chunkRecords) {
  const jobs = [];
  for (const [group, values] of [...tasksByPrevalence].sort(([left], [right]) => left.localeCompare(right))) {
    const recordCount = values.length / ADMIN_CAP_TASK_WIDTH;
    for (let startRecord = 0; startRecord < recordCount; startRecord += chunkRecords) {
      jobs.push({
        jobId: jobs.length,
        group,
        values,
        start: startRecord * ADMIN_CAP_TASK_WIDTH,
        end: Math.min(recordCount, startRecord + chunkRecords) * ADMIN_CAP_TASK_WIDTH
      });
    }
  }
  return jobs;
}

async function scoreAdminCapTasks({
  tasksByPrevalence,
  candidates,
  workers = 1,
  chunkRecords = DEFAULT_ADMIN_CAP_CHUNK_RECORDS
}) {
  const jobs = buildJobs(tasksByPrevalence, chunkRecords);
  if (!jobs.length) return null;
  const workerCount = Math.max(1, Math.min(Number(workers) || 1, jobs.length));
  const results = Array(jobs.length);
  let nextJobIndex = 0;
  let completedJobs = 0;
  let settled = false;
  const activeWorkers = [];

  await new Promise((resolve, reject) => {
    const fail = async (error) => {
      if (settled) return;
      settled = true;
      await Promise.allSettled(activeWorkers.map((worker) => worker.terminate()));
      reject(error);
    };
    const dispatch = (worker) => {
      if (settled) return;
      if (nextJobIndex >= jobs.length) {
        if (completedJobs === jobs.length) {
          settled = true;
          Promise.allSettled(activeWorkers.map((item) => item.terminate())).then(resolve, reject);
        }
        return;
      }
      const job = jobs[nextJobIndex++];
      const values = Float64Array.from(job.values.slice(job.start, job.end));
      worker.postMessage(
        { jobId: job.jobId, candidates, buffer: values.buffer },
        [values.buffer]
      );
    };
    for (let index = 0; index < workerCount; index += 1) {
      const worker = new Worker(__filename);
      activeWorkers.push(worker);
      worker.on("message", (message) => {
        if (settled) return;
        if (!message.ok) {
          fail(new Error(message.error?.message || "admin-cap worker failed"));
          return;
        }
        results[message.jobId] = message.result;
        completedJobs += 1;
        dispatch(worker);
      });
      worker.on("error", fail);
      worker.on("exit", (code) => {
        if (!settled && code !== 0) fail(new Error(`admin-cap worker exited with code ${code}`));
      });
      dispatch(worker);
    }
  });

  const totals = new Map();
  for (const job of jobs) {
    const result = results[job.jobId];
    if (!totals.has(job.group)) {
      totals.set(job.group, {
        modelLosses: new Float64Array(candidates.length),
        baselineLoss: 0,
        evaluatedWeight: 0,
        chunkCount: 0
      });
    }
    const total = totals.get(job.group);
    for (let index = 0; index < candidates.length; index += 1) {
      total.modelLosses[index] += result.modelLosses[index];
    }
    total.baselineLoss += result.baselineLoss;
    total.evaluatedWeight += result.evaluatedWeight;
    total.chunkCount += 1;
  }
  return {
    objective: "development_oof_raw_brier_by_prevalence",
    sqlAggregationPolicy: "one_sql_aggregation_per_fold_then_all_candidates_scored_in_worker_threads",
    deterministicReductionPolicy: "fixed_record_chunks_merged_by_job_id",
    candidateCount: candidates.length,
    workerCount,
    chunkRecords,
    taskCount: jobs.reduce((sum, job) => sum + (job.end - job.start) / ADMIN_CAP_TASK_WIDTH, 0),
    byPrevalence: Object.fromEntries(
      [...totals].map(([group, total]) => [
        group,
        candidates
          .map((candidate, index) => ({
            id: candidate.id,
            caps: candidate.caps,
            modelLoss: total.modelLosses[index],
            baselineLoss: total.baselineLoss,
            evaluatedWeight: total.evaluatedWeight,
            brier: total.evaluatedWeight > 0 ? total.modelLosses[index] / total.evaluatedWeight : null,
            baselineBrier: total.evaluatedWeight > 0 ? total.baselineLoss / total.evaluatedWeight : null
          }))
          .sort((left, right) => left.brier - right.brier || left.id.localeCompare(right.id))
      ])
    )
  };
}

module.exports = {
  ADMIN_CAP_TASK_WIDTH,
  DEFAULT_ADMIN_CAP_CHUNK_RECORDS,
  scoreAdminCapChunk,
  scoreAdminCapTasks
};
