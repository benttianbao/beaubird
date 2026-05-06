const fs = require("fs");
const path = require("path");

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error("Usage: node tools/markdown-to-print-html.js <input.md> <output.html>");
  process.exit(1);
}

const markdown = fs.readFileSync(inputPath, "utf8");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderInline(value) {
  let output = escapeHtml(value);
  output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
    const safeUrl = escapeHtml(url);
    return `<a href="${safeUrl}">${label}</a>`;
  });
  return output;
}

function isTableDivider(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderTable(lines, startIndex) {
  const headers = splitTableRow(lines[startIndex]);
  let index = startIndex + 2;
  const rows = [];

  while (index < lines.length && /^\s*\|/.test(lines[index])) {
    rows.push(splitTableRow(lines[index]));
    index += 1;
  }

  const head = headers.map((cell) => `<th>${renderInline(cell)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`)
    .join("\n");

  return {
    html: `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`,
    nextIndex: index
  };
}

function renderMarkdown(source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let index = 0;
  let inCode = false;
  let codeLines = [];
  let inList = false;

  function closeList() {
    if (inList) {
      html.push("</ol>");
      inList = false;
    }
  }

  while (index < lines.length) {
    const line = lines[index];

    if (/^```/.test(line)) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      index += 1;
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      index += 1;
      continue;
    }

    if (!line.trim()) {
      closeList();
      index += 1;
      continue;
    }

    if (/^\s*\|/.test(line) && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      closeList();
      const table = renderTable(lines, index);
      html.push(table.html);
      index = table.nextIndex;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      index += 1;
      continue;
    }

    const orderedMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (orderedMatch) {
      if (!inList) {
        html.push("<ol>");
        inList = true;
      }
      html.push(`<li>${renderInline(orderedMatch[1])}</li>`);
      index += 1;
      continue;
    }

    closeList();
    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^```/.test(lines[index]) &&
      !/^(#{1,6})\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index]) &&
      !(index + 1 < lines.length && /^\s*\|/.test(lines[index]) && isTableDivider(lines[index + 1]))
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
  }

  closeList();
  return html.join("\n");
}

const titleMatch = markdown.match(/^#\s+(.+)$/m);
const title = titleMatch ? titleMatch[1] : path.basename(inputPath, path.extname(inputPath));
const body = renderMarkdown(markdown);
const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: A4;
      margin: 16mm 14mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: #17211b;
      font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.62;
      background: #fff;
    }

    h1, h2, h3, h4 {
      color: #153d2a;
      line-height: 1.28;
      page-break-after: avoid;
    }

    h1 {
      margin: 0 0 18px;
      padding-bottom: 10px;
      border-bottom: 2px solid #2f7d4a;
      font-size: 24pt;
    }

    h2 {
      margin: 24px 0 10px;
      padding-top: 8px;
      font-size: 17pt;
    }

    h3 {
      margin: 18px 0 8px;
      font-size: 13.5pt;
    }

    h4 {
      margin: 14px 0 6px;
      font-size: 12pt;
    }

    p {
      margin: 0 0 9px;
    }

    a {
      color: #2264aa;
      text-decoration: none;
      overflow-wrap: anywhere;
    }

    code {
      padding: 1px 4px;
      border-radius: 4px;
      background: #eef5ef;
      color: #174029;
      font-family: Consolas, "SFMono-Regular", monospace;
      font-size: 0.92em;
    }

    pre {
      margin: 10px 0 12px;
      padding: 10px 12px;
      border: 1px solid #dbe8df;
      border-radius: 7px;
      background: #f7faf7;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
      page-break-inside: avoid;
    }

    pre code {
      padding: 0;
      background: transparent;
    }

    table {
      width: 100%;
      margin: 10px 0 14px;
      border-collapse: collapse;
      font-size: 10pt;
      page-break-inside: avoid;
    }

    th,
    td {
      padding: 6px 7px;
      border: 1px solid #dbe6dc;
      vertical-align: top;
    }

    th {
      background: #edf5ef;
      color: #173d2a;
      font-weight: 700;
      text-align: left;
    }

    tr:nth-child(even) td {
      background: #fbfdfb;
    }

    ol {
      margin: 0 0 12px 20px;
      padding: 0;
    }

    li {
      margin: 4px 0;
    }
  </style>
</head>
<body>
${body}
</body>
</html>
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html, "utf8");
console.log(outputPath);
