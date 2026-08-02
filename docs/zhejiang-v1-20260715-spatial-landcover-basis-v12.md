# v12 连续公开地表基底诊断

状态：唯一 development 诊断已完成；结论为 No-Go；停止连续地表基底校准路径。未查看 sealed，未发布，未覆盖默认模型，也未执行 reference 物化或运行时集成。

## v11 失败根因

v11 将正例数至少 200 的鸟种拆分为 `taxon × public profile` 独立 Beta 校准。pooled Brier Skill 有所改善，但最大逐鸟种 ECE 从 `0.10829956319678026` 恶化到 `0.11273245808796035`，outer fold 1 的 Brier 相对恶化 `1.28396%`，因此为 Development No-Go。

进一步检查发现，验证使用的离散原型与 outer fold 高度混杂：

- `profile_13` 只出现在 fold 1；
- `profile_16` 只出现在 fold 2；
- `profile_04` 只出现在 fold 1、4；
- `profile_14` 只出现在 fold 2、5；
- `profile_15` 出现在 fold 1、3、4；
- `profile_18` 只出现在 fold 3、5。

留一折交叉拟合时，部分 held-out 原型在训练折完全不存在。继续增加原型数量会让支持度更稀疏，不能解决该问题。

## 唯一冻结假设

v12 不再把原型 ID 当离散校准类别，而是从全部 5,743 个公开 WorldCover 单元形成的冻结原型质心中提取三个连续基底：

- `local_forest`：WorldCover 10；
- `local_human_modified`：WorldCover 40 + 50；
- `local_aquatic`：WorldCover 80 + 90 + 95。

三个基底只按各原型的公共单元支持度进行总体标准化，不读取鸟种标签，也不保存每个上下文的精确特征向量。基底模型 SHA-256 为 `da8d7c1158f5e6e2a05eef46817d64e75cf27348e8144197f534bc326582d001`。

候选以当前 cross-fitted Beta 校准概率的 logit 为 offset，仅为正例数至少 200 的鸟种拟合共享连续基底上的四个残差系数：

- intercept；
- forest；
- human modified；
- aquatic。

固定 ridge 为 `10`，系数绝对值上限为 `2`，不进行 ridge、特征或参数扫描。校准 scope 保护改为按鸟种跨全部 held-out outer folds 汇总，避免再次形成稀疏的 `taxon × profile` scope。

每个 outer 的残差系数只使用排除该 outer 后形成的4个严格 inner OOF control 预测拟合。首次执行曾因错误地重新拟合 control 而被 `controlMustExactlyReproduceV10SpatialMetrics` 门禁拦截，未生成候选报告；修正只恢复冻结 control 并接入已有 inner OOF，不改变基底、ridge、系数边界或质量门槛。修正后的实现和预检哈希已重新冻结。

## 固定判定条件

候选必须同时满足：

1. control 在 `1e-12` 内复现 v10 正式空间指标；
2. 每个 outer fold 和 pooled Brier/ECE 保护均通过；
3. 最大逐鸟种 ECE 严格改善；
4. 最大逐鸟种 ECE 达到固定门槛 `≤ 0.05`；
5. 所有其他冻结 spatial 门禁均通过。

任一条件失败即停止该路径，不得调 ridge、替换基底、放宽门槛或查看 sealed。即使通过，也只能另行准备冻结的运行时集成和完整 development 重验证。

## v12 诊断结果

唯一候选诊断已完成，报告 SHA-256 为 `31dd781b928179a3c4136afc62c6096c2bbc19f4bcdeb0d1130e42c2800679a0`，sidecar 匹配。

- control 最大逐鸟种 ECE：`0.10829956319678026`
- candidate 最大逐鸟种 ECE：`0.10829956319678026`
- candidate Brier Skill：`0.06255911454939223`
- candidate overall ECE：`0.003547694561342304`
- candidate Recall@20 delta：`0.05523826521506336`
- pooled Brier 相对变化：`-0.006497166584303396`
- pooled ECE 变化：`-0.0005336577521586616`
- 五个 outer fold 保护全部通过
- 234 个物种 scope 接受，134 个拒绝

连续共享基底改善了 pooled Brier 和 ECE，但没有严格改善最终最大逐鸟种 ECE。最差物种 `4866` 的未保护候选 ECE 从 `0.10829956319678026` 降到 `0.10580628234831281`，同时该物种 Brier 相对恶化 `0.06657297097642013`，超过 `0.01` 保护上限，因此该 scope 回退到 control。最终 `runtimeIntegrationEligible=false`。

这说明问题不再是离散 profile 的支持度本身；仅靠现有 WorldCover 地表组成做后校准无法同时满足概率误差和 Brier。按预登记停止该路径，下一步只能补充与服务时一致可得、能支持空间外推的稳定解释变量，而不能继续调整校准强度。

## 文件

- 预登记：`docs/zhejiang-v1-20260715-spatial-landcover-basis-v12-preregistration.json`
- 候选实现：`server/prediction/spatial-landcover-basis-candidate.js`
- 评分入口：`tools/score-zhejiang-spatial-landcover-basis.js`
- 预检入口：`tools/preflight-zhejiang-spatial-landcover-basis.js`
- 单元测试：`tools/test-zhejiang-spatial-landcover-basis.js`
- 预登记测试：`tools/test-zhejiang-spatial-landcover-basis-v12-preregistration.js`
- 预检输出：`data/prediction-models/development-cache/zhejiang-v1-20260715-spatial-landcover-basis-v12-preflight.json`
- 候选输出：`data/prediction-models/development-cache/zhejiang-v1-20260715-spatial-landcover-basis-v12.json`
