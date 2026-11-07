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
};
const collections = [
  { name: "Timeline", order: "chronological", seasons: [["daredevil", 1], ["loki", 1], ["daredevil", 2], ["born-again", 1]] },
  { name: "Daredevil", seasons: [["born-again"], ["daredevil"]] },
];
const ep = (imdb, season, episode, released) => ({ id: `${imdb}:${season}:${episode}`, season, episode, released });
const cinemetaData = {
  tt1: { name: "Loki", poster: "p1", videos: [ep("tt1", 1, 1, "2021-06-09")] },
  tt2: { name: "Daredevil", poster: "p2", videos: [ep("tt2", 1, 1, "2015-04-10"), ep("tt2", 2, 1, "2016-03-18")] },
  tt3: { name: "Daredevil: Born Again", poster: "p3", videos: [ep("tt3", 1, 1, "2025-03-04"), ep("tt3", 2, 1, "2099-03-24")] },
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
const ids = (metas) => metas.map((m) => m.behaviorHints.defaultVideoId);

test("builds one catalog with a genre per collection, in each collection's order", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "series-collections-"));
  const { fetchImpl, seen } = fakeFetch();
  const report = await build(opts(outDir, fetchImpl));
  assert.equal(seen.length, 3, "each show is looked up once");

  const timeline = await read(outDir, "catalog/series/collections/genre=Timeline (Chronological).json");
  assert.deepEqual(ids(timeline.metas), ["tt2:1:1", "tt1:1:1", "tt2:2:1", "tt3:1:1"]);
  assert.deepEqual(await read(outDir, "catalog/series/collections.json"), timeline, "the first collection is the default");

  const daredevil = await read(outDir, "catalog/series/collections/genre=Daredevil.json");
  assert.deepEqual(ids(daredevil.metas), ["tt2:1:1", "tt2:2:1", "tt3:1:1"], "release order, unaired season held back");
  assert.deepEqual(report.upcoming, { Daredevil: ["Daredevil: Born Again season 2"] });

  const manifest = await read(outDir, "manifest.json");
  assert.deepEqual(manifest.catalogs[0].extra[0].options, ["Timeline (Chronological)", "Daredevil"]);
  assert.ok(existsSync(join(outDir, "index.html")));
});

test("refuses to publish when an id points at another show or a season is missing", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "series-collections-"));
  const { fetchImpl } = fakeFetch({ ...cinemetaData, tt1: { name: "Box 21", videos: [] } });
  await assert.rejects(build(opts(outDir, fetchImpl)), /loki: tt1 is "Box 21" on Cinemeta, not "Loki"/);

  const { fetchImpl: ok } = fakeFetch();
  const missing = [{ name: "Timeline", seasons: [["daredevil", 9]] }];
  await assert.rejects(build(opts(outDir, ok, missing)), /Timeline: Daredevil has no season 9 on Cinemeta/);
});

test("refuses a broken config before fetching anything", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "series-collections-"));
  const { fetchImpl, seen } = fakeFetch();
  await assert.rejects(build(opts(outDir, fetchImpl, [{ name: "X", seasons: [["thor"]] }])), /no show called "thor"/);
  assert.equal(seen.length, 0);
});
