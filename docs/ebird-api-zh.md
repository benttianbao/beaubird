# eBird API 2.0 中文功能说明

整理日期：2026-05-07  
原始文档：<https://documenter.getpostman.com/view/664302/S1ENwy59>

这份文档按“功能能做什么”来翻译和整理 eBird API 2.0。它不是逐字翻译，而是把 Postman 文档中的接口、用途、路径、常用参数和注意事项整理成便于开发查阅的中文 Markdown。

## 1. 基础信息

### 1.1 基础地址

```text
https://api.ebird.org/v2
```

Postman 文档里的 `{{serverName}}/{{contextRoot}}` 通常对应：

```text
serverName = api.ebird.org
contextRoot = v2
```

### 1.2 鉴权方式

大多数接口都需要 eBird API Key。推荐放在请求头：

```http
X-eBirdApiToken: 你的 API Key
```

文档也说明可以用查询参数 `key=你的 API Key`，但实际开发更建议使用请求头，避免 key 出现在 URL、日志或浏览器历史里。

### 1.3 默认返回格式

多数接口默认返回 JSON。少数参考类接口支持 `fmt=csv` 或 `fmt=json`，例如分类、热点、地区列表等。为了前端或 App 使用稳定，建议显式加：

```text
fmt=json
```

### 1.4 常见参数速查

| 参数 | 中文含义 | 常见取值 / 说明 |
| --- | --- | --- |
| `regionCode` | 地区代码 | 国家、省州、县区或地点代码，如 `CN`、`CN-ZJ`、`US-NY`、`L123456` |
| `speciesCode` | eBird 鸟种代码 | 通常是 6 位左右的英文缩写，可从 taxonomy 接口获取 |
| `lat` / `lng` | 纬度 / 经度 | 附近查询必填 |
| `dist` | 搜索半径，单位 km | 多数附近查询最大 50 km |
| `back` | 向前查询天数 | 1-30，很多接口默认 14 |
| `sppLocale` | 鸟种俗名语言 | `zh` 可返回中文俗名，默认 `en` |
| `locale` | 分类俗名语言 | taxonomy 接口常用，`zh` 为中文 |
| `fmt` | 返回格式 | `json` 或 `csv` |
| `maxResults` | 返回数量上限 | 不同接口上限不同 |
| `hotspot` | 只查热点记录 | `true` / `false` |
| `includeProvisional` | 包含未审核记录 | `true` / `false` |
| `detail` | 返回字段详略 | `simple` / `full` |
| `cat` | 分类类别过滤 | 如 `species`、`issf`、`form`、`slash`、`spuh`、`hybrid` 等 |

## 2. data/obs：观测记录接口

这组接口用于查询 eBird 清单中提交的观测记录。可以按地区查，也可以按经纬度查附近记录。多数“最近”接口只查最近 30 天内的数据。

### 2.1 查询某地区最近观测到的鸟种

```http
GET /data/obs/{regionCode}/recent
```

用途：查询国家、省州、县区或地点最近出现过的鸟种。结果通常按每个鸟种只返回该地区最新的一条记录。

常用参数：

| 参数 | 说明 |
| --- | --- |
| `back` | 向前查多少天，1-30，默认 14 |
| `cat` | 只查某些分类类别 |
| `hotspot` | 只返回热点记录 |
| `includeProvisional` | 是否包含未审核记录 |
| `maxResults` | 限制返回数量 |
| `r` | 指定最多 10 个地点代码 |
| `sppLocale` | 鸟种中文名可用 `zh` |

示例：

```bash
curl "https://api.ebird.org/v2/data/obs/CN-ZJ/recent?back=7&sppLocale=zh" \
  -H "X-eBirdApiToken: YOUR_TOKEN"
```

### 2.2 查询某地区最近的稀有 / 值得关注记录

```http
GET /data/obs/{regionCode}/recent/notable
```

用途：查询某地区最近的 notable records，也就是当地或全国层面的稀有、不寻常、季节异常等记录。

常用参数：

| 参数 | 说明 |
| --- | --- |
| `back` | 向前查多少天，1-30，默认 14 |
| `detail` | `simple` 返回简略字段，`full` 返回更完整字段 |
| `hotspot` | 只返回热点记录 |
| `maxResults` | 限制返回数量 |
| `r` | 指定最多 10 个地点代码 |
| `sppLocale` | 鸟种中文名可用 `zh` |

### 2.3 查询某地区某个鸟种的最近记录

```http
GET /data/obs/{regionCode}/recent/{speciesCode}
```

