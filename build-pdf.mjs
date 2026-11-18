#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { deflateSync } from "node:zlib";
const require = createRequire(import.meta.url);
const emoji = require("markdown-it-emoji");
const KROKI = "https://kroki.io";
const KROKI_TYPES = {
  plantuml: "plantuml", puml: "plantuml",
  dbml: "dbml",
  dot: "graphviz", graphviz: "graphviz",
  bpmn: "bpmn",
  c4: "c4plantuml", c4plantuml: "c4plantuml",
  d2: "d2",
  act: "act",
  ditaa: "ditaa",
  erb: "erb",
  excalidraw: "excalidraw",
  filetree: "filetree",
  firebase: "firebase",
  flowchart: "flowchart",
  goap: "goap-rs",
  hackfont: "hackfont",
  icm: "icm",
  infocard: "infocard",
  jmxp: "jmxp",
  kanban: "kanban",
  markmap: "markmap",
  nomnoml: "nomnoml",
  opengraph: "opengraph",
  pacuiflow: "pacuiflow",
  packet: "packet",
  papyrus: "papyrus",
  pkl: "pkl",
  raphael: "raphael",
  sdbm: "sdbm",
  seqdiag: "seqdiag",
  sql: "sql",
  sysml: "sysml-v2",
  tikz: "tikz",
  umlet: "umlet",
  vek: "vek",
  vega: "vega",
  veles: "veles",
  wavedrom: "wavedrom",
  wireframe: "wireframe",
};
function krokiImg(type, code) {
  const encoded = deflateSync(Buffer.from(code.trim(), "utf8"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `<p><img src="${KROKI}/${type}/svg/${encoded}" alt="${type} diagram" style="max-width: 100%;"></p>`;
}
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import puppeteer from "puppeteer-core";

const here = dirname(fileURLToPath(import.meta.url));
const EDGE = [
  join(process.env["ProgramFiles(x86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  join(process.env.ProgramFiles || "", "Microsoft", "Edge", "Application", "msedge.exe"),
].find((p) => p);

const args = process.argv.slice(2);
const showHelp = args.includes("--help") || args.includes("-h");
const showFrontmatter = args.includes("--frontmatter");
const h1NewPage = args.includes("--h1-new-page");
const h2NewPage = args.includes("--h2-new-page");
const recursive = args.includes("--recursive");
const outIdx = args.indexOf("--out");
let outDir = null;
if (outIdx !== -1 && args[outIdx + 1] && !args[outIdx + 1].startsWith("--")) {
  outDir = resolve(args[outIdx + 1]);
}
const positional = args.filter((a, i) => !a.startsWith("--") && !(outIdx !== -1 && i === outIdx + 1));

if (showHelp) {
  console.log(`Usage: mdtopdf [options] <file.md | folder> [...]

Convert Markdown files to PDF (markdown-it + highlight.js + mermaid + Kroki diagrams).

Options:
  -h, --help          Show this help message
  --frontmatter       Render YAML frontmatter as a table at the top of the document
  --h1-new-page       Start a new page for every h1 heading
  --h2-new-page       Start a new page for every h2 heading
  --recursive         Recurse into subfolders when a folder is given
  --out <folder>      Output folder (default: same folder as the source file)

Examples:
  mdtopdf notes.md
  mdtopdf docs/ --recursive --out pdf/
  mdtopdf spec.md --h1-new-page --frontmatter`);
  process.exit(0);
}

// Expand folders to their .md files (recursively with --recursive)
function collectMd(dir, isRecursive) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const found = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (isRecursive) found.push(...collectMd(full, true));
    } else if (e.isFile() && /\.md$/i.test(e.name)) {
      found.push(full);
    }
  }
  return found;
}

const files = [];
for (const p of positional) {
  const abs = resolve(p);
  if (!existsSync(abs)) {
    console.error(`Not found: ${p}`);
    continue;
  }
  if (statSync(abs).isDirectory()) {
    const mdFiles = collectMd(abs, recursive);
    if (mdFiles.length === 0) console.error(`No .md files in: ${p}`);
    files.push(...mdFiles);
  } else {
    files.push(abs);
  }
}
if (files.length === 0) {
  console.error("Usage: mdtopdf [options] <file.md | folder> [...] (see --help)");
  process.exit(1);
}

const template = readFileSync(join(here, "template", "template.html"), "utf8");
const cssFiles = ["styles/markdown.css", "styles/markdown-pdf.css", "styles/code-highlighting-tomorrow.css"];
const mermaidScript = '<script src="https://unpkg.com/mermaid/dist/mermaid.min.js"></script>';

const ALERT_CSS = `
.markdown-alert {
  padding: 10px 16px;
  margin: 0 0 16px;
  border-left: 4px solid #820014;
  border-radius: 0px;
  background-color: rgba(130, 0, 20, 0.03);
}
.markdown-alert .markdown-alert-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  margin: 0 0 4px;
}
.markdown-alert .markdown-alert-title svg { flex-shrink: 0; }
.markdown-alert p:last-child { margin-bottom: 0; }
.markdown-alert.note { border-left-color: #0969da; background-color: rgba(9, 105, 218, 0.03); }
.markdown-alert.note .markdown-alert-title { color: #0969da; }
.markdown-alert.important { border-left-color: #8250df; background-color: rgba(130, 80, 223, 0.03); }
.markdown-alert.important .markdown-alert-title { color: #8250df; }
.markdown-alert.tip { border-left-color: #1a7f37; background-color: rgba(26, 127, 55, 0.03); }
.markdown-alert.tip .markdown-alert-title { color: #1a7f37; }
.markdown-alert.warning { border-left-color: #9a6700; background-color: rgba(154, 103, 0, 0.03); }
.markdown-alert.warning .markdown-alert-title { color: #9a6700; }
.markdown-alert.caution { border-left-color: #d1242f; background-color: rgba(209, 36, 47, 0.03); }
.markdown-alert.caution .markdown-alert-title { color: #d1242f; }
`;

const ALERT_ICONS = {
  note: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="7.5" x2="8" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="4.75" r="1" fill="currentColor"/></svg>',
  tip: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 1.5a5 5 0 0 0-2.9 9.1c.5.37.9.9.9 1.4v.5h4v-.5c0-.5.4-1.03.9-1.4A5 5 0 0 0 8 1.5Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><line x1="6.5" y1="14.5" x2="9.5" y2="14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  important: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="4.5" x2="8" y2="9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11.75" r="1" fill="currentColor"/></svg>',
  warning: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 1.8 14.8 13.7a.6.6 0 0 1-.52.9H1.72a.6.6 0 0 1-.52-.9L8 1.8Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><line x1="8" y1="6" x2="8" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="12" r="1" fill="currentColor"/></svg>',
  caution: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="1.75" y="1.75" width="12.5" height="12.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="4.75" x2="8" y2="9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11.75" r="1" fill="currentColor"/></svg>',
};

const FM_CSS = `
.frontmatter-table {
  width: auto;
  max-width: 60%;
  border-collapse: collapse;
  margin: 0 0 24px;
  font-size: 12px;
  color: #57606a;
}
.frontmatter-table td {
  padding: 3px 12px 3px 0;
  vertical-align: top;
  border-bottom: 1px solid #d1d1d1;
}
.frontmatter-table tr:last-child td { border-bottom: none; }
.frontmatter-table .fm-key {
  color: #57606a;
  font-weight: bold;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}
`;

let extraCss = "";
if (h1NewPage) extraCss += "h1 { break-before: page; }";
if (h2NewPage) extraCss += "h2 { break-before: page; }";
const styleTags = cssFiles
  .map((f) => `<style>\n${readFileSync(join(here, f), "utf8")}\n</style>`)
  .join("\n") + `<style>\n${ALERT_CSS}\n</style>` + `<style>\n${FM_CSS}\n</style>` + (extraCss ? `<style>\n${extraCss}\n</style>` : "");

function githubAlertsPlugin(md) {
  const mdInner = new MarkdownIt({ html: true, breaks: false });
  md.core.ruler.after("block", "github_alerts", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== "blockquote_open") continue;
      // first paragraph inside the blockquote
      let k = i + 1;
      while (k < tokens.length && tokens[k].type === "inline") k++;
      if (k >= tokens.length || tokens[k].type !== "paragraph_open") continue;
      const inlineIdx = k + 1;
      if (inlineIdx >= tokens.length || tokens[inlineIdx].type !== "inline") continue;
      const inline = tokens[inlineIdx];
      const nl = inline.content.indexOf("\n");
      const firstLine = (nl === -1 ? inline.content : inline.content.slice(0, nl)).trim();
      const m = firstLine.match(/^\[!(note|tip|important|warning|caution)\](?:\s+(.*))?$/i);
      if (!m) continue;
      const type = m[1].toLowerCase();
      const customTitle = (m[2] || "").trim();
      const title = customTitle || (type[0].toUpperCase() + type.slice(1));
      const body = nl === -1 ? "" : inline.content.slice(nl + 1).replace(/^\s+/, "");

      // locate the matching blockquote_close
      let depth = 1, j = i + 1;
      while (j < tokens.length && depth > 0) {
        if (tokens[j].type === "blockquote_open") depth++;
        else if (tokens[j].type === "blockquote_close") depth--;
        j++;
      }
      const closeIdx = j - 1;

      tokens[i].tag = "div";
      tokens[i].attrs = [["class", "markdown-alert " + type]];
      tokens[closeIdx].tag = "div";

      // title paragraph with icon
      const po = new state.Token("paragraph_open", "p", 1);
      po.attrs = [["class", "markdown-alert-title"]];
      const hi = new state.Token("inline", "", 0);
      hi.children = [];
      hi.content = ALERT_ICONS[type] + " " + mdInner.renderInline(title);
      const pc = new state.Token("paragraph_close", "p", -1);

      if (body) {
        // there is more text in the same paragraph: keep it as body
        inline.content = body;
        tokens.splice(i + 1, 0, po, hi, pc);
      } else {
        // the paragraph only contained the tag: remove it and inject the title
        tokens.splice(k, 3);
        tokens.splice(i + 1, 0, po, hi, pc);
      }
    }
  });
}

function stripFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  return { meta, body: src.slice(m[0].length) };
}

const md = new MarkdownIt({
  html: true,
  breaks: false,
  highlight(code, lang) {
    if (lang && /\bmermaid\b/i.test(lang)) return `<div class="mermaid">${md.utils.escapeHtml(code)}</div>`;
    const krokiType = lang ? KROKI_TYPES[lang.toLowerCase()] : undefined;
    if (krokiType) return krokiImg(krokiType, code);
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(code, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
      } catch { /* fallthrough */ }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(code)}</code></pre>`;
  },
});
md.use(emoji.full);
md.use(githubAlertsPlugin);

function frontmatterTable(meta) {
  const rows = Object.entries(meta)
    .filter(([, v]) => String(v).trim() !== "")
    .map(
      ([k, v]) =>
        `<tr><td class="fm-key">${md.utils.escapeHtml(k)}</td><td>${md.utils.escapeHtml(String(v))}</td></tr>`
    )
    .join("");
  if (!rows) return "";
  return (
    '<table class="frontmatter-table"><tbody>' + rows + "</tbody></table>"
  );
}

async function toPdf(mdFile) {
  const raw = readFileSync(mdFile, "utf8");
  const { meta, body } = stripFrontmatter(raw);
  const title = meta.title || basename(mdFile, ".md");
  const fm = showFrontmatter ? frontmatterTable(meta) : "";
  const content = md.render(body.replace(/<!--\s*page-break\s*-->/g, "\n\n<div class=\"page\"></div>\n\n"));
  const html = template
    .replaceAll("{{{title}}}", md.utils.escapeHtml(title))
    .replaceAll("{{{style}}}", styleTags)
    .replaceAll("{{{mermaid}}}", mermaidScript)
    .replaceAll("{{{content}}}", fm + content);

  const htmlPath = join(here, ".tmp-" + basename(mdFile, ".md") + ".html");
  writeFileSync(htmlPath, html);

  try {
    const browser = await puppeteer.launch({
      executablePath: EDGE,
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });
    const page = await browser.newPage();
    await page.goto("file:///" + htmlPath.replace(/\\/g, "/"), { waitUntil: "networkidle0", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1500));
    if (outDir) mkdirSync(outDir, { recursive: true });
    const pdfPath = join(outDir || dirname(mdFile), basename(mdFile, ".md") + ".pdf");
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate:
        '<div style="font-size: 9px; margin: 0 auto;"> <span class=\'pageNumber\'></span> / <span class=\'totalPages\'></span></div>',
      margin: { top: "1.5cm", bottom: "1cm", right: "1cm", left: "1cm" },
    });
    await browser.close();
    console.log(`OK ${pdfPath}`);
  } finally {
    if (existsSync(htmlPath)) unlinkSync(htmlPath);
  }
}

for (const f of files) await toPdf(f);
 