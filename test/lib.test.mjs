import { test } from "node:test";
import assert from "node:assert/strict";
import { arrange, buildManifest, configProblems, sameTitle, toCollectionMeta, toPreview, toShow, toStream } from "../src/lib.mjs";

const cm = (name, released, extra = {}) => ({
  name, released, releaseInfo: released.slice(0, 4),
  poster: `https://images.metahub.space/poster/small/${name}/img`,
  background: `https://images.metahub.space/background/medium/${name}/img`,
  description: `About ${name}.`, ...extra,
});

const loki = toShow("tt9140554", cm("Loki", "2021-06-09T00:00:00.000Z", { releaseInfo: "2021–2023" }));
const wanda = toShow("tt9140560", cm("WandaVision", "2021-01-15T00:00:00.000Z"));
const echo = toShow("tt13966962", cm("Echo", "2023-11-29T00:00:00.000Z"));
const collection = { id: "marvel-studios", name: "Marvel Studios Series", description: "Disney+." };

test("sameTitle tolerates punctuation but not a different show", () => {
  assert.ok(sameTitle("She-Hulk: Attorney at Law", "She Hulk: Attorney at Law"));
  assert.ok(sameTitle("What If...?", "What If...?"));
  assert.ok(!sameTitle("Star Trek", "Star Trek: The Next Generation"));
  assert.ok(!sameTitle("Helstrom", "Box 21"));
  assert.ok(!sameTitle("Loki", undefined));
});

test("configProblems catches duplicate ids, bad order and empty collections", () => {
  const ok = { id: "a", shows: [{ imdb: "tt1", name: "X" }] };
  assert.deepEqual(configProblems([{ id: "r", collections: [ok] }]), []);
  assert.deepEqual(configProblems([
    { id: "r", collections: [ok] },
    { id: "r", collections: [ok, { id: "b", order: "random", shows: [] }] },
  ]), [
    'row id "r" is used twice',
    'collection id "a" is used twice',
    'b: order must be "release" or "listed", not "random"',
    "b has no shows",
  ]);
});

test("toShow takes the premiere year and a bigger poster", () => {
  assert.equal(loki.year, 2021);
  assert.equal(loki.releaseInfo, "2021–2023");
  assert.match(loki.poster, /\/poster\/medium\//);
});

test("the catalog poster is the collection, with the first show's art unless overridden", () => {
  const p = toPreview(collection, [wanda, loki, echo]);
  assert.equal(p.id, "sercol-marvel-studios");
  assert.equal(p.type, "series");
  assert.equal(p.poster, wanda.poster);
  assert.equal(p.releaseInfo, "2021–2023");
  assert.equal(toPreview({ ...collection, poster: "custom" }, [wanda]).poster, "custom");
});

test("release order sorts by premiere, one season per year", () => {
  assert.deepEqual(
    arrange([echo, loki, wanda]).map(({ show, season, episode }) => [show.name, season, episode]),
    [["WandaVision", 2021, 1], ["Loki", 2021, 2], ["Echo", 2023, 1]],
  );
});

test("listed order keeps the config's order in one season", () => {
  assert.deepEqual(
    arrange([echo, loki, wanda], "listed").map(({ show, season, episode }) => [show.name, season, episode]),
    [["Echo", 1, 1], ["Loki", 1, 2], ["WandaVision", 1, 3]],
  );
});

test("collection meta lists shows as videos with deep-link chips", () => {
  const meta = toCollectionMeta(collection, [echo, loki, wanda]);
  assert.deepEqual(meta.videos.map((v) => v.id), ["sercol-tt9140560", "sercol-tt9140554", "sercol-tt13966962"]);
  assert.equal(meta.videos[1].title, "Loki (2021–2023)");
  assert.equal(meta.links[0].url, "stremio:///detail/series/tt9140560");
  assert.match(meta.description, /3 series/);
});

test("a show's only stream deep-links to the real show page", () => {
  const s = toStream(loki);
  assert.equal(s.externalUrl, "stremio:///detail/series/tt9140554");
  assert.equal(s.url, undefined);
  assert.match(s.title, /^Open Loki/);
});

test("manifest has one catalog per row and serves its own ids only", () => {
  const m = buildManifest([{ id: "marvel", name: "Marvel Collections" }, { id: "star-trek", name: "Star Trek Collections" }]);
  assert.deepEqual(m.types, ["series"]);
  assert.deepEqual(m.catalogs, [
    { type: "series", id: "marvel", name: "Marvel Collections" },
    { type: "series", id: "star-trek", name: "Star Trek Collections" },
  ]);
  for (const name of ["meta", "stream"]) {
    assert.deepEqual(m.resources.find((r) => r.name === name).idPrefixes, ["sercol-"]);
  }
});
