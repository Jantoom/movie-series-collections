import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHRONOLOGICAL_NOTE, arrange, buildManifest, catalogPaths, collectionDescription, collectionId, configProblems,
  displayName, expandSeasons, groupNames, sameTitle, seasonLink, toCollectionMeta, toCollectionPreview, toShow, valueSpellings,
} from "../src/lib.mjs";

const ep = (imdb, season, episode, released) => ({ id: `${imdb}:${season}:${episode}`, season, episode, released });
const loki = toShow("tt9140554", {
  name: "Loki",
  poster: "https://images.metahub.space/poster/small/tt9140554/img",
  background: "bg",
  videos: [
    ep("tt9140554", 2, 2, "2023-10-12T00:00:00.000Z"),
    ep("tt9140554", 1, 1, "2021-06-09T00:00:00.000Z"),
    ep("tt9140554", 1, 2, "2021-06-16T00:00:00.000Z"),
    ep("tt9140554", 2, 1, "2023-10-05T00:00:00.000Z"),
    ep("tt9140554", 3, 1, "2099-01-01T00:00:00.000Z"),
    ep("tt9140554", 0, 1, "2021-01-01T00:00:00.000Z"),
  ],
});
const wanda = toShow("tt9140560", { name: "WandaVision", poster: "wp", videos: [ep("tt9140560", 1, 1, "2021-01-15T00:00:00.000Z")] });
const shows = new Map([["loki", loki], ["wandavision", wanda]]);
const NOW = "2026-11-08T00:00:00.000Z";
const names = (list) => list.map(({ show, season }) => `${show.name} ${season.number}`);

test("sameTitle tolerates punctuation but not a different show", () => {
  assert.ok(sameTitle("She-Hulk: Attorney at Law", "She Hulk: Attorney at Law"));
  assert.ok(!sameTitle("Star Trek", "Star Trek: The Next Generation"));
  assert.ok(!sameTitle("Loki", undefined));
});

