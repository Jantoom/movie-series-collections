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
  CATALOGS, TYPE, arrange, buildManifest, catalogOf, catalogPaths, collectionId, configProblems, displayName,
  entryStreams, expandEntries, genreNames, genresOf, sameTitle, toCollectionMeta, toCollectionPreview, toMovie, toShow,
} from "../src/lib.mjs";
import { installPage } from "../src/install-page.mjs";

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

  const manifest = buildManifest(collections);
  await writeJson("manifest.json", manifest);
  await writeFile(join(outDir, ".nojekyll"), "");
  await writeFile(join(outDir, "index.html"), sitePage(siteUrl, manifest, lists, { movies: movies.size, series: shows.size }));
  report.series = shows.size;
  report.movies = movies.size;
  await writeJson("report.json", report);
  log(`Done: ${collections.length} collections, ${movies.size} movies, ${shows.size} series.`);
  return report;
}

function sitePage(siteUrl, manifest, lists, totals) {
  const base = siteUrl.replace(/\/$/, "");
  const groups = manifest.catalogs.map((catalog) => {
    const members = lists.filter(({ c }) => catalogOf(c) === catalog.id);
    const genres = catalog.extra.find((e) => e.name === "genre").options;
    return {
      title: catalog.name,
      detail: `${members.length} collections`,
      choicesLabel: "Genres",
      choices: genres.map((genre) => ({ label: genre, detail: String(members.filter(({ c }) => genresOf(c).includes(genre)).length) })),
    };
  });
  return installPage({
    name: manifest.name,
    version: manifest.version,
    icon: "stack",
    tagline: "Watch orders and franchise collections of movies and TV series.",
    manifestUrl: base ? `${base}/manifest.json` : "manifest.json",
    stats: [
      { value: lists.length, label: "collections" },
      { value: totals.movies, label: "movies" },
      { value: totals.series, label: "series" },
    ],
    groups,
    about: `<p>Find them under <b>Discover</b> → <b>Collections</b>. <b>Connected Storyline</b> has watch orders for stories told across many titles, by release or by the story's timeline. <b>Other</b> gathers titles that share a franchise, character or brand. Each movie, season or show in a collection opens that title.</p>
<p>This addon has no streams of its own. Titles play through whatever stream addons you already have installed.</p>`,
    links: [{ label: "Build report", href: "report.json" }],
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  build().catch((err) => { console.error(`\nBuild failed: ${err.message}`); process.exit(1); });
}
