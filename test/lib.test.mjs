import { test } from "node:test";
import assert from "node:assert/strict";
import { CHRONOLOGICAL_NOTE, arrange, buildManifest, catalogPaths, collectionDescription, configProblems, displayName, expandSeasons, sameTitle, toSeasonPreview, toShow, valueSpellings } from "../src/lib.mjs";

const ep = (imdb, season, episode, released) => ({ id: `${imdb}:${season}:${episode}`, season, episode, released });
const loki = toShow("tt9140554", {
  name: "Loki",
  poster: "https://images.metahub.space/poster/small/tt9140554/img",
  background: "bg",
  description: "God of mischief.",
  videos: [
    ep("tt9140554", 2, 2, "2023-10-12T00:00:00.000Z"),
    ep("tt9140554", 1, 1, "2021-06-09T00:00:00.000Z"),
    ep("tt9140554", 1, 2, "2021-06-16T00:00:00.000Z"),
    ep("tt9140554", 2, 1, "2023-10-05T00:00:00.000Z"),
    ep("tt9140554", 3, 1, "2099-01-01T00:00:00.000Z"),
    ep("tt9140554", 0, 1, "2021-01-01T00:00:00.000Z"),
  ],
});
const wanda = toShow("tt9140560", { name: "WandaVision", videos: [ep("tt9140560", 1, 1, "2021-01-15T00:00:00.000Z")] });
const shows = new Map([["loki", loki], ["wandavision", wanda]]);
const NOW = "2026-11-08T00:00:00.000Z";

test("sameTitle tolerates punctuation but not a different show", () => {
  assert.ok(sameTitle("She-Hulk: Attorney at Law", "She Hulk: Attorney at Law"));
  assert.ok(!sameTitle("Star Trek", "Star Trek: The Next Generation"));
  assert.ok(!sameTitle("Loki", undefined));
});