用途：在指定地区查某个鸟种最近 30 天内的记录。通常每个地点只返回该鸟种最近的一条记录。

常用参数：

| 参数 | 说明 |
| --- | --- |
| `back` | 向前查多少天 |
| `hotspot` | 只查热点记录 |
| `includeProvisional` | 包含未审核记录 |
| `maxResults` | 返回数量上限 |
| `r` | 指定地点代码 |
| `sppLocale` | 鸟种俗名语言 |

提示：`speciesCode` 可以通过 `/ref/taxonomy/ebird` 获取。

### 2.4 查询某坐标附近的最近观测记录

```http
GET /data/obs/geo/recent
```

用途：按经纬度查询附近最近观测记录。适合“当前位置附近最近有什么鸟”的功能。

常用参数：

| 参数 | 说明 |
| --- | --- |
| `lat` | 纬度，必填 |
| `lng` | 经度，必填 |
| `dist` | 半径 km，0-50，默认 25 |
| `back` | 向前查多少天，默认 14 |
| `cat` | 分类类别过滤 |
| `hotspot` | 只查热点 |
| `includeProvisional` | 是否包含未审核 |
| `maxResults` | 返回数量上限 |
| `sort` | `date` 按日期，`species` 按分类顺序 |
| `sppLocale` | 鸟种中文名可用 `zh` |

示例：

```bash
curl "https://api.ebird.org/v2/data/obs/geo/recent?lat=30.274&lng=120.155&dist=20&sppLocale=zh" \
  -H "X-eBirdApiToken: YOUR_TOKEN"
```

### 2.5 查询某坐标附近某个鸟种的最近记录

```http
GET /data/obs/geo/recent/{speciesCode}
```

用途：按经纬度查询附近某个鸟种的记录。适合“附近哪里最近看过某鸟种”。

常用参数：

| 参数 | 说明 |
| --- | --- |
| `lat` / `lng` | 经纬度，必填 |
| `dist` | 半径 km，0-50，默认 25 |
| `back` | 向前查多少天 |
| `hotspot` | 只查热点 |
| `includeProvisional` | 是否包含未审核 |
| `maxResults` | 返回数量上限 |
| `sppLocale` | 鸟种俗名语言 |

### 2.6 查询最近见到某鸟种的最近地点

```http
GET /data/nearest/geo/recent/{speciesCode}
```

用途：找出距离指定经纬度最近、最近曾记录过某鸟种的地点。

常用参数：

| 参数 | 说明 |
| --- | --- |
| `lat` / `lng` | 经纬度，必填 |
| `back` | 向前查多少天，默认 14 |
| `dist` | 限制最大距离，最大 50 km |
| `hotspot` | 只查热点 |
| `includeProvisional` | 是否包含未审核 |
| `maxResults` | 上限通常为 3000 |
| `sppLocale` | 鸟种俗名语言 |

和 2.5 的区别：2.5 是查半径范围内的记录；2.6 更强调“离我最近在哪里见过这个鸟”。

### 2.7 查询某坐标附近最近的稀有 / 值得关注记录

```http
GET /data/obs/geo/recent/notable
```

用途：按当前位置查附近稀有或异常记录。

常用参数：

| 参数 | 说明 |
| --- | --- |
| `lat` / `lng` | 经纬度，必填 |
| `dist` | 半径 km，0-50，默认 25 |
| `back` | 向前查多少天 |
| `detail` | `simple` 或 `full` |
| `hotspot` | 只查热点 |
| `maxResults` | 返回数量上限 |
| `sppLocale` | 鸟种俗名语言 |

### 2.8 查询某地区某一天的历史观测

```http
GET /data/obs/{regionCode}/historic/{y}/{m}/{d}
```

用途：查询某地区在某个具体日期记录到的所有分类单元。适合做历史日统计、年度对比、迁徙日期回顾。

路径参数：

| 参数 | 说明 |
| --- | --- |
| `regionCode` | 地区或地点代码 |
| `y` | 年，1800 至今 |
| `m` | 月，1-12 |
| `d` | 日 |

常用参数：

| 参数 | 说明 |
| --- | --- |
| `cat` | 分类类别过滤 |
| `detail` | `simple` 或 `full` |
| `hotspot` | 只查热点 |
| `includeProvisional` | 是否包含未审核 |
| `maxResults` | 返回数量上限 |
| `rank` | `mrec` 取当天最新记录，`create` 取最早添加记录 |
| `r` | 指定最多 50 个地点代码 |
| `sppLocale` | 鸟种俗名语言 |

