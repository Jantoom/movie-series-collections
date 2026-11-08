#!/usr/bin/env node
// Builds the static Stremio addon into ./dist from Cinemeta data.
//   node scripts/build.mjs
// Optional env: SITE_URL (public base URL, used for genre links and the install page),
// OUT_DIR, CINEMETA_URL.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { shows as defaultShows, movies as defaultMovies, collections as defaultCollections } from "../collections.config.mjs";
import {
  ADDON_NAME, CATALOGS, TYPE, arrange, buildManifest, catalogOf, catalogPaths, collectionDescription, collectionId, configProblems, displayName,
  entryStreams, expandEntries, genreNames, genresOf, sameTitle, toCollectionMeta, toCollectionPreview, toMovie, toShow,
} from "../src/lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function build({
  fetchImpl = globalThis.fetch,
  shows: showsConfig = defaultShows,
  movies: moviesConfig = defaultMovies,
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

  // ---- 1. Look up every show and movie the collections use, once ----------
  const fix = (problems) => new Error(`Fix collections.config.mjs:\n  ${problems.join("\n  ")}`);
  const configErrors = configProblems(showsConfig, moviesConfig, collections);
  if (configErrors.length) throw fix(configErrors);
  const shows = new Map(), movies = new Map();
  const problems = [];
  const lookup = async (key) => {
    const isMovie = Boolean(moviesConfig[key]);
    const { imdb, name, released } = isMovie ? moviesConfig[key] : showsConfig[key];
    const found = (await getJson(`${cinemeta}/meta/${isMovie ? "movie" : "series"}/${imdb}.json`)).meta;
    // The config's `released` fills in for titles Cinemeta has no date for.
    const cm = found && { ...found, released: found.released ?? released };
    if (!cm?.name) problems.push(`${key}: ${imdb} ("${name}") isn't on Cinemeta as a ${isMovie ? "movie" : "series"}`);
    else if (!sameTitle(name, cm.name)) problems.push(`${key}: ${imdb} is "${cm.name}" on Cinemeta, not "${name}"`);
    else if (isMovie) movies.set(key, toMovie(imdb, cm));
    else shows.set(key, toShow(imdb, cm));
  };
  // Hundreds of titles, so a few lookups at a time.
  const queue = [...new Set(collections.flatMap((c) => c.entries.map(([k]) => k)))];
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (queue.length) await lookup(queue.shift());
  }));
  problems.sort();
  // Failing stops the workflow from replacing the last good deployment.
  if (problems.length) throw fix(problems);

  // ---- 2. Put each collection's entries in order ---------------------------
  const lists = [];
  const upcoming = {};
  for (const c of collections) {
    const name = displayName(c);
    const expanded = expandEntries(c, shows, movies, now);
    problems.push(...expanded.problems);
    if (expanded.upcoming.length) upcoming[name] = expanded.upcoming;
    lists.push({ c, name, entries: arrange(expanded.entries, c.order) });
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

  // Genre chips link to Discover, which needs the URL the addon is installed from.
  const manifestUrl = siteUrl ? `${siteUrl.replace(/\/$/, "")}/manifest.json` : undefined;
  const report = { builtAt: now, catalogs: {}, upcoming };
  const previews = new Map();
  for (const { c, name, entries } of lists) {
    previews.set(c, toCollectionPreview(c, name, entries, manifestUrl));
    await writeJson(`meta/${TYPE}/${collectionId(name)}.json`, { meta: toCollectionMeta(c, name, entries, manifestUrl) });
    for (const { id, streams } of entryStreams(c, name, entries)) {
      await writeJson(`stream/${TYPE}/${id}.json`, { streams });
    }
  }
  for (const catalog of CATALOGS) {
    const members = lists.filter(({ c }) => catalogOf(c) === catalog.id);
    // No genre ("None"): all of the catalog's collections. Also its home-screen row.
    for (const { rel, metas } of catalogPaths(catalog.id, undefined, members.map(({ c }) => previews.get(c)))) {
      await writeJson(rel, { metas });
    }
    for (const genre of genreNames(collections, catalog.id)) {
      const inGenre = members.filter(({ c }) => genresOf(c).includes(genre)).map(({ c }) => previews.get(c));
      for (const { rel, metas } of catalogPaths(catalog.id, genre, inGenre)) {
        await writeJson(rel, { metas });
      }
    }
    report.catalogs[catalog.name] = Object.fromEntries(members.map(({ name, entries }) => [name, entries.length]));
    for (const { name, entries } of members) {
      log(`${catalog.name} / ${name}: ${entries.length} entries${upcoming[name] ? ` (not out yet: ${upcoming[name].join(", ")})` : ""}`);
    }
  }

  await writeJson("manifest.json", buildManifest(collections));
  await writeFile(join(outDir, ".nojekyll"), "");
  await writeFile(join(outDir, "index.html"), installPage(siteUrl, lists));
  report.series = shows.size;
  report.movies = movies.size;
  await writeJson("report.json", report);
  log(`Done: ${collections.length} collections, ${movies.size} movies, ${shows.size} series.`);
  return report;
}

function installPage(siteUrl, lists) {
  const base = siteUrl.replace(/\/$/, "");
  const manifest = base ? `${base}/manifest.json` : "manifest.json";
  const stremio = base ? manifest.replace(/^https?:\/\//, "stremio://") : "#";
  const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const item = ({ c, name }) => `<li><b>${escape(name)}</b> <small>(${escape(genresOf(c).join(", "))})</small>${collectionDescription(c) ? ` — ${escape(collectionDescription(c))}` : ""}</li>`;
  const list = CATALOGS
    .map(({ id, name }) => `<h2>${escape(name)}</h2><ul>${lists.filter(({ c }) => catalogOf(c) === id).map(item).join("")}</ul>`)
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${ADDON_NAME}</title><style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1a1a1a;--muted:#666;--accent:#7b5bf2}
@media (prefers-color-scheme:dark){:root{--bg:#111;--fg:#eee;--muted:#999}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box}
main{max-width:520px}h1{margin:0 0 8px}h2{font-size:18px;margin:24px 0 0}p,li{color:var(--muted)}
a.btn{display:inline-block;background:var(--accent);color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;margin-right:8px}
code{word-break:break-all;font-size:14px}</style></head><body><main>
<h1>${ADDON_NAME}</h1>
<p>Collections of movies and TV series, under Discover → Collections. <b>Connected Storyline</b> has watch orders for stories told across many titles; <b>Other</b> gathers titles that share a franchise, character or brand. Each catalog's genre filter starts on None, showing all of its collections. Each movie, season or show in a collection opens that title.</p>
<p><a class="btn" href="${stremio}">Install in Stremio</a><a href="report.json">Build report</a></p>
<p>Or paste this into Stremio's addon search:<br><code>${manifest}</code></p>
${list}
<p>This addon has no streams of its own. Titles play through whatever stream addons you already have installed.</p>
</main></body></html>`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  build().catch((err) => { console.error(`\nBuild failed: ${err.message}`); process.exit(1); });
}
