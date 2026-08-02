# v10 多尺度空间特征契约与诊断缓存

状态：development 诊断构建已完成；正式结论为 Development No-Go；未运行 sealed、未发布、未修改默认模型。

## 目的

v9-r2 的 `development no-go` 仍由 `spatial.species_calibration.maximumEce` 触发。v10 不改模型策略、不放宽质量门槛，而是先生成可与 v9-r2 邻居策略 OOF 证据逐折对齐的空间特征上下文，用于判断残差是否集中在特定多尺度地表结构。

机器可读冻结登记见 `docs/zhejiang-v1-20260715-multiscale-spatial-feature-v10-preregistration.json`。

## 冻结特征契约

契约 ID 为 `zhejiang_worldcover_h3_r6_multiscale_profiles_v1`，SHA-256 为 `d8a4d9bc382afc240e40cc787e12f6a7c3655f82c51ffae70cc0421ce7d9e78e`。

每个公开 H3 r6 单元使用 40 个目标无关、标签无关的特征：

- local、精确一环、精确二环分别保留 11 个 ESA WorldCover 类别占比，共 33 维；
- 三个尺度各一个归一化 Shannon entropy，共 3 维；
- local 到一环、二环的 Hellinger 对比，共 2 维；
- 一环、二环的公开特征可用率，共 2 维。

标准化统计只由冻结的 5,743 个公开 WorldCover 单元计算，使用总体均值和标准差并裁剪到 ±6。确定性最远点播种 k-means 请求 24 个原型，低于 32 个公开单元的簇按冻结规则合并；真实输入最终得到 19 个原型，最小支持 32、最大支持 1,685。原型模型 SHA-256 为 `896848ec676c31f9aeed9117801b9e66a722b7f579b792c8047fc5312b0795e4`。

## 诊断缓存

缓存 schema 只包含 metadata、profiles、fold_sets、contexts 四张白名单表。固定布局为 5 个 outer、20 个 inner、共 25 个 fold set；outer 上下文 727 行、inner 上下文 2,908 行、合计 3,635 行。

每个上下文只保存：

- 与伴随邻居缓存相同 fold set 下的连续匿名序号；
- 满足至少 32 个公开单元支持的原型 ID；
- `season_week`。

缓存不保存报告 ID、鸟种 ID、观察者、坐标、H3、空间单元、邻居 ID、地点名称或逐上下文精确特征向量。原型表只保存公开支持数和标准化质心。

写入采用临时 SQLite、事务、外键检查、`quick_check`、`freelist_count=0`、VACUUM、SHA sidecar 和原子重命名；目标存在时拒绝覆盖。

## v9-r2 只读伴随绑定

v10 直接复用已完成的 v9-r2 邻居缓存，不重新生成约 693 万条邻居检测聚合：

- 路径：`data/prediction-models/development-cache/zhejiang-v1-20260715-neighbor-policy-oof-v9-r2.sqlite`
- SHA-256：`dc1b6a23ab408f101a6c301fe2da4e7b492aa8046a15f325cb7406aa2103015e`

构建器会同时核对 sidecar、缓存 kind、development 面板、快照 SHA、split 文件 SHA、split manifest hash、25 个 fold set 的身份与上下文布局。新特征缓存还会逐 fold 核对上下文数和 companion score 数；任何不一致都 fail closed。

新增 CLI 参数 `--companion-neighbor-policy-oof-cache` 只允许与 `--write-spatial-feature-diagnostic-cache` 配套使用，并与新建邻居缓存模式互斥。

## 预检结果

只读预检已通过：

- 预检：`data/prediction-models/development-cache/zhejiang-v1-20260715-spatial-feature-diagnostic-v10-preflight.json`
- 预检 SHA-256：`c72b2d0b6f1128975941e565f28fa6f8b1105f1e9d87bde0e15821a178c7b270`
- `outputsAbsent=true`
- `sealedPanelViewed=false`
- 默认模型 SHA-256 仍为 `c4d8f759cdb9275b9d9171877d80b339e8796342dd262b380cf99360108ac582`

预登记的长构建命令如下，并已在明确批准后执行一次：

```powershell
node --max-old-space-size=8192 tools/build-zhejiang-prediction-model.js --source data/prediction-snapshots/zhejiang-v1-20260715.sqlite --source-is-snapshot --snapshot data/prediction-snapshots/zhejiang-v1-20260715.sqlite --output data/prediction-models/zhejiang-v1-20260715-development-multiscale-spatial-feature-v10.sqlite --model-version zhejiang-v1-20260715-development-multiscale-spatial-feature-v10 --spatial-split-manifest docs/zhejiang-v1-20260715-spatial-splits.json --spatial-panel development --habitat-features data/prediction-features/zhejiang-v1-20260715-worldcover-h3-r6-continuous-v2.json --habitat-model zhejiang_worldcover_hellinger_kernel_v1 --companion-neighbor-policy-oof-cache data/prediction-models/development-cache/zhejiang-v1-20260715-neighbor-policy-oof-v9-r2.sqlite --write-spatial-feature-diagnostic-cache data/prediction-models/development-cache/zhejiang-v1-20260715-spatial-feature-diagnostic-v10.sqlite --spatial-feature-preregistration docs/zhejiang-v1-20260715-multiscale-spatial-feature-v10-preregistration.json --workers 4 --evaluation-only --no-publish --confirm-coordinate-system bd09
```

缓存只提供诊断证据，不授权修改 runtime、冻结模型参数、物化 reference、查看 sealed 或覆盖默认模型。

## v10 构建结果

唯一构建于 2026-07-27 完成，最后阶段为 `artifact_ready`。stderr 仅有 Node SQLite experimental warning。

- evaluation-only 模型 SHA-256：`0754e5cc0cba380cdcc865058d4f9c4300c95b6dadec7bfac5d75b9b901a5014`
- 报告 SHA-256：`f05a353ecdd5350fff15975ab9f894c1e07ed7c8a5e9f3c99c46faeb4c137b33`
- 特征诊断缓存 SHA-256：`deb5af1b59581aee265013dc5526be61bbdb1196b08ae4409e6c6e074097fcdd`
- 模型和缓存均为 `quick_check=ok`、`freelist_count=0`、外键无错误；全部 sidecar 匹配。
- 缓存为 25 个 fold set、19 个公开原型、3,635 个匿名上下文；outer 为 727 行、inner 为 2,908 行。

正式 `releaseQuality.passed=false`。唯一失败项仍为 `spatial.species_calibration.maximumEce`；最大逐鸟种 ECE 为 `0.10829956319678036`，固定门槛为 `0.05`，共有 32 个逐鸟种 scope 超限。spatial Brier Skill `0.05642857380918209`、overall ECE `0.004081352313500836`、Recall@20 delta `0.05550597893985365` 均通过。

v10 不改变预测策略，因此正式指标与 v9-r2 一致；它的价值是提供后续只读残差定位。outer 上下文只落入 6 个公开原型，其中 `profile_14` 占约 47.85% 评估权重，并在多个最差鸟种上贡献主要残差；同一鸟种在不同原型之间存在反向偏差。后续 v11 只测试按 `taxon × public profile` 条件校准的单一假设，见 `docs/zhejiang-v1-20260715-spatial-profile-calibration-v11-preregistration.json`。
