#!/usr/bin/env node
// Builds the static Stremio addon into ./dist from Cinemeta show data.
//   node scripts/build.mjs
// Optional env: SITE_URL (public base URL, used on the install page), OUT_DIR, CINEMETA_URL.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { shows as defaultShows, collections as defaultCollections } from "../collections.config.mjs";
import { ADDON_NAME, TYPE, arrange, buildManifest, catalogPaths, collectionDescription, configProblems, displayName, expandSeasons, sameTitle, toSeasonPreview, toShow } from "../src/lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function build({
  fetchImpl = globalThis.fetch,
  shows: showsConfig = defaultShows,
  collections = defaultCollections,
  now = new Date().toISOString(),
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

  // ---- 1. Look up every show the collections use, once, on Cinemeta --------
  const fix = (problems) => new Error(`Fix collections.config.mjs:\n  ${problems.join("\n  ")}`);
  const configErrors = configProblems(showsConfig, collections);
  if (configErrors.length) throw fix(configErrors);
  const shows = new Map();
  const problems = [];
  for (const key of new Set(collections.flatMap((c) => c.seasons.map(([k]) => k)))) {
    const { imdb, name } = showsConfig[key];
    const cm = (await getJson(`${cinemeta}/meta/${TYPE}/${imdb}.json`)).meta;
    if (!cm?.name) problems.push(`${key}: ${imdb} ("${name}") isn't on Cinemeta as a series`);
    else if (!sameTitle(name, cm.name)) problems.push(`${key}: ${imdb} is "${cm.name}" on Cinemeta, not "${name}"`);
    else shows.set(key, toShow(imdb, cm));
  }
  // Failing stops the workflow from replacing the last good deployment.
  if (problems.length) throw fix(problems);

  // ---- 2. Turn each collection into its season posters ----------------------
  const lists = [];
  const upcoming = {};
  for (const c of collections) {
    const expanded = expandSeasons(c, shows, now);
    problems.push(...expanded.problems);
    if (expanded.upcoming.length) upcoming[displayName(c)] = expanded.upcoming;
    lists.push({ c, metas: arrange(expanded.entries, c.order).map((entry) => toSeasonPreview(entry, c)) });
  }
  if (problems.length) throw fix(problems);

  // ---- 3. Write the static addon --------------------------------------------
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const writeJson = async (rel, data) => {
    const file = join(outDir, rel);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(data));
  };

  const report = { builtAt: now, collections: {}, upcoming };
  for (const [i, { c, metas }] of lists.entries()) {
    const name = displayName(c);
    for (const { rel, metas: page } of catalogPaths(name, metas, i === 0)) {
      await writeJson(rel, { metas: page });
    }
    report.collections[name] = metas.length;
    log(`${name}: ${metas.length} seasons${upcoming[name] ? ` (not aired yet: ${upcoming[name].join(", ")})` : ""}`);
  }

  await writeJson("manifest.json", buildManifest(collections));
  await writeFile(join(outDir, ".nojekyll"), "");
  await writeFile(join(outDir, "index.html"), installPage(siteUrl, collections));
  report.series = shows.size;
  await writeJson("report.json", report);
  log(`Done: ${collections.length} collections, ${shows.size} series.`);
  return report;
}

function installPage(siteUrl, collections) {
  const base = siteUrl.replace(/\/$/, "");
  const manifest = base ? `${base}/manifest.json` : "manifest.json";
  const stremio = base ? manifest.replace(/^https?:\/\//, "stremio://") : "#";
  const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const list = collections
    .map((c) => `<li><b>${escape(displayName(c))}</b>${collectionDescription(c) ? ` — ${escape(collectionDescription(c))}` : ""}</li>`)
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${ADDON_NAME}</title><style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1a1a1a;--muted:#666;--accent:#7b5bf2}
@media (prefers-color-scheme:dark){:root{--bg:#111;--fg:#eee;--muted:#999}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box}
main{max-width:520px}h1{margin:0 0 8px}p,li{color:var(--muted)}
a.btn{display:inline-block;background:var(--accent);color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;margin-right:8px}
code{word-break:break-all;font-size:14px}</style></head><body><main>
<h1>${ADDON_NAME}</h1>
<p>TV series collections in watch order, one poster per season. Find them under Discover → Series → Collections and pick a collection from the genre filter. Each poster opens that season of the show.</p>
<p><a class="btn" href="${stremio}">Install in Stremio</a><a href="report.json">Build report</a></p>
<p>Or paste this into Stremio's addon search:<br><code>${manifest}</code></p>
<p>Collections:</p><ul>${list}</ul>
<p>This addon has no streams of its own. Episodes play through whatever stream addons you already have installed.</p>
</main></body></html>`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  build().catch((err) => { console.error(`\nBuild failed: ${err.message}`); process.exit(1); });
}