test("toShow groups episodes into seasons, without specials", () => {
  assert.deepEqual([...loki.seasons.keys()], [1, 2, 3]);
  assert.deepEqual(loki.seasons.get(2), { number: 2, episodes: 2, premiere: "2023-10-05T00:00:00.000Z" });
  assert.match(loki.poster, /\/poster\/medium\//);
});

test("configProblems catches unknown shows, bad seasons, names, groups and order", () => {
  const cfg = { loki: { imdb: "tt9140554", name: "Loki" } };
  assert.deepEqual(configProblems(cfg, [
    { group: "Heroes", name: "Fine", seasons: [["loki"], ["loki", 2]] },
    { group: "Heroes", name: "Fine", order: "chronological", seasons: [["loki"]] },
  ]), [], "a release and a chronological collection can share a name");
  assert.deepEqual(configProblems(cfg, [
    { group: "G", name: "A", seasons: [["loki"]] },
    { group: "G", name: "A", order: "random", seasons: [["thor"], ["loki", 0]] },
    { group: "Bad/Group", name: "Bad: Name", seasons: [] },
  ]), [
    'collection "A" is used twice',
    'A: order must be "release" or "chronological", not "random"',
    'A: no show called "thor" in shows',
    'A: "loki" season must be a whole number from 1, not 0',
    'collection name "Bad: Name" can only use letters, digits, spaces, \' & and -',
    'Bad: Name: group "Bad/Group" can only use letters, digits, spaces, \' & and -',
    "Bad: Name has no seasons",
  ]);
});

test("chronological collections say so in their name, id and description", () => {
  const release = { name: "MCU", description: "Disney+ and Netflix." };
  const chrono = { ...release, order: "chronological" };
  assert.equal(displayName(release), "MCU");
  assert.equal(displayName(chrono), "MCU (Chronological)");
  assert.equal(collectionId(release), "sercol-mcu");
  assert.equal(collectionId(chrono), "sercol-mcu-chronological");
  assert.equal(collectionDescription(release), "Disney+ and Netflix.");
  assert.equal(collectionDescription(chrono), `Disney+ and Netflix. ${CHRONOLOGICAL_NOTE}`);
  assert.equal(collectionDescription({ name: "X" }), undefined);
});

test("groupNames keeps the order collections first use them", () => {
  assert.deepEqual(groupNames([{ group: "Superheroes" }, { group: "Sci-Fi" }, { group: "Superheroes" }]), ["Superheroes", "Sci-Fi"]);
});

test("expandSeasons takes whole shows or single seasons, and holds back unaired ones", () => {
  const { entries, problems, upcoming } = expandSeasons({ name: "C", seasons: [["loki"], ["wandavision", 1], ["wandavision", 4]] }, shows, NOW);
  assert.deepEqual(names(entries), ["Loki 1", "Loki 2", "WandaVision 1"]);
  assert.deepEqual(upcoming, ["Loki season 3"]);
  assert.deepEqual(problems, ["C: WandaVision has no season 4 on Cinemeta"]);
});

test("release order sorts seasons by premiere; chronological keeps the config's order", () => {
  const { entries } = expandSeasons({ name: "C", seasons: [["loki", 2], ["wandavision", 1], ["loki", 1]] }, shows, NOW);
  assert.deepEqual(names(arrange(entries)), ["WandaVision 1", "Loki 1", "Loki 2"]);
  assert.deepEqual(names(arrange(entries, "chronological")), ["Loki 2", "WandaVision 1", "Loki 1"]);
});

test("a season is a link that opens the show on that season's tab", () => {
  assert.deepEqual(seasonLink({ show: loki, season: loki.seasons.get(2) }), {
    name: "Loki · Season 2",
    category: "Watch order",
    url: "stremio:///detail/series/tt9140554?season=2",
  });
});

test("a collection is one poster carrying every season, so repeat shows survive", () => {
  const c = { group: "Heroes", name: "MCU", order: "chronological", description: "Disney+." };
  const { entries } = expandSeasons({ ...c, seasons: [["loki", 1], ["wandavision", 1], ["loki", 2]] }, shows, NOW);
  const p = toCollectionPreview(c, entries);
  assert.equal(p.id, "sercol-mcu-chronological");
  assert.equal(p.type, "series");
  assert.equal(p.name, "MCU (Chronological)");
  assert.equal(p.poster, loki.poster);
  assert.deepEqual(p.links.map((l) => l.name), ["Loki · Season 1", "WandaVision · Season 1", "Loki · Season 2"]);
  assert.equal(p.description, `Disney+. ${CHRONOLOGICAL_NOTE}\n\n3 seasons of 2 series. Pick a season under "Watch order" to open that show on it.`);
  assert.equal(toCollectionPreview({ ...c, poster: "custom" }, entries).poster, "custom");
  assert.deepEqual(toCollectionMeta(c, entries).videos, []);
});

test("catalogPaths writes every genre spelling, pages of 100 and the default", () => {
  assert.deepEqual(valueSpellings("Sci-Fi"), ["Sci-Fi"]);
  assert.deepEqual(valueSpellings("Crime & Drama"), ["Crime & Drama", "Crime+&+Drama", "Crime%20%26%20Drama", "Crime+%26+Drama"]);
  assert.ok(valueSpellings("Kids' Shows").includes("Kids%27%20Shows"), "strict encoding for ' ( ) too");
  const metas = Array.from({ length: 150 }, (_, i) => ({ id: `sercol-${i}` }));
  const files = catalogPaths("Sci-Fi", metas, true);
  assert.deepEqual(files.map((f) => f.rel), [
    "catalog/series/collections/genre=Sci-Fi.json",
    "catalog/series/collections.json",
    "catalog/series/collections/genre=Sci-Fi&skip=100.json",
    "catalog/series/collections/skip=100.json",
  ]);
  assert.equal(files[0].metas.length, 100);
  assert.equal(files.at(-1).metas.length, 50);
});

test("manifest is one Collections catalog whose genres are the groups", () => {
  const m = buildManifest([{ group: "Superheroes" }, { group: "Superheroes" }, { group: "Sci-Fi" }]);
  assert.deepEqual(m.resources, ["catalog", { name: "meta", types: ["series"], idPrefixes: ["sercol-"] }]);
  assert.equal(m.catalogs.length, 1);
  const [c] = m.catalogs;
  assert.deepEqual([c.type, c.id, c.name], ["series", "collections", "Collections"]);
  assert.deepEqual(c.extra, [{ name: "genre", options: ["Superheroes", "Sci-Fi"] }, { name: "skip" }]);
  assert.deepEqual(c.genres, ["Superheroes", "Sci-Fi"]);
});
