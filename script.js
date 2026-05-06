const STORAGE_KEY = "birdBlogRecordsV1";
const PERSONAL_STORAGE_KEY = "birdBlogPersonalRecordsV1";
const LEGACY_STORAGE_KEY = STORAGE_KEY;
const EBIRD_API_KEY_STORAGE = "birdBlogEbirdApiKey";
const EBIRD_REGION_STORAGE = "birdBlogEbirdRegionCode";
const EBIRD_BACK_STORAGE = "birdBlogEbirdBackDays";
const EBIRD_SPECIES_LOCALE = "zh_SIM";
const EBIRD_SEASONAL_CACHE_STORAGE = "birdBlogEbirdSeasonalCacheV1";
const EBIRD_SEASONAL_SETTINGS_STORAGE = "birdBlogEbirdSeasonalSettingsV1";
const EBIRD_SEASONAL_REGION_CODE = "CN-ZJ";
const EBIRD_SEASONAL_DEFAULT_YEARS = 10;
const EBIRD_SEASONAL_DEFAULT_WINDOW_DAYS = 7;
const EBIRD_SEASONAL_CACHE_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const EBIRD_SEASONAL_CONCURRENCY = 4;
const BIRDREPORT_PROXY_URL_STORAGE = "birdBlogBirdreportProxyUrl";
const BIRDREPORT_RARE_SPECIES_STORAGE = "birdBlogBirdreportRareSpeciesV1";
const BIRDREPORT_RARE_MONITOR_STORAGE = "birdBlogBirdreportRareMonitorV1";
const BIRDREPORT_RARE_NOTIFICATION_LOG_STORAGE = "birdBlogBirdreportRareNotificationLogV1";
const BIRDREPORT_UNLOCKED_SPECIES_CACHE_STORAGE = "birdBlogBirdreportUnlockedSpeciesCacheV1";
const BIRDREPORT_SEARCH_PAGE_URL = "https://www.birdreport.cn/home/search/page.html";
const BIRDREPORT_TAXON_PAGE_URL = "https://www.birdreport.cn/home/search/taxon.html";
const BIRDREPORT_ZHEJIANG_SPECIES_DATA_URL = "./data/zhejiang-birdreport-species.json";
const BIRDREPORT_ZHEJIANG_SPECIES_GLOBAL = "BEAUBIRD_ZHEJIANG_SPECIES_DATA";
const BIRDREPORT_VERSION = "CH4";
const ANDROID_APP_USER_AGENT_TOKEN = "BeauBirdAndroidApp";
const BIRDREPORT_PARAM_PUBLIC_KEY = "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCvxXa98E1uWXnBzXkS2yHUfnBM6n3PCwLdfIox03T91joBvjtoDqiQ5x3tTOfpHs3LtiqMMEafls6b0YWtgB1dse1W5m+FpeusVkCOkQxB4SZDH6tuerIknnmB/Hsq5wgEkIvO5Pff9biig6AyoAkdWpSek/1/B7zYIepYY0lxKQIDAQAB";
const BIRDREPORT_AES_KEY_SOURCE = "6756696653534952657053656868665752665050485566485667545454484967";
const BIRDREPORT_AES_IV_SOURCE = "53536868555767547048526949655455";
const DEFAULT_BIRDREPORT_PROXY_URL = "http://127.0.0.1:8787";
const BIRDREPORT_RARE_SPECIES_PROVINCE = "浙江省";
const BIRDREPORT_RARE_SPECIES_THRESHOLD = 500;
const BIRDREPORT_MONITOR_INTERVAL_MS = 60 * 60 * 1000;
const BIRDREPORT_MUNICIPALITY_AREAS = [
  "湖北省神农架林区",
  "新疆维吾尔自治区北屯市",
  "河南省济源市",
  "海南省五指山市",
  "新疆维吾尔自治区五家渠市",
  "湖北省仙桃市",
  "湖北省潜江市",
  "湖北省天门市",
  "新疆维吾尔自治区石河子市",
  "海南省文昌市",
  "海南省琼海市",
  "海南省东方市",
  "新疆维吾尔自治区可克达拉市",
  "海南省万宁市",
  "海南省乐东黎族自治县",
  "新疆维吾尔自治区双河市",
  "新疆维吾尔自治区图木舒克市",
  "新疆维吾尔自治区昆玉市",
  "新疆维吾尔自治区胡杨河市",
  "新疆维吾尔自治区铁门关市",
  "新疆维吾尔自治区阿拉尔市",
  "海南省临高县",
  "海南省保亭黎族苗族自治县",
  "海南省定安县",
  "海南省屯昌县",
  "海南省昌江黎族自治县",
  "海南省澄迈县",
  "海南省琼中黎族苗族自治县",
  "海南省白沙黎族自治县",
  "海南省陵水黎族自治县",
  "青海省海西蒙古族藏族自治州",
  "台湾省云林县",
  "台湾省南投县",
  "台湾省台东县",
  "台湾省嘉义县",
  "台湾省嘉义市",
  "台湾省基隆市",
  "台湾省宜兰县",
  "台湾省屏东县",
  "台湾省彰化县",
  "台湾省新竹县",
  "台湾省新竹市",
  "台湾省澎湖县",
  "台湾省花莲县",
  "台湾省苗栗县"
];
const SAMPLE_RECORDS = [
  { date: "2026-03-01", species: "白鹭", location: "杭州西溪湿地", lat: 30.271, lng: 120.123, notes: "芦苇边活动频繁" },
  { date: "2026-03-02", species: "麻雀", location: "上海人民公园", lat: 31.231, lng: 121.47, notes: "晨间群聚觅食" },
  { date: "2026-03-03", species: "红嘴蓝鹊", location: "杭州西湖", lat: 30.24, lng: 120.15, notes: "林缘短暂停留" },
  { date: "2026-03-04", species: "夜鹭", location: "广州海珠湿地", lat: 23.071, lng: 113.318, notes: "黄昏时出现" },
  { date: "2026-03-05", species: "戴胜", location: "北京奥林匹克森林公园", lat: 40.019, lng: 116.396, notes: "地面翻找昆虫" },
  { date: "2026-03-05", species: "白鹭", location: "杭州西溪湿地", lat: 30.271, lng: 120.123, notes: "同点位再次观察到" },
  { date: "2026-03-08", species: "翠鸟", location: "成都锦城湖", lat: 30.57, lng: 104.047, notes: "停在近岸枯枝" },
  { date: "2026-03-10", species: "珠颈斑鸠", location: "深圳莲花山公园", lat: 22.548, lng: 114.055, notes: "步道旁常见" }
];
const ROOT_CLASS_LABEL = "鸟纲";
const UNKNOWN_ORDER_LABEL = "未分类目";
const UNKNOWN_FAMILY_LABEL = "未分类科";
const UNKNOWN_GENUS_LABEL = "未分类属";
const TRADITIONAL_PHRASE_REPLACEMENTS = [
  ["臺灣", "台湾"],
  ["鶺鴒", "鹡鸰"],
  ["鸕鶿", "鸬鹚"],
  ["鷦鷯", "鹪鹩"],
  ["鷺鷥", "鹭鸶"]
];
const TRADITIONAL_CHAR_MAP = {
  "萬": "万",
  "東": "东",
  "絲": "丝",
  "個": "个",
  "豐": "丰",
  "麗": "丽",
  "舉": "举",
  "義": "义",
  "烏": "乌",
  "樂": "乐",
  "習": "习",
  "鄉": "乡",
  "書": "书",
  "買": "买",
  "亂": "乱",
  "爭": "争",
  "於": "于",
  "虧": "亏",
  "亞": "亚",
  "產": "产",
  "畝": "亩",
  "親": "亲",
  "褻": "亵",
  "嚴": "严",
  "喪": "丧",
  "個": "个",
  "豔": "艳",
  "鳳": "凤",
  "麼": "么",
  "義": "义",
  "廣": "广",
  "門": "门",
  "飛": "飞",
  "馬": "马",
  "魚": "鱼",
  "鳥": "鸟",
  "鳧": "凫",
  "鳩": "鸠",
  "鳶": "鸢",
  "鴉": "鸦",
  "鴒": "鸰",
  "鴕": "鸵",
  "鴛": "鸳",
  "鴞": "鸮",
  "鴝": "鸲",
  "鴣": "鸪",
  "鴦": "鸯",
  "鴨": "鸭",
  "鴯": "鸸",
  "鴴": "鸻",
  "鴿": "鸽",
  "鵂": "鸺",
  "鵑": "鹃",
  "鵒": "鹆",
  "鵓": "鹁",
  "鵜": "鹈",
  "鵐": "鹀",
  "鵑": "鹃",
  "鵝": "鹅",
  "鵠": "鹄",
  "鵡": "鹉",
  "鵪": "鹌",
  "鵯": "鹎",
  "鵰": "雕",
  "鵲": "鹊",
  "鵷": "鹓",
  "鶁": "鹑",
  "鶇": "鸫",
  "鶉": "鹑",
  "鶘": "鹕",
  "鶚": "鹗",
  "鶡": "鹖",
  "鶥": "鹛",
  "鶩": "鹜",
  "鶯": "莺",
  "鶲": "鹟",
  "鶴": "鹤",
  "鶺": "鹡",
  "鶼": "鹣",
  "鶿": "鹚",
  "鷂": "鹞",
  "鷓": "鹧",
  "鷗": "鸥",
  "鷙": "鸷",
  "鷚": "鹨",
  "鷥": "鸶",
  "鷦": "鹪",
  "鷯": "鹩",
  "鷲": "鹫",
  "鷳": "鹇",
  "鷹": "鹰",
  "鷺": "鹭",
  "鸕": "鸬",
  "鸚": "鹦",
  "鸛": "鹳",
  "鸝": "鹂",
  "麥": "麦",
  "黃": "黄",
  "點": "点",
  "龍": "龙",
  "紅": "红",
  "綠": "绿",
  "藍": "蓝",
  "黑": "黑",
  "頭": "头",
  "頸": "颈",
  "頰": "颊",
  "顏": "颜",
  "體": "体",
  "側": "侧",
  "長": "长",
  "腳": "脚",
  "翅": "翅",
  "翹": "翘",
  "線": "线",
  "紋": "纹",
  "斑": "斑",
  "細": "细",
  "闊": "阔",
  "雙": "双",
  "蒼": "苍",
  "臺": "台",
  "灣": "湾",
  "裏": "里",
  "啄": "啄",
  "鸌": "鹱",
  "鸏": "鹲",
  "鸌": "鹱",
  "鸛": "鹳",
  "鷸": "鹬",
  "鸌": "鹱",
  "鱗": "鳞",
  "鸌": "鹱"
};
const TAXON_ZH_MAP = {
  order: {
    Accipitriformes: "鹰形",
    Anseriformes: "雁形",
    Apodiformes: "雨燕",
    Bucerotiformes: "犀鸟",
    Charadriiformes: "鸻形",
    Columbiformes: "鸽形",
    Coraciiformes: "佛法僧",
    Cuculiformes: "鹃形",
    Falconiformes: "隼形",
    Galliformes: "鸡形",
    Gruiformes: "鹤形",
    Passeriformes: "雀形",
    Pelecaniformes: "鹈形",
    Piciformes: "䴕形",
    Podicipediformes: "䴙䴘形",
    Psittaciformes: "鹦形",
    Strigiformes: "鸮形",
    Suliformes: "鲣鸟"
  },
  family: {
    Accipitridae: "鹰",
    Alcedinidae: "翠鸟",
    Anatidae: "鸭雁",
    Ardeidae: "鹭",
    Columbidae: "鸠鸽",
    Corvidae: "鸦",
    Cuculidae: "杜鹃",
    Hirundinidae: "燕",
    Laridae: "鸥",
    Motacillidae: "鹡鸰",
    Muscicapidae: "鹟",
    Paridae: "山雀",
    Passeridae: "雀",
    Phasianidae: "雉",
    Picidae: "啄木鸟",
    Pycnonotidae: "鹎",
    Rallidae: "秧鸡",
    Sturnidae: "椋鸟",
    Strigidae: "鸱鸮",
    Upupidae: "戴胜"
  }
};
const COMMON_BIRD_TAXONOMY = {
  "白鹭": { sciName: "Egretta garzetta", orderName: "Pelecaniformes", familyName: "Ardeidae", familyCommonName: "鹭", genusName: "Egretta" },
  "苍鹭": { sciName: "Ardea cinerea", orderName: "Pelecaniformes", familyName: "Ardeidae", familyCommonName: "鹭", genusName: "Ardea" },
  "夜鹭": { sciName: "Nycticorax nycticorax", orderName: "Pelecaniformes", familyName: "Ardeidae", familyCommonName: "鹭", genusName: "Nycticorax" },
  "麻雀": { sciName: "Passer montanus", orderName: "Passeriformes", familyName: "Passeridae", familyCommonName: "雀", genusName: "Passer" },
  "乌鸫": { sciName: "Turdus merula", orderName: "Passeriformes", familyName: "Turdidae", familyCommonName: "鸫", genusName: "Turdus" },
  "喜鹊": { sciName: "Pica pica", orderName: "Passeriformes", familyName: "Corvidae", familyCommonName: "鸦", genusName: "Pica" },
  "红嘴蓝鹊": { sciName: "Urocissa erythroryncha", orderName: "Passeriformes", familyName: "Corvidae", familyCommonName: "鸦", genusName: "Urocissa" },
  "戴胜": { sciName: "Upupa epops", orderName: "Bucerotiformes", familyName: "Upupidae", familyCommonName: "戴胜", genusName: "Upupa" },
  "翠鸟": { sciName: "Alcedo atthis", orderName: "Coraciiformes", familyName: "Alcedinidae", familyCommonName: "翠鸟", genusName: "Alcedo" },
  "珠颈斑鸠": { sciName: "Spilopelia chinensis", orderName: "Columbiformes", familyName: "Columbidae", familyCommonName: "鸠鸽", genusName: "Spilopelia" },
  "斑鸠": { sciName: "Streptopelia orientalis", orderName: "Columbiformes", familyName: "Columbidae", familyCommonName: "鸠鸽", genusName: "Streptopelia" },
  "白头鹎": { sciName: "Pycnonotus sinensis", orderName: "Passeriformes", familyName: "Pycnonotidae", familyCommonName: "鹎", genusName: "Pycnonotus" },
  "大山雀": { sciName: "Parus major", orderName: "Passeriformes", familyName: "Paridae", familyCommonName: "山雀", genusName: "Parus" },
  "白鹡鸰": { sciName: "Motacilla alba", orderName: "Passeriformes", familyName: "Motacillidae", familyCommonName: "鹡鸰", genusName: "Motacilla" }
};

const unlockedSpeciesCache = loadUnlockedSpeciesCache();

const state = {
  personalRecords: loadPersonalRecords(),
  regionQueryRecords: [],
  activeRegionRecordId: null,
  ebirdSeasonalResults: [],
  ebirdSeasonalMeta: null,
  activeEbirdSeasonalSpeciesCode: "",
  birdreportLastQueryPayload: null,
  birdreportLastResults: [],
  activeBirdreportSpeciesKey: null,
  birdreportSpeciesDetailSpecies: null,
  birdreportSpeciesDetailRecords: [],
  birdreportSpeciesDetailLoading: false,
  birdreportSpeciesDetailError: "",
  birdreportSpeciesCaptchaImageUrl: "",
  birdreportSpeciesCaptchaLoading: false,
  birdreportSpeciesCaptchaError: "",
  map: null,
  heatLayer: null,
  expandedTaxa: new Set(),
  migrationSummary: { changed: 0 },
  zhejiangRareSpecies: loadZhejiangRareSpecies(),
  zhejiangRareMonitor: loadZhejiangRareMonitor(),
  zhejiangRareNotificationLog: loadZhejiangRareNotificationLog(),
  zhejiangRareHits: [],
  activeZhejiangRareSpeciesKey: null,
  zhejiangRareSpeciesDetailTargetDate: "",
  zhejiangRareSpeciesDetailSpecies: null,
  zhejiangRareSpeciesDetailRecords: [],
  zhejiangRareSpeciesDetailLoading: false,
  zhejiangRareSpeciesDetailError: "",
  zhejiangRareMonitorTimerId: null,
  zhejiangRareMonitorInFlight: false,
  unlockedSpeciesCatalog: unlockedSpeciesCache.catalog,
  unlockedObservedSpecies: unlockedSpeciesCache.observed,
  unlockedMissingSpecies: unlockedSpeciesCache.missing,
  unlockedTargetUsername: unlockedSpeciesCache.username,
  unlockedSpeciesCacheSavedAt: unlockedSpeciesCache.savedAt,
  unlockedSpeciesShowMeta: false,
  unlockedSpeciesTableVisible: true,
  activeUnlockedSpeciesKey: null,
  unlockedSpeciesDetailRecords: [],
  unlockedSpeciesDetailLoading: false,
  unlockedSpeciesDetailError: "",
  unlockedSpeciesCaptchaImageUrl: "",
  unlockedSpeciesCaptchaLoading: false,
  unlockedSpeciesCaptchaError: ""
};

const elements = {
  fileInput: document.querySelector("#fileInput"),
  pasteInput: document.querySelector("#pasteInput"),
  importPasteBtn: document.querySelector("#importPasteBtn"),
  loadSampleBtn: document.querySelector("#loadSampleBtn"),
  clearAllBtn: document.querySelector("#clearAllBtn"),
  importMessage: document.querySelector("#importMessage"),
  ebirdApiKey: document.querySelector("#ebirdApiKey"),
  ebirdRegionCode: document.querySelector("#ebirdRegionCode"),
  ebirdBackDays: document.querySelector("#ebirdBackDays"),
  syncEbirdBtn: document.querySelector("#syncEbirdBtn"),
  clearEbirdKeyBtn: document.querySelector("#clearEbirdKeyBtn"),
  ebirdMessage: document.querySelector("#ebirdMessage"),
  regionQuerySummary: document.querySelector("#regionQuerySummary"),
  regionQueryContainer: document.querySelector("#regionQueryContainer"),
  regionQueryBackdrop: document.querySelector("#regionQueryBackdrop"),
  regionQueryDetail: document.querySelector("#regionQueryDetail"),
  ebirdSeasonalDate: document.querySelector("#ebirdSeasonalDate"),
  ebirdSeasonalYears: document.querySelector("#ebirdSeasonalYears"),
  ebirdSeasonalWindow: document.querySelector("#ebirdSeasonalWindow"),
  analyzeEbirdSeasonalBtn: document.querySelector("#analyzeEbirdSeasonalBtn"),
  clearEbirdSeasonalCacheBtn: document.querySelector("#clearEbirdSeasonalCacheBtn"),
  ebirdSeasonalMessage: document.querySelector("#ebirdSeasonalMessage"),
  ebirdSeasonalSummary: document.querySelector("#ebirdSeasonalSummary"),
  ebirdSeasonalContainer: document.querySelector("#ebirdSeasonalContainer"),
  birdreportProxyUrl: document.querySelector("#birdreportProxyUrl"),
  birdreportStartDate: document.querySelector("#birdreportStartDate"),
  birdreportEndDate: document.querySelector("#birdreportEndDate"),
  birdreportProvince: document.querySelector("#birdreportProvince"),
  birdreportCity: document.querySelector("#birdreportCity"),
  birdreportDistrict: document.querySelector("#birdreportDistrict"),
  birdreportPointName: document.querySelector("#birdreportPointName"),
  queryBirdreportProxyBtn: document.querySelector("#queryBirdreportProxyBtn"),
  openBirdreportTaxonBtn: document.querySelector("#openBirdreportTaxonBtn"),
  openBirdreportSearchBtn: document.querySelector("#openBirdreportSearchBtn"),
  birdreportMessage: document.querySelector("#birdreportMessage"),
  birdreportSpeciesSummary: document.querySelector("#birdreportSpeciesSummary"),
  birdreportSpeciesContainer: document.querySelector("#birdreportSpeciesContainer"),
  birdreportSpeciesDetailBackdrop: document.querySelector("#birdreportSpeciesDetailBackdrop"),
  birdreportSpeciesDetail: document.querySelector("#birdreportSpeciesDetail"),
  birdreportUnlockedUsername: document.querySelector("#birdreportUnlockedUsername"),
  queryUnlockedSpeciesBtn: document.querySelector("#queryUnlockedSpeciesBtn"),
  exportUnlockedSpeciesBtn: document.querySelector("#exportUnlockedSpeciesBtn"),
  clearUnlockedSpeciesBtn: document.querySelector("#clearUnlockedSpeciesBtn"),
  unlockedSpeciesMessage: document.querySelector("#unlockedSpeciesMessage"),
  unlockedSpeciesSummary: document.querySelector("#unlockedSpeciesSummary"),
  unlockedSpeciesContainer: document.querySelector("#unlockedSpeciesContainer"),
  saveZhejiangRareSpeciesBtn: document.querySelector("#saveZhejiangRareSpeciesBtn"),
  checkZhejiangRareSpeciesBtn: document.querySelector("#checkZhejiangRareSpeciesBtn"),
  toggleZhejiangRareMonitorBtn: document.querySelector("#toggleZhejiangRareMonitorBtn"),
  zhejiangRareMonitorDate: document.querySelector("#zhejiangRareMonitorDate"),
  zhejiangRareSpeciesMessage: document.querySelector("#zhejiangRareSpeciesMessage"),
  zhejiangRareSpeciesSummary: document.querySelector("#zhejiangRareSpeciesSummary"),
  zhejiangRareSpeciesContainer: document.querySelector("#zhejiangRareSpeciesContainer"),
  zhejiangRareSpeciesDetailBackdrop: document.querySelector("#zhejiangRareSpeciesDetailBackdrop"),
  zhejiangRareSpeciesDetail: document.querySelector("#zhejiangRareSpeciesDetail"),
  speciesFilter: document.querySelector("#speciesFilter"),
  sortOrder: document.querySelector("#sortOrder"),
  viewMode: document.querySelector("#viewMode"),
  lifeRegionFilter: document.querySelector("#lifeRegionFilter"),
  lifeBackDays: document.querySelector("#lifeBackDays"),
  speciesDiscoveryRegion: document.querySelector("#speciesDiscoveryRegion"),
  speciesDiscoveryStart: document.querySelector("#speciesDiscoveryStart"),
  speciesDiscoveryEnd: document.querySelector("#speciesDiscoveryEnd"),
  heatMetric: document.querySelector("#heatMetric"),
  statsSummary: document.querySelector("#statsSummary"),
  taxonomyBrowser: document.querySelector("#taxonomyBrowser"),
  recordsContainer: document.querySelector("#recordsContainer"),
  lifeSummary: document.querySelector("#lifeSummary"),
  lifeListContainer: document.querySelector("#lifeListContainer"),
  speciesDiscoverySummary: document.querySelector("#speciesDiscoverySummary"),
  speciesDiscoveryContainer: document.querySelector("#speciesDiscoveryContainer"),
  calendarLegend: document.querySelector("#calendarLegend"),
  calendarHeatmap: document.querySelector("#calendarHeatmap")
};

bootstrap();

function bootstrap() {
  applyRuntimeEnvironment();
  lockEmbeddedAndroidViewport();
  hydrateEbirdInputs();
  hydrateEbirdSeasonalInputs();
  hydrateBirdreportProxyInputs();
  hydrateZhejiangRareMonitorInputs();
  bindEvents();
  initBirdreportProxy();
  initEmbeddedAndroidQuickNav();
  renderRegionQueryResults();
  renderEbirdSeasonalPrediction();
  renderZhejiangRareSpeciesPanel();
  renderUnlockedSpeciesPanel();
  initZhejiangRareSpeciesMonitor();
  setEbirdMessage("填入 API 密钥和区域代码后，可以查询 eBird 区域最近观测。查询结果不会保存到个人记录。");
  setEbirdSeasonalMessage("选择目标日期后，可按浙江多年同期历史记录分析当季可能出现鸟种。");
  setBirdreportMessage(
    isEmbeddedAndroidApp()
      ? "应用内代理已就绪，选择时间和省 / 市 / 区后就能直接查询 BirdReport 鸟种。"
      : "先运行本地代理脚本，再选择时间和省 / 市 / 区，就能在页面里查看 BirdReport 鸟种。"
  );
  if (elements.birdreportUnlockedUsername && state.unlockedTargetUsername) {
    elements.birdreportUnlockedUsername.value = state.unlockedTargetUsername;
  }
  setUnlockedSpeciesMessage(
    state.unlockedTargetUsername
      ? `已恢复 ${state.unlockedTargetUsername} 的未解锁鸟种缓存；重新查询会刷新记录。`
      : "输入记录用户姓名后，可以核对该用户在浙江名录里还缺哪些鸟种。"
  );
  if (state.zhejiangRareMonitor.enabled) {
    setZhejiangRareSpeciesMessage("浙江稀有鸟种监测已恢复运行，页面保持打开时会继续每小时检查。");
  } else {
    setZhejiangRareSpeciesMessage("先保存一次浙江稀有鸟种名单，再开启每小时监测。");
  }
}

