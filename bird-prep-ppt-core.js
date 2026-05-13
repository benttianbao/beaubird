(function initBirdPrepPptCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.BeauBirdPrepPpt = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function createBirdPrepPptCore() {
  const EMU_PER_INCH = 914400;
  const PPT_WIDTH = 12192000;
  const PPT_HEIGHT = 6858000;
  const ZIP_UTF8_FLAG = 0x0800;

  const SECTION_LIMITS = {
    appearance: 150,
    identification: 150,
    habits: 180,
    merged: 230
  };

  const CRC_TABLE = createCrcTable();

  function normalizeBirdName(value) {
    let text = String(value || "").trim();
    if (typeof text.normalize === "function") {
      text = text.normalize("NFKC");
    }
    return text.replace(/\s+/g, "");
  }

  function buildBirdProfileIndex(profiles) {
    const index = new Map();
    const items = Array.isArray(profiles) ? profiles : [];
    items.forEach((item) => {
      const key = normalizeBirdName(item?.name);
      if (!key || index.has(key)) {
        return;
      }
      index.set(key, {
        name: String(item.name || "").trim(),
        appearance: compactText(item.appearance),
        call: compactText(item.call),
        habits: compactText(item.habits),
        breeding: compactText(item.breeding),
        identification: compactText(item.identification),
        distribution: compactText(item.distribution)
      });
    });
    return index;
  }

  function buildBirdPrepSlides(taxa, profileIndex) {
    const index = profileIndex instanceof Map ? profileIndex : buildBirdProfileIndex(profileIndex);
    const slides = [];
    const skippedNames = [];

    (Array.isArray(taxa) ? taxa : []).forEach((taxon) => {
      const speciesName = String(taxon?.taxonname || taxon?.name || "").trim();
      if (!speciesName) {
        return;
      }

      const profile = index.get(normalizeBirdName(speciesName));
      if (!profile) {
        skippedNames.push(speciesName);
        return;
      }

      slides.push({
        speciesName,
        latinName: String(taxon?.latinname || taxon?.englishname || "").trim(),
        orderName: String(taxon?.taxonordername || "").trim(),
        familyName: String(taxon?.taxonfamilyname || "").trim(),
        recordCount: Number(taxon?.recordcount) || 0,
        sections: [
          {
            title: "外形",
            body: limitText(profile.appearance, SECTION_LIMITS.appearance)
          },
          {
            title: "识别",
            body: limitText(profile.identification, SECTION_LIMITS.identification)
          },
          {
            title: "习性生境",
            body: limitText(profile.habits, SECTION_LIMITS.habits)
          },
          {
            title: "分布 / 繁殖 / 叫声",
            body: limitText(
              [
                profile.distribution ? `分布：${profile.distribution}` : "",
                profile.breeding ? `繁殖：${profile.breeding}` : "",
                profile.call ? `叫声：${profile.call}` : ""
              ]
                .filter(Boolean)
                .join(" "),
              SECTION_LIMITS.merged
            )
          }
        ]
      });
    });

    return { slides, skippedNames };
  }

  function createBirdPrepPptx(slides, options = {}) {
    const normalizedSlides = (Array.isArray(slides) ? slides : []).filter((slide) => slide?.speciesName);
    if (!normalizedSlides.length) {
      throw new Error("没有可生成 PPT 的鸟种简介。");
    }

    const createdAt = options.createdAt instanceof Date ? options.createdAt : new Date();
    const title = compactText(options.title || "鸟类预习");
    const entries = [
      { name: "[Content_Types].xml", data: contentTypesXml(normalizedSlides.length) },
      { name: "_rels/.rels", data: packageRelsXml() },
      { name: "docProps/app.xml", data: appPropertiesXml(normalizedSlides.length) },
      { name: "docProps/core.xml", data: corePropertiesXml(title, createdAt) },
      { name: "ppt/presentation.xml", data: presentationXml(normalizedSlides.length) },
      { name: "ppt/_rels/presentation.xml.rels", data: presentationRelsXml(normalizedSlides.length) },
      { name: "ppt/slideMasters/slideMaster1.xml", data: slideMasterXml() },
      { name: "ppt/slideMasters/_rels/slideMaster1.xml.rels", data: slideMasterRelsXml() },
      { name: "ppt/slideLayouts/slideLayout1.xml", data: slideLayoutXml() },
      { name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", data: slideLayoutRelsXml() },
      { name: "ppt/theme/theme1.xml", data: themeXml() }
    ];

    normalizedSlides.forEach((slide, index) => {
      const slideNumber = index + 1;
      entries.push({ name: `ppt/slides/slide${slideNumber}.xml`, data: slideXml(slide, slideNumber, normalizedSlides.length) });
      entries.push({ name: `ppt/slides/_rels/slide${slideNumber}.xml.rels`, data: slideRelsXml() });
    });

    return createStoredZip(entries);
  }

  function buildBirdPrepPptxFilename({ province = "", city = "", district = "", pointname = "", date = new Date() } = {}) {
    const area = [province, city, district, pointname].map(sanitizeFilenamePart).filter(Boolean).join("-") || "地区";
    return `${area}-鸟类预习-${formatTimestamp(date)}.pptx`;
  }

  function compactText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function limitText(value, maxLength) {
    const text = compactText(value);
    if (!text) {
      return "暂无资料。";
    }
    const limit = Math.max(20, Number(maxLength) || 120);
    if (text.length <= limit) {
      return text;
    }

    const head = text.slice(0, limit - 1);
    const punctuationCut = Math.max(
      head.lastIndexOf("。"),
      head.lastIndexOf("；"),
      head.lastIndexOf(";"),
      head.lastIndexOf(".")
    );
    if (punctuationCut > Math.floor(limit * 0.55)) {
      return head.slice(0, punctuationCut + 1);
    }
    return `${head.replace(/[，、；;：:,.。！？!?]+$/g, "")}…`;
  }

  function sanitizeFilenamePart(value) {
    return String(value || "").trim().replace(/[\\/:*?"<>|]/g, "_");
  }

  function formatTimestamp(date) {
    const value = date instanceof Date ? date : new Date(date);
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    const hours = String(value.getHours()).padStart(2, "0");
    const minutes = String(value.getMinutes()).padStart(2, "0");
    const seconds = String(value.getSeconds()).padStart(2, "0");
    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
  }

  function slideXml(slide, slideNumber, totalSlides) {
    const titleMeta = [slide.latinName, [slide.orderName, slide.familyName].filter(Boolean).join(" / ")]
      .filter(Boolean)
      .join(" · ");
    const footer = `BeauBird 鸟类预习 · ${slideNumber}/${totalSlides}`;
    const shapes = [
      rectangleShape(2, "背景", 0, 0, PPT_WIDTH, PPT_HEIGHT, "F7FAF5", "F7FAF5"),
      textShape(3, "鸟种标题", inch(0.5), inch(0.25), inch(12.3), inch(0.5), [
        paragraph([{ text: slide.speciesName, size: 2600, bold: true, color: "223024" }])
      ]),
      textShape(4, "鸟种副标题", inch(0.52), inch(0.76), inch(12.1), inch(0.3), [
        paragraph([{ text: titleMeta || "学名 / 分类待补充", size: 1050, color: "5F6E61" }])
      ]),
      rectangleShape(5, "图片占位背景", inch(0.58), inch(1.18), inch(4.15), inch(5.78), "ECF4EE", "A8C7B0"),
      textShape(
        6,
        "图片占位文字",
        inch(0.88),
        inch(3.25),
        inch(3.55),
        inch(0.75),
        [
          paragraph([{ text: "图片预留区", size: 1800, bold: true, color: "2F7D4A" }], { align: "ctr" }),
          paragraph([{ text: "后续可放鸟类照片", size: 1100, color: "5F6E61" }], { align: "ctr" })
        ],
        { anchor: "ctr" }
      ),
      textShape(20, "页脚", inch(0.58), inch(7.08), inch(12.2), inch(0.24), [
        paragraph([{ text: footer, size: 850, color: "7A877C" }], { align: "r" })
      ])
    ];

    const sectionX = inch(5.02);
    const sectionY = inch(1.18);
    const sectionWidth = inch(7.75);
    const sectionHeight = inch(1.32);
    const sectionGap = inch(0.15);
    (Array.isArray(slide.sections) ? slide.sections : []).slice(0, 4).forEach((section, index) => {
      const y = sectionY + index * (sectionHeight + sectionGap);
      const shapeId = 7 + index * 3;
      shapes.push(rectangleShape(shapeId, `${section.title} 卡片`, sectionX, y, sectionWidth, sectionHeight, "FFFFFF", "D8E2D8"));
      shapes.push(
        textShape(shapeId + 1, `${section.title} 标题`, sectionX + inch(0.18), y + inch(0.12), sectionWidth - inch(0.36), inch(0.25), [
          paragraph([{ text: section.title, size: 1200, bold: true, color: "2F7D4A" }])
        ])
      );
      shapes.push(
        textShape(shapeId + 2, `${section.title} 正文`, sectionX + inch(0.18), y + inch(0.43), sectionWidth - inch(0.36), sectionHeight - inch(0.54), [
          paragraph([{ text: limitText(section.body, 170), size: 1050, color: "223024" }])
        ])
      );
    });

    return xmlDocument(`\
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="${PPT_WIDTH}" cy="${PPT_HEIGHT}"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="${PPT_WIDTH}" cy="${PPT_HEIGHT}"/>
        </a:xfrm>
      </p:grpSpPr>
      ${shapes.join("\n      ")}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`);
  }

  function rectangleShape(id, name, x, y, cx, cy, fill, line) {
    return `\
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="${id}" name="${xmlEscape(name)}"/>
    <p:cNvSpPr/>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm>
      <a:off x="${x}" y="${y}"/>
      <a:ext cx="${cx}" cy="${cy}"/>
    </a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>
    <a:ln w="9525"><a:solidFill><a:srgbClr val="${line}"/></a:solidFill></a:ln>
  </p:spPr>
</p:sp>`;
  }

  function textShape(id, name, x, y, cx, cy, paragraphs, options = {}) {
    const anchor = options.anchor ? ` anchor="${options.anchor}"` : "";
    return `\
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="${id}" name="${xmlEscape(name)}"/>
    <p:cNvSpPr txBox="1"/>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm>
      <a:off x="${x}" y="${y}"/>
      <a:ext cx="${cx}" cy="${cy}"/>
    </a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:noFill/>
    <a:ln><a:noFill/></a:ln>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square"${anchor} lIns="0" tIns="0" rIns="0" bIns="0">
      <a:spAutoFit/>
    </a:bodyPr>
    <a:lstStyle/>
    ${paragraphs.join("\n    ")}
  </p:txBody>
</p:sp>`;
  }

  function paragraph(runs, options = {}) {
    const align = options.align ? ` algn="${options.align}"` : "";
    return `<a:p><a:pPr${align}/>${runs.map(textRun).join("")}</a:p>`;
  }

  function textRun(run) {
    const size = Number(run.size) || 1100;
    const bold = run.bold ? ' b="1"' : "";
    const color = run.color || "223024";
    return `<a:r><a:rPr lang="zh-CN" sz="${size}"${bold} dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Microsoft YaHei"/><a:ea typeface="Microsoft YaHei"/></a:rPr><a:t>${xmlEscape(run.text)}</a:t></a:r>`;
  }

  function contentTypesXml(slideCount) {
    const slideTypes = [];
    for (let index = 1; index <= slideCount; index += 1) {
      slideTypes.push(
        `<Override PartName="/ppt/slides/slide${index}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
      );
    }

    return xmlDocument(`\
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${slideTypes.join("\n  ")}
</Types>`);
  }

  function packageRelsXml() {
    return xmlDocument(`\
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
  }

  function appPropertiesXml(slideCount) {
    return xmlDocument(`\
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>BeauBird</Application>
  <PresentationFormat>On-screen Show (16:9)</PresentationFormat>
  <Slides>${slideCount}</Slides>
  <Company>BeauBird</Company>
</Properties>`);
  }

  function corePropertiesXml(title, createdAt) {
    const timestamp = createdAt.toISOString();
    return xmlDocument(`\
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${xmlEscape(title)}</dc:title>
  <dc:creator>BeauBird</dc:creator>
  <cp:lastModifiedBy>BeauBird</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified>
</cp:coreProperties>`);
  }

  function presentationXml(slideCount) {
    const slideIds = [];
    for (let index = 1; index <= slideCount; index += 1) {
      slideIds.push(`<p:sldId id="${255 + index}" r:id="rId${index + 1}"/>`);
    }
    return xmlDocument(`\
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" saveSubsetFonts="1">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
    ${slideIds.join("\n    ")}
  </p:sldIdLst>
  <p:sldSz cx="${PPT_WIDTH}" cy="${PPT_HEIGHT}" type="wide"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:defaultTextStyle>
    <a:defPPr><a:defRPr lang="zh-CN"/></a:defPPr>
  </p:defaultTextStyle>
</p:presentation>`);
  }

  function presentationRelsXml(slideCount) {
    const relationships = [
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>'
    ];
    for (let index = 1; index <= slideCount; index += 1) {
      relationships.push(
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index}.xml"/>`
      );
    }
    return xmlDocument(`\
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relationships.join("\n  ")}
</Relationships>`);
  }

  function slideMasterXml() {
    return xmlDocument(`\
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${PPT_WIDTH}" cy="${PPT_HEIGHT}"/><a:chOff x="0" y="0"/><a:chExt cx="${PPT_WIDTH}" cy="${PPT_HEIGHT}"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>
</p:sldMaster>`);
  }

  function slideMasterRelsXml() {
    return xmlDocument(`\
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`);
  }

  function slideLayoutXml() {
    return xmlDocument(`\
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${PPT_WIDTH}" cy="${PPT_HEIGHT}"/><a:chOff x="0" y="0"/><a:chExt cx="${PPT_WIDTH}" cy="${PPT_HEIGHT}"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`);
  }

  function slideLayoutRelsXml() {
    return xmlDocument(`\
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`);
  }

  function slideRelsXml() {
    return xmlDocument(`\
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`);
  }

  function themeXml() {
    return xmlDocument(`\
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="BeauBird">
  <a:themeElements>
    <a:clrScheme name="BeauBird">
      <a:dk1><a:srgbClr val="223024"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="5F6E61"/></a:dk2>
      <a:lt2><a:srgbClr val="F7FAF5"/></a:lt2>
      <a:accent1><a:srgbClr val="2F7D4A"/></a:accent1>
      <a:accent2><a:srgbClr val="A8C7B0"/></a:accent2>
      <a:accent3><a:srgbClr val="D8E2D8"/></a:accent3>
      <a:accent4><a:srgbClr val="ECF4EE"/></a:accent4>
      <a:accent5><a:srgbClr val="7A877C"/></a:accent5>
      <a:accent6><a:srgbClr val="DDE8DF"/></a:accent6>
      <a:hlink><a:srgbClr val="2F7D4A"/></a:hlink>
      <a:folHlink><a:srgbClr val="5F6E61"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="BeauBird Fonts">
      <a:majorFont><a:latin typeface="Microsoft YaHei"/><a:ea typeface="Microsoft YaHei"/></a:majorFont>
      <a:minorFont><a:latin typeface="Microsoft YaHei"/><a:ea typeface="Microsoft YaHei"/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="BeauBird Format"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
  </a:themeElements>
</a:theme>`);
  }

  function xmlDocument(body) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${body}`;
  }

  function xmlEscape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function inch(value) {
    return Math.round(Number(value) * EMU_PER_INCH);
  }

  function createStoredZip(entries) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    entries.forEach((entry) => {
      const nameBytes = utf8Bytes(entry.name);
      const dataBytes = typeof entry.data === "string" ? utf8Bytes(entry.data) : toUint8Array(entry.data);
      const crc = crc32(dataBytes);
      const localHeader = createLocalHeader(nameBytes, dataBytes.length, crc);
      const centralHeader = createCentralHeader(nameBytes, dataBytes.length, crc, offset);
      localParts.push(localHeader, dataBytes);
      centralParts.push(centralHeader);
      offset += localHeader.length + dataBytes.length;
    });

    const centralOffset = offset;
    const centralDirectory = concatBytes(centralParts);
    const endRecord = createEndRecord(entries.length, centralDirectory.length, centralOffset);
    return concatBytes([...localParts, centralDirectory, endRecord]);
  }

  function createLocalHeader(nameBytes, size, crc) {
    const bytes = [];
    pushU32(bytes, 0x04034b50);
    pushU16(bytes, 20);
    pushU16(bytes, ZIP_UTF8_FLAG);
    pushU16(bytes, 0);
    pushU16(bytes, 0);
    pushU16(bytes, 0);
    pushU32(bytes, crc);
    pushU32(bytes, size);
    pushU32(bytes, size);
    pushU16(bytes, nameBytes.length);
    pushU16(bytes, 0);
    return concatBytes([Uint8Array.from(bytes), nameBytes]);
  }

  function createCentralHeader(nameBytes, size, crc, offset) {
    const bytes = [];
    pushU32(bytes, 0x02014b50);
    pushU16(bytes, 20);
    pushU16(bytes, 20);
    pushU16(bytes, ZIP_UTF8_FLAG);
    pushU16(bytes, 0);
    pushU16(bytes, 0);
    pushU16(bytes, 0);
    pushU32(bytes, crc);
    pushU32(bytes, size);
    pushU32(bytes, size);
    pushU16(bytes, nameBytes.length);
    pushU16(bytes, 0);
    pushU16(bytes, 0);
    pushU16(bytes, 0);
    pushU16(bytes, 0);
    pushU32(bytes, 0);
    pushU32(bytes, offset);
    return concatBytes([Uint8Array.from(bytes), nameBytes]);
  }

  function createEndRecord(entryCount, centralSize, centralOffset) {
    const bytes = [];
    pushU32(bytes, 0x06054b50);
    pushU16(bytes, 0);
    pushU16(bytes, 0);
    pushU16(bytes, entryCount);
    pushU16(bytes, entryCount);
    pushU32(bytes, centralSize);
    pushU32(bytes, centralOffset);
    pushU16(bytes, 0);
    return Uint8Array.from(bytes);
  }

  function utf8Bytes(value) {
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(String(value));
    }
    return Uint8Array.from(unescape(encodeURIComponent(String(value))), (char) => char.charCodeAt(0));
  }

  function toUint8Array(value) {
    if (value instanceof Uint8Array) {
      return value;
    }
    if (Array.isArray(value)) {
      return Uint8Array.from(value);
    }
    return utf8Bytes(value);
  }

  function concatBytes(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(total);
    let offset = 0;
    parts.forEach((part) => {
      output.set(part, offset);
      offset += part.length;
    });
    return output;
  }

  function pushU16(bytes, value) {
    bytes.push(value & 0xff, (value >>> 8) & 0xff);
  }

  function pushU32(bytes, value) {
    const unsigned = value >>> 0;
    bytes.push(unsigned & 0xff, (unsigned >>> 8) & 0xff, (unsigned >>> 16) & 0xff, (unsigned >>> 24) & 0xff);
  }

  function createCrcTable() {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let crc = index;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
      }
      table[index] = crc >>> 0;
    }
    return table;
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let index = 0; index < bytes.length; index += 1) {
      crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  return {
    buildBirdPrepSlides,
    buildBirdPrepPptxFilename,
    buildBirdProfileIndex,
    createBirdPrepPptx,
    normalizeBirdName
  };
});
