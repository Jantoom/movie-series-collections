// End-to-end build against a fake Cinemeta. No network needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "../scripts/build.mjs";

const shows = {
  loki: { imdb: "tt1", name: "Loki" },
  daredevil: { imdb: "tt2", name: "Daredevil" },
  "born-again": { imdb: "tt3", name: "Daredevil: Born Again" },
  trek: { imdb: "tt4", name: "Star Trek", title: "Star Trek: The Original Series" },
};
const movies = {
  "iron-man": { imdb: "tt5", name: "Iron Man" },
  doomsday: { imdb: "tt6", name: "Avengers: Doomsday" },
  animatrix: { imdb: "tt7", name: "The Animatrix", released: "2003-06-03" },
};
const marvel = [["iron-man"], ["daredevil", 1], ["loki", 1], ["daredevil", 2], ["born-again", 1], ["doomsday"]];
const collections = [
  { genres: ["Superhero", "Action"], name: "Marvel", order: "release", entries: marvel },
  { genres: ["Superhero"], name: "Marvel", order: "timeline", entries: marvel },
  { genres: ["Sci-Fi"], name: "Trek", order: "release", entries: [["trek"], ["animatrix"]] },
  { genres: ["Superhero", "Crime"], name: "Every Daredevil Series", entries: [["born-again"], ["daredevil"]] },
];
const ep = (imdb, season, episode, released) => ({ id: `${imdb}:${season}:${episode}`, season, episode, released });
const cinemetaData = {
  series: {
    tt1: { name: "Loki", poster: "p1", videos: [ep("tt1", 1, 1, "2021-06-09")] },
    tt2: { name: "Daredevil", poster: "p2", videos: [ep("tt2", 1, 1, "2015-04-10"), ep("tt2", 2, 1, "2016-03-18")] },
    tt3: { name: "Daredevil: Born Again", poster: "p3", videos: [ep("tt3", 1, 1, "2025-03-04"), ep("tt3", 2, 1, "2099-03-24")] },
    tt4: { name: "Star Trek", poster: "p4", videos: [ep("tt4", 1, 1, "1966-09-08")] },
  },
  movie: {
    tt5: { name: "Iron Man", poster: "p5", released: "2008-05-02" },
    tt6: { name: "Avengers: Doomsday", released: "2099-12-18" },
    tt7: { name: "The Animatrix", released: "1950-01-01", imdbRating: "7.3" },
  },
};

const fakeFetch = (data = cinemetaData) => {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    const [, type, id] = url.match(/meta\/(series|movie)\/(tt\d+)\.json$/) ?? [];
    const meta = data[type]?.[id];
    return { ok: true, json: async () => (meta ? { meta } : {}) };
  };
  return { fetchImpl, seen };
};

// IMDb's rating and vote count. The Animatrix has none, so its Cinemeta rating stands in.
const ratings = new Map([["tt1", [8.2, 400000]], ["tt2", [8.6, 500000]], ["tt3", [7.5, 50000]], ["tt4", [8.4, 100000]], ["tt5", [7.9, 1100000]]]
  .map(([id, [rating, votes]]) => [id, { rating, votes }]));