function bindIfPresent(element, eventName, handler) {
  element?.addEventListener(eventName, handler);
}

function bindEvents() {
  bindIfPresent(elements.importPasteBtn, "click", () => {
    importText(elements.pasteInput.value, "粘贴内容");
  });

  bindIfPresent(elements.loadSampleBtn, "click", () => {
    state.personalRecords = normalizeRecords(SAMPLE_RECORDS);
    persistAndRender();
    setMessage(`已加载 ${state.personalRecords.length} 条示例记录。`);
  });

  bindIfPresent(elements.clearAllBtn, "click", () => {
    state.personalRecords = [];
    savePersonalRecords(state.personalRecords);
    render();
    setMessage("已清空全部个人记录。");
  });

  bindIfPresent(elements.fileInput, "change", async (event) => {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      importText(text, `文件 ${file.name}`);
    } catch (error) {
      setMessage(`读取文件失败：${error.message}`, true);
    } finally {
      elements.fileInput.value = "";
    }
  });

  bindIfPresent(elements.syncEbirdBtn, "click", syncEbirdRecords);
  bindIfPresent(elements.clearEbirdKeyBtn, "click", clearEbirdApiKey);
  bindIfPresent(elements.ebirdApiKey, "change", persistEbirdSettings);
  bindIfPresent(elements.ebirdRegionCode, "change", persistEbirdSettings);
  bindIfPresent(elements.ebirdBackDays, "change", persistEbirdSettings);
  bindIfPresent(elements.analyzeEbirdSeasonalBtn, "click", analyzeEbirdSeasonalPrediction);
  bindIfPresent(elements.clearEbirdSeasonalCacheBtn, "click", clearEbirdSeasonalCache);
  bindIfPresent(elements.ebirdSeasonalDate, "change", persistEbirdSeasonalSettings);
  bindIfPresent(elements.ebirdSeasonalYears, "change", persistEbirdSeasonalSettings);
  bindIfPresent(elements.ebirdSeasonalWindow, "change", persistEbirdSeasonalSettings);
  bindIfPresent(elements.birdreportProxyUrl, "change", persistBirdreportProxySettings);
  bindIfPresent(elements.birdreportStartDate, "change", clearBirdreportSpeciesResults);
  bindIfPresent(elements.birdreportEndDate, "change", clearBirdreportSpeciesResults);
  bindIfPresent(elements.birdreportProvince, "change", handleBirdreportProvinceChange);
  bindIfPresent(elements.birdreportCity, "change", handleBirdreportCityChange);
  bindIfPresent(elements.birdreportDistrict, "change", clearBirdreportSpeciesResults);
  bindIfPresent(elements.birdreportPointName, "input", clearBirdreportSpeciesResults);
  bindIfPresent(elements.queryBirdreportProxyBtn, "click", queryBirdreportSpeciesByProxy);
  bindIfPresent(elements.openBirdreportTaxonBtn, "click", openBirdreportTaxonPage);
  bindIfPresent(elements.openBirdreportSearchBtn, "click", openBirdreportSearchPage);
  bindIfPresent(elements.queryUnlockedSpeciesBtn, "click", queryUnlockedSpeciesByUser);
  bindIfPresent(elements.exportUnlockedSpeciesBtn, "click", exportUnlockedSpeciesTable);
  bindIfPresent(elements.clearUnlockedSpeciesBtn, "click", clearUnlockedSpeciesResults);
  bindIfPresent(elements.birdreportUnlockedUsername, "keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      queryUnlockedSpeciesByUser();
    }
  });
  bindIfPresent(elements.saveZhejiangRareSpeciesBtn, "click", saveZhejiangRareSpecies);
  bindIfPresent(elements.checkZhejiangRareSpeciesBtn, "click", () => {
    checkZhejiangRareSpeciesToday({ source: "manual", notify: true });
  });
  bindIfPresent(elements.toggleZhejiangRareMonitorBtn, "click", toggleZhejiangRareMonitor);
  bindIfPresent(elements.zhejiangRareMonitorDate, "change", handleZhejiangRareMonitorDateChange);
  bindIfPresent(elements.speciesFilter, "change", renderRecordsOnly);
  bindIfPresent(elements.sortOrder, "change", renderRecordsOnly);
  bindIfPresent(elements.viewMode, "change", renderRecordsOnly);
  bindIfPresent(elements.lifeRegionFilter, "input", renderLifeList);
  bindIfPresent(elements.lifeBackDays, "input", renderLifeList);
  bindIfPresent(elements.speciesDiscoveryRegion, "input", renderSpeciesDiscovery);
  bindIfPresent(elements.speciesDiscoveryStart, "change", renderSpeciesDiscovery);
  bindIfPresent(elements.speciesDiscoveryEnd, "change", renderSpeciesDiscovery);
  bindIfPresent(elements.heatMetric, "change", renderMap);
  bindIfPresent(elements.regionQueryBackdrop, "click", closeRegionQueryDetail);
  bindIfPresent(elements.birdreportSpeciesDetailBackdrop, "click", closeBirdreportSpeciesDetail);
  bindIfPresent(elements.zhejiangRareSpeciesDetailBackdrop, "click", closeZhejiangRareSpeciesDetail);
  document.addEventListener("keydown", handleRegionQueryDetailHotkeys);
  document.querySelectorAll(".app-quicknav-btn").forEach((button) => {
    button.addEventListener("click", handleQuickNavClick);
  });
}

function handleQuickNavClick(event) {
  const targetId = event.currentTarget?.dataset?.target;
  if (!targetId) {
    return;
  }

  const section = document.getElementById(targetId);
  if (!section) {
    return;
  }

  setActiveQuickNav(targetId);
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setActiveQuickNav(targetId) {
  document.querySelectorAll(".app-quicknav-btn").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.target === targetId);
  });
}

function initEmbeddedAndroidQuickNav() {
  if (!isEmbeddedAndroidApp()) {
    return;
  }

  const sections = ["ebirdSection", "birdreportSection", "unlockedSection", "monitorSection"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (!sections.length || !("IntersectionObserver" in window)) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

      if (visible?.target?.id) {
        setActiveQuickNav(visible.target.id);
      }
    },
    {
      rootMargin: "-18% 0px -56% 0px",
      threshold: [0.2, 0.35, 0.55]
    }
  );

  sections.forEach((section) => observer.observe(section));
}

function importText(text, sourceName) {
  const trimmed = text.trim();
  if (!trimmed) {
    setMessage("没有可导入的内容。", true);
    return;
  }

  try {
    const imported = parseInput(trimmed);
    if (!imported.length) {
      setMessage("未识别到有效记录，请检查格式。", true);
      return;
    }

    state.personalRecords = normalizeRecords([...state.personalRecords, ...imported]);
    persistAndRender();
    setMessage(`已从${sourceName}导入 ${imported.length} 条个人记录，当前共 ${state.personalRecords.length} 条。`);
  } catch (error) {
    setMessage(`导入失败：${error.message}`, true);
  }
}

function parseInput(text) {
  const compact = text.trim();
  if (compact.startsWith("[") || compact.startsWith("{")) {
    return parseJsonInput(compact);
  }

  const firstLine = compact.split(/\r?\n/, 1)[0];
  if ((firstLine.includes(",") || firstLine.includes("\t")) && /date|species|location|lat|lng|common|observation/i.test(firstLine)) {
    return parseDelimitedInput(compact, firstLine.includes("\t") ? "\t" : ",");
  }

  return parseLineInput(compact);
}

function parseJsonInput(text) {
  const parsed = JSON.parse(text);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  return items.map((item) => toRecord(item));
}

function parseDelimitedInput(text, delimiter = ",") {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const headers = splitDelimitedLine(lines[0], delimiter).map((header) => normalizeHeaderName(header));
  return lines.slice(1).map((line) => {
    const cells = splitDelimitedLine(line, delimiter);
    const raw = headers.reduce((result, header, index) => {
      result[header] = cells[index] ?? "";
      return result;
    }, {});
    return toRecord(raw);
  });
}

function parseLineInput(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[\t,，]/).map((part) => part.trim());
      return toRecord({
        date: parts[0],
        species: parts[1],
        location: parts[2],
        lat: parts[3],
        lng: parts[4],
        notes: parts.slice(5).join(" ")
      });
    });
}