注意：该接口结果可能有约 30 分钟缓存。

## 3. product：产品页数据接口

这组接口对应 eBird 网站上常见的产品页数据，比如排行榜、清单列表、地区统计、某份清单详情等。

### 3.1 查询某地区最近提交的清单

```http
GET /product/lists/{regionCode}
```

用途：获取某地区最近提交的 checklist 列表。

常用参数：

| 参数 | 说明 |
| --- | --- |
| `maxResults` | 返回清单数量，1-200，默认 10 |

### 3.2 查询某地区某一天提交的清单

```http
GET /product/lists/{regionCode}/{y}/{m}/{d}
```

用途：获取指定地区在某个日期提交的清单列表。

路径参数：

| 参数 | 说明 |
| --- | --- |
| `regionCode` | 国家、省州、县区或地点代码 |
| `y` / `m` / `d` | 年、月、日 |

### 3.3 查询某地区某一天的 Top 100 贡献者

```http
GET /product/top100/{regionCode}/{y}/{m}/{d}
```

用途：获取某地区某一天的前 100 位贡献者。

常用参数：

| 参数 | 说明 |
| --- | --- |
| `rankedBy` | `spp` 按鸟种数排序，`cl` 按完整清单数排序 |
| `maxResults` | 返回贡献者数量，1-100 |

注意：结果大约每 15 分钟更新一次。按鸟种数排序时，完整清单数相关字段可能为 0；按完整清单数排序时，鸟种数相关字段可能为 0。

### 3.4 查询某地区某一天的统计汇总

```http
GET /product/stats/{regionCode}/{y}/{m}/{d}
```

用途：获取某地区某一天的提交清单数、记录鸟种数、贡献者数等汇总数据。

路径参数：

| 参数 | 说明 |
| --- | --- |
| `regionCode` | 国家、省州、县区或地点代码 |
| `y` / `m` / `d` | 年、月、日 |

注意：结果大约每 15 分钟更新一次。

### 3.5 查看某份清单详情

```http
GET /product/checklist/view/{subId}
```

用途：获取某份 checklist 的详细信息及其中所有观测记录。

路径参数：

| 参数 | 说明 |
| --- | --- |
| `subId` | 清单编号，例如 `S123456789` |

重要注意：官方文档明确提醒不要用这个接口大规模下载数据，否则可能被封禁。它适合查看单份清单详情，不适合批量爬取。

### 3.6 查询某地区历史记录过的鸟种列表

```http
GET /product/spplist/{regionCode}
```

用途：返回某地区历史上被记录过的所有 eBird 鸟种代码。适合做地区总名录、已记录 / 未记录对比、目标鸟种筛选。

路径参数：

| 参数 | 说明 |
| --- | --- |
| `regionCode` | 国家、省州、县区或地点代码 |

返回结果通常是 `speciesCode` 数组。

## 4. ref/hotspot：热点接口

热点是 eBird 中的公共观鸟地点。这组接口适合做地图、附近热点、地点详情、热点清单入口。

### 4.1 查询某地区的热点

```http
GET /ref/hotspot/{regionCode}
```

用途：获取某个国家、省州、县区或地点范围内的热点列表。

常用参数：

| 参数 | 说明 |
| --- | --- |
| `back` | 如果提供，只返回最近若干天有记录的热点 |
| `fmt` | `json` 或 `csv`，建议显式用 `fmt=json` |

常见返回字段包括 `locId`、`locName`、`lat`、`lng`、`countryCode`、`subnational1Code`、`subnational2Code`、`latestObsDt`、`numSpeciesAllTime` 等。

### 4.2 查询某坐标附近的热点

```http
GET /ref/hotspot/geo
```

用途：根据经纬度查附近热点。适合“附近观鸟点”。

常用参数：

| 参数 | 说明 |
| --- | --- |
| `lat` / `lng` | 经纬度，必填 |
| `dist` | 半径 km |
| `back` | 只看最近若干天活跃的热点 |
| `fmt` | `json` 或 `csv`，建议 `fmt=json` |

示例：

```bash
curl "https://api.ebird.org/v2/ref/hotspot/geo?lat=30.274&lng=120.155&dist=20&fmt=json" \
  -H "X-eBirdApiToken: YOUR_TOKEN"
```

### 4.3 查询某个热点详情

```http
GET /ref/hotspot/info/{locId}
```

用途：获取某个热点的地点信息，如名称、坐标、所属地区、历史鸟种数等。

路径参数：

| 参数 | 说明 |
| --- | --- |
| `locId` | eBird 地点 / 热点编号，通常以 `L` 开头 |