test("toShow groups episodes into seasons, without specials", () => {
  assert.deepEqual([...loki.seasons.keys()], [1, 2, 3]);
  assert.deepEqual(loki.seasons.get(2), { number: 2, episodes: 2, firstVideoId: "tt9140554:2:1", premiere: "2023-10-05T00:00:00.000Z" });
  assert.match(loki.poster, /\/poster\/medium\//);
});

test("configProblems catches unknown shows, bad seasons, names and order", () => {
  const cfg = { loki: { imdb: "tt9140554", name: "Loki" } };
  assert.deepEqual(configProblems(cfg, [{ name: "Fine", seasons: [["loki"], ["loki", 2]] }]), []);
  assert.deepEqual(configProblems(cfg, [
    { name: "A", seasons: [["loki"]] },
    { name: "A", order: "random", seasons: [["thor"], ["loki", 0]] },
    { name: "Bad: Name", seasons: [] },
  ]), [
    'collection "A" is used twice',
    'A: order must be "release" or "chronological", not "random"',
    'A: no show called "thor" in shows',
    'A: "loki" season must be a whole number from 1, not 0',
    'collection name "Bad: Name" can only use letters, digits, spaces, \' & and -',
    "Bad: Name has no seasons",
  ]);
});

test("expandSeasons takes whole shows or single seasons, and holds back unaired ones", () => {
  const { entries, problems, upcoming } = expandSeasons({ name: "C", seasons: [["loki"], ["wandavision", 1], ["wandavision", 4]] }, shows, NOW);
  assert.deepEqual(entries.map(({ show, season }) => `${show.name} ${season.number}`), ["Loki 1", "Loki 2", "WandaVision 1"]);
  assert.deepEqual(upcoming, ["Loki season 3"]);
  assert.deepEqual(problems, ["C: WandaVision has no season 4 on Cinemeta"]);
});

test("release order sorts seasons by premiere; chronological keeps the config's order", () => {
  const { entries } = expandSeasons({ name: "C", seasons: [["loki", 2], ["wandavision", 1], ["loki", 1]] }, shows, NOW);
  const names = (list) => list.map(({ show, season }) => `${show.name} ${season.number}`);
  assert.deepEqual(names(arrange(entries)), ["WandaVision 1", "Loki 1", "Loki 2"]);
  assert.deepEqual(names(arrange(entries, "chronological")), ["Loki 2", "WandaVision 1", "Loki 1"]);
});

test("chronological collections say so in their name and description", () => {
  const release = { name: "MCU", description: "Disney+ and Netflix." };
  const chrono = { ...release, order: "chronological" };
  assert.equal(displayName(release), "MCU");
  assert.equal(displayName(chrono), "MCU (Chronological)");
  assert.equal(collectionDescription(release), "Disney+ and Netflix.");
  assert.equal(collectionDescription(chrono), `Disney+ and Netflix. ${CHRONOLOGICAL_NOTE}`);
  assert.equal(collectionDescription({ name: "X", order: "chronological" }), CHRONOLOGICAL_NOTE);
  assert.equal(collectionDescription({ name: "X" }), undefined);
});

test("a season poster is the real show, landing on the season's first episode", () => {
  const p = toSeasonPreview({ show: loki, season: loki.seasons.get(2) }, { name: "MCU", order: "chronological" });
  assert.equal(p.id, "tt9140554");
  assert.equal(p.type, "series");
  assert.equal(p.name, "Season 2 · Loki");
  assert.equal(p.releaseInfo, undefined);
  assert.equal(p.behaviorHints.defaultVideoId, "tt9140554:2:1");
  assert.equal(p.description, `Loki, season 2 (2 episodes).\n\nMCU (Chronological): ${CHRONOLOGICAL_NOTE}\n\nGod of mischief.`);
  assert.equal(toSeasonPreview({ show: loki, season: loki.seasons.get(1) }, { name: "Plain" }).description, "Loki, season 1 (2 episodes).\n\nGod of mischief.");
});

test("catalogPaths writes every genre spelling, pages of 100 and the default", () => {
  assert.deepEqual(valueSpellings("Star Trek"), ["Star Trek", "Star+Trek", "Star%20Trek"]);
  assert.deepEqual(valueSpellings("MCU (Chronological)"), ["MCU (Chronological)", "MCU+(Chronological)", "MCU%20(Chronological)", "MCU%20%28Chronological%29", "MCU+%28Chronological%29"]);
  const metas = Array.from({ length: 150 }, (_, i) => ({ id: `tt${i}` }));
  const files = catalogPaths("Star Trek", metas, true);
  assert.deepEqual(files.map((f) => f.rel), [
    "catalog/series/collections/genre=Star Trek.json",
    "catalog/series/collections/genre=Star+Trek.json",
    "catalog/series/collections/genre=Star%20Trek.json",
    "catalog/series/collections.json",
    "catalog/series/collections/genre=Star Trek&skip=100.json",
    "catalog/series/collections/genre=Star+Trek&skip=100.json",
    "catalog/series/collections/genre=Star%20Trek&skip=100.json",
    "catalog/series/collections/skip=100.json",
  ]);
  assert.equal(files[0].metas.length, 100);
  assert.equal(files.at(-1).metas.length, 50);
  assert.equal(catalogPaths("Loki", [], false).length, 1, "an empty collection still answers with an empty page");
});

test("manifest is one Collections catalog whose genres are the collections", () => {
  const m = buildManifest([{ name: "MCU" }, { name: "MCU", order: "chronological" }, { name: "Star Trek" }]);
  assert.deepEqual(m.resources, ["catalog"]);
  assert.equal(m.catalogs.length, 1);
  const [c] = m.catalogs;
  assert.deepEqual([c.type, c.id, c.name], ["series", "collections", "Collections"]);
  assert.deepEqual(c.extra, [{ name: "genre", options: ["MCU", "MCU (Chronological)", "Star Trek"] }, { name: "skip" }]);
  assert.deepEqual(c.genres, ["MCU", "MCU (Chronological)", "Star Trek"]);
});
