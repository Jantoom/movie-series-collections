#!/usr/bin/env node
// Builds the static Stremio addon into ./dist from Cinemeta data.
//   node scripts/build.mjs
// Optional env: SITE_URL (public base URL, used for genre links and the install page),
// OUT_DIR, CINEMETA_URL, RATINGS_URL.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { shows as defaultShows, movies as defaultMovies, collections as defaultCollections, sequels as defaultSequels } from "../collections.config.mjs";
import {
  ALL_GENRES, CATALOGS, TYPE, arrange, buildManifest, catalogPaths, catalogsOf, collectionScore, configProblems, displayName, entryStreams,
  expandEntries, genreNames, genresOf, idOf, orderOf, sagasOf, sameTitle, titleScore, toCollectionMeta, toCollectionPreview, toMovie, toShow,
  withFranchiseCopies,
} from "../src/lib.mjs";
import { installPage } from "../src/install-page.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * IMDb's public ratings dataset (rating and vote count for every title), trimmed to the
 * given ids. If it can't be fetched, the build carries on with Cinemeta's ratings alone.
 */
export async function loadImdbRatings(ids, { fetchImpl = globalThis.fetch, url = process.env.RATINGS_URL || "https://datasets.imdbws.com/title.ratings.tsv.gz", log = console.log } = {}) {
  const ratings = new Map();
  try {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await new Response(res.body.pipeThrough(new DecompressionStream("gzip"))).text();
    for (const line of text.split("\n")) {
      const [id, rating, votes] = line.split("\t");
      if (ids.has(id)) ratings.set(id, { rating: Number(rating), votes: Number(votes) });
    }
  } catch (err) {
    log(`IMDb ratings unavailable (${err.message}); sorting by Cinemeta's ratings only.`);
  }
  return ratings;
}