const read = async (dir, rel) => JSON.parse(await readFile(join(dir, rel), "utf8"));
const opts = (outDir, fetchImpl, c = collections) => ({
  fetchImpl, shows, movies, collections: c, sequels: [], loadRatings: async () => ratings, now: "2026-11-08T00:00:00.000Z", cinemeta: "https://fake.test", siteUrl: "https://example.test/addon/", outDir, log: () => {},
});
const urls = (meta, category = "Watch order") => meta.links.filter((l) => l.category === category).map((l) => l.url.replace(/^stremio:\/\/\/detail\//, ""));

test("builds the catalogs, each with a genre filter, best-loved collections first", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "movie-series-collections-"));
  const { fetchImpl, seen } = fakeFetch();
  const report = await build(opts(outDir, fetchImpl));
  assert.equal(seen.length, 7, "each title is looked up once");

  const connected = await read(outDir, "catalog/collections/storyline.json");
  assert.deepEqual(connected.metas.map((m) => m.id), ["mscol-marvel", "mscol-marvel-timeline", "mscol-trek"], "None lists the catalog's collections, best-loved first");
  const other = await read(outDir, "catalog/collections/other.json");
  assert.deepEqual(other.metas.map((m) => m.name), ["Every Daredevil Series"]);
  assert.deepEqual((await read(outDir, "catalog/collections/storyline/genre=Superhero.json")).metas.map((m) => m.id), ["mscol-marvel", "mscol-marvel-timeline"]);
  assert.deepEqual((await read(outDir, "catalog/collections/storyline/genre=Sci-Fi.json")).metas.map((m) => m.id), ["mscol-trek"]);
  const franchise = await read(outDir, "catalog/collections/franchise.json");
  assert.deepEqual(franchise.metas.map((m) => [m.id, m.name]), [["mscol-franchise-marvel", "Marvel"]], "a release order over 3 titles gets a Franchise copy");
  assert.deepEqual(urls(franchise.metas[0], "Titles"), ["movie/tt5", "series/tt2", "series/tt1", "series/tt3"], "its titles once each, in the watch order's order");
  assert.deepEqual((await read(outDir, "catalog/collections/person.json")).metas, []);
  assert.deepEqual((await read(outDir, "catalog/collections/other/genre=Crime.json")).metas.map((m) => m.id), ["mscol-every-daredevil-series"]);
  assert.ok(!existsSync(join(outDir, "catalog/collections/other/genre=Sci-Fi.json")), "a catalog only gets the genres it uses");

  const [release, timeline, trek] = connected.metas;
  assert.deepEqual(urls(release), ["movie/tt5", "series/tt2?season=1", "series/tt2?season=2", "series/tt1?season=1", "series/tt3?season=1"]);
  assert.deepEqual(urls(timeline), ["movie/tt5", "series/tt2?season=1", "series/tt1?season=1", "series/tt2?season=2", "series/tt3?season=1"]);
  assert.equal(timeline.name, "Marvel (Timeline)");
  assert.deepEqual(release.links.filter((l) => l.category === "Contents").map((l) => l.name), ["1 Movie", "3 Series", "4 Seasons"]);
  assert.deepEqual(urls(trek), ["series/tt4?season=1", "movie/tt7"], "the config's date wins over Cinemeta's for The Animatrix");
  assert.deepEqual(urls(other.metas[0], "Titles"), ["series/tt2", "series/tt3"], "a list goes most watched first");
  assert.equal(trek.links.find((l) => l.category === "Watch order").name, "Star Trek: The Original Series S1", "the config's title replaces Cinemeta's name");
  assert.deepEqual(report.upcoming.Marvel, ["Avengers: Doomsday"]);
  assert.deepEqual(report.upcoming["Every Daredevil Series"], ["Daredevil: Born Again season 2"]);

  const meta = (await read(outDir, "meta/collections/mscol-marvel-timeline.json")).meta;
  assert.deepEqual(urls(meta), urls(timeline), "the detail page has the same links");
  assert.deepEqual([...new Set(meta.videos.map((v) => v.season))], [1, 2, 3], "everything, then movies, then series");
  const stream = await read(outDir, "stream/collections/mscol-marvel-timeline-3.json");
  assert.equal(stream.streams[0].externalUrl, "stremio:///detail/series/tt1?season=1");
  assert.equal((await read(outDir, "stream/collections/mscol-marvel-timeline-m1.json")).streams[0].externalUrl, "stremio:///detail/movie/tt5");

  const manifest = await read(outDir, "manifest.json");
  assert.deepEqual(manifest.catalogs.map((c) => [c.id, c.genres]), [
    ["storyline", ["All", "Action", "Sci-Fi", "Superhero"]],
    ["franchise", ["All", "Action", "Superhero"]],
    ["person", ["All"]],
    ["studio", ["All"]],
    ["other", ["All", "Crime", "Superhero"]],
  ]);
  assert.deepEqual((await read(outDir, "catalog/collections/storyline/genre=All.json")).metas, connected.metas, "All lists every collection");
  assert.deepEqual(Object.keys(report.catalogs), ["Storyline", "Franchise", "Person", "Studio", "Other"]);
  assert.equal(report.movies, 3);
  assert.ok(existsSync(join(outDir, "index.html")));
});

test("leaves out titles Cinemeta lacks or has under another name, and refuses a missing season", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "movie-series-collections-"));
  const { tt1, ...series } = cinemetaData.series;
  const { fetchImpl } = fakeFetch({ series, movie: { ...cinemetaData.movie, tt5: { name: "Box 21" } } });
  const report = await build(opts(outDir, fetchImpl));
  assert.deepEqual(report.skipped, ['iron-man: tt5 is "Box 21" on Cinemeta, not "Iron Man"', `loki: tt1 ("Loki") isn't on Cinemeta as a series`]);
  const marvel = (await read(outDir, "catalog/collections/storyline.json")).metas.find((m) => m.id === "mscol-marvel");
  assert.deepEqual(urls(marvel), ["series/tt2?season=1", "series/tt2?season=2", "series/tt3?season=1"], "the rest of the collection still builds");
  const allGone = [{ genres: ["G"], name: "Gone", entries: [["loki"]] }];
  await assert.rejects(build(opts(outDir, fetchImpl, allGone)), /Gone: none of its titles are on Cinemeta/);

  const { fetchImpl: ok } = fakeFetch();
  const missing = [{ genres: ["Superhero"], name: "Marvel", order: "release", entries: [["daredevil", 9]] }];
  await assert.rejects(build(opts(outDir, ok, missing)), /Marvel: Daredevil has no season 9 on Cinemeta/);
});

test("refuses a broken config before fetching anything", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "movie-series-collections-"));
  const { fetchImpl, seen } = fakeFetch();
  await assert.rejects(build(opts(outDir, fetchImpl, [{ genres: ["G"], name: "X", entries: [["thor"]] }])), /no show or movie called "thor"/);
  assert.equal(seen.length, 0);
});