## 5. ref/taxonomy：分类体系接口

这组接口用于获取 eBird 使用的分类名录、鸟种代码、版本、语言、类群等。

### 5.1 获取 eBird 分类名录

```http
GET /ref/taxonomy/ebird
```

用途：下载 eBird 当前或指定版本的分类体系。开发中常用来建立 `speciesCode`、中文名、拉丁名之间的映射。

常用参数：

| 参数 | 说明 |
| --- | --- |
| `cat` | 只返回某些分类类别，需小写 |
| `fmt` | `csv` 或 `json`，默认可能是 `csv`，建议 `fmt=json` |
| `locale` | 俗名语言，中文用 `zh` |
| `species` | 只查指定鸟种代码，多个用逗号分隔 |
| `version` | 指定 taxonomy 版本，默认最新 |

示例：

```bash
curl "https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json&locale=zh" \
  -H "X-eBirdApiToken: YOUR_TOKEN"
```

常见返回字段包括 `sciName`、`comName`、`speciesCode`、`category`、`taxonOrder`、`order`、`familyCode`、`familyComName`、`familySciName` 等。

### 5.2 获取某个鸟种的分类形式 / 亚种形式

```http
GET /ref/taxon/forms/{speciesCode}
```

用途：获取某个鸟种在 eBird taxonomy 中承认的 forms，比如亚种、地理型或其他下级形式。

路径参数：

| 参数 | 说明 |
| --- | --- |
| `speciesCode` | eBird 鸟种代码 |

### 5.3 获取 eBird 支持的俗名语言代码

```http
GET /ref/taxa-locales/ebird
```

用途：获取 eBird 俗名支持的语言 / 地区代码列表。可用来判断 `locale` 或 `sppLocale` 能不能填某种语言。

### 5.4 获取 taxonomy 版本列表

```http
GET /ref/taxonomy/versions
```

用途：获取所有可用的 eBird taxonomy 版本，并识别哪个是最新版本。

这个接口通常不需要 API Key。

### 5.5 获取鸟类分组列表

```http
GET /ref/sppgroup/{speciesGrouping}
```

用途：获取鸟类分组，例如鸥类、燕鸥、雀科等，用于构建筛选器或分组展示。

路径参数：

| 参数 | 说明 |
| --- | --- |
| `speciesGrouping` | `merlin` 或 `ebird` |

常用参数：

| 参数 | 说明 |
| --- | --- |
| `groupNameLocale` | 分组名称语言，中文可用 `zh` |

说明：`merlin` 会按 Merlin 的方式把相似鸟类放在一起；`ebird` 更接近分类顺序。

## 6. ref/region / ref/geo：地区接口

这组接口用于查地区信息、下级地区、相邻地区。适合做地区选择器、行政区级联、边界相邻地区推荐。

### 6.1 查询地区信息

```http
GET /ref/region/info/{regionCode}
```

用途：获取某个地区或地点的名称及地理范围信息。

常用参数：

| 参数 | 说明 |
| --- | --- |
| `regionNameFormat` | 控制地区名显示方式，如 `full`、`nameonly`、`detailed`、`revdetailed` |
| `delim` | 地区名各层级之间的分隔符，默认类似 `, ` |

`regionNameFormat` 常见含义：

| 取值 | 含义 |
| --- | --- |
| `full` | 完整名称 |
| `nameonly` | 只返回本级名称 |
| `namequal` | 返回带限定的名称 |
| `detailed` | 返回较详细描述 |
| `detailednoqual` | 到上级地区层级的描述 |
| `revdetailed` | 反向详细名称 |

### 6.2 查询下级地区列表

```http
GET /ref/region/list/{regionType}/{parentRegionCode}
```

用途：获取某个国家或地区下面的下级地区列表。

路径参数：

| 参数 | 说明 |
| --- | --- |
| `regionType` | 要返回的地区层级：`country`、`subnational1`、`subnational2` |
| `parentRegionCode` | 父级地区代码，或 `world` |

常用参数：

| 参数 | 说明 |
| --- | --- |
| `fmt` | `json` 或 `csv`，默认 `json` |

示例：

```bash
curl "https://api.ebird.org/v2/ref/region/list/subnational1/CN?fmt=json" \
  -H "X-eBirdApiToken: YOUR_TOKEN"
```

### 6.3 查询相邻地区

```http
GET /ref/adjacent/{regionCode}
```

用途：返回与某个国家、省州或县区接壤的地区列表。

路径参数：

