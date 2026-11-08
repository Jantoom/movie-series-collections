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
  trek: { imdb: "tt4", name: "Star Trek" },
};
const movies = {
  "iron-man": { imdb: "tt5", name: "Iron Man" },
  doomsday: { imdb: "tt6", name: "Avengers: Doomsday" },
};
const marvel = [["iron-man"], ["daredevil", 1], ["loki", 1], ["daredevil", 2], ["born-again", 1], ["doomsday"]];
const collections = [
  { group: "Heroes", name: "Marvel", order: "release", entries: marvel },
  { group: "Heroes", name: "Marvel", order: "timeline", entries: marvel },
  { group: ["Sci-Fi", "Heroes"], name: "Trek", order: "release", entries: [["trek"]] },
  { group: "Heroes", name: "Daredevil", entries: [["born-again"], ["daredevil"]] },
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

const read = async (dir, rel) => JSON.parse(await readFile(join(dir, rel), "utf8"));
const opts = (outDir, fetchImpl, c = collections) => ({
  fetchImpl, shows, movies, collections: c, now: "2026-11-08T00:00:00.000Z", cinemeta: "https://fake.test", siteUrl: "https://example.test/addon/", outDir, log: () => {},
});
const urls = (meta, category = "Watch order") => meta.links.filter((l) => l.category === category).map((l) => l.url.replace(/^stremio:\/\/\/detail\//, ""));

test("builds one Genre catalog with a genre per group, a poster per collection", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "series-collections-"));
  const { fetchImpl, seen } = fakeFetch();
  const report = await build(opts(outDir, fetchImpl));
  assert.equal(seen.length, 6, "each title is looked up once");
  assert.ok(seen.includes("https://fake.test/meta/movie/tt5.json") && seen.includes("https://fake.test/meta/series/tt1.json"));

  const heroes = await read(outDir, "catalog/collections/collections/genre=Heroes.json");
  const ids = ["sercol-marvel", "sercol-marvel-timeline", "sercol-trek", "sercol-every-daredevil-series"];
  assert.deepEqual(heroes.metas.map((m) => m.id), ids);
  assert.deepEqual((await read(outDir, "catalog/collections/collections/genre=Sci-Fi.json")).metas.map((m) => m.name), ["Trek"]);
  const all = await read(outDir, "catalog/collections/collections.json");
  assert.deepEqual(all.metas.map((m) => m.id), ids, "None lists every collection once");

  const [release, timeline, , daredevil] = heroes.metas;
  assert.equal(release.name, "Marvel");
  assert.deepEqual(urls(release), ["movie/tt5", "series/tt2?season=1", "series/tt2?season=2", "series/tt1?season=1", "series/tt3?season=1"]);
  assert.equal(timeline.name, "Marvel (Timeline)");
  assert.deepEqual(urls(timeline), ["movie/tt5", "series/tt2?season=1", "series/tt1?season=1", "series/tt2?season=2", "series/tt3?season=1"]);
  assert.deepEqual(release.links.filter((l) => l.category === "Contents").map((l) => l.name), ["1 Movie", "3 Series", "4 Seasons"]);
  assert.equal(daredevil.name, "Every Daredevil Series");
  assert.deepEqual(urls(daredevil, "Titles"), ["series/tt2", "series/tt3"]);
  assert.deepEqual(report.upcoming.Marvel, ["Avengers: Doomsday"]);
  assert.deepEqual(report.upcoming["Every Daredevil Series"], ["Daredevil: Born Again season 2"]);

  const meta = (await read(outDir, "meta/collections/sercol-marvel-timeline.json")).meta;
  assert.deepEqual(urls(meta), urls(timeline), "the detail page has the same links");
  assert.deepEqual(meta.videos.map((v) => v.title), ["Iron Man", "Daredevil S1", "Loki S1", "Daredevil S2", "Daredevil: Born Again S1"]);
  const stream = await read(outDir, "stream/collections/sercol-marvel-timeline-3.json");
  assert.equal(stream.streams[0].externalUrl, "stremio:///detail/series/tt1?season=1");

  const manifest = await read(outDir, "manifest.json");
  assert.deepEqual(manifest.catalogs[0].extra[0].options, ["Heroes", "Sci-Fi"]);
  assert.deepEqual(report.groups.Heroes, { Marvel: 5, "Marvel (Timeline)": 5, Trek: 1, "Every Daredevil Series": 3 });
  assert.equal(report.movies, 2);
  assert.ok(existsSync(join(outDir, "index.html")));
});

test("refuses to publish when an id points at another title or a season is missing", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "series-collections-"));
  const { fetchImpl } = fakeFetch({ ...cinemetaData, movie: { ...cinemetaData.movie, tt5: { name: "Box 21" } } });
  await assert.rejects(build(opts(outDir, fetchImpl)), /iron-man: tt5 is "Box 21" on Cinemeta, not "Iron Man"/);

  const { fetchImpl: ok } = fakeFetch();
  const missing = [{ group: "Heroes", name: "Marvel", order: "release", entries: [["daredevil", 9]] }];
  await assert.rejects(build(opts(outDir, ok, missing)), /Marvel: Daredevil has no season 9 on Cinemeta/);
});

test("refuses a broken config before fetching anything", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "series-collections-"));
  const { fetchImpl, seen } = fakeFetch();
  await assert.rejects(build(opts(outDir, fetchImpl, [{ group: "G", name: "X", entries: [["thor"]] }])), /no show or movie called "thor"/);
  assert.equal(seen.length, 0);
});