function splitDelimitedLine(line, delimiter = ",") {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === delimiter && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function toRecord(raw) {
  const record = normalizeRecord({
    date: getRawValue(raw, ["date", "observedat", "time", "obsdt", "observationdate"]),
    species: getRawValue(raw, ["species", "name", "bird", "commonname", "comname"]),
    location: getRawValue(raw, ["location", "place", "site", "locname", "locationname"]),
    notes: getRawValue(raw, ["notes", "note", "comment", "comments", "speciescomments"]),
    lat: getRawValue(raw, ["lat", "latitude"]),
    lng: getRawValue(raw, ["lng", "lon", "longitude"]),
    sciName: getRawValue(raw, ["sciname", "scientificname", "scientific_name"]),
    speciesCode: getRawValue(raw, ["speciescode", "species_code"]),
    taxonOrder: getRawValue(raw, ["taxonorder", "taxon_order"]),
    orderName: getRawValue(raw, ["ordername", "order", "order_name"]),
    familyName: getRawValue(raw, ["familyname", "family", "familysciname", "family_name"]),
    familyCommonName: getRawValue(raw, ["familycommonname", "familycommon", "familycomname", "family_common"]),
    genusName: getRawValue(raw, ["genusname", "genus", "genus_name"])
  });

  if (!record.date || !record.species || !record.location) {
    throw new Error("每条记录至少需要日期、种类和地点。");
  }

  return record;
}

function getRawValue(raw, keys) {
  for (const key of keys) {
    if (raw[key] != null && raw[key] !== "") {
      return raw[key];
    }

    const matchedKey = Object.keys(raw).find((rawKey) => normalizeHeaderName(rawKey) === normalizeHeaderName(key));
    if (matchedKey && raw[matchedKey] != null && raw[matchedKey] !== "") {
      return raw[matchedKey];
    }
  }
  return "";
}

function normalizeHeaderName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeRecords(records) {
  return records
    .map((record) => normalizeRecord(record))
    .filter((record) => record.date && record.species && record.location)
    .sort((left, right) => right.date.localeCompare(left.date));
}

function persistAndRender() {
  savePersonalRecords(state.personalRecords);
  render();
}

function render() {
  renderRegionQueryResults();
}

function renderFilters() {
  const previousValue = elements.speciesFilter.value;
  const speciesList = [...new Set(state.personalRecords.map((record) => record.species))].sort((a, b) => a.localeCompare(b, "zh-CN"));

  elements.speciesFilter.innerHTML = '<option value="">全部种类</option>';
  speciesList.forEach((species) => {
    const option = document.createElement("option");
    option.value = species;
    option.textContent = species;
    elements.speciesFilter.append(option);
  });

  if (speciesList.includes(previousValue)) {
    elements.speciesFilter.value = previousValue;
  }
}

function renderRecordsOnly() {
  const viewMode = elements.viewMode.value;
  const filtered = getVisibleRecords();

  elements.recordsContainer.className = `records ${viewMode === "list" ? "list" : "cards"}`;
  renderStats(filtered);
  renderTaxonomyBrowser(filtered);

  if (!filtered.length) {
    elements.recordsContainer.innerHTML = '<div class="empty-state">当前筛选条件下没有记录。</div>';
    return;
  }

  elements.recordsContainer.innerHTML = "";
  filtered.forEach((record) => {
    const item = document.createElement("article");
    item.className = "record";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(record.species)}</strong>
        <small>${escapeHtml(formatDate(record.date))}</small>
      </div>
      <div>${escapeHtml(record.location)}</div>
      <div>
        ${record.lat != null && record.lng != null ? `<small>坐标：${record.lat.toFixed(3)}, ${record.lng.toFixed(3)}</small>` : '<small>未提供坐标</small>'}
        ${record.notes ? `<div class="record-note">${escapeHtml(record.notes)}</div>` : ""}
      </div>
    `;
    elements.recordsContainer.append(item);
  });
}

function renderStats(records) {
  if (!state.personalRecords.length) {
    elements.statsSummary.textContent = "还没有观鸟记录。";
    return;
  }

  const speciesCount = new Set(records.map((record) => record.species)).size;
  const coordinateCount = records.filter((record) => record.lat != null && record.lng != null).length;
  elements.statsSummary.textContent = `当前展示 ${records.length} 条个人记录，涉及 ${speciesCount} 个种类，其中 ${coordinateCount} 条可用于地图热力图。`;
}

function renderTaxonomyBrowser(records) {
  elements.taxonomyBrowser.innerHTML = "";

  if (!records.length) {
    return;
  }

  const root = buildTaxonomyTree(records);
  if (!root) {
    return;
  }

  const list = document.createElement("ul");
  list.className = "taxonomy-list";
  list.append(renderTaxonomyNode(root, 0, "class:Aves"));
  elements.taxonomyBrowser.append(list);
}

function renderLifeList() {
  const context = getLifeListContext();
  elements.lifeSummary.textContent = context.summary;
  elements.lifeListContainer.innerHTML = "";

  if (!context.entries.length) {
    elements.lifeListContainer.innerHTML = '<div class="empty-state">当前区域和时间范围内还没有个人生涯记录。</div>';
    return;
  }

  context.entries.forEach((entry) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "life-item";
    item.innerHTML = `
      <strong>${escapeHtml(entry.species)}</strong>
      <span>最近记录：${escapeHtml(entry.lastSeenLabel)}</span>
      <span>首次记录：${escapeHtml(entry.firstSeenLabel)}</span>
      <span>累计 ${entry.count} 条 · ${entry.locationCount} 个地点</span>
    `;
    item.addEventListener("click", () => {
      elements.speciesFilter.value = entry.species;
      renderRecordsOnly();
    });
    elements.lifeListContainer.append(item);
  });
}

function renderSpeciesDiscovery() {
  const context = getSpeciesDiscoveryContext();
  elements.speciesDiscoverySummary.textContent = context.summary;
  elements.speciesDiscoveryContainer.innerHTML = "";

  if (!context.entries.length) {
    elements.speciesDiscoveryContainer.innerHTML = '<div class="empty-state">当前时间和地区条件下没有匹配到鸟种。</div>';
    return;
  }

  context.entries.forEach((entry) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "life-item";
    item.innerHTML = `
      <strong>${escapeHtml(entry.species)}</strong>
      <span>首次记录：${escapeHtml(entry.firstSeenLabel)}</span>
      <span>最近记录：${escapeHtml(entry.lastSeenLabel)}</span>
      <span>${entry.count} 条记录 · ${entry.locationCount} 个地点</span>
    `;
    item.addEventListener("click", () => {
      elements.speciesFilter.value = entry.species;
      renderRecordsOnly();
    });
    elements.speciesDiscoveryContainer.append(item);
  });
}

function renderRegionQueryResults() {
  elements.regionQuerySummary.textContent = "";
  elements.regionQueryContainer.innerHTML = "";

  if (!state.regionQueryRecords.length) {
    state.activeRegionRecordId = null;
    renderRegionQueryDetail();
    return;
  }

  const speciesCount = new Set(state.regionQueryRecords.map((record) => record.species)).size;
  elements.regionQuerySummary.textContent = `当前区域查询结果共 ${state.regionQueryRecords.length} 条，涉及 ${speciesCount} 个种类。这些结果不会保存到个人记录。`;

  if (!state.regionQueryRecords.some((record) => record.id === state.activeRegionRecordId)) {
    state.activeRegionRecordId = null;
  }

  elements.regionQueryContainer.innerHTML = `
    <div class="result-table" style="--table-columns: 72px minmax(210px, 1.4fr) minmax(260px, 1.9fr) 150px 116px;">
      <div class="result-table-header">
        <div class="result-table-cell">序号</div>
        <div class="result-table-cell">鸟种</div>
        <div class="result-table-cell">地点</div>
        <div class="result-table-cell">日期</div>
        <div class="result-table-cell">详情</div>
      </div>
      <div class="result-table-body">
        ${state.regionQueryRecords
          .map((record, index) => {
            const isActive = record.id === state.activeRegionRecordId;
            return `
              <div class="result-table-row${isActive ? " is-active" : ""}">
                <div class="result-table-cell result-table-index">${state.regionQueryRecords.length - index}</div>
                <div class="result-table-cell">
                  <button
                    type="button"
                    class="result-table-name-btn"
                    data-region-record-id="${escapeHtml(String(record.id || ""))}"
                    aria-pressed="${isActive ? "true" : "false"}"
                  >
                    <strong>${escapeHtml(record.species)}</strong>
                    <span class="result-table-meta">${escapeHtml(record.sciName || "点击查看详情")}</span>
                  </button>
                </div>
                <div class="result-table-cell result-table-location">${escapeHtml(record.location || "未提供地点")}</div>
                <div class="result-table-cell result-table-date">${escapeHtml(formatDate(record.date))}</div>
                <div class="result-table-cell result-table-status">${isActive ? "已展开" : "查看详情"}</div>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
  elements.regionQueryContainer.querySelectorAll("[data-region-record-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const recordId = button.dataset.regionRecordId || "";
      state.activeRegionRecordId = state.activeRegionRecordId === recordId ? null : recordId;
      renderRegionQueryResults();
    });
  });

  renderRegionQueryDetail();
}

function renderRegionQueryDetail() {
  const record = state.regionQueryRecords.find((entry) => entry.id === state.activeRegionRecordId);

  if (!record) {
    elements.regionQueryDetail.innerHTML = "";
    elements.regionQueryDetail.classList.add("is-hidden");
    elements.regionQueryBackdrop?.classList.add("is-hidden");
    document.body.classList.remove("query-detail-open");
    return;
  }

  const detailItems = [
    { label: "观测日期", value: formatDate(record.date) },
    { label: "观测地点", value: record.location },
    {
      label: "坐标",
      value: record.lat != null && record.lng != null ? `${record.lat.toFixed(4)}, ${record.lng.toFixed(4)}` : "未提供"
    },
    { label: "学名", value: record.sciName || "未提供" },
    { label: "物种代码", value: record.speciesCode || "未提供" },
    { label: "目", value: formatTaxonLabel("order", record.orderName) },
    { label: "科", value: formatTaxonLabel("family", record.familyName, record.familyCommonName) },
    { label: "属", value: formatTaxonLabel("genus", record.genusName) },
    { label: "备注", value: record.notes || "未提供" }
  ];

  elements.regionQueryDetail.innerHTML = `
    <div class="query-detail-header">
      <div>
        <h3 class="query-detail-title">${escapeHtml(record.species)}</h3>
        <p class="query-detail-subtitle">详情固定显示在右侧，方便你连续点不同卡片快速对比。</p>
      </div>
      <button type="button" class="ghost query-detail-close">收起详情</button>
    </div>
    <div class="query-detail-grid">
      ${detailItems
        .map(
          (item) => `
            <div class="query-detail-item">
              <strong>${escapeHtml(item.label)}</strong>
              <span>${escapeHtml(item.value)}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
  elements.regionQueryDetail.classList.remove("is-hidden");
  elements.regionQueryBackdrop?.classList.remove("is-hidden");
  document.body.classList.add("query-detail-open");
  elements.regionQueryDetail.querySelector(".query-detail-close")?.addEventListener("click", closeRegionQueryDetail);
}

function closeRegionQueryDetail() {
  if (!state.activeRegionRecordId) {
    return;
  }

  state.activeRegionRecordId = null;
  renderRegionQueryResults();
}

function handleRegionQueryDetailHotkeys(event) {
  if (event.key !== "Escape") {
    return;
  }

  if (state.activeRegionRecordId) {
    closeRegionQueryDetail();
  }

  if (state.activeBirdreportSpeciesKey) {
    closeBirdreportSpeciesDetail();
  }

  if (state.activeZhejiangRareSpeciesKey) {
    closeZhejiangRareSpeciesDetail();
  }

  if (state.activeEbirdSeasonalSpeciesCode) {
    state.activeEbirdSeasonalSpeciesCode = "";
    renderEbirdSeasonalPrediction();
  }
}

function getVisibleRecords() {
  const species = elements.speciesFilter.value;
  const sortOrder = elements.sortOrder.value;

  return state.personalRecords
    .filter((record) => !species || record.species === species)
    .sort((left, right) => {
      const result = left.date.localeCompare(right.date);
      return sortOrder === "asc" ? result : -result;
    });
}

function getLifeListContext() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!state.personalRecords.length) {
    return {
      entries: [],
      summary: "还没有可统计的个人记录。"
    };
  }

  const regionInput = String(elements.lifeRegionFilter.value || "").trim();
  const regionKeyword = regionInput.toLocaleLowerCase("zh-CN");
  const backDays = parsePositiveInteger(elements.lifeBackDays.value);
  const earliestDate = state.personalRecords.reduce(
    (result, record) => (record.date < result ? record.date : result),
    state.personalRecords[0].date
  );
  const startDate = backDays == null ? earliestDate : formatIsoDate(addDays(today, -(backDays - 1)));
  const endDate = formatIsoDate(today);
  const filteredRecords = state.personalRecords.filter((record) => {
    const inRegion = !regionKeyword || record.location.toLocaleLowerCase("zh-CN").includes(regionKeyword);
    const inRange = record.date >= startDate && record.date <= endDate;
    return inRegion && inRange;
  });
  const grouped = buildSpeciesAggregate(filteredRecords);

  const entries = [...grouped.values()]
    .map((entry) => ({
      species: entry.species,
      count: entry.count,
      firstSeen: entry.firstSeen,
      lastSeen: entry.lastSeen,
      firstSeenLabel: formatDate(entry.firstSeen),
      lastSeenLabel: formatDate(entry.lastSeen),
      locationCount: entry.locations.size
    }))
    .sort((left, right) => {
      if (left.lastSeen !== right.lastSeen) {
        return right.lastSeen.localeCompare(left.lastSeen);
      }
      if (left.count !== right.count) {
        return right.count - left.count;
      }
      return left.species.localeCompare(right.species, "zh-CN");
    });

  const regionText = regionInput ? `区域包含“${regionInput}”` : "全部区域";
  const timeText =
    backDays == null ? `${formatDate(startDate)} 至 ${formatDate(endDate)}` : `最近 ${backDays} 天（${formatDate(startDate)} 至 ${formatDate(endDate)}）`;

  return {
    entries,
    summary: `${regionText}，时间范围 ${timeText}，累计 ${filteredRecords.length} 条记录，涉及 ${entries.length} 个生涯种。`
  };
}

function getSpeciesDiscoveryContext() {
  if (!state.personalRecords.length) {
    return {
      entries: [],
      summary: "还没有可筛选的个人记录。"
    };
  }

  const regionInput = String(elements.speciesDiscoveryRegion.value || "").trim();
  const regionKeyword = regionInput.toLocaleLowerCase("zh-CN");
  const startDate = normalizeDateInput(elements.speciesDiscoveryStart.value) || getRecordBoundaryDate("earliest");
  const endDate = normalizeDateInput(elements.speciesDiscoveryEnd.value) || getRecordBoundaryDate("latest");
  const validStartDate = startDate <= endDate ? startDate : endDate;
  const validEndDate = startDate <= endDate ? endDate : startDate;
  const filteredRecords = state.personalRecords.filter((record) => {
    const inRegion = !regionKeyword || record.location.toLocaleLowerCase("zh-CN").includes(regionKeyword);
    const inRange = record.date >= validStartDate && record.date <= validEndDate;
    return inRegion && inRange;
  });
  const grouped = buildSpeciesAggregate(filteredRecords);
  const entries = [...grouped.values()]
    .map((entry) => ({
      species: entry.species,
      count: entry.count,
      firstSeen: entry.firstSeen,
      lastSeen: entry.lastSeen,
      firstSeenLabel: formatDate(entry.firstSeen),
      lastSeenLabel: formatDate(entry.lastSeen),
      locationCount: entry.locations.size
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      if (right.lastSeen !== left.lastSeen) {
        return right.lastSeen.localeCompare(left.lastSeen);
      }
      return left.species.localeCompare(right.species, "zh-CN");
    });

  return {
    entries,
    summary: `筛选范围：${regionInput || "全部地区"} · ${formatDate(validStartDate)} 至 ${formatDate(validEndDate)}，共找到 ${entries.length} 个鸟种，匹配 ${filteredRecords.length} 条记录。`
  };
}

function buildSpeciesAggregate(records) {
  const grouped = new Map();

  records.forEach((record) => {
    if (!grouped.has(record.species)) {
      grouped.set(record.species, {
        species: record.species,
        count: 0,
        firstSeen: record.date,
        lastSeen: record.date,
        locations: new Set()
      });
    }

    const bucket = grouped.get(record.species);
    bucket.count += 1;
    bucket.firstSeen = record.date < bucket.firstSeen ? record.date : bucket.firstSeen;
    bucket.lastSeen = record.date > bucket.lastSeen ? record.date : bucket.lastSeen;
    bucket.locations.add(record.location);
  });

  return grouped;
}

function getRecordBoundaryDate(mode) {
  if (!state.personalRecords.length) {
    return formatIsoDate(new Date());
  }

  return state.personalRecords.reduce((result, record) => {
    if (mode === "earliest") {
      return record.date < result ? record.date : result;
    }
    return record.date > result ? record.date : result;
  }, state.personalRecords[0].date);
}

function normalizeDateInput(value) {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function initMap() {
  if (!window.L) {
    setMessage("地图组件未加载，地图热力图不可用。", true);
    return;
  }

  state.map = L.map("map", {
    center: [31.23, 121.47],
    zoom: 5,
    scrollWheelZoom: true
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(state.map);
}

function renderMap() {
  if (!state.map || !window.L || !L.heatLayer) {
    return;
  }

  const points = buildHeatPoints(elements.heatMetric.value);
  if (state.heatLayer) {
    state.map.removeLayer(state.heatLayer);
    state.heatLayer = null;
  }

  if (!points.length) {
    state.map.setView([31.23, 121.47], 5);
    return;
  }

  state.heatLayer = L.heatLayer(points, {
    radius: 28,
    blur: 22,
    maxZoom: 10,
    minOpacity: 0.4
  }).addTo(state.map);

  const bounds = L.latLngBounds(points.map(([lat, lng]) => [lat, lng]));
  state.map.fitBounds(bounds.pad(0.35));
}

function buildHeatPoints(metric) {
  const coordinateRecords = state.personalRecords.filter((record) => record.lat != null && record.lng != null);
  if (!coordinateRecords.length) {
    return [];
  }

  const grouped = new Map();
  coordinateRecords.forEach((record) => {
    const key = `${record.lat.toFixed(4)},${record.lng.toFixed(4)}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        lat: record.lat,
        lng: record.lng,
        count: 0,
        species: new Set()
      });
    }

    const bucket = grouped.get(key);
    bucket.count += 1;
    bucket.species.add(record.species);
  });

  const rawPoints = [...grouped.values()].map((item) => [
    item.lat,
    item.lng,
    metric === "speciesRichness" ? item.species.size : item.count
  ]);

  const maxWeight = Math.max(...rawPoints.map((point) => point[2]), 1);
  return rawPoints.map(([lat, lng, weight]) => [lat, lng, weight / maxWeight]);
}

function renderCalendarHeatmap() {
  const days = buildCalendarDays();
  const counts = state.personalRecords.reduce((result, record) => {
    result[record.date] = (result[record.date] || 0) + 1;
    return result;
  }, {});
  const maxCount = Math.max(...Object.values(counts), 0);

  renderLegend(maxCount);
  elements.calendarHeatmap.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "calendar-grid";

  days.forEach((day) => {
    const cell = document.createElement("div");
    const count = day ? counts[day] || 0 : 0;

    cell.className = `day-cell${day ? "" : " empty"}`;
    if (day) {
      cell.style.background = calendarColor(count, maxCount);
      cell.title = `${day}：${count} 条记录`;
    }
    grid.append(cell);
  });

  elements.calendarHeatmap.append(grid);
}

function renderLegend(maxCount) {
  const levels = [0, 0.25, 0.5, 0.75, 1];
  const scale = levels
    .map((level) => `<span class="legend-cell" style="background:${calendarColor(Math.round(maxCount * level), maxCount)}"></span>`)
    .join("");

  elements.calendarLegend.innerHTML = `
    <span>少</span>
    <span class="legend-scale">${scale}</span>
    <span>多</span>
  `;
}

async function syncEbirdRecords() {
  const apiKey = elements.ebirdApiKey.value.trim();
  const regionCode = elements.ebirdRegionCode.value.trim();
  const backDays = clampBackDays(elements.ebirdBackDays.value);

  if (!apiKey) {
    setEbirdMessage("请先输入 eBird API 密钥。", true);
    elements.ebirdApiKey.focus();
    return;
  }

  if (!regionCode) {
    setEbirdMessage("请先输入区域代码，例如 CN-31 或 L7884500。", true);
    elements.ebirdRegionCode.focus();
    return;
  }

  elements.ebirdBackDays.value = String(backDays);
  persistEbirdSettings();
  setEbirdLoading(true);
  setEbirdMessage("正在查询 eBird 区域最近观测...");

  try {
    const url = new URL(`https://api.ebird.org/v2/data/obs/${encodeURIComponent(regionCode)}/recent`);
    url.searchParams.set("back", String(backDays));
    url.searchParams.set("maxResults", "500");
    url.searchParams.set("sppLocale", EBIRD_SPECIES_LOCALE);

    const response = await fetch(url, {
      headers: {
        "X-eBirdApiToken": apiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`eBird 返回 ${response.status}：${errorText || "请求失败"}`);
    }

    const payload = await response.json();
    let taxonomyMap = new Map();

    try {
      taxonomyMap = await fetchEbirdTaxonomyMap(apiKey, payload.map((observation) => observation.speciesCode));
    } catch (taxonomyError) {
      console.warn("Failed to enrich taxonomy from eBird:", taxonomyError);
    }

    const imported = normalizeEbirdObservations(payload, taxonomyMap);
    state.regionQueryRecords = imported;
    renderRegionQueryResults();

    if (!imported.length) {
      setEbirdMessage("eBird 已连接成功，但这个区域在所选天数内没有可显示的观测。");
      return;
    }

    setEbirdMessage(`eBird 区域查询完成：抓取 ${imported.length} 条结果。这些结果仅供查看，不会保存到个人记录。`);
  } catch (error) {
    state.regionQueryRecords = [];
    renderRegionQueryResults();
    const extra =
      error instanceof TypeError
        ? " 这通常是浏览器跨域限制或网络拦截导致的；如果页面是纯静态部署，可能需要加一个后端代理。"
        : "";
    setEbirdMessage(`查询失败：${error.message}${extra}`, true);
  } finally {
    setEbirdLoading(false);
  }
}

function hydrateEbirdInputs() {
  elements.ebirdApiKey.value = localStorage.getItem(EBIRD_API_KEY_STORAGE) || "";
  elements.ebirdRegionCode.value = localStorage.getItem(EBIRD_REGION_STORAGE) || "";
  elements.ebirdBackDays.value = localStorage.getItem(EBIRD_BACK_STORAGE) || "14";
}

function persistEbirdSettings() {
  const backDays = clampBackDays(elements.ebirdBackDays.value);
  elements.ebirdBackDays.value = String(backDays);
  localStorage.setItem(EBIRD_API_KEY_STORAGE, elements.ebirdApiKey.value.trim());
  localStorage.setItem(EBIRD_REGION_STORAGE, elements.ebirdRegionCode.value.trim());
  localStorage.setItem(EBIRD_BACK_STORAGE, String(backDays));
}

function clearEbirdApiKey() {
  elements.ebirdApiKey.value = "";
  localStorage.removeItem(EBIRD_API_KEY_STORAGE);
  setEbirdMessage("已清除本地保存的 eBird API 密钥。");
}

function hydrateEbirdSeasonalInputs() {
  let settings = {};
  try {
    settings = JSON.parse(localStorage.getItem(EBIRD_SEASONAL_SETTINGS_STORAGE) || "{}");
  } catch (error) {
    settings = {};
  }

  if (elements.ebirdSeasonalDate) {
    elements.ebirdSeasonalDate.value = normalizeDateInput(settings.targetDate) || formatIsoDate(new Date());
  }
  if (elements.ebirdSeasonalYears) {
    elements.ebirdSeasonalYears.value = String(clampEbirdSeasonalYears(settings.yearCount));
  }
  if (elements.ebirdSeasonalWindow) {
    elements.ebirdSeasonalWindow.value = String(clampEbirdSeasonalWindow(settings.windowDays));
  }
}

function persistEbirdSeasonalSettings() {
  const settings = getEbirdSeasonalSettings();
  localStorage.setItem(EBIRD_SEASONAL_SETTINGS_STORAGE, JSON.stringify(settings));
}

function getEbirdSeasonalSettings() {
  const targetDate = normalizeDateInput(elements.ebirdSeasonalDate?.value) || formatIsoDate(new Date());
  const yearCount = clampEbirdSeasonalYears(elements.ebirdSeasonalYears?.value);
  const windowDays = clampEbirdSeasonalWindow(elements.ebirdSeasonalWindow?.value);

  if (elements.ebirdSeasonalDate) {
    elements.ebirdSeasonalDate.value = targetDate;
  }
  if (elements.ebirdSeasonalYears) {
    elements.ebirdSeasonalYears.value = String(yearCount);
  }
  if (elements.ebirdSeasonalWindow) {
    elements.ebirdSeasonalWindow.value = String(windowDays);
  }

  return {
    targetDate,
    yearCount,
    windowDays
  };
}

async function analyzeEbirdSeasonalPrediction() {
  const apiKey = elements.ebirdApiKey.value.trim();
  if (!apiKey) {
    setEbirdSeasonalMessage("请先在上方输入 eBird API 密钥。", true);
    elements.ebirdApiKey.focus();
    return;
  }

  const core = getEbirdSeasonalCore();
  if (!core) {
    setEbirdSeasonalMessage("eBird 季节分析模块未加载，请刷新页面后重试。", true);
    return;
  }

  const settings = getEbirdSeasonalSettings();
  persistEbirdSeasonalSettings();
  const requests = core.buildEbirdSeasonalDateRequests(settings.targetDate, settings.yearCount, settings.windowDays);
  if (!requests.length) {
    state.ebirdSeasonalResults = [];
    state.ebirdSeasonalMeta = null;
    renderEbirdSeasonalPrediction();
    setEbirdSeasonalMessage("这个目标日期在所选历史年份中没有可比日期，常见原因是 2 月 29 日且历史年份都不是闰年。", true);
    return;
  }

  setEbirdSeasonalLoading(true);
  setEbirdSeasonalMessage(`正在分析浙江 ${formatDate(settings.targetDate)} 前后 ${settings.windowDays} 天的多年历史记录...`);

  try {
    const dailyResult = await fetchEbirdSeasonalDailyEntries(apiKey, requests, (progress) => {
      setEbirdSeasonalMessage(
        `正在读取历史窗口：${progress.done}/${progress.total} 天，缓存 ${progress.cacheHits} 天，新拉取 ${progress.fetched} 天。`
      );
    });

    if (!dailyResult.dailyEntries.length) {
      state.ebirdSeasonalResults = [];
      state.ebirdSeasonalMeta = {
        ...settings,
        totalRequests: requests.length,
        successfulDays: 0,
        failedDays: dailyResult.failures.length,
        cacheHits: dailyResult.cacheHits,
        fetched: dailyResult.fetched,
        recentCount: 0,
        historicalYears: [...new Set(requests.map((entry) => entry.anchorYear))],
        generatedAt: new Date().toISOString()
      };
      renderEbirdSeasonalPrediction();
      setEbirdSeasonalMessage("历史窗口没有成功读取到可分析数据，请稍后重试或检查网络。", true);
      return;
    }

    const recentObservations = await fetchEbirdRecentSeasonalObservations(apiKey);
    const speciesCodes = [
      ...new Set([
        ...dailyResult.dailyEntries.flatMap((entry) => entry.observations.map((observation) => observation.speciesCode).filter(Boolean)),
        ...recentObservations.map((observation) => observation.speciesCode).filter(Boolean)
      ])
    ];
    let taxonomyMap = new Map();
    try {
      taxonomyMap = await fetchEbirdTaxonomyMap(apiKey, speciesCodes);
    } catch (taxonomyError) {
      console.warn("Failed to enrich seasonal taxonomy from eBird:", taxonomyError);
    }

    const successfulHistoricalYears = [...new Set(dailyResult.dailyEntries.map((entry) => entry.anchorYear))].sort((left, right) => left - right);
    const results = core.aggregateEbirdSeasonalPrediction({
      dailyEntries: dailyResult.dailyEntries,
      recentObservations,
      taxonomyMap,
      historicalYearCount: successfulHistoricalYears.length,
      totalHistoricalDays: dailyResult.dailyEntries.length
    });

    state.ebirdSeasonalResults = results;
    state.activeEbirdSeasonalSpeciesCode = "";
    state.ebirdSeasonalMeta = {
      ...settings,
      totalRequests: requests.length,
      successfulDays: dailyResult.dailyEntries.length,
      failedDays: dailyResult.failures.length,
      cacheHits: dailyResult.cacheHits,
      fetched: dailyResult.fetched,
      recentCount: recentObservations.length,
      historicalYears: successfulHistoricalYears,
      generatedAt: new Date().toISOString()
    };
    renderEbirdSeasonalPrediction();

    const highCount = results.filter((entry) => entry.probabilityLevel === "高概率").length;
    setEbirdSeasonalMessage(
      `浙江当季分析完成：${results.length} 个候选鸟种，其中高概率 ${highCount} 种；历史读取成功 ${dailyResult.dailyEntries.length}/${requests.length} 天。`
    );
  } catch (error) {
    state.ebirdSeasonalResults = [];
    state.ebirdSeasonalMeta = null;
    renderEbirdSeasonalPrediction();
    const extra =
      error instanceof TypeError
        ? " 这通常是浏览器跨域限制或网络拦截导致的；如果页面是纯静态部署，可能需要加一个后端代理。"
        : "";
    setEbirdSeasonalMessage(`浙江当季分析失败：${error.message}${extra}`, true);
  } finally {
    setEbirdSeasonalLoading(false);
  }
}

function renderEbirdSeasonalPrediction() {
  if (!elements.ebirdSeasonalContainer || !elements.ebirdSeasonalSummary) {
    return;
  }

  const results = state.ebirdSeasonalResults || [];
  const meta = state.ebirdSeasonalMeta;
  elements.ebirdSeasonalContainer.innerHTML = "";
  elements.ebirdSeasonalSummary.textContent = meta
    ? [
        `区域 ${EBIRD_SEASONAL_REGION_CODE}`,
        `目标 ${formatDate(meta.targetDate)}`,
        `窗口 ±${meta.windowDays} 天`,
        `历史 ${formatSeasonalYearRange(meta.historicalYears)}`,
        `成功 ${meta.successfulDays}/${meta.totalRequests} 天`,
        `近期记录 ${meta.recentCount} 条`
      ].join(" · ")
    : "尚未分析。结果会显示基于 eBird 历史提交记录推算出的当季候选鸟种。";

  if (!results.length) {
    elements.ebirdSeasonalContainer.innerHTML = '<div class="empty-state">分析结果会显示在这里。</div>';
    return;
  }

  const rows = results
    .map((entry, index) => {
      const isActive = entry.speciesCode === state.activeEbirdSeasonalSpeciesCode;
      return `
        <div class="result-table-row seasonal-prediction-row${isActive ? " is-active" : ""}">
          <div class="result-table-cell result-table-index">${index + 1}</div>
          <div class="result-table-cell">
            <button type="button" class="result-table-name-btn" data-seasonal-species-code="${escapeHtml(entry.speciesCode)}" aria-expanded="${isActive ? "true" : "false"}">
              <strong>${escapeHtml(entry.commonName)}</strong>
              <span class="result-table-meta">${escapeHtml(entry.sciName || entry.speciesCode)}</span>
            </button>
          </div>
          <div class="result-table-cell result-table-status">
            <span class="seasonal-probability ${getSeasonalProbabilityClass(entry.probabilityLevel)}">${escapeHtml(entry.probabilityLevel)}</span>
            <small>${escapeHtml(entry.score.toFixed(2))}</small>
          </div>
          <div class="result-table-cell result-table-count">${escapeHtml(String(entry.yearsSeen))} 年</div>
          <div class="result-table-cell result-table-count">${escapeHtml(String(entry.hitDays))} 天</div>
          <div class="result-table-cell result-table-status">${entry.recentConfirmed ? "已确认" : "未确认"}</div>
          <div class="result-table-cell result-table-location">${escapeHtml(formatSeasonalRecentEvidence(entry))}</div>
        </div>
      `;
    })
    .join("");

  const activeEntry = results.find((entry) => entry.speciesCode === state.activeEbirdSeasonalSpeciesCode);
  elements.ebirdSeasonalContainer.innerHTML = `
    <div class="result-table seasonal-prediction-table" style="--table-columns: 56px minmax(180px, 1.3fr) 96px 90px 90px 96px minmax(180px, 1.2fr);">
      <div class="result-table-header">
        <div class="result-table-cell">排名</div>
        <div class="result-table-cell">鸟种</div>
        <div class="result-table-cell">概率</div>
        <div class="result-table-cell">命中年份</div>
        <div class="result-table-cell">命中天数</div>
        <div class="result-table-cell">近期</div>
        <div class="result-table-cell">近期证据</div>
      </div>
      <div class="result-table-body">
        ${rows}
      </div>
    </div>
    ${activeEntry ? renderEbirdSeasonalDetail(activeEntry) : ""}
  `;

  elements.ebirdSeasonalContainer.querySelectorAll("[data-seasonal-species-code]").forEach((button) => {
    button.addEventListener("click", () => {
      const speciesCode = button.dataset.seasonalSpeciesCode || "";
      state.activeEbirdSeasonalSpeciesCode = state.activeEbirdSeasonalSpeciesCode === speciesCode ? "" : speciesCode;
      renderEbirdSeasonalPrediction();
    });
  });
}

function renderEbirdSeasonalDetail(entry) {
  const dates = entry.historicalDates.slice(0, 40).map((date) => formatDate(date)).join("、");
  const extraDates = entry.historicalDates.length > 40 ? ` 等 ${entry.historicalDates.length} 天` : "";
  return `
    <div class="seasonal-prediction-detail">
      <div class="seasonal-detail-card">
        <strong>历史年份</strong>
        <span>${escapeHtml(entry.historicalYears.join("、") || "暂无")}</span>
      </div>
      <div class="seasonal-detail-card">
        <strong>历史命中日期</strong>
        <span>${escapeHtml(dates || "暂无")}${escapeHtml(extraDates)}</span>
      </div>
      <div class="seasonal-detail-card">
        <strong>近期证据</strong>
        <span>${escapeHtml(formatSeasonalRecentEvidence(entry))}</span>
      </div>
      <div class="seasonal-detail-card">
        <strong>说明</strong>
        <span>这是基于 eBird 历史提交记录的出现可能性，不代表未列出的鸟种不会出现。</span>
      </div>
    </div>
  `;
}

function clearEbirdSeasonalCache() {
  localStorage.removeItem(EBIRD_SEASONAL_CACHE_STORAGE);
  setEbirdSeasonalMessage("已清除浙江当季分析的历史缓存；下次分析会重新请求 eBird。");
}

async function fetchEbirdSeasonalDailyEntries(apiKey, requests, onProgress) {
  const cache = loadEbirdSeasonalCache();
  const entries = [];
  const failures = [];
  let cacheHits = 0;
  let fetched = 0;
  let done = 0;

  const tasks = requests.map((request) => async () => {
    const cached = getCachedEbirdSeasonalDay(cache, request.date);
    if (cached) {
      cacheHits += 1;
      done += 1;
      onProgress?.({ done, total: requests.length, cacheHits, fetched });
      return {
        anchorYear: request.anchorYear,
        date: request.date,
        observations: cached
      };
    }

    try {
      const observations = await fetchEbirdHistoricSpeciesForDate(apiKey, request.date);
      setCachedEbirdSeasonalDay(cache, request.date, observations);
      fetched += 1;
      done += 1;
      onProgress?.({ done, total: requests.length, cacheHits, fetched });
      return {
        anchorYear: request.anchorYear,
        date: request.date,
        observations
      };
    } catch (error) {
      failures.push({ ...request, error: error.message });
      done += 1;
      onProgress?.({ done, total: requests.length, cacheHits, fetched });
      return null;
    }
  });

  const results = await runLimitedConcurrency(tasks, EBIRD_SEASONAL_CONCURRENCY);
  results.forEach((entry) => {
    if (entry) {
      entries.push(entry);
    }
  });
  saveEbirdSeasonalCache(cache);

  return {
    dailyEntries: entries,
    failures,
    cacheHits,
    fetched
  };
}

async function fetchEbirdHistoricSpeciesForDate(apiKey, date) {
  const { year, month, day } = parseIsoDateParts(date);
  const url = new URL(`https://api.ebird.org/v2/data/obs/${EBIRD_SEASONAL_REGION_CODE}/historic/${year}/${month}/${day}`);
  url.searchParams.set("cat", "species");
  url.searchParams.set("sppLocale", EBIRD_SPECIES_LOCALE);
  url.searchParams.set("maxResults", "500");

  const response = await fetch(url, {
    headers: {
      "X-eBirdApiToken": apiKey
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`historic ${date} 返回 ${response.status}：${errorText || "请求失败"}`);
  }

  return normalizeEbirdSeasonalObservationList(await response.json());
}

async function fetchEbirdRecentSeasonalObservations(apiKey) {
  const url = new URL(`https://api.ebird.org/v2/data/obs/${EBIRD_SEASONAL_REGION_CODE}/recent`);
  url.searchParams.set("back", "30");
  url.searchParams.set("cat", "species");
  url.searchParams.set("sppLocale", EBIRD_SPECIES_LOCALE);
  url.searchParams.set("maxResults", "500");

  const response = await fetch(url, {
    headers: {
      "X-eBirdApiToken": apiKey
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`recent 返回 ${response.status}：${errorText || "请求失败"}`);
  }

  return normalizeEbirdSeasonalObservationList(await response.json());
}

function normalizeEbirdSeasonalObservationList(payload) {
  const unique = new Map();
  (Array.isArray(payload) ? payload : []).forEach((item) => {
    const speciesCode = String(item?.speciesCode || "").trim();
    if (!speciesCode) {
      return;
    }

    const existing = unique.get(speciesCode);
    if (existing && String(existing.obsDt || "") >= String(item?.obsDt || "")) {
      return;
    }

    unique.set(speciesCode, {
      speciesCode,
      comName: simplifyChineseText(item?.comName || ""),
      sciName: String(item?.sciName || "").trim(),
      obsDt: String(item?.obsDt || "").trim(),
      locName: String(item?.locName || item?.locId || "").trim()
    });
  });
  return [...unique.values()];
}

function loadEbirdSeasonalCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(EBIRD_SEASONAL_CACHE_STORAGE) || "{}");
    return {
      version: 1,
      days: parsed?.days && typeof parsed.days === "object" ? parsed.days : {}
    };
  } catch (error) {
    console.warn("Failed to load eBird seasonal cache:", error);
    return { version: 1, days: {} };
  }
}

function saveEbirdSeasonalCache(cache) {
  localStorage.setItem(
    EBIRD_SEASONAL_CACHE_STORAGE,
    JSON.stringify({
      version: 1,
      days: cache.days || {}
    })
  );
}

function getCachedEbirdSeasonalDay(cache, date) {
  const key = getEbirdSeasonalCacheKey(date);
  const cached = cache.days?.[key];
  if (!cached || !Array.isArray(cached.observations)) {
    return null;
  }

  const savedAt = Date.parse(cached.savedAt || "");
  if (!Number.isFinite(savedAt) || Date.now() - savedAt > EBIRD_SEASONAL_CACHE_TTL_MS) {
    delete cache.days[key];
    return null;
  }

  return cached.observations;
}

function setCachedEbirdSeasonalDay(cache, date, observations) {
  cache.days[getEbirdSeasonalCacheKey(date)] = {
    savedAt: new Date().toISOString(),
    observations
  };
}

function getEbirdSeasonalCacheKey(date) {
  return `${EBIRD_SEASONAL_REGION_CODE}|${date}`;
}

async function runLimitedConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  const workerCount = Math.min(Math.max(1, limit), tasks.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

function parseIsoDateParts(date) {
  const normalized = normalizeDateInput(date);
  if (!normalized) {
    throw new Error(`日期格式无效：${date}`);
  }
  const [year, month, day] = normalized.split("-").map(Number);
  return { year, month, day };
}

function getEbirdSeasonalCore() {
  return window.EBIRD_SEASONAL_CORE || null;
}

function formatSeasonalYearRange(years = []) {
  if (!years.length) {
    return "无";
  }
  if (years.length === 1) {
    return String(years[0]);
  }
  return `${years[0]}-${years[years.length - 1]}`;
}

function formatSeasonalRecentEvidence(entry) {
  if (!entry.recentConfirmed) {
    return "最近 30 天未确认";
  }
  const date = normalizeDate(entry.recentDate);
  const dateLabel = date ? formatDate(date) : "日期未知";
  return [dateLabel, entry.recentLocation].filter(Boolean).join(" · ");
}

function getSeasonalProbabilityClass(level) {
  if (level === "高概率") {
    return "is-high";
  }
  if (level === "中概率") {
    return "is-medium";
  }
  return "is-low";
}

function isEmbeddedAndroidApp() {
  return navigator.userAgent.includes(ANDROID_APP_USER_AGENT_TOKEN);
}

function getDefaultBirdreportProxyUrl() {
  return DEFAULT_BIRDREPORT_PROXY_URL;
}

function applyRuntimeEnvironment() {
  if (isEmbeddedAndroidApp()) {
    document.body.classList.add("embedded-android-app");
  }
}

function lockEmbeddedAndroidViewport() {
  if (!isEmbeddedAndroidApp()) {
    return;
  }

  const applyViewport = () => {
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement("meta");
      viewport.setAttribute("name", "viewport");
      document.head.append(viewport);
    }

    viewport.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    );

    document.documentElement.style.width = "100%";
    document.documentElement.style.maxWidth = "100%";
    document.body.style.width = "100%";
    document.body.style.maxWidth = "100%";
    document.body.style.overflowX = "hidden";
  };

  applyViewport();
  window.addEventListener("resize", applyViewport, { passive: true });
  window.visualViewport?.addEventListener("resize", applyViewport, { passive: true });
  window.addEventListener("orientationchange", applyViewport, { passive: true });
}

function hydrateBirdreportProxyInputs() {
  const stored = localStorage.getItem(BIRDREPORT_PROXY_URL_STORAGE);
  const value = isEmbeddedAndroidApp() ? getDefaultBirdreportProxyUrl() : stored || getDefaultBirdreportProxyUrl();
  elements.birdreportProxyUrl.value = value;
}

function persistBirdreportProxySettings() {
  const value = isEmbeddedAndroidApp() ? getDefaultBirdreportProxyUrl() : elements.birdreportProxyUrl.value.trim();
  elements.birdreportProxyUrl.value = value;
  localStorage.setItem(BIRDREPORT_PROXY_URL_STORAGE, value);
}

function hydrateZhejiangRareMonitorInputs() {
  const targetDate = normalizeDateInput(state.zhejiangRareMonitor?.targetDate) || formatIsoDate(new Date());
  state.zhejiangRareMonitor.targetDate = targetDate;
  if (elements.zhejiangRareMonitorDate) {
    elements.zhejiangRareMonitorDate.value = targetDate;
  }
  saveZhejiangRareMonitor(state.zhejiangRareMonitor);
}

function handleZhejiangRareMonitorDateChange() {
  const targetDate = getSelectedZhejiangRareMonitorDate();
  state.zhejiangRareMonitor.targetDate = targetDate;
  state.zhejiangRareHits = [];
  clearZhejiangRareSpeciesDetail();
  saveZhejiangRareMonitor(state.zhejiangRareMonitor);
  renderZhejiangRareSpeciesPanel();

  if (state.zhejiangRareMonitor.enabled) {
    setZhejiangRareSpeciesMessage(`监测日期已改为 ${targetDate}，后续每小时检查会按这个日期执行。`);
  } else {
    setZhejiangRareSpeciesMessage(`已选择检查日期 ${targetDate}。`);
  }
}

async function initBirdreportProxy() {
  if (!canUseBirdreportProxy()) {
    elements.queryBirdreportProxyBtn.disabled = true;
    return;
  }

  try {
    await loadBirdreportProvinces();
  } catch (error) {
    setBirdreportMessage(`代理初始化失败：${error.message}`, true);
  }
}

function canUseBirdreportProxy() {
  if (typeof window.fetch !== "function") {
    setBirdreportMessage("当前环境缺少 fetch，暂时无法连接 BirdReport 代理。", true);
    return false;
  }

  if (!window.JSEncrypt || typeof window.MD5 !== "function") {
    setBirdreportMessage("BirdReport 请求签名依赖未加载，暂时无法连接代理。", true);
    return false;
  }

  return true;
}

function initZhejiangRareSpeciesMonitor() {
  if (!state.zhejiangRareMonitor.enabled) {
    renderZhejiangRareSpeciesPanel();
    return;
  }

  startZhejiangRareMonitor({ silent: true });
}

function renderZhejiangRareSpeciesPanel() {
  const rareSpecies = state.zhejiangRareSpecies?.species || [];
  const monitor = state.zhejiangRareMonitor || {};
  const status = monitor.enabled ? "运行中" : "未启动";
  const targetDate = getSelectedZhejiangRareMonitorDate();
  const savedLabel = state.zhejiangRareSpecies?.savedAt ? formatDateTime(state.zhejiangRareSpecies.savedAt) : "尚未保存";
  const checkedLabel = monitor.lastCheckedAt
    ? `${formatDateTime(monitor.lastCheckedAt)}（检查 ${monitor.lastCheckedDate || targetDate}）`
    : "尚未检查";
  const hitLabel = monitor.lastHitAt ? formatDateTime(monitor.lastHitAt) : "所选日期暂无命中";
  const targetDateLabel = formatDate(targetDate);
  if (elements.zhejiangRareMonitorDate && elements.zhejiangRareMonitorDate.value !== targetDate) {
    elements.zhejiangRareMonitorDate.value = targetDate;
  }
  elements.zhejiangRareSpeciesSummary.textContent = [
    `名单 ${rareSpecies.length} 种`,
    `基线 ${BIRDREPORT_RARE_SPECIES_PROVINCE} 全历史记录次数 <= ${BIRDREPORT_RARE_SPECIES_THRESHOLD}`,
    `检查日期 ${targetDateLabel}`,
    `名单保存 ${savedLabel}`,
    `监测状态 ${status}`,
    `上次检查 ${checkedLabel}`,
    `最近命中 ${hitLabel}`
  ].join(" · ");

  elements.toggleZhejiangRareMonitorBtn.textContent = monitor.enabled ? "停止每小时监测" : "开始每小时监测";
  renderZhejiangRareSpeciesHits(targetDateLabel, state.zhejiangRareHits, rareSpecies.length > 0);
}

function renderZhejiangRareSpeciesHits(todayLabel, hits, hasBaseline) {
  elements.zhejiangRareSpeciesContainer.innerHTML = "";
  if (!hits.length) {
    clearZhejiangRareSpeciesDetail();
    renderZhejiangRareSpeciesDetail();
    const emptyText = hasBaseline
      ? `${todayLabel} 暂未发现命中的浙江稀有鸟种。`
      : `保存浙江稀有鸟种名单后，这里会显示所选日期命中的稀有鸟种。`;
    elements.zhejiangRareSpeciesContainer.innerHTML = `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
    return;
  }

  hits.forEach((item) => {
    const isActive = item.key === state.activeZhejiangRareSpeciesKey;
    const card = document.createElement("article");
    card.className = `record${isActive ? " is-active" : ""}`;
    card.innerHTML = `
      <div>
        <strong>${escapeHtml(item.taxonname || item.name || "未命名鸟种")}</strong>
        <small>${escapeHtml(item.latinname || item.englishname || "未提供学名/英文名")}</small>
      </div>
      <div>${escapeHtml(item.taxonordername || "未提供目")} · ${escapeHtml(item.taxonfamilyname || "未提供科")}</div>
      <div><small>所选日期记录次数：${escapeHtml(String(item.targetDateRecordCount ?? 0))}</small></div>
      <div><small>历史基线记录次数：${escapeHtml(String(item.baselineRecordCount ?? 0))}</small></div>
      <div><small>${isActive ? "已展开地点详情" : "点击查看观测地点"}</small></div>
    `;
    card.addEventListener("click", () => {
      toggleZhejiangRareSpeciesDetail(item);
    });
    elements.zhejiangRareSpeciesContainer.append(card);
  });

  renderZhejiangRareSpeciesDetail();
}

async function saveZhejiangRareSpecies() {
  setZhejiangRareSpeciesLoading(true);
  setZhejiangRareSpeciesMessage(`正在读取本地 ${BIRDREPORT_RARE_SPECIES_PROVINCE} 鸟种名录...`);

  try {
    let totalSpecies = 0;
    let rareSpecies = [];
    let sourceLabel = "本地 JSON";

    try {
      const baseline = await fetchZhejiangSpeciesBaselineFromJson();
      totalSpecies = baseline.totalSpecies;
      rareSpecies = baseline.rareSpecies;
    } catch (jsonError) {
      if (!canUseBirdreportProxy()) {
        throw new Error(`读取本地浙江鸟种名录失败：${jsonError.message}`);
      }

      sourceLabel = "BirdReport 在线查询";
      setZhejiangRareSpeciesMessage(`读取本地名录失败，正在回退到 BirdReport 在线查询：${jsonError.message}`);
      const results = await fetchAllBirdreportTaxa(createBirdreportPayload({ province: BIRDREPORT_RARE_SPECIES_PROVINCE }), {
        onProgress: (message) => setZhejiangRareSpeciesMessage(message)
      });
      totalSpecies = results.length;
      rareSpecies = sortBirdreportTaxaByRecordCount(
        results.filter((item) => (Number(item?.recordcount) || 0) <= BIRDREPORT_RARE_SPECIES_THRESHOLD)
      ).map(serializeBirdreportTaxon);
    }

    state.zhejiangRareSpecies = {
      province: BIRDREPORT_RARE_SPECIES_PROVINCE,
      threshold: BIRDREPORT_RARE_SPECIES_THRESHOLD,
      savedAt: new Date().toISOString(),
      totalSpecies,
      source: sourceLabel,
      species: rareSpecies
    };
    state.zhejiangRareHits = [];
    state.zhejiangRareNotificationLog = {};
    state.zhejiangRareMonitor.lastHitAt = "";
    clearZhejiangRareSpeciesDetail();
    saveZhejiangRareSpeciesToStorage(state.zhejiangRareSpecies);
    saveZhejiangRareNotificationLog(state.zhejiangRareNotificationLog);
    saveZhejiangRareMonitor(state.zhejiangRareMonitor);
    renderZhejiangRareSpeciesPanel();
    setZhejiangRareSpeciesMessage(`已保存 ${rareSpecies.length} 种浙江稀有鸟种，来源：${sourceLabel}。`);
    return true;
  } catch (error) {
    setZhejiangRareSpeciesMessage(`保存浙江稀有鸟种名单失败：${error.message}`, true);
    return false;
  } finally {
    setZhejiangRareSpeciesLoading(false);
  }
}

async function queryUnlockedSpeciesByUser() {
  const username = String(elements.birdreportUnlockedUsername?.value || "").trim();
  if (!username) {
    setUnlockedSpeciesMessage("请先输入记录用户姓名。", true);
    elements.birdreportUnlockedUsername?.focus();
    return;
  }

  if (!canUseBirdreportProxy()) {
    setUnlockedSpeciesMessage("BirdReport 代理还不可用，无法查询记录用户。", true);
    return;
  }

  setUnlockedSpeciesLoading(true);
  setUnlockedSpeciesMessage(`正在查询 ${username} 的浙江鸟种...`);

  try {
    const catalog = normalizeBirdreportTaxa(await fetchZhejiangSpeciesCatalogForUnlocked({
      onProgress: (message) => setUnlockedSpeciesMessage(message)
    }));
    const observed = normalizeBirdreportTaxa(await fetchUserZhejiangSpecies(username, {
      onProgress: (message) => setUnlockedSpeciesMessage(message)
    }));
    if (catalog.length && !observed.length) {
      throw new Error(`BirdReport 没有查到「${username}」在浙江的鸟种记录；请确认输入的是记录页里显示的完整记录用户名。`);
    }

    const missing = buildUnlockedMissingSpecies(catalog, observed);

    state.unlockedSpeciesCatalog = catalog;
    state.unlockedObservedSpecies = observed;
    state.unlockedMissingSpecies = missing;
    state.unlockedTargetUsername = username;
    state.unlockedSpeciesCacheSavedAt = new Date().toISOString();
    state.unlockedSpeciesTableVisible = true;
    clearUnlockedSpeciesDetail();
    saveUnlockedSpeciesCache();
    renderUnlockedSpeciesPanel();
    setUnlockedSpeciesMessage(
      `${username} 已解锁 ${observed.length} / ${catalog.length} 种浙江鸟种，还差 ${missing.length} 种。`
    );
  } catch (error) {
    setUnlockedSpeciesMessage(`未解锁鸟种查询失败：${error.message}`, true);
  } finally {
    setUnlockedSpeciesLoading(false);
  }
}

async function fetchZhejiangSpeciesCatalogForUnlocked(options = {}) {
  const { onProgress } = options;
  try {
    onProgress?.("正在刷新浙江鸟种名录和历史记录数...");
    const onlineCatalog = await fetchAllBirdreportTaxa(createBirdreportPayload({ province: BIRDREPORT_RARE_SPECIES_PROVINCE }), {
      onProgress: (message) => onProgress?.(message.replace("BirdReport 鸟种", "浙江鸟种名录"))
    });
    if (onlineCatalog.length) {
      return onlineCatalog.map(serializeBirdreportTaxon).sort(sortBirdreportTaxaByReportCountDesc);
    }
  } catch (error) {
    console.warn("Failed to refresh Zhejiang species catalog from BirdReport:", error);
    onProgress?.(`在线刷新浙江名录失败，使用本地缓存名录：${error.message}`);
  }

  return fetchZhejiangSpeciesCatalogFromJson();
}

async function fetchUserZhejiangSpecies(username, options = {}) {
  const { onProgress } = options;
  const primary = await fetchAllBirdreportTaxa(
    createBirdreportPayload({
      province: BIRDREPORT_RARE_SPECIES_PROVINCE,
      username,
      mode: 1
    }),
    {
      onProgress: (message) => onProgress?.(message.replace("BirdReport 鸟种", "用户浙江鸟种"))
    }
  );
  if (primary.length) {
    return primary;
  }

  onProgress?.("按兼容模式重新核对记录用户鸟种...");
  return fetchAllBirdreportTaxa(
    createBirdreportPayload({
      province: BIRDREPORT_RARE_SPECIES_PROVINCE,
      username
    }),
    {
      onProgress: (message) => onProgress?.(message.replace("BirdReport 鸟种", "用户浙江鸟种"))
    }
  );
}

function buildUnlockedMissingSpecies(catalog, observed) {
  const catalogItems = getBirdreportTaxaArray(catalog);
  const observedItems = getBirdreportTaxaArray(observed);
  const observedKeys = new Set(observedItems.map(getBirdreportTaxonKey).filter(Boolean));
  const observedNames = new Set(observedItems.map((item) => String(item?.taxonname || item?.name || "").trim()).filter(Boolean));

  return catalogItems
    .filter((item) => !observedKeys.has(getBirdreportTaxonKey(item)) && !observedNames.has(String(item?.taxonname || "").trim()))
    .sort(sortBirdreportTaxaByReportCountDesc);
}

function sortBirdreportTaxaByReportCountDesc(left, right) {
  const countDiff = getBirdreportReportCount(right) - getBirdreportReportCount(left);
  if (countDiff !== 0) {
    return countDiff;
  }

  return String(left?.taxonname || "").localeCompare(String(right?.taxonname || ""), "zh-CN");
}

function renderUnlockedSpeciesPanel() {
  if (!elements.unlockedSpeciesSummary || !elements.unlockedSpeciesContainer) {
    return;
  }

  const catalog = getBirdreportTaxaArray(state.unlockedSpeciesCatalog);
  const observed = getBirdreportTaxaArray(state.unlockedObservedSpecies);
  const missing = getBirdreportTaxaArray(state.unlockedMissingSpecies);
  const catalogCount = catalog.length || 0;
  const missingCount = missing.length || 0;
  const observedCount = observed.length || (catalogCount ? catalogCount - missingCount : 0);
  updateUnlockedSpeciesExportButton();

  if (!catalogCount) {
    elements.unlockedSpeciesSummary.classList.remove("is-rich");
    elements.unlockedSpeciesSummary.textContent = "输入记录用户后，可核对浙江 588 种名录中的未解锁鸟种。";
    elements.unlockedSpeciesContainer.innerHTML = '<div class="empty-state">查询结果会显示在这里。</div>';
    return;
  }

  renderUnlockedSpeciesSummary({
    observedCount,
    missingCount,
    catalogCount
  });

  renderUnlockedSpeciesList();
}

function renderUnlockedSpeciesSummary({ observedCount, missingCount, catalogCount }) {
  elements.unlockedSpeciesSummary.classList.add("is-rich");
  elements.unlockedSpeciesSummary.innerHTML = `
    <div class="unlocked-summary-toolbar">
      <div class="unlocked-summary-grid">
        ${renderUnlockedSpeciesSummaryCard("记录用户", state.unlockedTargetUsername || "未填写")}
        ${renderUnlockedSpeciesSummaryCard("已解锁", `${observedCount} 种`)}
        ${renderUnlockedSpeciesSummaryCard("未解锁", `${missingCount} 种`)}
        ${renderUnlockedSpeciesSummaryCard("浙江名录", `${catalogCount} 种`)}
        ${
          state.unlockedSpeciesCacheSavedAt
            ? renderUnlockedSpeciesSummaryCard("缓存", formatDateTime(state.unlockedSpeciesCacheSavedAt))
            : ""
        }
      </div>
      <div class="unlocked-summary-actions">
        <button type="button" class="ghost unlocked-summary-toggle">${state.unlockedSpeciesShowMeta ? "隐藏鸟种信息" : "显示鸟种信息"}</button>
      </div>
    </div>
  `;
  elements.unlockedSpeciesSummary
    .querySelector(".unlocked-summary-toggle")
    ?.addEventListener("click", toggleUnlockedSpeciesInfoVisibility);
}

function renderUnlockedSpeciesSummaryCard(label, value) {
  return `
    <div class="unlocked-summary-card">
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

function toggleUnlockedSpeciesInfoVisibility() {
  state.unlockedSpeciesShowMeta = !state.unlockedSpeciesShowMeta;
  renderUnlockedSpeciesPanel();
}

function toggleUnlockedSpeciesTableVisibility() {
  state.unlockedSpeciesTableVisible = !state.unlockedSpeciesTableVisible;
  if (!state.unlockedSpeciesTableVisible) {
    clearUnlockedSpeciesDetail();
  }
  renderUnlockedSpeciesPanel();
}

function renderUnlockedSpeciesList() {
  elements.unlockedSpeciesContainer.innerHTML = "";
  const missing = getBirdreportTaxaArray(state.unlockedMissingSpecies);
  if (!missing.length) {
    elements.unlockedSpeciesContainer.innerHTML = '<div class="empty-state">这个用户已经解锁浙江名录里的全部鸟种。</div>';
    return;
  }

  if (!state.unlockedSpeciesTableVisible) {
    elements.unlockedSpeciesContainer.append(createUnlockedSpeciesFloatingActions(missing.length));
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = `已隐藏 ${missing.length} 个未解锁鸟种，点击“展开全部鸟种”查看表格。`;
    elements.unlockedSpeciesContainer.append(empty);
    return;
  }

  const totalReportCount = Math.max(
    1,
    missing.reduce(
      (sum, item) => sum + getBirdreportReportCount(item),
      0
    )
  );

  const table = document.createElement("div");
  table.className = "unlocked-species-table";
  table.innerHTML = `
    <div class="unlocked-species-table-head" role="row">
      <span class="unlocked-table-cell unlocked-cell-rank">序号</span>
      <span class="unlocked-table-cell unlocked-cell-code">编号</span>
      <span class="unlocked-table-cell unlocked-cell-name">中文名</span>
      <span class="unlocked-table-cell unlocked-cell-count">历史记录</span>
      <span class="unlocked-table-cell unlocked-cell-toggle">展开</span>
    </div>
  `;

  elements.unlockedSpeciesContainer.append(createUnlockedSpeciesFloatingActions(missing.length));

  missing.forEach((item, index) => {
    const key = getBirdreportTaxonKey(item);
    const isActive = key === state.activeUnlockedSpeciesKey;
    const reportCount = getBirdreportReportCount(item);
    const frequency = (reportCount / totalReportCount) * 100;
    const taxonId = String(item?.taxon_id || item?.taxonid || item?.id || "--").trim() || "--";
    const entry = document.createElement("article");
    entry.className = [
      "unlocked-species-entry",
      isActive ? "is-active" : ""
    ].filter(Boolean).join(" ");
    entry.innerHTML = `
      <button
        type="button"
        class="unlocked-species-row"
        aria-expanded="${isActive ? "true" : "false"}"
        aria-label="${isActive ? "收起" : "展开"} ${escapeHtml(item.taxonname || "未命名鸟种")} 的鸟种信息和公开地点"
      >
        <span class="unlocked-table-cell unlocked-cell-rank">${index + 1}</span>
        <span class="unlocked-table-cell unlocked-cell-code">${escapeHtml(taxonId)}</span>
        <span class="unlocked-table-cell unlocked-cell-name">
          <strong>${escapeHtml(item.taxonname || "未命名鸟种")}</strong>
          ${state.unlockedSpeciesShowMeta ? `<small>${escapeHtml(buildUnlockedSpeciesMetaLine(item))}</small>` : ""}
        </span>
        <span class="unlocked-table-cell unlocked-cell-count">${escapeHtml(reportCount.toLocaleString("zh-CN"))}</span>
        <span class="unlocked-table-cell unlocked-cell-toggle" aria-hidden="true">${isActive ? "⌃" : "⌄"}</span>
      </button>
    `;

    entry.querySelector(".unlocked-species-row")?.addEventListener("click", () => toggleUnlockedSpeciesLocations(item));

    if (isActive) {
      entry.append(
        renderUnlockedSpeciesLocationPanel(item, {
          reportCount,
          frequency
        })
      );
    }

    table.append(entry);
  });

  elements.unlockedSpeciesContainer.append(table);
}

function createUnlockedSpeciesFloatingActions(missingCount) {
  const actions = document.createElement("div");
  actions.className = `unlocked-floating-actions${state.unlockedSpeciesTableVisible ? "" : " is-collapsed"}`;
  const buttonLabel = state.unlockedSpeciesTableVisible ? "隐藏全部鸟种" : "展开全部鸟种";
  actions.innerHTML = `
    <button type="button" class="ghost unlocked-floating-table-toggle" aria-label="${escapeHtml(buttonLabel)}">
      <span>${escapeHtml(buttonLabel)}</span>
      <small>${escapeHtml(String(missingCount))} 种</small>
    </button>
  `;
  actions
    .querySelector(".unlocked-floating-table-toggle")
    ?.addEventListener("click", toggleUnlockedSpeciesTableVisibility);
  return actions;
}

function buildUnlockedSpeciesMetaLine(item) {
  const taxonMeta = [item?.taxonordername, item?.taxonfamilyname].filter(Boolean).join(" · ");
  return [item?.latinname, taxonMeta].filter(Boolean).join(" · ") || "点击展开查看详情";
}

function renderUnlockedSpeciesLocationPanel(species, context = {}) {
  const panel = document.createElement("div");
  panel.className = "unlocked-location-panel";
  const reportCount = Number.isFinite(context.reportCount) ? context.reportCount : getBirdreportReportCount(species);
  const frequency = Number.isFinite(context.frequency) ? context.frequency : 0;
  const summaryBlock = `
    <div class="unlocked-detail-grid">
      <div class="unlocked-detail-card">
        <strong>学名</strong>
        <span>${escapeHtml(species.latinname || "未提供学名")}</span>
      </div>
      <div class="unlocked-detail-card">
        <strong>缺口频率</strong>
        <span>${escapeHtml(frequency.toFixed(5))}%</span>
      </div>
      <div class="unlocked-detail-card">
        <strong>目 / 科</strong>
        <span>${escapeHtml(formatUnlockedSpeciesTaxonomy(species))}</span>
      </div>
      <div class="unlocked-detail-card">
        <strong>浙江历史记录</strong>
        <span>${escapeHtml(reportCount.toLocaleString("zh-CN"))}</span>
      </div>
    </div>
  `;

  if (state.unlockedSpeciesDetailLoading) {
    panel.innerHTML = `${summaryBlock}<div class="empty-state">正在按报告编号加载公开地点...</div>`;
    return panel;
  }

  if (state.unlockedSpeciesDetailError) {
    if (state.unlockedSpeciesDetailError === "captcha_required") {
      panel.innerHTML = `${summaryBlock}
        <div class="birdreport-captcha-panel">
          <strong>BirdReport 需要验证码</strong>
          <span>请输入图片里的验证码，验证通过后会自动重新加载这个鸟种的地点。</span>
          <div class="birdreport-captcha-row">
            ${
              state.unlockedSpeciesCaptchaImageUrl
                ? `<img class="birdreport-captcha-image" src="${escapeHtml(state.unlockedSpeciesCaptchaImageUrl)}" alt="BirdReport 验证码" />`
                : '<span class="empty-state">验证码加载中...</span>'
            }
            <button type="button" class="ghost birdreport-refresh-captcha-btn">换一张</button>
          </div>
          <div class="birdreport-captcha-row">
            <input class="birdreport-captcha-input" type="text" inputmode="text" maxlength="4" autocomplete="off" placeholder="输入验证码" />
            <button type="button" class="birdreport-submit-captcha-btn">${state.unlockedSpeciesCaptchaLoading ? "验证中..." : "验证并重试"}</button>
          </div>
          ${state.unlockedSpeciesCaptchaError ? `<div class="message error">${escapeHtml(state.unlockedSpeciesCaptchaError)}</div>` : ""}
        </div>
      `;
      const input = panel.querySelector(".birdreport-captcha-input");
      const submit = panel.querySelector(".birdreport-submit-captcha-btn");
      const refresh = panel.querySelector(".birdreport-refresh-captcha-btn");
      if (submit) {
        submit.disabled = state.unlockedSpeciesCaptchaLoading;
        submit.addEventListener("click", () => submitUnlockedSpeciesCaptcha(species, input?.value));
      }
      input?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          submitUnlockedSpeciesCaptcha(species, input.value);
        }
      });
      refresh?.addEventListener("click", () => refreshUnlockedSpeciesCaptcha());
      return panel;
    }

    panel.innerHTML = `${summaryBlock}<div class="empty-state">加载失败：${escapeHtml(state.unlockedSpeciesDetailError)}</div>`;
    return panel;
  }

  if (!state.unlockedSpeciesDetailRecords.length) {
    panel.innerHTML = `${summaryBlock}<div class="empty-state">BirdReport 暂时没有返回可展示的公开地点。</div>`;
    return panel;
  }

  panel.innerHTML = `
    ${summaryBlock}
    <div class="unlocked-location-title">
      <strong>${escapeHtml(species.taxonname || "未命名鸟种")} 公开地点</strong>
      <span>按官网记录页的观测时间倒序展示</span>
    </div>
    <div class="unlocked-location-list">
      ${state.unlockedSpeciesDetailRecords
        .map(
          (record) => `
            <div class="unlocked-location-item">
              <strong>${escapeHtml(record.pointName || "未提供观测地点")}</strong>
              <span>${escapeHtml(record.startTimeLabel)} 至 ${escapeHtml(record.endTimeLabel)}</span>
              <span>记录用户：${escapeHtml(record.username || "未提供")} · 数量：${escapeHtml(String(record.taxonCount ?? 0))} · 报告编号：${escapeHtml(record.serialId || "未提供")}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
  return panel;
}

