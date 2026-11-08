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
const timeline = [["daredevil", 1], ["loki", 1], ["daredevil", 2], ["born-again", 1]];
const collections = [
  { group: "Heroes", name: "Marvel", seasons: timeline },
  { group: "Heroes", name: "Marvel", order: "chronological", seasons: timeline },
  { group: "Sci-Fi", name: "Trek", seasons: [["trek"]] },
  { group: "Heroes", name: "Daredevil", seasons: [["born-again"], ["daredevil"]] },
];
const ep = (imdb, season, episode, released) => ({ id: `${imdb}:${season}:${episode}`, season, episode, released });
const cinemetaData = {
  tt1: { name: "Loki", poster: "p1", videos: [ep("tt1", 1, 1, "2021-06-09")] },
  tt2: { name: "Daredevil", poster: "p2", videos: [ep("tt2", 1, 1, "2015-04-10"), ep("tt2", 2, 1, "2016-03-18")] },
  tt3: { name: "Daredevil: Born Again", poster: "p3", videos: [ep("tt3", 1, 1, "2025-03-04"), ep("tt3", 2, 1, "2099-03-24")] },
  tt4: { name: "Star Trek", poster: "p4", videos: [ep("tt4", 1, 1, "1966-09-08")] },
};

const fakeFetch = (data = cinemetaData) => {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    const id = url.match(/meta\/series\/(tt\d+)\.json$/)?.[1];
    return { ok: true, json: async () => (data[id] ? { meta: data[id] } : {}) };
  };
  return { fetchImpl, seen };
};

const read = async (dir, rel) => JSON.parse(await readFile(join(dir, rel), "utf8"));
const opts = (outDir, fetchImpl, c = collections) => ({ fetchImpl, shows, collections: c, now: "2026-11-08T00:00:00.000Z", cinemeta: "https://fake.test", outDir, log: () => {} });
const urls = (meta) => meta.links.filter((l) => l.category === "Watch order").map((l) => l.url.replace("stremio:///detail/series/", ""));

test("builds one catalog with a genre per group, a poster per collection", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "series-collections-"));
  const { fetchImpl, seen } = fakeFetch();
  const report = await build(opts(outDir, fetchImpl));
  assert.equal(seen.length, 4, "each show is looked up once");

  const heroes = await read(outDir, "catalog/series/collections/genre=Heroes.json");
  assert.deepEqual(heroes.metas.map((m) => m.id), ["sercol-marvel", "sercol-marvel-chronological", "sercol-daredevil"]);
  assert.deepEqual((await read(outDir, "catalog/series/collections/genre=Sci-Fi.json")).metas.map((m) => m.name), ["Trek"]);
  const all = await read(outDir, "catalog/series/collections.json");
  assert.deepEqual(all.metas.map((m) => m.id), [...heroes.metas.map((m) => m.id), "sercol-trek"], "no genre lists every collection, group by group");

  const [release, chrono, daredevil] = heroes.metas;
  assert.deepEqual(urls(release), ["tt2?season=1", "tt2?season=2", "tt1?season=1", "tt3?season=1"], "release order keeps every season");
  assert.deepEqual(urls(chrono), ["tt2?season=1", "tt1?season=1", "tt2?season=2", "tt3?season=1"]);
  assert.equal(chrono.name, "Marvel (Chronological)");
  assert.deepEqual(urls(daredevil), ["tt2?season=1", "tt2?season=2", "tt3?season=1"], "unaired season held back");
  assert.deepEqual(report.upcoming, { Daredevil: ["Daredevil: Born Again season 2"] });

  const meta = (await read(outDir, "meta/series/sercol-marvel-chronological.json")).meta;
  assert.deepEqual(urls(meta), urls(chrono), "the detail page has the same links");
  assert.deepEqual(meta.videos.map((v) => v.title), ["Daredevil S1", "Loki S1", "Daredevil S2", "Daredevil: Born Again S1"]);
  assert.equal(chrono.releaseInfo, "2015–2025");

  const manifest = await read(outDir, "manifest.json");
  assert.deepEqual(manifest.catalogs[0].extra[0].options, ["Heroes", "Sci-Fi"]);
  assert.deepEqual(report.groups.Heroes, { Marvel: 4, "Marvel (Chronological)": 4, Daredevil: 3 });
  assert.ok(existsSync(join(outDir, "index.html")));
});

test("refuses to publish when an id points at another show or a season is missing", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "series-collections-"));
  const { fetchImpl } = fakeFetch({ ...cinemetaData, tt1: { name: "Box 21", videos: [] } });
  await assert.rejects(build(opts(outDir, fetchImpl)), /loki: tt1 is "Box 21" on Cinemeta, not "Loki"/);

  const { fetchImpl: ok } = fakeFetch();
  const missing = [{ group: "Heroes", name: "Marvel", seasons: [["daredevil", 9]] }];
  await assert.rejects(build(opts(outDir, ok, missing)), /Marvel: Daredevil has no season 9 on Cinemeta/);
});

test("refuses a broken config before fetching anything", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "series-collections-"));
  const { fetchImpl, seen } = fakeFetch();
  await assert.rejects(build(opts(outDir, fetchImpl, [{ group: "G", name: "X", seasons: [["thor"]] }])), /no show called "thor"/);
  assert.equal(seen.length, 0);
});
