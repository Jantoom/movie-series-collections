// End-to-end build against a fake Cinemeta. No network needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "../scripts/build.mjs";

const rows = [
  {
    id: "marvel",
    name: "Marvel",
    collections: [
      { id: "studios", name: "Studios", shows: [{ imdb: "tt1", name: "Loki" }, { imdb: "tt3", name: "Daredevil: Born Again" }] },
      { id: "netflix", name: "Netflix", shows: [{ imdb: "tt2", name: "Daredevil" }, { imdb: "tt3", name: "Daredevil: Born Again" }] },
    ],
  },
  {
    id: "rewatch",
    name: "Rewatch",
    collections: [{ id: "watch-order", name: "Watch Order", order: "listed", shows: [{ imdb: "tt3", name: "Daredevil: Born Again" }, { imdb: "tt2", name: "Daredevil" }] }],
  },
];
const cinemetaData = {
  tt1: { name: "Loki", released: "2021-06-09T00:00:00.000Z", poster: "p1", background: "b1" },
  tt2: { name: "Daredevil", released: "2015-04-10T00:00:00.000Z", poster: "p2", background: "b2" },
  tt3: { name: "Daredevil: Born Again", released: "2025-03-04T00:00:00.000Z", poster: "p3", background: "b3" },
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
const opts = (outDir, fetchImpl, r = rows) => ({ fetchImpl, rows: r, cinemeta: "https://fake.test", outDir, log: () => {} });

test("builds a catalog per row, a meta per collection and a stream per show", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "series-collections-"));
  const { fetchImpl, seen } = fakeFetch();
  const report = await build(opts(outDir, fetchImpl));
  assert.equal(report.series, 3);
  assert.equal(seen.length, 3, "a show in several collections is looked up once");

  const marvel = await read(outDir, "catalog/series/marvel.json");
  assert.deepEqual(marvel.metas.map((m) => [m.id, m.poster]), [["sercol-studios", "p1"], ["sercol-netflix", "p2"]]);
  const rewatch = await read(outDir, "catalog/series/rewatch.json");
  assert.deepEqual(rewatch.metas.map((m) => m.id), ["sercol-watch-order"]);

  const netflix = (await read(outDir, "meta/series/sercol-netflix.json")).meta;
  assert.deepEqual(netflix.videos.map((v) => [v.id, v.season]), [["sercol-tt2", 2015], ["sercol-tt3", 2025]]);
  const order = (await read(outDir, "meta/series/sercol-watch-order.json")).meta;
  assert.deepEqual(order.videos.map((v) => [v.id, v.season, v.episode]), [["sercol-tt3", 1, 1], ["sercol-tt2", 1, 2]]);

  const stream = await read(outDir, "stream/series/sercol-tt3.json");
  assert.equal(stream.streams[0].externalUrl, "stremio:///detail/series/tt3");

  assert.deepEqual((await read(outDir, "manifest.json")).catalogs.map((c) => c.id), ["marvel", "rewatch"]);
  assert.deepEqual(report.rows.Rewatch, { "Watch Order": 2 });
  assert.ok(existsSync(join(outDir, "index.html")));
});

test("refuses to publish when an id is missing or points at another show", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "series-collections-"));
  const { fetchImpl } = fakeFetch({ tt1: { name: "Box 21", released: "2020-01-01" }, tt2: cinemetaData.tt2 });
  await assert.rejects(build(opts(outDir, fetchImpl)), (err) => {
    assert.match(err.message, /tt1 is "Box 21" on Cinemeta, not "Loki"/);
    assert.match(err.message, /tt3 \("Daredevil: Born Again"\) isn't on Cinemeta/);
    return true;
  });
});

test("refuses a broken config before fetching anything", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "series-collections-"));
  const { fetchImpl, seen } = fakeFetch();
  const dupe = [rows[0], { ...rows[1], collections: [{ ...rows[1].collections[0], id: "studios" }] }];
  await assert.rejects(build(opts(outDir, fetchImpl, dupe)), /collection id "studios" is used twice/);
  assert.equal(seen.length, 0);
});
