#!/usr/bin/env node
// Builds the static Stremio addon into ./dist from Cinemeta show data.
//   node scripts/build.mjs
// Optional env: SITE_URL (public base URL, used on the install page), OUT_DIR, CINEMETA_URL.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { rows as defaultRows } from "../collections.config.mjs";
import { ADDON_NAME, TYPE, buildManifest, collectionId, configProblems, sameTitle, showVideoId, toCollectionMeta, toPreview, toShow, toStream } from "../src/lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function build({
  fetchImpl = globalThis.fetch,
  rows = defaultRows,
  cinemeta = process.env.CINEMETA_URL || "https://v3-cinemeta.strem.io",
  outDir = process.env.OUT_DIR || join(root, "dist"),
  siteUrl = process.env.SITE_URL || "",
  log = console.log,
} = {}) {
  async function getJson(url) {
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetchImpl(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        lastErr = err;
        if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }
    throw new Error(`${url}: ${lastErr.message}`);
  }

  // ---- 1. Look up every show once on Cinemeta ------------------------------
  // A show can sit in several collections (Daredevil: Born Again), so key by IMDb id.
  const fix = (problems) => new Error(`Fix collections.config.mjs:\n  ${problems.join("\n  ")}`);
  const configErrors = configProblems(rows);
  if (configErrors.length) throw fix(configErrors);
  const collections = rows.flatMap((row) => row.collections);
  const shows = new Map();
  const problems = [];
  for (const c of collections) {
    for (const { imdb, name } of c.shows) {
      if (shows.has(imdb)) continue;
      const cm = (await getJson(`${cinemeta}/meta/${TYPE}/${imdb}.json`)).meta;
      if (!cm?.name) problems.push(`${imdb} ("${name}") isn't on Cinemeta as a series`);
      else if (!sameTitle(name, cm.name)) problems.push(`${imdb} is "${cm.name}" on Cinemeta, not "${name}"`);
      else shows.set(imdb, toShow(imdb, cm));
    }
  }
  // Failing stops the workflow from replacing the last good deployment.
  if (problems.length) throw fix(problems);

  // ---- 2. Write the static addon --------------------------------------------
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const writeJson = async (rel, data) => {
    const file = join(outDir, rel);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(data));
  };

  const report = { builtAt: new Date().toISOString(), rows: {} };
  for (const row of rows) {
    report.rows[row.name] = {};
    const previews = [];
    for (const c of row.collections) {
      const list = c.shows.map((s) => shows.get(s.imdb));
      previews.push(toPreview(c, list));
      await writeJson(`meta/${TYPE}/${collectionId(c.id)}.json`, { meta: toCollectionMeta(c, list) });
      report.rows[row.name][c.name] = list.length;
      log(`${row.name} / ${c.name}: ${list.length} series`);
    }
    await writeJson(`catalog/${TYPE}/${row.id}.json`, { metas: previews });
  }
  for (const show of shows.values()) {
    await writeJson(`stream/${TYPE}/${showVideoId(show.imdb)}.json`, { streams: [toStream(show)] });
  }

  await writeJson("manifest.json", buildManifest(rows));
  await writeFile(join(outDir, ".nojekyll"), "");
  await writeFile(join(outDir, "index.html"), installPage(siteUrl));
  report.series = shows.size;
  await writeJson("report.json", report);
  log(`Done: ${rows.length} rows, ${collections.length} collections, ${shows.size} series.`);
  return report;
}

function installPage(siteUrl) {
  const base = siteUrl.replace(/\/$/, "");
  const manifest = base ? `${base}/manifest.json` : "manifest.json";
  const stremio = base ? manifest.replace(/^https?:\/\//, "stremio://") : "#";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${ADDON_NAME}</title><style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1a1a1a;--muted:#666;--accent:#7b5bf2}
@media (prefers-color-scheme:dark){:root{--bg:#111;--fg:#eee;--muted:#999}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box}
main{max-width:520px}h1{margin:0 0 8px}p{color:var(--muted)}
a.btn{display:inline-block;background:var(--accent);color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;margin-right:8px}
code{word-break:break-all;font-size:14px}</style></head><body><main>
<h1>${ADDON_NAME}</h1>
<p>TV series grouped into collections, as rows of posters on Stremio's home screen. Open a collection, pick a show, then choose "Open show" to get its seasons and episodes.</p>
<p><a class="btn" href="${stremio}">Install in Stremio</a><a href="report.json">Build report</a></p>
<p>Or paste this into Stremio's addon search:<br><code>${manifest}</code></p>
<p>This addon has no streams of its own. Episodes play through whatever stream addons you already have installed.</p>
</main></body></html>`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  build().catch((err) => { console.error(`\nBuild failed: ${err.message}`); process.exit(1); });
}
