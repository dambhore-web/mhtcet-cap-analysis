// Crawl colleges' own websites for their placement pages (issue #132) and save the page text.
//
// For each college: render the home page in Chromium (many sites build their pages with
// JavaScript), follow links that look like placement pages (Placement, Training & Placement, T&P,
// TPO, Recruiters, Placement Statistics/Record/Report), one level further for statistics pages,
// and read placement PDFs linked from them. Text goes to data/raw/placement-pages/<code>.json
// (git-ignored); `npm run placement:claims` extracts the figures from it.
//
// Usage (from packages/pipeline): node scripts/crawlPlacementPages.mjs <colleges.tsv> [--refresh]
//   colleges.tsv: <code>\t<home page URL> per line.
// Needs Chromium (PW_CHROMIUM_PATH, or Playwright's own) and, behind the agent proxy, its CA.
import { chromium } from "playwright";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = join(REPO, "data/raw/placement-pages");
const [listFile] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const refresh = process.argv.includes("--refresh");
mkdirSync(OUT, { recursive: true });

const PLACEMENT_LINK = /placement|training\s*(&|and)?\s*placement|\bt\s*&\s*p\b|\btnp\b|\btpo\b|recruit|campus\s*(drive|selection)|\bplaced\b|career\s*(cell|development)/i;
const STATS_LINK = /statistic|record|report|detail|highlight|summary|placed|package|20\d\d/i;
const SKIP_LINK = /facebook|instagram|twitter|linkedin|youtube|whatsapp|mailto:|tel:|javascript:|\.(jpe?g|png|gif|zip|docx?|xlsx?)$/i;
const MAX_PAGES = 8;
const MAX_PDFS = 4;

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const args = [];
if (existsSync("/root/.ccr/agent-proxy-ca.crt")) {
  const spki = execFileSync("sh", ["-c", "openssl x509 -in /root/.ccr/agent-proxy-ca.crt -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64"]).toString().trim();
  args.push(`--ignore-certificate-errors-spki-list=${spki}`);
}
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, proxy, args });
const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36" });
// Text is all we need: skip images, fonts and media so slow college sites load faster.
await ctx.route("**/*", (route) => (["image", "font", "media"].includes(route.request().resourceType()) ? route.abort() : route.continue()));

async function render(url) {
  const page = await ctx.newPage();
  try {
    const res = await page.goto(url, { timeout: 25_000, waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1_200);
    // Scroll through the page so counters that animate into view reach their final numbers.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight && y < 20_000; y += 900) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    });
    await page.waitForTimeout(1_500);
    const text = await page.evaluate(() => document.body?.innerText ?? "");
    const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => [a.href, (a.textContent || "").trim().slice(0, 120)]));
    return { status: res?.status() ?? 0, final: page.url(), text, links };
  } catch (e) {
    return { status: 0, error: String(e.message).split("\n")[0], text: "", links: [] };
  } finally {
    await page.close();
  }
}

function sameSite(a, b) {
  const root = (h) => h.replace(/^www\./, "").split(".").slice(-3).join(".");
  try { return root(new URL(a).hostname) === root(new URL(b).hostname) || new URL(a).hostname.endsWith(new URL(b).hostname.replace(/^www\./, "")); } catch { return false; }
}

async function pdfText(url) {
  const tmp = join(OUT, `_tmp-${process.pid}.pdf`);
  try {
    execFileSync("curl", ["-sS", "-L", "--http1.1", "-A", "Mozilla/5.0", "--max-time", "30", "--max-filesize", "15000000", "-o", tmp, url], { timeout: 40_000 });
    const data = new Uint8Array(readFileSync(tmp));
    if (Buffer.from(data.subarray(0, 4)).toString() !== "%PDF") return null;
    const doc = await getDocument({ data, verbosity: 0 }).promise;
    const parts = [];
    for (let p = 1; p <= Math.min(doc.numPages, 15); p++) {
      const items = (await (await doc.getPage(p)).getTextContent()).items;
      // Keep line structure: a new line when the text moves down.
      let lastY = null, line = "";
      for (const it of items) {
        if (!("str" in it)) continue;
        const y = Math.round(it.transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 3) { parts.push(line); line = ""; }
        line += (line ? " " : "") + it.str;
        lastY = y;
      }
      parts.push(line);
    }
    await doc.destroy();
    return parts.join("\n");
  } catch {
    return null;
  }
}

const rows = readFileSync(listFile, "utf8").trim().split("\n").map((l) => l.split("\t"));
for (const [code, home] of rows) {
  const file = join(OUT, `${code}.json`);
  if (!refresh && existsSync(file)) continue;
  const pages = [];
  const start = Date.now();
  const h = await render(home.startsWith("http") ? home : `https://${home}`);
  pages.push({ url: h.final ?? home, kind: "home", status: h.status, error: h.error, text: h.text });
  const queue = [...new Map(h.links.filter(([u, t]) => !SKIP_LINK.test(u) && PLACEMENT_LINK.test(`${u} ${t}`) && sameSite(u, h.final ?? home)).map(([u, t]) => [u.split("#")[0], t])).keys()];
  const seen = new Set([h.final]);
  const pdfs = new Map();
  while (queue.length && pages.length < MAX_PAGES && Date.now() - start < 120_000) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    if (/\.pdf($|\?)/i.test(url)) { pdfs.set(url, ""); continue; }
    const r = await render(url);
    pages.push({ url: r.final ?? url, kind: "page", status: r.status, error: r.error, text: r.text });
    for (const [u, t] of r.links) {
      const clean = u.split("#")[0];
      if (SKIP_LINK.test(clean) || seen.has(clean)) continue;
      if (/\.pdf($|\?)/i.test(clean) && /placement|placed|package|recruit|t&p|tnp/i.test(`${clean} ${t}`)) pdfs.set(clean, t);
      else if (sameSite(clean, r.final ?? url) && PLACEMENT_LINK.test(`${clean} ${t}`) && STATS_LINK.test(`${clean} ${t}`) && !queue.includes(clean)) queue.push(clean);
    }
  }
  const newest = (s) => Math.max(0, ...[...s.matchAll(/20(\d\d)/g)].map((m) => Number(m[1])));
  for (const [url, t] of [...pdfs].sort((a, b) => newest(b.join(" ")) - newest(a.join(" "))).slice(0, MAX_PDFS)) {
    const text = await pdfText(url);
    if (text) pages.push({ url, kind: "pdf", status: 200, text, linkText: t });
  }
  writeFileSync(file, JSON.stringify({ code, home, crawledAt: new Date().toISOString(), pages }));
  console.log(code, h.status, pages.length, pages.filter((p) => p.kind === "pdf").length, ((Date.now() - start) / 1000).toFixed(0) + "s");
}
await browser.close();