function formatUnlockedSpeciesTaxonomy(species) {
  const orderName = String(species?.taxonordername || "").trim() || "未提供目";
  const familyName = String(species?.taxonfamilyname || "").trim() || "未提供科";
  return `${orderName} · ${familyName}`;
}

async function toggleUnlockedSpeciesLocations(species) {
  const key = getBirdreportTaxonKey(species);
  if (!key || !species.taxon_id) {
    setUnlockedSpeciesMessage("这个鸟种缺少 BirdReport 鸟种编号，暂时不能查询地点。", true);
    return;
  }

  if (state.activeUnlockedSpeciesKey === key && !state.unlockedSpeciesDetailLoading) {
    clearUnlockedSpeciesDetail();
    renderUnlockedSpeciesList();
    return;
  }

  state.activeUnlockedSpeciesKey = key;
  state.unlockedSpeciesDetailRecords = [];
  state.unlockedSpeciesDetailError = "";
  state.unlockedSpeciesDetailLoading = true;
  renderUnlockedSpeciesList();
  setUnlockedSpeciesMessage(`正在按观测时间倒序加载 ${species.taxonname || "该鸟种"} 在浙江的公开地点...`);

  try {
    state.unlockedSpeciesDetailRecords = await fetchRecentBirdreportRecordsByTaxon(species, {
      limit: 8
    });
    state.unlockedSpeciesDetailError = "";
    setUnlockedSpeciesMessage(
      state.unlockedSpeciesDetailRecords.length
        ? `${species.taxonname || "该鸟种"} 公开地点已加载 ${state.unlockedSpeciesDetailRecords.length} 条，按观测时间倒序展示。`
        : `${species.taxonname || "该鸟种"} 暂时没有可展示的公开地点。`
    );
  } catch (error) {
    if (isBirdreportCaptchaError(error)) {
      state.unlockedSpeciesDetailError = "captcha_required";
      state.unlockedSpeciesCaptchaError = "";
      await refreshUnlockedSpeciesCaptcha({ silent: true });
      setUnlockedSpeciesMessage("BirdReport 要求输入验证码，验证后会自动重试地点查询。", true);
    } else {
      state.unlockedSpeciesDetailError = error.message;
      setUnlockedSpeciesMessage(`加载公开地点失败：${error.message}`, true);
    }
  } finally {
    state.unlockedSpeciesDetailLoading = false;
    renderUnlockedSpeciesList();
  }
}