export async function build({
  fetchImpl = globalThis.fetch,
  shows: showsConfig = defaultShows,
  movies: moviesConfig = defaultMovies,
  collections: configCollections = defaultCollections,
  sequels = defaultSequels,
  loadRatings = (ids) => loadImdbRatings(ids, { log }),
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
  const collections = withFranchiseCopies(configCollections);
  const configErrors = configProblems(showsConfig, moviesConfig, collections, sequels);
  if (configErrors.length) throw fix(configErrors);
  const shows = new Map(), movies = new Map();
  const problems = [], skipped = [];
  const lookup = async (key) => {
    const isMovie = Boolean(moviesConfig[key]);
    const { imdb, name, title, released } = isMovie ? moviesConfig[key] : showsConfig[key];
    const found = (await getJson(`${cinemeta}/meta/${isMovie ? "movie" : "series"}/${imdb}.json`)).meta;
    // The config's `released` wins: Cinemeta has no date for some titles, and dates others
    // by a later release (a US or anniversary release of a Japanese film).
    // `title` is the name to show, when Cinemeta's isn't the one English speakers know.
    const cm = found && { ...found, released: released ?? found.released };
    // A title Cinemeta doesn't have, or has under another name (a typo'd id, or a regional
    // show it renamed), is left out rather than holding up the whole build. Cinemeta's
    // servers don't always agree on these, so the build log and report.json list them.
    if (!cm?.name) skipped.push(`${key}: ${imdb} ("${name}") isn't on Cinemeta as a ${isMovie ? "movie" : "series"}`);
    // Cinemeta sometimes has the English name already, which is as good a match.
    else if (!sameTitle(name, cm.name) && !sameTitle(title, cm.name)) skipped.push(`${key}: ${imdb} is "${cm.name}" on Cinemeta, not "${name}"`);
    else if (isMovie) movies.set(key, toMovie(imdb, { ...cm, name: title ?? cm.name }));
    else shows.set(key, toShow(imdb, { ...cm, name: title ?? cm.name }));
  };
  // Hundreds of titles, so a few lookups at a time.
  const queue = [...new Set(collections.flatMap((c) => c.entries.map(([k]) => k)))];
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (queue.length) await lookup(queue.shift());
  }));
  problems.sort();
  // Failing stops the workflow from replacing the last good deployment.
  if (problems.length) throw fix(problems);

  // ---- 2. Put each collection's entries in order, and the best-loved first ----
  const titles = [...shows.values(), ...movies.values()];
  const ratings = await loadRatings(new Set(titles.map((t) => t.imdb)));
  const popularity = new Map(titles.map((t) => [t.imdb, ratings.get(t.imdb) ?? { rating: t.rating }]));
  const scores = new Map(titles.map((t) => [t.imdb, titleScore(popularity.get(t.imdb))]));
  const sagas = sagasOf(configCollections, sequels);
  const lists = [];
  const upcoming = {};
  for (const config of collections) {
    const name = displayName(config);
    const c = { ...config, entries: config.entries.filter(([k]) => shows.has(k) || movies.has(k)) };
    if (!c.entries.length) { problems.push(`${name}: none of its titles are on Cinemeta`); continue; }
    const expanded = expandEntries(c, shows, movies, now);
    problems.push(...expanded.problems);
    // A Franchise copy (it has its own id) repeats its watch order's upcoming titles.
    if (expanded.upcoming.length && !config.id) upcoming[name] = expanded.upcoming;
    const entries = arrange(expanded.entries, orderOf(c), popularity, sagas);
    lists.push({ c: config, name, entries, score: collectionScore(entries, scores) });
  }
  // Sorting keeps the config's order between equals, so a release order stays ahead of its timeline.
  lists.sort((a, b) => b.score - a.score);
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
  const report = { builtAt: now, catalogs: {}, upcoming, skipped: skipped.sort() };
  const previews = new Map();
  for (const { c, entries } of lists) {
    previews.set(c, toCollectionPreview(c, entries, manifestUrl));
    await writeJson(`meta/${TYPE}/${idOf(c)}.json`, { meta: toCollectionMeta(c, entries, manifestUrl) });
    for (const { id, streams } of entryStreams(c, entries)) {
      await writeJson(`stream/${TYPE}/${id}.json`, { streams });
    }
  }
  for (const catalog of CATALOGS) {
    const members = lists.filter(({ c }) => catalogsOf(c).includes(catalog.id));
    // "All", and no genre at all: all of the catalog's collections.
    const all = members.map(({ c }) => previews.get(c));
    for (const { rel, metas } of [...catalogPaths(catalog.id, undefined, all), ...catalogPaths(catalog.id, ALL_GENRES, all)]) {
      await writeJson(rel, { metas });
    }
    for (const genre of genreNames(collections, catalog.id)) {
      const inGenre = members.filter(({ c }) => genresOf(c).includes(genre)).map(({ c }) => previews.get(c));
      for (const { rel, metas } of catalogPaths(catalog.id, genre, inGenre)) {
        await writeJson(rel, { metas });
      }
    }
    report.catalogs[catalog.name] = Object.fromEntries(members.map(({ name, entries, score }) => [name, { entries: entries.length, score: Number(score.toFixed(2)) }]));
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
  for (const m of skipped) log(`Skipped ${m}`);
  log(`Done: ${collections.length} collections, ${movies.size} movies, ${shows.size} series.`);
  return report;
}

function sitePage(siteUrl, manifest, lists, totals) {
  const base = siteUrl.replace(/\/$/, "");
  const groups = manifest.catalogs.map((catalog) => {
    const members = lists.filter(({ c }) => catalogsOf(c).includes(catalog.id));
    const genres = genreNames(lists.map(({ c }) => c), catalog.id);
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
    about: `<p>Find them under <b>Discover</b> → <b>Collections</b>. <b>Storyline</b> has watch orders for stories told across many titles, by release or by the story's timeline. <b>Franchise</b>, <b>Person</b> and <b>Studio</b> gather the titles of a franchise, a director or personality, or a studio, with sequels together and the most watched first (a big watch order's copy in Franchise keeps its order), and <b>Other</b> has the rest. Each movie, season or show in a collection opens that title.</p>
<p>This addon has no streams of its own. Titles play through whatever stream addons you already have installed.</p>`,
    links: [{ label: "Build report", href: "report.json" }],
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  build().catch((err) => { console.error(`\nBuild failed: ${err.message}`); process.exit(1); });
}
