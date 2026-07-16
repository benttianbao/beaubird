"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { buildAdminExposureCapCandidates } = require("../server/prediction/spatial-transfer");
const {
  ADMIN_CAP_TASK_WIDTH,
  scoreAdminCapChunk,
  scoreAdminCapTasks
} = require("../server/prediction/spatial-transfer-worker");

function syntheticTasks(recordCount = 137) {
  const groups = new Map([
    ["group_30_79", []],
    ["species_200_plus", []]
  ]);
  for (const [groupIndex, values] of [...groups.values()].entries()) {
    for (let index = 0; index < recordCount; index += 1) {
      const total = 1 + (index % 3) * 0.25;
      const actual = index % (5 + groupIndex) === 0 ? Math.min(1, total) : 0;
      const provinceExposure = 20 + (index % 17);
      const provinceDetections = provinceExposure * (0.03 + (index % 7) * 0.01);
      const cityExposure = 50 + (index % 31) * 7;
      const cityDetections = cityExposure * (0.02 + (index % 11) * 0.015);
      const districtExposure = 10 + (index % 19) * 9;
      const districtDetections = districtExposure * (0.01 + (index % 9) * 0.02);
      values.push(
        actual,
        total,
        provinceExposure,
        provinceDetections,
        cityExposure,
        cityDetections,
        20 + groupIndex * 5,
        districtExposure,
        districtDetections,
        12 + groupIndex * 3
      );
    }
  }
  return groups;
}

test("worker 单块评分保持任务宽度并产生有限损失", () => {
  const candidates = buildAdminExposureCapCandidates();
  const values = Float64Array.from(syntheticTasks(3).get("group_30_79"));
  assert.equal(values.length, 3 * ADMIN_CAP_TASK_WIDTH);
  const result = scoreAdminCapChunk(values, candidates);
  assert.equal(result.modelLosses.length, 25);
  assert.equal(result.evaluatedWeight, 3.75);
  assert.ok(result.modelLosses.every(Number.isFinite));
  assert.ok(Number.isFinite(result.baselineLoss));
});

test("workers=1、2、4 使用固定分块与合并顺序并得到完全相同结果", async () => {
  const candidates = buildAdminExposureCapCandidates();
  const tasksByPrevalence = syntheticTasks();
  const options = { tasksByPrevalence, candidates, chunkRecords: 17 };
  const single = await scoreAdminCapTasks({ ...options, workers: 1 });
  const dual = await scoreAdminCapTasks({ ...options, workers: 2 });
  const quad = await scoreAdminCapTasks({ ...options, workers: 4 });
  assert.deepEqual(dual.byPrevalence, single.byPrevalence);
  assert.deepEqual(quad.byPrevalence, single.byPrevalence);
  assert.equal(single.taskCount, 274);
  assert.equal(single.deterministicReductionPolicy, "fixed_record_chunks_merged_by_job_id");
  assert.equal(single.workerCount, 1);
  assert.equal(dual.workerCount, 2);
  assert.equal(quad.workerCount, 4);
});