async function submitUnlockedSpeciesCaptcha(species, rawCode) {
  const code = String(rawCode || "").trim();
  if (!code) {
    state.unlockedSpeciesCaptchaError = "请先输入验证码。";
    renderUnlockedSpeciesList();
    return;
  }

  state.unlockedSpeciesCaptchaLoading = true;
  state.unlockedSpeciesCaptchaError = "";
  renderUnlockedSpeciesList();

  try {
    await verifyBirdreportCaptcha(code);
    state.unlockedSpeciesCaptchaLoading = false;
    state.unlockedSpeciesCaptchaError = "";
    state.unlockedSpeciesDetailError = "";
    state.unlockedSpeciesDetailLoading = true;
    state.unlockedSpeciesDetailRecords = [];
    renderUnlockedSpeciesList();
    setUnlockedSpeciesMessage("验证码通过，正在重新加载公开地点...");

    state.unlockedSpeciesDetailRecords = await fetchRecentBirdreportRecordsByTaxon(species, {
      limit: 8
    });
    state.unlockedSpeciesDetailError = "";
    setUnlockedSpeciesMessage(
      state.unlockedSpeciesDetailRecords.length
        ? `${species.taxonname || "该鸟种"} 公开地点已加载 ${state.unlockedSpeciesDetailRecords.length} 条，按观测时间倒序展示。`
        : `${species.taxonname || "该鸟种"} 暂时没有可展示的公开地点。`
    );
  } catch (error) {
    state.unlockedSpeciesCaptchaLoading = false;
    state.unlockedSpeciesDetailLoading = false;
    state.unlockedSpeciesDetailError = "captcha_required";
    state.unlockedSpeciesCaptchaError = error.message;
    await refreshUnlockedSpeciesCaptcha({ silent: true });
    setUnlockedSpeciesMessage(`验证码验证失败：${error.message}`, true);
  } finally {
    state.unlockedSpeciesCaptchaLoading = false;
    state.unlockedSpeciesDetailLoading = false;
    renderUnlockedSpeciesList();
  }
}

async function refreshUnlockedSpeciesCaptcha(options = {}) {
  const { silent = false } = options;
  try {
    const imageUrl = await loadBirdreportCaptchaImage();
    if (state.unlockedSpeciesCaptchaImageUrl) {
      URL.revokeObjectURL(state.unlockedSpeciesCaptchaImageUrl);
    }
    state.unlockedSpeciesCaptchaImageUrl = imageUrl;
    if (!silent) {
      state.unlockedSpeciesCaptchaError = "";
      renderUnlockedSpeciesList();
    }
  } catch (error) {
    state.unlockedSpeciesCaptchaError = `验证码加载失败：${error.message}`;
    if (!silent) {
      renderUnlockedSpeciesList();
    }
  }
}

async function fetchRecentBirdreportRecordsByTaxon(species, options = {}) {
  const taxonId = String(species?.taxon_id || species?.taxonid || species?.key || "").trim();
  const taxonName = String(species?.taxonname || species?.name || "").trim();
  if (!taxonId && !taxonName) {
    throw new Error("缺少 BirdReport 鸟种编号或鸟种名称。");
  }

  const displayLimit = Math.max(1, Math.min(20, Number(options.limit) || 8));
  return fetchBirdreportRecordWindowByTaxon(
    { taxonId, taxonName },
    { startTime: "", endTime: "", label: "全历史" },
    { displayLimit }
  );
}

async function fetchBirdreportRecordWindowByTaxon(taxonQuery, windowRange, options = {}) {
  const taxonId = String(taxonQuery?.taxonId || taxonQuery || "").trim();
  const taxonName = String(taxonQuery?.taxonName || "").trim();
  const displayLimit = Math.max(1, Math.min(20, Number(options.displayLimit) || 8));
  const pageLimit = 100;
  const maxPages = Math.max(1, Math.min(8, Number(options.maxPages) || 4));
  const stateCandidates = [""];

  for (const stateFilter of stateCandidates) {
    const basePayload = createBirdreportPayload({
      province: BIRDREPORT_RARE_SPECIES_PROVINCE,
      startTime: windowRange.startTime,
      endTime: windowRange.endTime,
      state: stateFilter
    });
    const recordPayload = createBirdreportRecordSearchPayload(basePayload, { taxonId, taxonName });
    const firstPage = await birdreportProxyPost("/api/birdreport/record", {
      ...recordPayload,
      page: 1,
      limit: pageLimit
    });
    if (isBirdreportCaptchaResponse(firstPage)) {
      throw createBirdreportCaptchaError();
    }
    const firstItems = normalizeBirdreportRecordPage(firstPage);
    const total = Math.max(Number(firstPage?.count) || firstItems.length, firstItems.length);
    const totalPages = Math.max(1, Math.ceil(total / pageLimit));
    const pagesToFetch = Math.min(totalPages, maxPages);
    const records = firstItems.filter((record) => record.isPublic && !record.isHiddenLocation);

    for (let page = 2; page <= pagesToFetch && records.length < displayLimit; page += 1) {
      const response = await birdreportProxyPost("/api/birdreport/record", {
        ...recordPayload,
        page,
        limit: pageLimit
      });
      if (isBirdreportCaptchaResponse(response)) {
        throw createBirdreportCaptchaError();
      }
      records.push(...normalizeBirdreportRecordPage(response).filter((record) => record.isPublic && !record.isHiddenLocation));
    }

    if (records.length || !stateFilter) {
      return records.sort(sortBirdreportRecordsByObservationTimeDesc).slice(0, displayLimit);
    }
  }

  return [];
}

function isBirdreportCaptchaResponse(response) {
  const code = Number(response?.code);
  return code === 505 || code === 405;
}

function createBirdreportCaptchaError() {
  const error = new Error("BirdReport 需要验证码。");
  error.name = "BirdreportCaptchaError";
  return error;
}

function isBirdreportCaptchaError(error) {
  return error?.name === "BirdreportCaptchaError";
}

async function loadBirdreportCaptchaImage() {
  const baseUrl = normalizeProxyBaseUrl(elements.birdreportProxyUrl.value);
  const response = await fetch(`${baseUrl}/api/birdreport/captcha?ts=${Date.now()}`, {
    method: "GET",
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

async function verifyBirdreportCaptcha(code) {
  const baseUrl = normalizeProxyBaseUrl(elements.birdreportProxyUrl.value);
  const response = await fetch(`${baseUrl}/api/birdreport/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ code })
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const result = await response.json();
  if (!result?.success) {
    throw new Error(result?.msg || result?.message || "验证码不正确");
  }

  return result;
}

function createBirdreportRecordSearchPayload(basePayload, { taxonId = "", taxonName = "" } = {}) {
  return {
    ...basePayload,
    ...(taxonId ? { taxonid: taxonId } : {}),
    ...(taxonName ? { taxonname: taxonName, taxon_name: taxonName, name: taxonName } : {}),
    field: "start_time",
    order: "desc",
    sort: "start_time",
    sortField: "start_time",
    sortOrder: "desc",
    orderField: "start_time",
    orderType: "desc"
  };
}

function clearUnlockedSpeciesDetail() {
  state.activeUnlockedSpeciesKey = null;
  state.unlockedSpeciesDetailRecords = [];
  state.unlockedSpeciesDetailLoading = false;
  state.unlockedSpeciesDetailError = "";
  if (state.unlockedSpeciesCaptchaImageUrl) {
    URL.revokeObjectURL(state.unlockedSpeciesCaptchaImageUrl);
  }
  state.unlockedSpeciesCaptchaImageUrl = "";
  state.unlockedSpeciesCaptchaLoading = false;
  state.unlockedSpeciesCaptchaError = "";
}

function clearUnlockedSpeciesResults(options = {}) {
  const { keepUsername = false } = options;
  state.unlockedSpeciesCatalog = [];
  state.unlockedObservedSpecies = [];
  state.unlockedMissingSpecies = [];
  state.unlockedTargetUsername = "";
  state.unlockedSpeciesCacheSavedAt = "";
  state.unlockedSpeciesTableVisible = true;
  clearUnlockedSpeciesDetail();
  clearUnlockedSpeciesCache();
  if (!keepUsername && elements.birdreportUnlockedUsername) {
    elements.birdreportUnlockedUsername.value = "";
  }
  renderUnlockedSpeciesPanel();
  setUnlockedSpeciesMessage("已清空未解锁鸟种查询结果。");
}

async function exportUnlockedSpeciesTable() {
  const rows = buildUnlockedSpeciesExportRows();
  if (!rows.length) {
    setUnlockedSpeciesMessage("当前没有可导出的未解锁鸟种。", true);
    return;
  }

  try {
    document.querySelector("[data-unlocked-export-overlay]")?.remove();
    document.body.classList.remove("unlocked-export-open");
    const csvContent = toCsvText([
      ["鸟类名称", "目", "科"],
      ...rows
    ]);
    const filename = buildUnlockedSpeciesExportFilename("csv");
    const locationLabel = await saveTextFile(filename, "text/csv;charset=utf-8", `\uFEFF${csvContent}`);
    setUnlockedSpeciesMessage(`未解锁鸟种表格已导出：${locationLabel || filename}`);
  } catch (error) {
    setUnlockedSpeciesMessage(`导出未解锁鸟种失败：${error.message}`, true);
  }
}

function buildUnlockedSpeciesExportRows() {
  return [...getBirdreportTaxaArray(state.unlockedMissingSpecies)]
    .sort(sortBirdreportTaxaByReportCountDesc)
    .map((item) => [
      String(item?.taxonname || item?.name || "未命名鸟种").trim() || "未命名鸟种",
      String(item?.taxonordername || "").trim() || "未提供",
      String(item?.taxonfamilyname || "").trim() || "未提供"
    ]);
}

function buildUnlockedSpeciesExportFilename(extension = "csv") {
  const username = String(state.unlockedTargetUsername || "未命名用户").trim().replace(/[\\/:*?"<>|]/g, "_");
  const stamp = formatExportTimestamp(new Date());
  return `${username}-未解锁鸟种-${stamp}.${extension}`;
}

function formatExportTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function toCsvText(rows) {
  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n");
}

function escapeCsvField(value) {
  const text = String(value ?? "");
  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, "\"\"")}"`;
}

async function saveTextFile(filename, mimeType, content) {
  if (window.BeauBirdAndroid && typeof window.BeauBirdAndroid.saveTextFile === "function") {
    return window.BeauBirdAndroid.saveTextFile(filename, mimeType, content) || filename;
  }

  if (window.showSaveFilePicker) {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "CSV 表格",
            accept: {
              [mimeType]: [".csv"]
            }
          }
        ]
      });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return fileHandle.name || filename;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw error;
      }
      console.warn("showSaveFilePicker failed, falling back to anchor download:", error);
    }
  }

  if (window.location.protocol === "file:") {
    triggerFileDownload(filename, `data:${mimeType},${encodeURIComponent(content)}`);
    return filename;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  triggerFileDownload(filename, url, () => URL.revokeObjectURL(url));
  return filename;
}

