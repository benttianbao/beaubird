"use strict";

const { join, resolve } = require("node:path");

const { createOfflinePredictionServer } = require("./app");
const { DEFAULT_MODEL_FILE } = require("./model-catalog");

function getListenOptions() {
  return {
    host: process.env.BEAUBIRD_OFFLINE_PREDICTION_HOST || "127.0.0.1",
    port: Number(process.env.BEAUBIRD_OFFLINE_PREDICTION_PORT || 3210)
  };
}

function main() {
  const projectRoot = resolve(__dirname, "..", "..");
  const { host, port } = getListenOptions();
  const server = createOfflinePredictionServer({
    projectRoot,
    modelDirectory: process.env.BEAUBIRD_OFFLINE_MODEL_DIRECTORY || join(projectRoot, "data", "prediction-models"),
    preferredModel: process.env.BEAUBIRD_OFFLINE_DEFAULT_MODEL || DEFAULT_MODEL_FILE
  });
  server.listen(port, host, () => {
    console.log(`浙江鸟种离线预测已启动：http://${host}:${port}`);
    console.log("关闭这个窗口即可停止离线预测。");
  });
}

if (require.main === module) main();

module.exports = { getListenOptions, main };
