# GBDT challenger（离线、当前安全关闭替换）

`train_challenger.py` 当前用于校验训练快照与公共 Bayesian champion 的绑定关系，并生成 fail-closed 审计报告。它不会改变 Node 线上预测，也不会批准任何鸟种替换。

公共 champion 必须是已发布并完成清理的 SQLite：其中不得存在 `training_reports`、`training_detections`、`occurrence_events` 等逐报告私有训练表。challenger 不会要求恢复这些表，也不会从聚合发布制品反推逐报告样本。

训练快照必须同时具有：

- `<snapshot>.sha256`，绑定快照文件的实际 SHA-256；
- `<snapshot>.manifest.json`，其中 `sourceChangedDuringSnapshot=false`，复制前后源指纹和 SQLite `data_version` 一致，且报告和观测数量与快照一致。

快照中复制进来的历史 `crawl_meta.status=running` 不表示快照文件仍在写入，因此不会据此拒绝快照。快照和 champion 均以 SQLite 只读 URI 加 `query_only` 打开。

运行示例：

```powershell
python ml/bird-prediction/train_challenger.py `
  --snapshot data/prediction-snapshots/zhejiang-YYYYMMDD.sqlite `
  --champion data/prediction-models/zhejiang-YYYYMMDD.sqlite `
  --output data/prediction-models/challenger-audit-YYYYMMDD.joblib `
  --report data/prediction-models/challenger-audit-YYYYMMDD.json
```

当前版本只从公共 `taxa` 目录列出独立正例不少于 200 的候选，并排除 `vagrant_candidate=1` 的“偶发/追鸟聚集候选”。由于公共 champion 的 `location_predictions` 是全量拟合结果，并非与 challenger 时间、空间、观察者留出折严格一致的 OOF 基线，不能用于正式替换比较。

因此输出固定满足：

- `formalEvaluationEligible=false`；
- `approvedTaxa=[]`；
- 每个候选的失败原因包含 `champion_baseline_not_oof`；
- joblib 中 `models={}`，不能作为线上模型加载。

这不是伪造 OOF。后续只有在只读训练快照上用共享训练契约生成同折 Bayesian OOF 概率和 Top-20 排名后，才能启用 GBDT 训练及 3% Brier、ECE、Top-K 替换门槛。公共制品的私有表清理策略不应为此放宽。

依赖：

```powershell
python -m pip install -r ml/bird-prediction/requirements.txt
```

测试：

```powershell
python -m unittest discover -s ml/bird-prediction -p "test_*.py"
```