function renderUnlockedSpeciesExportOverlay(rows) {
  document.querySelector("[data-unlocked-export-overlay]")?.remove();

  const username = escapeHtml(state.unlockedTargetUsername || "未命名用户");
  const exportedAt = escapeHtml(formatDateTime(new Date().toISOString()));
  const tsvText = `鸟类名称\t目\t科\n${rows.map((row) => row.join("\t")).join("\n")}`;
  const tableRows = rows
    .map(
      (row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(row[0])}</td>
          <td>${escapeHtml(row[1])}</td>
          <td>${escapeHtml(row[2])}</td>
        </tr>
      `
    )
    .join("");

  const overlay = document.createElement("div");
  overlay.setAttribute("data-unlocked-export-overlay", "true");
  overlay.innerHTML = `
    <div class="unlocked-export-backdrop"></div>
    <div class="unlocked-export-panel" role="dialog" aria-modal="true" aria-label="未解锁鸟种导出表格">
      <div class="unlocked-export-header">
        <div>
          <h3>${username} 的未解锁鸟种导出表</h3>
          <p>字段：鸟类名称、目、科。可直接打印、复制，或手动另存页面。</p>
        </div>
        <button type="button" class="ghost unlocked-export-close-btn">关闭</button>
      </div>
      <div class="unlocked-export-meta">记录用户：${username} · 未解锁 ${rows.length} 种 · 导出时间：${exportedAt}</div>
      <div class="unlocked-export-actions">
        <button type="button" class="unlocked-export-print-btn">打印 / 另存为 PDF</button>
        <button type="button" class="ghost unlocked-export-copy-btn">复制为表格文本</button>
      </div>
      <div class="unlocked-export-table-wrap">
        <table class="unlocked-export-table">
          <thead>
            <tr>
              <th style="width:72px;">序号</th>
              <th>鸟类名称</th>
              <th>目</th>
              <th>科</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <textarea class="unlocked-export-copy-source" spellcheck="false">${escapeHtml(tsvText)}</textarea>
    </div>
  `;
  document.body.append(overlay);
  document.body.classList.add("unlocked-export-open");

  const close = () => {
    overlay.remove();
    document.body.classList.remove("unlocked-export-open");
  };

  overlay.querySelector(".unlocked-export-close-btn")?.addEventListener("click", close);
  overlay.querySelector(".unlocked-export-backdrop")?.addEventListener("click", close);
  overlay.querySelector(".unlocked-export-print-btn")?.addEventListener("click", () => window.print());
  overlay.querySelector(".unlocked-export-copy-btn")?.addEventListener("click", async () => {
    const source = tsvText;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(source);
      } else {
        const textarea = overlay.querySelector(".unlocked-export-copy-source");
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
      }
      setUnlockedSpeciesMessage("未解锁鸟种表格文本已复制，可直接粘贴到 Excel / WPS。");
    } catch (error) {
      setUnlockedSpeciesMessage("自动复制失败，请在弹窗里手动复制表格内容。", true);
    }
  });
}

function triggerFileDownload(filename, href, cleanup) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.append(anchor);

  try {
    anchor.dispatchEvent(new MouseEvent("click", { view: window, bubbles: true, cancelable: true }));
  } finally {
    setTimeout(() => {
      anchor.remove();
      cleanup?.();
    }, 60 * 1000);
  }
}

async function toggleZhejiangRareMonitor() {
  if (state.zhejiangRareMonitor.enabled) {
    stopZhejiangRareMonitor();
    return;
  }

  await startZhejiangRareMonitor();
}

async function startZhejiangRareMonitor(options = {}) {
  if (!canUseBirdreportProxy()) {
    return false;
  }

  const { silent = false } = options;
  state.zhejiangRareMonitor.targetDate = getSelectedZhejiangRareMonitorDate();
  if (!state.zhejiangRareSpecies?.species?.length) {
    if (!silent) {
      setZhejiangRareSpeciesMessage("本地还没有浙江稀有鸟种名单，先为你生成一次。");
    }
    const saved = await saveZhejiangRareSpecies();
    if (!saved) {
      return false;
    }
  }

  await ensureBrowserNotificationPermission({ prompt: !silent });
  state.zhejiangRareMonitor.enabled = true;
  saveZhejiangRareMonitor(state.zhejiangRareMonitor);
  scheduleZhejiangRareMonitor();
  renderZhejiangRareSpeciesPanel();

  if (!silent) {
    setZhejiangRareSpeciesMessage(`已开始每小时监测浙江 ${getSelectedZhejiangRareMonitorDate()} 的 BirdReport 数据。页面保持打开时会自动检查。`);
  }

  checkZhejiangRareSpeciesToday({ source: silent ? "resume" : "start", notify: true });
  return true;
}

function stopZhejiangRareMonitor() {
  if (state.zhejiangRareMonitorTimerId) {
    window.clearInterval(state.zhejiangRareMonitorTimerId);
    state.zhejiangRareMonitorTimerId = null;
  }

  state.zhejiangRareMonitor.enabled = false;
  saveZhejiangRareMonitor(state.zhejiangRareMonitor);
  renderZhejiangRareSpeciesPanel();
  setZhejiangRareSpeciesMessage("已停止浙江稀有鸟种每小时监测。");
}

function scheduleZhejiangRareMonitor() {
  if (state.zhejiangRareMonitorTimerId) {
    window.clearInterval(state.zhejiangRareMonitorTimerId);
  }

  state.zhejiangRareMonitorTimerId = window.setInterval(() => {
    checkZhejiangRareSpeciesToday({ source: "scheduled", notify: true });
  }, BIRDREPORT_MONITOR_INTERVAL_MS);
}

async function toggleZhejiangRareSpeciesDetail(species) {
  const targetDate = getSelectedZhejiangRareMonitorDate();
  if (state.activeZhejiangRareSpeciesKey === species.key && state.zhejiangRareSpeciesDetailTargetDate === targetDate) {
    clearZhejiangRareSpeciesDetail();
    renderZhejiangRareSpeciesHits(formatDate(targetDate), state.zhejiangRareHits, Boolean(state.zhejiangRareSpecies?.species?.length));
    return;
  }

  state.activeZhejiangRareSpeciesKey = species.key;
  state.zhejiangRareSpeciesDetailTargetDate = targetDate;
  state.zhejiangRareSpeciesDetailSpecies = species;
  state.zhejiangRareSpeciesDetailRecords = [];
  state.zhejiangRareSpeciesDetailError = "";
  state.zhejiangRareSpeciesDetailLoading = true;
  renderZhejiangRareSpeciesHits(formatDate(targetDate), state.zhejiangRareHits, Boolean(state.zhejiangRareSpecies?.species?.length));
  setZhejiangRareSpeciesMessage(`正在加载 ${species.taxonname || species.name} 在 ${targetDate} 的观测地点...`);

  try {
    const records = await fetchBirdreportRecordsByTaxon(species, targetDate, {
      onProgress: (message) => setZhejiangRareSpeciesMessage(message)
    });
    state.zhejiangRareSpeciesDetailRecords = records;
    state.zhejiangRareSpeciesDetailError = "";
    setZhejiangRareSpeciesMessage(
      records.length
        ? `${species.taxonname || species.name} 在 ${targetDate} 共找到 ${records.length} 条观测记录。`
        : `${species.taxonname || species.name} 在 ${targetDate} 没有可展示的公开观测地点。`
    );
  } catch (error) {
    state.zhejiangRareSpeciesDetailError = error.message;
    setZhejiangRareSpeciesMessage(`加载观测地点失败：${error.message}`, true);
  } finally {
    state.zhejiangRareSpeciesDetailLoading = false;
    renderZhejiangRareSpeciesDetail();
  }
}

async function checkZhejiangRareSpeciesToday(options = {}) {
  const { source = "manual", notify = true } = options;
  if (!state.zhejiangRareSpecies?.species?.length) {
    setZhejiangRareSpeciesMessage("请先保存浙江稀有鸟种名单。", true);
    return [];
  }

  if (!canUseBirdreportProxy()) {
    return [];
  }

  if (state.zhejiangRareMonitorInFlight) {
    if (source === "manual") {
      setZhejiangRareSpeciesMessage("浙江稀有鸟种检查进行中，请稍候。");
    }
    return state.zhejiangRareHits;
  }

  state.zhejiangRareMonitorInFlight = true;
  setZhejiangRareSpeciesLoading(true);
  const targetDate = getSelectedZhejiangRareMonitorDate();
  state.zhejiangRareMonitor.targetDate = targetDate;
  const sourcePrefix = source === "manual" ? "正在检查" : "正在自动检查";
  setZhejiangRareSpeciesMessage(`${sourcePrefix} ${BIRDREPORT_RARE_SPECIES_PROVINCE} ${targetDate} 的 BirdReport 数据...`);

  try {
    const results = await fetchAllBirdreportTaxa(
      createBirdreportPayload({ province: BIRDREPORT_RARE_SPECIES_PROVINCE, startTime: targetDate, endTime: targetDate }),
      {
        onProgress: (message) => setZhejiangRareSpeciesMessage(message)
      }
    );
    const rareSpeciesMap = new Map((state.zhejiangRareSpecies.species || []).map((item) => [item.key, item]));
    const hits = sortBirdreportTaxaByRecordCount(
      results
        .filter((item) => rareSpeciesMap.has(getBirdreportTaxonKey(item)))
        .map((item) => toRareSpeciesHit(item, rareSpeciesMap.get(getBirdreportTaxonKey(item))))
    );

    state.zhejiangRareHits = hits;
    state.zhejiangRareMonitor.lastCheckedAt = new Date().toISOString();
    state.zhejiangRareMonitor.lastCheckedDate = targetDate;
    if (hits.length) {
      state.zhejiangRareMonitor.lastHitAt = state.zhejiangRareMonitor.lastCheckedAt;
    }
    if (!hits.some((item) => item.key === state.activeZhejiangRareSpeciesKey) || state.zhejiangRareSpeciesDetailTargetDate !== targetDate) {
      clearZhejiangRareSpeciesDetail();
    }
    saveZhejiangRareMonitor(state.zhejiangRareMonitor);
    renderZhejiangRareSpeciesPanel();

    if (notify) {
      await notifyRareSpeciesHits(targetDate, hits, { prompt: source === "start" });
    }

    setZhejiangRareSpeciesMessage(
      hits.length
        ? `${BIRDREPORT_RARE_SPECIES_PROVINCE} ${targetDate} 命中 ${hits.length} 种稀有鸟，已更新本地记录。`
        : `${BIRDREPORT_RARE_SPECIES_PROVINCE} ${targetDate} 暂未发现命中的稀有鸟种。`
    );
    return hits;
  } catch (error) {
    setZhejiangRareSpeciesMessage(`检查浙江指定日期 BirdReport 数据失败：${error.message}`, true);
    return [];
  } finally {
    state.zhejiangRareMonitorInFlight = false;
    setZhejiangRareSpeciesLoading(false);
  }
}

async function notifyRareSpeciesHits(date, hits, options = {}) {
  const { prompt = false } = options;
  if (!hits.length) {
    return;
  }

  const hasPermission = await ensureBrowserNotificationPermission({ prompt });
  if (!hasPermission) {
    return;
  }

  const notifiedKeys = new Set(state.zhejiangRareNotificationLog[date] || []);
  const newHits = hits.filter((item) => !notifiedKeys.has(item.key));
  if (!newHits.length) {
    return;
  }

  const preview = newHits.slice(0, 3).map((item) => item.taxonname || item.name).join("、");
  const body =
    newHits.length === 1
      ? `${preview} 出现在浙江 ${date} 的 BirdReport 结果里。`
      : `${preview} 等 ${newHits.length} 种稀有鸟出现在浙江 ${date} 的 BirdReport 结果里。`;

  const notification = new Notification("浙江稀有鸟种提醒", {
    body,
    tag: `zhejiang-rare-species-${date}`,
    renotify: true
  });
  notification.onclick = () => window.focus();

  state.zhejiangRareNotificationLog[date] = [...notifiedKeys, ...newHits.map((item) => item.key)];
  saveZhejiangRareNotificationLog(state.zhejiangRareNotificationLog);
}

function renderZhejiangRareSpeciesDetail() {
  const detailTarget = elements.zhejiangRareSpeciesDetail;
  if (!detailTarget) {
    return;
  }

  const species = state.zhejiangRareSpeciesDetailSpecies;
  if (!state.activeZhejiangRareSpeciesKey || !species) {
    detailTarget.innerHTML = "";
    detailTarget.classList.add("is-hidden");
    elements.zhejiangRareSpeciesDetailBackdrop?.classList.add("is-hidden");
    document.body.classList.remove("zhejiang-rare-detail-open");
    return;
  }

  const targetDate = state.zhejiangRareSpeciesDetailTargetDate || getSelectedZhejiangRareMonitorDate();
  let content = "";
  if (state.zhejiangRareSpeciesDetailLoading) {
    content = '<div class="empty-state">正在加载观测地点...</div>';
  } else if (state.zhejiangRareSpeciesDetailError) {
    content = `<div class="empty-state">加载失败：${escapeHtml(state.zhejiangRareSpeciesDetailError)}</div>`;
  } else if (!state.zhejiangRareSpeciesDetailRecords.length) {
    content = '<div class="empty-state">当前条件下没有可展示的公开观测地点。</div>';
  } else {
    content = `
      <div class="birdreport-rare-detail-list">
        ${state.zhejiangRareSpeciesDetailRecords
          .map(
            (record) => `
              <div class="birdreport-rare-detail-item">
                <strong>${escapeHtml(record.pointName || "未提供观测地点")}</strong>
                <div class="birdreport-rare-detail-meta">
                  <span>观测时间：${escapeHtml(record.startTimeLabel)} 至 ${escapeHtml(record.endTimeLabel)}</span>
                  <span>记录数量：${escapeHtml(String(record.taxonCount ?? 0))}</span>
                  <span>记录用户：${escapeHtml(record.username || "未提供")}</span>
                  <span>报告编号：${escapeHtml(record.serialId || "未提供")}</span>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  detailTarget.innerHTML = `
    <div class="birdreport-rare-detail-header">
      <div>
        <h3 class="birdreport-rare-detail-title">${escapeHtml(species.taxonname || species.name || "未命名鸟种")} 的观测地点</h3>
        <p class="birdreport-rare-detail-subtitle">${escapeHtml(targetDate)} · ${escapeHtml(BIRDREPORT_RARE_SPECIES_PROVINCE)} · 点击其他卡片可切换地点列表</p>
      </div>
      <button type="button" class="ghost" id="closeZhejiangRareSpeciesDetailBtn">收起详情</button>
    </div>
    ${content}
  `;
  detailTarget.classList.remove("is-hidden");
  elements.zhejiangRareSpeciesDetailBackdrop?.classList.remove("is-hidden");
  document.body.classList.add("zhejiang-rare-detail-open");
  detailTarget.querySelector("#closeZhejiangRareSpeciesDetailBtn")?.addEventListener("click", closeZhejiangRareSpeciesDetail);
}

function clearZhejiangRareSpeciesDetail() {
  state.activeZhejiangRareSpeciesKey = null;
  state.zhejiangRareSpeciesDetailTargetDate = "";
  state.zhejiangRareSpeciesDetailSpecies = null;
  state.zhejiangRareSpeciesDetailRecords = [];
  state.zhejiangRareSpeciesDetailLoading = false;
  state.zhejiangRareSpeciesDetailError = "";
}

function closeZhejiangRareSpeciesDetail() {
  if (!state.activeZhejiangRareSpeciesKey) {
    return;
  }

  clearZhejiangRareSpeciesDetail();
  renderZhejiangRareSpeciesHits(
    formatDate(getSelectedZhejiangRareMonitorDate()),
    state.zhejiangRareHits,
    Boolean(state.zhejiangRareSpecies?.species?.length)
  );
}

async function ensureBrowserNotificationPermission(options = {}) {
  const { prompt = false } = options;
  if (!("Notification" in window)) {
    setZhejiangRareSpeciesMessage("当前浏览器不支持桌面通知，仍会继续监测并在页面内显示结果。", true);
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission === "denied") {
    setZhejiangRareSpeciesMessage("浏览器通知权限已被拒绝，仍会继续监测并在页面内显示结果。", true);
    return false;
  }

  if (!prompt) {
    return false;
  }

  const result = await Notification.requestPermission();
  if (result !== "granted") {
    setZhejiangRareSpeciesMessage("未开启浏览器通知权限，监测命中时只会在页面内显示。", true);
    return false;
  }

  return true;
}

function setZhejiangRareSpeciesLoading(isLoading) {
  elements.saveZhejiangRareSpeciesBtn.disabled = isLoading;
  elements.checkZhejiangRareSpeciesBtn.disabled = isLoading;
  elements.toggleZhejiangRareMonitorBtn.disabled = isLoading;
  elements.zhejiangRareMonitorDate.disabled = isLoading;
  elements.saveZhejiangRareSpeciesBtn.textContent = isLoading ? "处理中..." : "保存浙江稀有鸟种名单";
  elements.checkZhejiangRareSpeciesBtn.textContent = isLoading ? "检查中..." : "立即检查所选日期数据";
}

function setZhejiangRareSpeciesMessage(message, isError = false) {
  setStatusMessage(elements.zhejiangRareSpeciesMessage, message, isError);
}

function setUnlockedSpeciesMessage(message, isError = false) {
  setStatusMessage(elements.unlockedSpeciesMessage, message, isError);
}

function updateUnlockedSpeciesExportButton(isLoading = false) {
  if (!elements.exportUnlockedSpeciesBtn) {
    return;
  }

  elements.exportUnlockedSpeciesBtn.disabled = isLoading;
}

function setUnlockedSpeciesLoading(isLoading) {
  if (elements.queryUnlockedSpeciesBtn) {
    elements.queryUnlockedSpeciesBtn.disabled = isLoading;
    elements.queryUnlockedSpeciesBtn.textContent = isLoading ? "查询中..." : "查询未解锁鸟种";
  }
  updateUnlockedSpeciesExportButton(isLoading);
  if (elements.clearUnlockedSpeciesBtn) {
    elements.clearUnlockedSpeciesBtn.disabled = isLoading;
  }
  if (elements.birdreportUnlockedUsername) {
    elements.birdreportUnlockedUsername.disabled = isLoading;
  }
}

function createBirdreportPayload({
  startTime = "",
  endTime = "",
  province = "",
  city = "",
  district = "",
  pointname = "",
  username = "",
  state = "",
  mode = 0
} = {}) {
  return normalizeBirdreportAdministrativeArea({
    startTime: normalizeDateInput(startTime),
    endTime: normalizeDateInput(endTime),
    province: String(province || "").trim(),
    city: String(city || "").trim(),
    district: String(district || "").trim(),
    pointname: String(pointname || "").trim(),
    username: String(username || "").trim(),
    state: String(state || "").trim(),
    version: BIRDREPORT_VERSION,
    outside_type: 0,
    mode
  });
}

function getSelectedZhejiangRareMonitorDate() {
  const selectedDate = normalizeDateInput(elements.zhejiangRareMonitorDate?.value);
  return selectedDate || normalizeDateInput(state.zhejiangRareMonitor?.targetDate) || formatIsoDate(new Date());
}

function getBirdreportTaxonKey(item) {
  return String(item?.taxon_id || item?.taxonid || item?.id || item?.taxonname || item?.name || "").trim();
}

function getBirdreportRarityFields(item) {
  const hasExplicitRarity = typeof item?.isRare === "boolean";
  const isRare = hasExplicitRarity ? item.isRare : (Number(item?.recordcount) || 0) <= BIRDREPORT_RARE_SPECIES_THRESHOLD;
  return {
    isRare,
    rarityLevel: String(item?.rarityLevel || (isRare ? "rare" : "common")).trim(),
    raritySource: String(item?.raritySource || (hasExplicitRarity ? "manual" : "recordcount_threshold")).trim(),
    manualAdded: Boolean(item?.manualAdded),
    rarityNote: String(item?.rarityNote || "").trim()
  };
}

function serializeBirdreportTaxon(item) {
  return {
    key: getBirdreportTaxonKey(item),
    taxon_id: String(item?.taxon_id || item?.taxonid || item?.id || "").trim(),
    taxonname: item?.taxonname || item?.name || "",
    latinname: item?.latinname || item?.englishname || "",
    taxonordername: item?.taxonordername || "",
    taxonfamilyname: item?.taxonfamilyname || "",
    recordcount: Number(item?.recordcount) || 0,
    reportcount: Number(item?.reportcount ?? item?.reportCount ?? item?.report_count) || 0,
    ...getBirdreportRarityFields(item)
  };
}

function getBirdreportTaxaArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidates = [
    payload.species,
    payload.list,
    payload.rows,
    payload.records,
    payload.items,
    payload.result,
    payload.data
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      const nested = getBirdreportTaxaArray(candidate);
      if (nested.length) {
        return nested;
      }
    }
  }

  return [];
}

function normalizeBirdreportTaxa(payload) {
  return getBirdreportTaxaArray(payload)
    .map(serializeBirdreportTaxon)
    .filter((item) => item.key);
}

async function fetchZhejiangSpeciesBaselineFromJson() {
  const parsed = await loadZhejiangSpeciesData();
  const species = normalizeZhejiangSpeciesCatalog(parsed);
  if (!species.length) {
    throw new Error("本地名录里没有可用鸟种");
  }

  return {
    totalSpecies: Number(parsed?.totalSpecies) || species.length,
    rareSpecies: sortBirdreportTaxaByRecordCount(species.filter((item) => item.isRare))
  };
}

async function fetchZhejiangSpeciesCatalogFromJson() {
  const parsed = await loadZhejiangSpeciesData();
  const species = normalizeZhejiangSpeciesCatalog(parsed);
  if (!species.length) {
    throw new Error("本地浙江鸟种名录里没有可用鸟种");
  }

  return species;
}

async function loadZhejiangSpeciesData() {
  const embedded = window[BIRDREPORT_ZHEJIANG_SPECIES_GLOBAL];
  if (embedded?.species?.length) {
    return embedded;
  }

  const response = await fetch(BIRDREPORT_ZHEJIANG_SPECIES_DATA_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

function normalizeZhejiangSpeciesCatalog(payload) {
  return Array.isArray(payload?.species) ? payload.species.map(serializeBirdreportTaxon).filter((item) => item.key) : [];
}

function toRareSpeciesHit(item, baseline) {
  return {
    ...serializeBirdreportTaxon(item),
    baselineRecordCount: Number(baseline?.recordcount) || 0,
    targetDateRecordCount: Number(item?.recordcount) || 0
  };
}

async function handleBirdreportProvinceChange() {
  resetSelectOptions(elements.birdreportCity, "请选择市");
  resetSelectOptions(elements.birdreportDistrict, "请选择区");
  clearBirdreportSpeciesResults();

  const province = elements.birdreportProvince.value;
  if (!province) {
    return;
  }

  try {
    const selectedOption = elements.birdreportProvince.selectedOptions[0];
    const provinceCode = selectedOption?.dataset.code || "";
    const response = await birdreportProxyPost("/api/birdreport/city", { province_code: provinceCode });
    renderBirdreportRegionOptions(elements.birdreportCity, response.data || [], "city_name", "city_code", "请选择市");
  } catch (error) {
    setBirdreportMessage(`加载城市失败：${error.message}`, true);
  }
}

async function handleBirdreportCityChange() {
  resetSelectOptions(elements.birdreportDistrict, "请选择区");
  clearBirdreportSpeciesResults();

  const city = elements.birdreportCity.value;
  if (!city) {
    return;
  }

  try {
    const selectedOption = elements.birdreportCity.selectedOptions[0];
    const cityCode = selectedOption?.dataset.code || "";
    const response = await birdreportProxyPost("/api/birdreport/district", { city_code: cityCode });
    renderBirdreportRegionOptions(elements.birdreportDistrict, response.data || [], "district_name", null, "请选择区");
  } catch (error) {
    setBirdreportMessage(`加载区县失败：${error.message}`, true);
  }
}

async function loadBirdreportProvinces() {
  resetSelectOptions(elements.birdreportProvince, "省份加载中...");
  resetSelectOptions(elements.birdreportCity, "请选择市");
  resetSelectOptions(elements.birdreportDistrict, "请选择区");
  const response = await birdreportProxyPost("/api/birdreport/province");
  renderBirdreportRegionOptions(elements.birdreportProvince, response.data || [], "province_name", "province_code", "请选择省");
  setBirdreportMessage("BirdReport 代理已连接，可以开始查询。");
}

async function queryBirdreportSpeciesByProxy() {
  const payload = buildBirdreportQueryPayload();
  if (!payload) {
    return;
  }

  if (!canUseBirdreportProxy()) {
    return;
  }

  setBirdreportLoading(true);
  setBirdreportMessage("正在通过代理查询 BirdReport 鸟种...");
  clearBirdreportSpeciesDetail();
  renderBirdreportSpeciesDetail();

  try {
    const results = await fetchAllBirdreportTaxa(payload, {
      onProgress: (message) => setBirdreportMessage(message)
    });
    state.birdreportLastQueryPayload = { ...payload };
    renderBirdreportSpeciesResults(results);
    const queryText = formatBirdreportQuerySummary(payload);
    setBirdreportMessage(`BirdReport 查询完成：${queryText} 共 ${results.length} 个鸟种。`);
  } catch (error) {
    clearBirdreportSpeciesResults();
    setBirdreportMessage(`BirdReport 查询失败：${error.message}`, true);
  } finally {
    setBirdreportLoading(false);
  }
}

async function fetchAllBirdreportTaxa(payload, options = {}) {
  const { onProgress } = options;
  const limit = 500;
  const firstPage = await birdreportProxyPost("/api/birdreport/taxon", {
    ...payload,
    page: 1,
    limit
  });
  const firstItems = normalizeBirdreportTaxonPage(firstPage);
  const total = Math.max(Number(firstPage?.count) || firstItems.length, firstItems.length);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (totalPages === 1) {
    return dedupeBirdreportTaxa(firstItems);
  }

  const pages = [];
  for (let page = 2; page <= totalPages; page += 1) {
    pages.push(page);
  }

  const rest = [];
  for (const page of pages) {
    onProgress?.(`正在通过代理查询 BirdReport 鸟种... 第 ${page}/${totalPages} 页`);
    const response = await birdreportProxyPost("/api/birdreport/taxon", {
      ...payload,
      page,
      limit
    });
    rest.push(...normalizeBirdreportTaxonPage(response));
  }

  return dedupeBirdreportTaxa([...firstItems, ...rest]);
}

async function fetchBirdreportRecordsByTaxon(species, targetDate, options = {}) {
  const taxonId = String(species?.taxon_id || species?.taxonid || species?.key || "").trim();
  if (!taxonId) {
    throw new Error("缺少 BirdReport 鸟种编号，暂时无法查询观测地点。");
  }

  const { onProgress } = options;
  const limit = 100;
  const basePayload = createBirdreportPayload({
    province: BIRDREPORT_RARE_SPECIES_PROVINCE,
    startTime: targetDate,
    endTime: targetDate,
    state: "2"
  });
  const firstPage = await birdreportProxyPost("/api/birdreport/record", {
    ...basePayload,
    taxonid: taxonId,
    page: 1,
    limit
  });
  const firstItems = normalizeBirdreportRecordPage(firstPage);
  const total = Math.max(Number(firstPage?.count) || firstItems.length, firstItems.length);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (totalPages === 1) {
    return firstItems;
  }

  const rest = [];
  for (let page = 2; page <= totalPages; page += 1) {
    onProgress?.(`正在加载观测地点... 第 ${page}/${totalPages} 页`);
    const response = await birdreportProxyPost("/api/birdreport/record", {
      ...basePayload,
      taxonid: taxonId,
      page,
      limit
    });
    rest.push(...normalizeBirdreportRecordPage(response));
  }

  return [...firstItems, ...rest];
}

async function fetchBirdreportRecordsForCurrentQuery(species, payload, options = {}) {
  const taxonId = String(species?.taxon_id || species?.taxonid || species?.key || "").trim();
  const taxonName = String(species?.taxonname || species?.name || "").trim();
  if (!taxonId && !taxonName) {
    throw new Error("缺少 BirdReport 鸟种编号或名称，暂时无法查询地点。");
  }

  if (!payload) {
    throw new Error("缺少 BirdReport 查询条件，请先重新查询鸟种列表。");
  }

  const { onProgress } = options;
  const limit = 100;
  const displayLimit = Math.max(1, Math.min(20, Number(options.limit) || 10));
  const maxPages = Math.max(1, Math.min(8, Number(options.maxPages) || 4));
  const basePayload = {
    ...payload,
    taxonid: taxonId,
    taxonname: taxonName,
    state: "2"
  };

  const firstPage = await birdreportProxyPost("/api/birdreport/record", {
    ...basePayload,
    page: 1,
    limit
  });
  if (isBirdreportCaptchaResponse(firstPage)) {
    throw createBirdreportCaptchaError();
  }

  const firstItems = normalizeBirdreportRecordPage(firstPage).filter((record) => record.isPublic && !record.isHiddenLocation);
  const total = Math.max(Number(firstPage?.count) || firstItems.length, firstItems.length);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pagesToFetch = Math.min(totalPages, maxPages);
  const records = [...firstItems];

  for (let page = 2; page <= pagesToFetch && records.length < displayLimit; page += 1) {
    onProgress?.(`正在加载公开地点... 第 ${page}/${pagesToFetch} 页`);
    const response = await birdreportProxyPost("/api/birdreport/record", {
      ...basePayload,
      page,
      limit
    });
    if (isBirdreportCaptchaResponse(response)) {
      throw createBirdreportCaptchaError();
    }
    records.push(...normalizeBirdreportRecordPage(response).filter((record) => record.isPublic && !record.isHiddenLocation));
  }

  return records.sort(sortBirdreportRecordsByObservationTimeDesc).slice(0, displayLimit);
}

function normalizeBirdreportTaxonPage(response) {
  const decoded = decodeBirdreportPayload(response?.data);
  const decodedItems = getBirdreportTaxaArray(decoded);
  if (decodedItems.length) {
    return decodedItems;
  }

  return getBirdreportTaxaArray(response);
}

function normalizeBirdreportRecordPage(response) {
  const decoded = decodeBirdreportPayload(response?.data);
  const items = getBirdreportRecordItems(decoded);
  const fallbackItems = items.length ? items : getBirdreportRecordItems(response);
  if (!Array.isArray(items)) {
    return [];
  }

  return fallbackItems.map((item, index) => normalizeBirdreportRecordItem(item, index)).filter(Boolean);
}

function renderBirdreportSpeciesDetail() {
  const detailTarget = elements.birdreportSpeciesDetail;
  if (!detailTarget) {
    return;
  }

  const species = state.birdreportSpeciesDetailSpecies;
  if (!state.activeBirdreportSpeciesKey || !species) {
    detailTarget.innerHTML = "";
    detailTarget.classList.add("is-hidden");
    elements.birdreportSpeciesDetailBackdrop?.classList.add("is-hidden");
    document.body.classList.remove("birdreport-species-detail-open");
    return;
  }

  let content = "";
  if (state.birdreportSpeciesDetailLoading) {
    content = '<div class="empty-state">正在加载当前筛选条件下的公开地点...</div>';
  } else if (state.birdreportSpeciesDetailError === "captcha_required") {
    content = `
      <div class="birdreport-captcha-panel">
        <strong>BirdReport 需要验证码</strong>
        <span>输入图片里的验证码后，会自动继续加载这个鸟种的公开地点。</span>
        <div class="birdreport-captcha-row">
          ${
            state.birdreportSpeciesCaptchaImageUrl
              ? `<img class="birdreport-captcha-image" src="${escapeHtml(state.birdreportSpeciesCaptchaImageUrl)}" alt="BirdReport 验证码" />`
              : '<span class="empty-state">验证码加载中...</span>'
          }
          <button type="button" class="ghost birdreport-species-refresh-captcha-btn">换一张</button>
        </div>
        <div class="birdreport-captcha-row">
          <input class="birdreport-captcha-input birdreport-species-captcha-input" type="text" inputmode="text" maxlength="4" autocomplete="off" placeholder="输入验证码" />
          <button type="button" class="birdreport-species-submit-captcha-btn">${state.birdreportSpeciesCaptchaLoading ? "验证中..." : "验证并重试"}</button>
        </div>
        ${state.birdreportSpeciesCaptchaError ? `<div class="message error">${escapeHtml(state.birdreportSpeciesCaptchaError)}</div>` : ""}
      </div>
    `;
  } else if (state.birdreportSpeciesDetailError) {
    content = `<div class="empty-state">加载失败：${escapeHtml(state.birdreportSpeciesDetailError)}</div>`;
  } else if (!state.birdreportSpeciesDetailRecords.length) {
    content = '<div class="empty-state">当前筛选条件下没有可展示的公开地点。</div>';
  } else {
    content = `
      <div class="birdreport-rare-detail-list">
        ${state.birdreportSpeciesDetailRecords
          .map(
            (record) => `
              <div class="birdreport-rare-detail-item">
                <strong>${escapeHtml(record.pointName || "未提供观测地点")}</strong>
                <div class="birdreport-rare-detail-meta">
                  <span>观测时间：${escapeHtml(record.startTimeLabel)} 至 ${escapeHtml(record.endTimeLabel)}</span>
                  <span>记录数量：${escapeHtml(String(record.taxonCount ?? 0))}</span>
                  <span>记录用户：${escapeHtml(record.username || "未提供")}</span>
                  <span>报告编号：${escapeHtml(record.serialId || "未提供")}</span>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  detailTarget.innerHTML = `
    <div class="birdreport-rare-detail-header">
      <div>
        <h3 class="birdreport-rare-detail-title">${escapeHtml(species.taxonname || species.name || "未命名鸟种")} 的公开地点</h3>
        <p class="birdreport-rare-detail-subtitle">${escapeHtml(formatBirdreportQuerySummary(state.birdreportLastQueryPayload || {}))} · 点击表格中的其他鸟种可快速切换</p>
      </div>
      <button type="button" class="ghost" id="closeBirdreportSpeciesDetailBtn">收起详情</button>
    </div>
    ${content}
  `;
  detailTarget.classList.remove("is-hidden");
  elements.birdreportSpeciesDetailBackdrop?.classList.remove("is-hidden");
  document.body.classList.add("birdreport-species-detail-open");
  detailTarget.querySelector("#closeBirdreportSpeciesDetailBtn")?.addEventListener("click", closeBirdreportSpeciesDetail);

  const submit = detailTarget.querySelector(".birdreport-species-submit-captcha-btn");
  const input = detailTarget.querySelector(".birdreport-species-captcha-input");
  const refresh = detailTarget.querySelector(".birdreport-species-refresh-captcha-btn");
  if (submit) {
    submit.disabled = state.birdreportSpeciesCaptchaLoading;
    submit.addEventListener("click", () => submitBirdreportSpeciesCaptcha(species, input?.value));
  }
  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      submitBirdreportSpeciesCaptcha(species, input.value);
    }
  });
  refresh?.addEventListener("click", () => refreshBirdreportSpeciesCaptcha());
}

async function toggleBirdreportSpeciesDetail(species) {
  const key = getBirdreportTaxonKey(species);
  if (!key) {
    setBirdreportMessage("这个鸟种缺少可用编号，暂时不能查询地点。", true);
    return;
  }

  if (!state.birdreportLastQueryPayload) {
    setBirdreportMessage("请先重新执行一次 BirdReport 查询，再查看地点。", true);
    return;
  }

  if (state.activeBirdreportSpeciesKey === key && !state.birdreportSpeciesDetailLoading) {
    closeBirdreportSpeciesDetail();
    return;
  }

  state.activeBirdreportSpeciesKey = key;
  state.birdreportSpeciesDetailSpecies = species;
  state.birdreportSpeciesDetailRecords = [];
  state.birdreportSpeciesDetailError = "";
  state.birdreportSpeciesDetailLoading = true;
  renderBirdreportSpeciesResults(state.birdreportLastResults);
  setBirdreportMessage(`正在加载 ${species.taxonname || species.name || "该鸟种"} 在当前筛选条件下的公开地点...`);

  try {
    state.birdreportSpeciesDetailRecords = await fetchBirdreportRecordsForCurrentQuery(species, state.birdreportLastQueryPayload, {
      limit: 10,
      onProgress: (message) => setBirdreportMessage(message)
    });
    state.birdreportSpeciesDetailError = "";
    setBirdreportMessage(
      state.birdreportSpeciesDetailRecords.length
        ? `${species.taxonname || species.name || "该鸟种"} 的公开地点已加载 ${state.birdreportSpeciesDetailRecords.length} 条。`
        : `${species.taxonname || species.name || "该鸟种"} 在当前筛选条件下没有可展示的公开地点。`
    );
  } catch (error) {
    if (isBirdreportCaptchaError(error)) {
      state.birdreportSpeciesDetailError = "captcha_required";
      state.birdreportSpeciesCaptchaError = "";
      await refreshBirdreportSpeciesCaptcha({ silent: true });
      setBirdreportMessage("BirdReport 要求输入验证码，验证后会自动重试地点查询。", true);
    } else {
      state.birdreportSpeciesDetailError = error.message;
      setBirdreportMessage(`加载公开地点失败：${error.message}`, true);
    }
  } finally {
    state.birdreportSpeciesDetailLoading = false;
    renderBirdreportSpeciesResults(state.birdreportLastResults);
  }
}

async function submitBirdreportSpeciesCaptcha(species, rawCode) {
  const code = String(rawCode || "").trim();
  if (!code) {
    state.birdreportSpeciesCaptchaError = "请先输入验证码。";
    renderBirdreportSpeciesDetail();
    return;
  }

  state.birdreportSpeciesCaptchaLoading = true;
  state.birdreportSpeciesCaptchaError = "";
  renderBirdreportSpeciesDetail();

  try {
    await verifyBirdreportCaptcha(code);
    state.birdreportSpeciesCaptchaLoading = false;
    state.birdreportSpeciesCaptchaError = "";
    state.birdreportSpeciesDetailError = "";
    state.birdreportSpeciesDetailLoading = true;
    state.birdreportSpeciesDetailRecords = [];
    renderBirdreportSpeciesResults(state.birdreportLastResults);
    setBirdreportMessage("验证码通过，正在重新加载公开地点...");

    state.birdreportSpeciesDetailRecords = await fetchBirdreportRecordsForCurrentQuery(species, state.birdreportLastQueryPayload, {
      limit: 10,
      onProgress: (message) => setBirdreportMessage(message)
    });
    state.birdreportSpeciesDetailError = "";
    setBirdreportMessage(
      state.birdreportSpeciesDetailRecords.length
        ? `${species.taxonname || species.name || "该鸟种"} 的公开地点已加载 ${state.birdreportSpeciesDetailRecords.length} 条。`
        : `${species.taxonname || species.name || "该鸟种"} 在当前筛选条件下没有可展示的公开地点。`
    );
  } catch (error) {
    state.birdreportSpeciesCaptchaLoading = false;
    state.birdreportSpeciesDetailLoading = false;
    state.birdreportSpeciesDetailError = "captcha_required";
    state.birdreportSpeciesCaptchaError = error.message;
    await refreshBirdreportSpeciesCaptcha({ silent: true });
    setBirdreportMessage(`验证码验证失败：${error.message}`, true);
  } finally {
    state.birdreportSpeciesCaptchaLoading = false;
    state.birdreportSpeciesDetailLoading = false;
    renderBirdreportSpeciesResults(state.birdreportLastResults);
  }
}

async function refreshBirdreportSpeciesCaptcha(options = {}) {
  const { silent = false } = options;
  try {
    const imageUrl = await loadBirdreportCaptchaImage();
    if (state.birdreportSpeciesCaptchaImageUrl) {
      URL.revokeObjectURL(state.birdreportSpeciesCaptchaImageUrl);
    }
    state.birdreportSpeciesCaptchaImageUrl = imageUrl;
    if (!silent) {
      state.birdreportSpeciesCaptchaError = "";
      renderBirdreportSpeciesDetail();
    }
  } catch (error) {
    state.birdreportSpeciesCaptchaError = `验证码加载失败：${error.message}`;
    if (!silent) {
      renderBirdreportSpeciesDetail();
    }
  }
}

function clearBirdreportSpeciesDetail() {
  state.activeBirdreportSpeciesKey = null;
  state.birdreportSpeciesDetailSpecies = null;
  state.birdreportSpeciesDetailRecords = [];
  state.birdreportSpeciesDetailLoading = false;
  state.birdreportSpeciesDetailError = "";
  if (state.birdreportSpeciesCaptchaImageUrl) {
    URL.revokeObjectURL(state.birdreportSpeciesCaptchaImageUrl);
  }
  state.birdreportSpeciesCaptchaImageUrl = "";
  state.birdreportSpeciesCaptchaLoading = false;
  state.birdreportSpeciesCaptchaError = "";
}

function closeBirdreportSpeciesDetail() {
  if (!state.activeBirdreportSpeciesKey) {
    return;
  }

  clearBirdreportSpeciesDetail();
  renderBirdreportSpeciesResults(state.birdreportLastResults);
}

function getBirdreportRecordItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidates = [
    payload.list,
    payload.rows,
    payload.records,
    payload.items,
    payload.result,
    payload.data
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function normalizeBirdreportRecordItem(item, index) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const stateValue = Number(item.state ?? item.status);
  const provinceName = String(item.province_name || item.provinceName || item.province || "").trim();
  const cityName = String(item.city_name || item.cityName || item.city || "").trim();
  const districtName = String(item.district_name || item.districtName || item.district || item.county || "").trim();
  const pointName = String(
    item.point_name ||
      item.pointName ||
      item.pointname ||
      item.point ||
      item.location ||
      item.locationName ||
      item.locality ||
      item.address ||
      ""
  ).trim();
  const locationText = `${provinceName}${cityName}${districtName}${pointName}` || pointName;
  const hasVisibleLocation = Boolean(locationText) && !locationText.includes("*");
  const isPublic = stateValue === 2 || hasVisibleLocation;
  const location = isPublic ? locationText : "*** *** *** ********";
  const username = isPublic ? String(item.username || item.userName || item.nickname || "").trim() : "******";
  const serialId = isPublic ? String(item.serial_id || item.serialId || item.serialid || item.id || "").trim() : "*************";
  const startTime = String(item.start_time || item.startTime || item.observation_time || item.observationTime || item.time || "").trim();
  const endTime = String(item.end_time || item.endTime || item.finish_time || item.finishTime || item.time || "").trim();
  return {
    id: String(item.serial_id || item.serialId || item.serialid || item.id || `${startTime || "record"}-${index}`),
    serialId,
    pointName: location,
    username: username || "未提供",
    taxonCount: Number(item.taxon_count ?? item.taxonCount ?? item.count ?? item.number) || 0,
    isPublic,
    isHiddenLocation: location.includes("*"),
    startTime,
    endTime,
    startTimeLabel: formatBirdreportDateTime(startTime),
    endTimeLabel: formatBirdreportDateTime(endTime)
  };
}

function sortBirdreportRecordsBySerialIdDesc(left, right) {
  const leftSerial = normalizeBirdreportSerialId(left);
  const rightSerial = normalizeBirdreportSerialId(right);
  if (leftSerial.length !== rightSerial.length) {
    return rightSerial.length - leftSerial.length;
  }

  const serialDiff = rightSerial.localeCompare(leftSerial, "en-US");
  if (serialDiff !== 0) {
    return serialDiff;
  }

  return String(right?.id || "").localeCompare(String(left?.id || ""), "zh-CN");
}

function normalizeBirdreportSerialId(record) {
  return String(record?.serialId || record?.id || "")
    .replace(/\D/g, "")
    .replace(/^0+/, "");
}

function sortBirdreportRecordsByObservationTimeDesc(left, right) {
  const rightTime = parseBirdreportRecordTime(right?.startTime || right?.endTime);
  const leftTime = parseBirdreportRecordTime(left?.startTime || left?.endTime);
  if (rightTime !== leftTime) {
    return rightTime - leftTime;
  }

  return sortBirdreportRecordsBySerialIdDesc(left, right);
}

function parseBirdreportRecordTime(value) {
  const text = String(value || "").trim();
  if (!text) {
    return 0;
  }

  const parsed = new Date(text.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getBirdreportReportCount(item) {
  const explicitReportCount = Number(item?.reportcount ?? item?.reportCount ?? item?.report_count);
  if (Number.isFinite(explicitReportCount) && explicitReportCount > 0) {
    return explicitReportCount;
  }

  return Number(item?.recordcount) || 0;
}

function dedupeBirdreportTaxa(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getBirdreportTaxonKey(item);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function sortBirdreportTaxaByRecordCount(items) {
  return [...items].sort((left, right) => {
    const leftCount = Number(left?.recordcount) || 0;
    const rightCount = Number(right?.recordcount) || 0;
    if (leftCount !== rightCount) {
      return leftCount - rightCount;
    }

    const leftName = String(left?.taxonname || left?.name || "");
    const rightName = String(right?.taxonname || right?.name || "");
    return leftName.localeCompare(rightName, "zh-CN");
  });
}

function birdreportProxyPost(path, data) {
  const baseUrl = normalizeProxyBaseUrl(elements.birdreportProxyUrl.value);
  persistBirdreportProxySettings();
  const signedRequest = buildBirdreportSignedRequest(data);

  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      ...signedRequest.headers
    },
    body: signedRequest.body
  }).then(async (response) => {
    let payload = null;
    const text = await response.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (response.ok) {
      return payload;
    }

    const rawMessage =
      payload?.error ||
      payload?.msg ||
      (typeof payload === "string" ? payload : "") ||
      `HTTP ${response.status}`;
    const message =
      String(rawMessage).trim() === "Unknown endpoint"
        ? `代理脚本里还没有 ${path}，请先重启 birdreport-proxy.ps1 以加载最新接口`
        : rawMessage;
    throw new Error(message);
  });
}

function buildBirdreportSignedRequest(data) {
  const serializedData = serializeBirdreportRequestData(data);
  const normalizedPayload = JSON.stringify(sortBirdreportObjectKeys(parseBirdreportRequestData(serializedData)));
  const timestamp = String(Date.now());
  const requestId = generateBirdreportRequestId();
  const sign = window.MD5(`${normalizedPayload}${requestId}${timestamp}`);
  const encrypt = new window.JSEncrypt();
  encrypt.setPublicKey(BIRDREPORT_PARAM_PUBLIC_KEY);
  const encryptedBody = encrypt.encryptLong(normalizedPayload);

  if (!encryptedBody) {
    throw new Error("BirdReport 请求体加密失败。");
  }

  return {
    body: encryptedBody,
    headers: {
      timestamp,
      requestId,
      sign
    }
  };
}

function serializeBirdreportRequestData(data) {
  const params = new URLSearchParams();
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value == null || value === "") {
      return;
    }
    params.append(key, String(value));
  });
  return params.toString();
}

function parseBirdreportRequestData(serializedData) {
  if (!serializedData) {
    return {};
  }

  const result = {};
  serializedData.split("&").forEach((entry) => {
    if (!entry) {
      return;
    }
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex === -1) {
      result[entry] = "";
      return;
    }
    result[entry.slice(0, separatorIndex)] = entry.slice(separatorIndex + 1);
  });
  return result;
}

function sortBirdreportObjectKeys(source) {
  return Object.keys(source || {})
    .sort()
    .reduce((result, key) => {
      result[key] = source[key];
      return result;
    }, {});
}

function generateBirdreportRequestId() {
  const hexDigits = "0123456789abcdef";
  const output = [];
  for (let index = 0; index < 32; index += 1) {
    output[index] = hexDigits[Math.floor(Math.random() * 16)];
  }
  output[14] = "4";
  output[19] = hexDigits[(Number.parseInt(output[19], 16) & 0x3) | 0x8];
  return output.join("");
}

function renderBirdreportRegionOptions(target, items, labelKey, codeKey, placeholder) {
  resetSelectOptions(target, placeholder);
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = String(item[labelKey] || "").trim();
    option.textContent = option.value;
    if (codeKey) {
      option.dataset.code = String(item[codeKey] || "").trim();
    }
    target.append(option);
  });
}

function resetSelectOptions(target, placeholder) {
  target.innerHTML = "";
  const option = document.createElement("option");
  option.value = "";
  option.textContent = placeholder;
  target.append(option);
}

function renderBirdreportSpeciesResults(results) {
  elements.birdreportSpeciesContainer.innerHTML = "";
  if (!results.length) {
    state.birdreportLastResults = [];
    clearBirdreportSpeciesDetail();
    renderBirdreportSpeciesDetail();
    elements.birdreportSpeciesSummary.textContent = "当前条件下没有查到鸟种。";
    elements.birdreportSpeciesContainer.innerHTML = '<div class="empty-state">当前条件下没有 BirdReport 鸟种结果。</div>';
    return;
  }

  const sortedResults = sortBirdreportTaxaByRecordCount(results);
  state.birdreportLastResults = sortedResults;
  if (!sortedResults.some((item) => getBirdreportTaxonKey(item) === state.activeBirdreportSpeciesKey)) {
    clearBirdreportSpeciesDetail();
  }

  elements.birdreportSpeciesSummary.textContent = `当前查询返回 ${sortedResults.length} 个鸟种，已按记录次数升序排列。点击鸟种名称可以查看当前筛选条件下的公开地点。`;
  elements.birdreportSpeciesContainer.innerHTML = `
    <div class="result-table" style="--table-columns: 72px minmax(240px, 1.55fr) minmax(210px, 1.35fr) 120px 116px;">
      <div class="result-table-header">
        <div class="result-table-cell">序号</div>
        <div class="result-table-cell">鸟种</div>
        <div class="result-table-cell">分类</div>
        <div class="result-table-cell">记录数</div>
        <div class="result-table-cell">地点</div>
      </div>
      <div class="result-table-body">
        ${sortedResults
          .map((item, index) => {
            const key = getBirdreportTaxonKey(item);
            const isActive = key && key === state.activeBirdreportSpeciesKey;
            const isLoading = isActive && state.birdreportSpeciesDetailLoading;
            return `
              <div class="result-table-row${isActive ? " is-active" : ""}">
                <div class="result-table-cell result-table-index">${sortedResults.length - index}</div>
                <div class="result-table-cell">
                  <button
                    type="button"
                    class="result-table-name-btn"
                    data-birdreport-species-key="${escapeHtml(key)}"
                    ${key ? "" : "disabled"}
                    aria-pressed="${isActive ? "true" : "false"}"
                  >
                    <strong>${escapeHtml(item.taxonname || item.name || "未命名鸟种")}</strong>
                    <span class="result-table-meta">${escapeHtml(item.latinname || item.englishname || "未提供学名/英文名")}</span>
                  </button>
                </div>
                <div class="result-table-cell result-table-location">${escapeHtml(item.taxonordername || "未提供目")} · ${escapeHtml(item.taxonfamilyname || "未提供科")}</div>
                <div class="result-table-cell result-table-count">${escapeHtml((Number(item.recordcount) || 0).toLocaleString("zh-CN"))}</div>
                <div class="result-table-cell result-table-status">${!key ? "不可用" : isLoading ? "加载中..." : isActive ? "已展开" : "查看地点"}</div>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
  elements.birdreportSpeciesContainer.querySelectorAll("[data-birdreport-species-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const species = state.birdreportLastResults.find((item) => getBirdreportTaxonKey(item) === button.dataset.birdreportSpeciesKey);
      if (species) {
        toggleBirdreportSpeciesDetail(species);
      }
    });
  });
  renderBirdreportSpeciesDetail();
}

function clearBirdreportSpeciesResults() {
  state.birdreportLastQueryPayload = null;
  state.birdreportLastResults = [];
  clearBirdreportSpeciesDetail();
  elements.birdreportSpeciesSummary.textContent = "";
  elements.birdreportSpeciesContainer.innerHTML = "";
  renderBirdreportSpeciesDetail();
}

function decodeBirdreportPayload(payload) {
  if (!payload) {
    return [];
  }

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) {
      return [];
    }

    try {
      return JSON.parse(trimmed);
    } catch (jsonError) {
      let decodedText = "";
      if (typeof window.BIRDREPORT_APIJS?.decode === "function") {
        try {
          decodedText = window.BIRDREPORT_APIJS.decode.call(window.BIRDREPORT_APIJS, trimmed) || "";
        } catch (decodeError) {
          decodedText = decodeBirdreportPayloadWithCryptoJs(trimmed);
        }
      } else {
        decodedText = decodeBirdreportPayloadWithCryptoJs(trimmed);
      }
      return JSON.parse(decodedText || "[]");
    }
  }

  return payload;
}

function decodeBirdreportPayloadWithCryptoJs(payload) {
  if (!window.CryptoJS?.AES || !window.CryptoJS?.enc) {
    throw new Error("BirdReport 解码依赖未加载，暂时不能读取返回结果。");
  }

  const key = window.CryptoJS.enc.Utf8.parse(decodeBirdreportDecimalPairs(BIRDREPORT_AES_KEY_SOURCE));
  const iv = window.CryptoJS.enc.Hex.parse(decodeBirdreportDecimalPairs(BIRDREPORT_AES_IV_SOURCE));
  const decoded = window.CryptoJS.AES.decrypt(payload, key, {
    iv,
    mode: window.CryptoJS.mode.CBC,
    padding: window.CryptoJS.pad.Pkcs7
  }).toString(window.CryptoJS.enc.Utf8);

  if (!decoded) {
    throw new Error("BirdReport 返回数据解码失败。");
  }

  return decoded;
}

function decodeBirdreportDecimalPairs(source) {
  let output = "";
  for (let index = 0; index < source.length; index += 2) {
    output += String.fromCharCode(Number(source.slice(index, index + 2)));
  }
  return output;
}

function setBirdreportLoading(isLoading) {
  elements.queryBirdreportProxyBtn.disabled = isLoading;
  elements.openBirdreportTaxonBtn.disabled = isLoading;
  elements.openBirdreportSearchBtn.disabled = isLoading;
  elements.queryBirdreportProxyBtn.textContent = isLoading ? "查询中..." : "通过代理查询鸟种";
}

function normalizeProxyBaseUrl(value) {
  const trimmed = String(value || "").trim() || getDefaultBirdreportProxyUrl();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function openExternalUrl(url) {
  if (window.BeauBirdAndroid && typeof window.BeauBirdAndroid.openExternal === "function") {
    window.BeauBirdAndroid.openExternal(url);
    return;
  }

  window.open(url, "_blank", "noopener");
}

function openBirdreportTaxonPage() {
  const payload = buildBirdreportQueryPayload();
  if (!payload) {
    return;
  }

  const url = `${BIRDREPORT_TAXON_PAGE_URL}?search=${encodeURIComponent(encodeBase64Utf8(JSON.stringify(payload)))}`;
  openExternalUrl(url);
  setBirdreportMessage("已打开 BirdReport 鸟种结果页。");
}

function openBirdreportSearchPage() {
  const payload = buildBirdreportQueryPayload();
  if (!payload) {
    return;
  }

  const url = new URL(BIRDREPORT_SEARCH_PAGE_URL);
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== "") {
      url.searchParams.set(key, value);
    }
  });
  openExternalUrl(url.toString());
  setBirdreportMessage("已打开 BirdReport 查询页，并带入当前筛选条件。");
}

function buildBirdreportQueryPayload() {
  const startTime = normalizeDateInput(elements.birdreportStartDate.value);
  const endTime = normalizeDateInput(elements.birdreportEndDate.value);
  const province = String(elements.birdreportProvince.value || "").trim();
  const city = String(elements.birdreportCity.value || "").trim();
  const district = String(elements.birdreportDistrict.value || "").trim();
  const pointname = String(elements.birdreportPointName?.value || "").trim();

  if (![startTime, endTime, province, city, district, pointname].some(Boolean)) {
    setBirdreportMessage("请先选择区域、填写观测地点，或设置日期范围。", true);
    (elements.birdreportPointName || elements.birdreportProvince).focus();
    return null;
  }

  if (startTime && endTime && startTime > endTime) {
    setBirdreportMessage("开始日期不能晚于结束日期。", true);
    elements.birdreportStartDate.focus();
    return null;
  }

  return createBirdreportPayload({ startTime, endTime, province, city, district, pointname });
}

function formatBirdreportQuerySummary(payload) {
  const areaText = [payload.province, payload.city, payload.district].filter(Boolean).join(" / ");
  const pointText = payload.pointname ? `观测地点“${payload.pointname}”` : "";
  return [areaText, pointText].filter(Boolean).join(" · ") || "当前筛选条件";
}

function normalizeBirdreportAdministrativeArea(payload) {
  const normalized = { ...payload };
  const municipalityKey = `${normalized.province}${normalized.city}`;

  if (normalized.city && !normalized.district && BIRDREPORT_MUNICIPALITY_AREAS.includes(municipalityKey)) {
    normalized.district = normalized.city;
    normalized.city = "";
  }

  return normalized;
}

function normalizeEbirdObservations(observations, taxonomyMap = new Map()) {
  if (!Array.isArray(observations)) {
    return [];
  }

  return observations
    .map((observation, index) => {
      const taxonomy = taxonomyMap.get(observation.speciesCode) || {};
      return normalizeRecord({
        id: createEbirdObservationId(observation, index),
        date: normalizeDate(observation.obsDt),
        species: taxonomy.commonName || observation.comName || observation.sciName,
        location: String(observation.locName || observation.locId || "").trim(),
        lat: toNumber(observation.lat),
        lng: toNumber(observation.lng),
        notes: buildEbirdNotes(observation),
        speciesCode: observation.speciesCode,
        sciName: taxonomy.sciName || observation.sciName,
        taxonOrder: taxonomy.taxonOrder ?? null,
        orderName: taxonomy.orderName,
        familyName: taxonomy.familyName,
        familyCommonName: taxonomy.familyCommonName,
        genusName: taxonomy.genusName
      });
    })
    .filter((record) => record.date && record.species && record.location);
}

function createEbirdObservationId(observation, index) {
  const parts = [
    "ebird",
    observation.subId || "nosub",
    observation.speciesCode || "nospecies",
    normalizeDate(observation.obsDt) || "nodate",
    String(observation.locId || observation.locName || "").trim() || "nolocation",
    String(index)
  ];

  return parts.join("|");
}

function buildEbirdNotes(observation) {
  const parts = ["eBird 同步"];
  if (observation.howMany != null) {
    parts.push(`数量 ${observation.howMany}`);
  }
  if (observation.subId) {
    parts.push(`提交 ${observation.subId}`);
  }
  return parts.join(" · ");
}

async function fetchEbirdTaxonomyMap(apiKey, speciesCodes) {
  const uniqueCodes = [...new Set(speciesCodes.filter(Boolean))];
  const result = new Map();

  if (!uniqueCodes.length) {
    return result;
  }

  const chunks = chunkArray(uniqueCodes, 80);
  await Promise.all(
    chunks.map(async (chunk) => {
      const url = new URL("https://api.ebird.org/v2/ref/taxonomy/ebird");
      url.searchParams.set("fmt", "json");
      url.searchParams.set("locale", EBIRD_SPECIES_LOCALE);
      url.searchParams.set("species", chunk.join(","));

      const response = await fetch(url, {
        headers: {
          "X-eBirdApiToken": apiKey
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`taxonomy 返回 ${response.status}：${errorText || "请求失败"}`);
      }

      const payload = await response.json();
      payload.forEach((item) => {
        result.set(item.speciesCode, {
          speciesCode: String(item.speciesCode || "").trim(),
          commonName: simplifyChineseText(item.comName || ""),
          sciName: String(item.sciName || "").trim(),
          taxonOrder: toTaxonOrder(item.taxonOrder),
          orderName: String(item.order || "").trim(),
          familyName: String(item.familySciName || item.family || "").trim(),
          familyCommonName: simplifyChineseText(item.familyComName || item.familyCommonName || ""),
          genusName: extractGenus(item.sciName)
        });
      });
    })
  );

  return result;
}

function mergeRecords(existingRecords, incomingRecords) {
  const merged = [...existingRecords];
  const seen = new Set(existingRecords.map(createDedupKey));
  let addedCount = 0;
  let duplicateCount = 0;

  incomingRecords.forEach((record) => {
    const key = createDedupKey(record);
    if (seen.has(key)) {
      duplicateCount += 1;
      return;
    }

    seen.add(key);
    merged.push(record);
    addedCount += 1;
  });

  return {
    mergedRecords: normalizeRecords(merged),
    addedCount,
    duplicateCount
  };
}

function createDedupKey(record) {
  return [
    record.date,
    record.species,
    record.location,
    record.lat == null ? "" : Number(record.lat).toFixed(4),
    record.lng == null ? "" : Number(record.lng).toFixed(4)
  ].join("|");
}

function normalizeRecord(record) {
  const species = simplifyChineseText(String(record.species || "").trim());
  const sciName = String(record.sciName || record.scientificName || "").trim();
  const speciesCode = String(record.speciesCode || record.species_code || "").trim();
  const fallbackTaxonomy = getFallbackTaxonomy(species, speciesCode, sciName);
  const finalSciName = sciName || fallbackTaxonomy.sciName || "";
  const genusName = String(record.genusName || record.genus || extractGenus(finalSciName) || fallbackTaxonomy.genusName || "").trim();
  const familyCommonName = simplifyChineseText(
    String(record.familyCommonName || record.familyCommon || fallbackTaxonomy.familyCommonName || "").trim()
  );

  return {
    id: record.id || createId(),
    date: normalizeDate(record.date),
    species,
    location: String(record.location || "").trim(),
    lat: toNumber(record.lat),
    lng: toNumber(record.lng),
    notes: String(record.notes || "").trim(),
    speciesCode: speciesCode || fallbackTaxonomy.speciesCode || "",
    sciName: finalSciName,
    taxonOrder: toTaxonOrder(record.taxonOrder ?? record.taxon_order) ?? fallbackTaxonomy.taxonOrder ?? null,
    className: "Aves",
    orderName: String(record.orderName || record.order || fallbackTaxonomy.orderName || "").trim(),
    familyName: String(record.familyName || record.family || fallbackTaxonomy.familyName || "").trim(),
    familyCommonName,
    genusName
  };
}

function migrateExistingRecords() {
  const previousSnapshot = JSON.stringify(state.personalRecords);
  const normalized = normalizeRecords(state.personalRecords);
  const changed = countMigratedRecords(state.personalRecords, normalized);

  if (previousSnapshot !== JSON.stringify(normalized)) {
    state.personalRecords = normalized;
  }

  return { changed };
}

function countMigratedRecords(previousRecords, nextRecords) {
  const limit = Math.min(previousRecords.length, nextRecords.length);
  let changed = Math.abs(previousRecords.length - nextRecords.length);

  for (let index = 0; index < limit; index += 1) {
    const previous = previousRecords[index] || {};
    const next = nextRecords[index] || {};
    if (
      String(previous.species || "") !== String(next.species || "") ||
      String(previous.orderName || previous.order || "") !== String(next.orderName || "") ||
      String(previous.familyName || previous.family || "") !== String(next.familyName || "") ||
      String(previous.familyCommonName || previous.familyCommon || "") !== String(next.familyCommonName || "") ||
      String(previous.genusName || previous.genus || "") !== String(next.genusName || "") ||
      String(previous.sciName || previous.scientificName || "") !== String(next.sciName || "") ||
      String(previous.speciesCode || previous.species_code || "") !== String(next.speciesCode || "")
    ) {
      changed += 1;
    }
  }

  return changed;
}

function buildInitialMessage() {
  if (!state.personalRecords.length) {
    return "可以上传文件、粘贴内容，或先加载示例数据。";
  }

  if (state.migrationSummary.changed > 0) {
    return `已加载 ${state.personalRecords.length} 条个人记录，并自动更新了 ${state.migrationSummary.changed} 条旧记录的鸟名/分类信息。`;
  }

  return `已加载 ${state.personalRecords.length} 条个人记录。`;
}

function getFallbackTaxonomy(species, speciesCode, sciName) {
  if (species && COMMON_BIRD_TAXONOMY[species]) {
    return COMMON_BIRD_TAXONOMY[species];
  }

  if (sciName) {
    const entry = Object.values(COMMON_BIRD_TAXONOMY).find((item) => item.sciName === sciName);
    if (entry) {
      return entry;
    }
  }

  if (speciesCode) {
    const entry = Object.values(COMMON_BIRD_TAXONOMY).find((item) => item.speciesCode === speciesCode);
    if (entry) {
      return entry;
    }
  }

  return {};
}

function buildTaxonomyTree(records) {
  const root = createTaxonomyNode("class", "Aves", ROOT_CLASS_LABEL);

  records.forEach((record) => {
    hydrateTaxonomyNode(root, record);
    const path = getTaxonomyPath(record);
    let current = root;

    path.forEach((segment) => {
      const nodeKey = `${segment.level}:${segment.key}`;
      if (!current.children.has(nodeKey)) {
        current.children.set(nodeKey, createTaxonomyNode(segment.level, segment.key, segment.label));
      }

      current = current.children.get(nodeKey);
      hydrateTaxonomyNode(current, record);
    });
  });

  return root.recordCount ? root : null;
}

function createTaxonomyNode(level, key, label) {
  return {
    level,
    key,
    label,
    recordCount: 0,
    speciesSet: new Set(),
    sortValue: Number.POSITIVE_INFINITY,
    children: new Map()
  };
}

function hydrateTaxonomyNode(node, record) {
  node.recordCount += 1;
  node.speciesSet.add(record.species);
  if (record.taxonOrder != null) {
    node.sortValue = Math.min(node.sortValue, record.taxonOrder);
  }
}

function getTaxonomyPath(record) {
  const orderKey = record.orderName || UNKNOWN_ORDER_LABEL;
  const familyKey = record.familyName || UNKNOWN_FAMILY_LABEL;
  const genusKey = record.genusName || UNKNOWN_GENUS_LABEL;

  return [
    { level: "order", key: orderKey, label: formatTaxonLabel("order", orderKey) },
    { level: "family", key: familyKey, label: formatTaxonLabel("family", familyKey, record.familyCommonName) },
    { level: "genus", key: genusKey, label: formatTaxonLabel("genus", genusKey) },
    { level: "species", key: record.species, label: record.species }
  ];
}

function renderTaxonomyNode(node, depth, pathKey) {
  const item = document.createElement("li");
  item.className = `taxonomy-item level-${node.level}`;

  const hasChildren = node.children.size > 0;
  const isExpanded = state.expandedTaxa.has(pathKey);
  const isActiveLeaf = node.level === "species" && elements.speciesFilter.value === node.label;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `taxonomy-toggle${isExpanded ? " is-expanded" : ""}${hasChildren ? "" : " is-leaf"}${isActiveLeaf ? " is-active" : ""}`;
  button.style.setProperty("--depth", String(depth));
  button.setAttribute("aria-expanded", String(Boolean(hasChildren && isExpanded)));

  const caret = document.createElement("span");
  caret.className = "taxonomy-caret";
  caret.textContent = hasChildren ? (isExpanded ? "▾" : "▸") : "•";

  const label = document.createElement("span");
  label.className = "taxonomy-label";
  label.textContent = node.label;

  const meta = document.createElement("span");
  meta.className = "taxonomy-meta";
  meta.textContent = node.level === "species" ? `${node.recordCount} 条` : `${node.speciesSet.size} 种 · ${node.recordCount} 条`;

  button.append(caret, label, meta);
  button.addEventListener("click", () => {
    if (hasChildren) {
      if (state.expandedTaxa.has(pathKey)) {
        state.expandedTaxa.delete(pathKey);
      } else {
        state.expandedTaxa.add(pathKey);
      }
      renderRecordsOnly();
      return;
    }

    elements.speciesFilter.value = elements.speciesFilter.value === node.label ? "" : node.label;
    renderRecordsOnly();
  });

  item.append(button);

  if (hasChildren && isExpanded) {
    const list = document.createElement("ul");
    list.className = "taxonomy-list";
    getSortedTaxonomyChildren(node).forEach((child) => {
      const childPathKey = `${pathKey}/${child.level}:${child.key}`;
      list.append(renderTaxonomyNode(child, depth + 1, childPathKey));
    });
    item.append(list);
  }

  return item;
}

function getSortedTaxonomyChildren(node) {
  return [...node.children.values()].sort((left, right) => {
    if (left.sortValue !== right.sortValue) {
      return left.sortValue - right.sortValue;
    }
    return left.label.localeCompare(right.label, "zh-CN");
  });
}

function formatTaxonLabel(level, value, commonName = "") {
  if (!value) {
    return level === "order" ? UNKNOWN_ORDER_LABEL : level === "family" ? UNKNOWN_FAMILY_LABEL : UNKNOWN_GENUS_LABEL;
  }

  if (level === "genus") {
    return /^[A-Z]/.test(value) ? `${value} 属` : value.endsWith("属") ? value : `${value}属`;
  }

  if (level === "family" && commonName) {
    const familyLabel = commonName.endsWith("科") ? commonName : `${commonName}科`;
    return `${familyLabel} (${value})`;
  }

  const zhStem = TAXON_ZH_MAP[level]?.[value];
  if (zhStem) {
    const suffix = level === "order" ? "目" : "科";
    return `${zhStem}${suffix} (${value})`;
  }

  return value;
}

function buildCalendarDays() {
  const end = new Date();
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setDate(end.getDate() - 364);
  start.setHours(0, 0, 0, 0);

  const days = [];
  const prefix = start.getDay();
  for (let index = 0; index < prefix; index += 1) {
    days.push(null);
  }

  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(formatIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function calendarColor(count, maxCount) {
  if (!count || !maxCount) {
    return "#edf3ec";
  }

  const ratio = count / maxCount;
  if (ratio <= 0.25) {
    return "#cfe7d5";
  }
  if (ratio <= 0.5) {
    return "#92c9a0";
  }
  if (ratio <= 0.75) {
    return "#54a86c";
  }
  return "#2f7d4a";
}

function loadPersonalRecords() {
  try {
    const personalRaw = localStorage.getItem(PERSONAL_STORAGE_KEY);
    if (personalRaw) {
      return normalizeRecords(JSON.parse(personalRaw));
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) {
      return [];
    }

    return normalizeRecords(JSON.parse(legacyRaw)).filter((record) => !isLegacyRegionQueryRecord(record));
  } catch (error) {
    console.warn("Failed to load personal records:", error);
    return [];
  }
}

function loadUnlockedSpeciesCache() {
  try {
    const raw = localStorage.getItem(BIRDREPORT_UNLOCKED_SPECIES_CACHE_STORAGE);
    if (!raw) {
      return createEmptyUnlockedSpeciesCache();
    }

    const parsed = JSON.parse(raw);
    const cache = {
      username: String(parsed?.username || "").trim(),
      savedAt: String(parsed?.savedAt || "").trim(),
      catalog: normalizeBirdreportTaxa(parsed?.catalog),
      observed: normalizeBirdreportTaxa(parsed?.observed),
      missing: normalizeBirdreportTaxa(parsed?.missing)
    };

    if (cache.username && !cache.catalog.length) {
      return createEmptyUnlockedSpeciesCache();
    }

    if (cache.username && cache.catalog.length && !cache.observed.length && cache.missing.length >= cache.catalog.length) {
      return createEmptyUnlockedSpeciesCache();
    }

    return cache;
  } catch (error) {
    console.warn("Failed to load unlocked species cache:", error);
    return createEmptyUnlockedSpeciesCache();
  }
}

function createEmptyUnlockedSpeciesCache() {
  return {
    username: "",
    savedAt: "",
    catalog: [],
    observed: [],
    missing: []
  };
}

function saveUnlockedSpeciesCache() {
  const payload = {
    username: state.unlockedTargetUsername,
    savedAt: state.unlockedSpeciesCacheSavedAt,
    catalog: normalizeBirdreportTaxa(state.unlockedSpeciesCatalog),
    observed: normalizeBirdreportTaxa(state.unlockedObservedSpecies),
    missing: normalizeBirdreportTaxa(state.unlockedMissingSpecies)
  };
  localStorage.setItem(BIRDREPORT_UNLOCKED_SPECIES_CACHE_STORAGE, JSON.stringify(payload));
}

function clearUnlockedSpeciesCache() {
  localStorage.removeItem(BIRDREPORT_UNLOCKED_SPECIES_CACHE_STORAGE);
}

function loadZhejiangRareSpecies() {
  try {
    const raw = localStorage.getItem(BIRDREPORT_RARE_SPECIES_STORAGE);
    if (!raw) {
      return {
        province: BIRDREPORT_RARE_SPECIES_PROVINCE,
        threshold: BIRDREPORT_RARE_SPECIES_THRESHOLD,
        savedAt: "",
        source: "",
        totalSpecies: 0,
        species: []
      };
    }

    const parsed = JSON.parse(raw);
    return {
      province: parsed?.province || BIRDREPORT_RARE_SPECIES_PROVINCE,
      threshold: Number(parsed?.threshold) || BIRDREPORT_RARE_SPECIES_THRESHOLD,
      savedAt: parsed?.savedAt || "",
      source: parsed?.source || "",
      totalSpecies: Number(parsed?.totalSpecies) || 0,
      species: Array.isArray(parsed?.species)
        ? parsed.species.map(serializeBirdreportTaxon)
        : []
    };
  } catch (error) {
    console.warn("Failed to load Zhejiang rare species:", error);
    return {
      province: BIRDREPORT_RARE_SPECIES_PROVINCE,
      threshold: BIRDREPORT_RARE_SPECIES_THRESHOLD,
      savedAt: "",
      source: "",
      totalSpecies: 0,
      species: []
    };
  }
}

function saveZhejiangRareSpeciesToStorage(payload) {
  localStorage.setItem(BIRDREPORT_RARE_SPECIES_STORAGE, JSON.stringify(payload));
}

function loadZhejiangRareMonitor() {
  try {
    const raw = localStorage.getItem(BIRDREPORT_RARE_MONITOR_STORAGE);
    if (!raw) {
      return { enabled: false, targetDate: formatIsoDate(new Date()), lastCheckedAt: "", lastCheckedDate: "", lastHitAt: "" };
    }

    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed?.enabled),
      targetDate: normalizeDateInput(parsed?.targetDate) || formatIsoDate(new Date()),
      lastCheckedAt: parsed?.lastCheckedAt || "",
      lastCheckedDate: parsed?.lastCheckedDate || "",
      lastHitAt: parsed?.lastHitAt || ""
    };
  } catch (error) {
    console.warn("Failed to load Zhejiang rare species monitor:", error);
    return { enabled: false, targetDate: formatIsoDate(new Date()), lastCheckedAt: "", lastCheckedDate: "", lastHitAt: "" };
  }
}

function saveZhejiangRareMonitor(payload) {
  localStorage.setItem(BIRDREPORT_RARE_MONITOR_STORAGE, JSON.stringify(payload));
}

function loadZhejiangRareNotificationLog() {
  try {
    const raw = localStorage.getItem(BIRDREPORT_RARE_NOTIFICATION_LOG_STORAGE);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("Failed to load Zhejiang rare species notification log:", error);
    return {};
  }
}

function saveZhejiangRareNotificationLog(payload) {
  localStorage.setItem(BIRDREPORT_RARE_NOTIFICATION_LOG_STORAGE, JSON.stringify(payload));
}

function savePersonalRecords(records) {
  localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(records));
}

function isLegacyRegionQueryRecord(record) {
  return String(record.notes || "").startsWith("eBird 同步");
}

function normalizeDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return formatIsoDate(date);
}

function formatIsoDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatBirdreportDateTime(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "未提供";
  }

  const normalized = text.replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? text : formatDateTime(parsed.toISOString());
}

function toNumber(value) {
  if (value === "" || value == null) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parsePositiveInteger(value) {
  if (value === "" || value == null) {
    return null;
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) {
    return null;
  }

  return Math.round(number);
}

function toTaxonOrder(value) {
  if (value === "" || value == null) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function extractGenus(value) {
  const genus = String(value || "").trim().split(/\s+/, 1)[0];
  return genus && /^[A-Z][A-Za-z-]+$/.test(genus) ? genus : "";
}

function simplifyChineseText(value) {
  let result = String(value || "").trim();
  TRADITIONAL_PHRASE_REPLACEMENTS.forEach(([source, target]) => {
    result = result.replaceAll(source, target);
  });
  return [...result].map((char) => TRADITIONAL_CHAR_MAP[char] || char).join("");
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function clampBackDays(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 14;
  }

  return Math.min(30, Math.max(1, Math.round(number)));
}

function clampEbirdSeasonalYears(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return EBIRD_SEASONAL_DEFAULT_YEARS;
  }

  return Math.min(15, Math.max(1, Math.round(number)));
}

function clampEbirdSeasonalWindow(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return EBIRD_SEASONAL_DEFAULT_WINDOW_DAYS;
  }

  return Math.min(14, Math.max(0, Math.round(number)));
}

function setMessage(message, isError = false) {
  setStatusMessage(elements.importMessage, message, isError);
}

function setEbirdMessage(message, isError = false) {
  setStatusMessage(elements.ebirdMessage, message, isError);
}

function setEbirdSeasonalMessage(message, isError = false) {
  setStatusMessage(elements.ebirdSeasonalMessage, message, isError);
}

function setBirdreportMessage(message, isError = false) {
  setStatusMessage(elements.birdreportMessage, message, isError);
}

function setStatusMessage(target, message, isError = false) {
  if (!target) {
    return;
  }

  target.textContent = message;
  target.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function setEbirdLoading(isLoading) {
  elements.syncEbirdBtn.disabled = isLoading;
  elements.clearEbirdKeyBtn.disabled = isLoading;
  elements.syncEbirdBtn.textContent = isLoading ? "查询中..." : "查询 eBird";
}

function setEbirdSeasonalLoading(isLoading) {
  if (elements.analyzeEbirdSeasonalBtn) {
    elements.analyzeEbirdSeasonalBtn.disabled = isLoading;
    elements.analyzeEbirdSeasonalBtn.textContent = isLoading ? "分析中..." : "分析浙江当季鸟种";
  }
  if (elements.clearEbirdSeasonalCacheBtn) {
    elements.clearEbirdSeasonalCacheBtn.disabled = isLoading;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function encodeBase64Utf8(value) {
  return btoa(unescape(encodeURIComponent(String(value))));
}