| 参数 | 说明 |
| --- | --- |
| `regionCode` | 国家、一级行政区或二级行政区代码 |

注意：官方文档说明，目前只有美国、新西兰、墨西哥的部分二级行政区支持相邻地区查询。

## 7. 常见返回字段说明

### 7.1 观测记录字段

| 字段 | 中文含义 |
| --- | --- |
| `speciesCode` | eBird 鸟种代码 |
| `comName` | 俗名，受 `sppLocale` 影响 |
| `sciName` | 学名 |
| `locId` | 地点编号 |
| `locName` | 地点名称 |
| `obsDt` | 观测日期时间 |
| `howMany` | 数量 |
| `lat` / `lng` | 经纬度 |
| `obsValid` | 记录是否有效 |
| `obsReviewed` | 是否已审核 |
| `locationPrivate` | 是否为私人地点 |
| `subId` | checklist 编号 |

### 7.2 地点 / 热点字段

| 字段 | 中文含义 |
| --- | --- |
| `locId` | 地点编号 |
| `locName` | 地点名称 |
| `lat` / `lng` | 经纬度 |
| `countryCode` | 国家代码 |
| `subnational1Code` | 一级行政区代码 |
| `subnational2Code` | 二级行政区代码 |
| `latestObsDt` | 最近观测日期 |
| `numSpeciesAllTime` | 历史记录鸟种数 |

### 7.3 分类字段

| 字段 | 中文含义 |
| --- | --- |
| `speciesCode` | 鸟种代码 |
| `comName` | 俗名 |
| `sciName` | 学名 |
| `category` | 分类类别 |
| `taxonOrder` | 分类排序 |
| `order` | 目 |
| `familyCode` | 科代码 |
| `familyComName` | 科俗名 |
| `familySciName` | 科学名 |

## 8. 开发建议

1. 中文名展示优先使用 `sppLocale=zh` 或 taxonomy 的 `locale=zh`。
2. 对 `ref/taxonomy/ebird`、`ref/hotspot/*`、`ref/region/list/*` 这类支持格式切换的接口，建议显式加 `fmt=json`。
3. `back` 通常最多 30 天，`dist` 通常最多 50 km，不要把它当作无限历史检索。
4. 大批量历史分析不要用 `product/checklist/view/{subId}` 批量抓清单详情，官方文档明确警告可能被封禁。
5. 遇到返回字段中带全大写 `ID` 的旧字段，例如 `locID`、`subID`，应优先使用小写形式如 `locId`、`subId`，因为旧字段可能被移除。
6. 做 App 缓存时，taxonomy、region、hotspot 这类参考数据可以长缓存；recent observations、notable observations、top100、stats 这类动态数据应短缓存。
7. 需要“地区总鸟种”时，用 `/product/spplist/{regionCode}`；需要“实时最近记录”时，用 `/data/obs/.../recent`；需要“官方分类名录”时，用 `/ref/taxonomy/ebird`。

## 9. 常用场景对照

| 你想做什么 | 推荐接口 |
| --- | --- |
| 查浙江最近有哪些鸟 | `GET /data/obs/CN-ZJ/recent?sppLocale=zh` |
| 查附近最近有什么鸟 | `GET /data/obs/geo/recent?lat=...&lng=...&dist=...&sppLocale=zh` |
| 查附近哪里最近见过某鸟 | `GET /data/nearest/geo/recent/{speciesCode}?lat=...&lng=...` |
| 查附近稀有记录 | `GET /data/obs/geo/recent/notable?lat=...&lng=...` |
| 查某地历史总名录 | `GET /product/spplist/{regionCode}` |
| 查 eBird 分类和中文名映射 | `GET /ref/taxonomy/ebird?fmt=json&locale=zh` |
| 查某地区热点 | `GET /ref/hotspot/{regionCode}?fmt=json` |
| 查附近热点 | `GET /ref/hotspot/geo?lat=...&lng=...&dist=...&fmt=json` |
| 做国家 / 省 / 县级联选择器 | `GET /ref/region/list/{regionType}/{parentRegionCode}` |
| 查看某份清单完整详情 | `GET /product/checklist/view/{subId}` |

## 10. 资料来源

- eBird API 2.0 Postman 文档：<https://documenter.getpostman.com/view/664302/S1ENwy59>
- eBird API 2.0 Postman Collection：<https://www.postman.com/orange-crater-145710/byld-apis/collection/novf30k/ebird-api-2-0>
- Postman 请求页：Top 100、Regional statistics、View Checklist、Region Info、Sub Region List、Hotspots、Taxonomy、Adjacent Regions 等。
