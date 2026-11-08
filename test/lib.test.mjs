import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHRONOLOGICAL_NOTE, arrange, buildManifest, catalogPaths, collectionDescription, collectionId, configProblems, displayName,
  expandSeasons, groupLink, groupNames, groupsOf, listItems, sameTitle, toCollectionMeta, toCollectionPreview, toShow, valueSpellings, yearSpan,
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
const MANIFEST = "https://example.test/addon/manifest.json";
const names = (list) => list.map(({ show, season }) => `${show.name} ${season.number}`);
const arranged = (c) => arrange(expandSeasons(c, shows, NOW).entries, c.order);

test("sameTitle tolerates punctuation but not a different show", () => {
  assert.ok(sameTitle("She-Hulk: Attorney at Law", "She Hulk: Attorney at Law"));
  assert.ok(!sameTitle("Star Trek", "Star Trek: The Next Generation"));
  assert.ok(!sameTitle("Loki", undefined));
});

test("toShow groups episodes into seasons, without specials", () => {
  assert.deepEqual([...loki.seasons.keys()], [1, 2, 3]);
  assert.deepEqual(loki.seasons.get(2), { number: 2, episodes: 2, premiere: "2023-10-05T00:00:00.000Z", finale: "2023-10-12T00:00:00.000Z" });
  assert.match(loki.poster, /\/poster\/medium\//);
  assert.equal(loki.ongoing, false);
  assert.equal(toShow("tt1", { name: "X", releaseInfo: "2025–" }).ongoing, true);
  assert.equal(toShow("tt1", { name: "X", status: "Continuing", releaseInfo: "2025" }).ongoing, true);
});

test("configProblems catches unknown shows, bad seasons, names, groups and order", () => {
  const cfg = { loki: { imdb: "tt9140554", name: "Loki" } };
  assert.deepEqual(configProblems(cfg, [
    { group: "Heroes", name: "Fine", order: "release", seasons: [["loki"], ["loki", 2]] },
    { group: ["Heroes", "Gods"], name: "Fine", order: "chronological", seasons: [["loki"]] },
    { group: "Heroes", name: "Fine", seasons: [["loki"]] },
  ]), [], "the same name can be a release order, a chronological order and a plain list");
  assert.deepEqual(configProblems(cfg, [
    { group: "G", name: "A", seasons: [["loki"]] },
    { group: "G", name: "A", order: "random", seasons: [["thor"], ["loki", 0]] },
    { group: "G", name: "List", seasons: [["loki", 2]] },
    { group: ["Bad/Group"], name: "Bad: Name", seasons: [] },
    { name: "Lost", seasons: [["loki"]] },
  ]), [
    'collection "A" is used twice',
    'A: order must be "release", "chronological" or left out, not "random"',
    'A: no show called "thor" in shows',
    'A: "loki" season must be a whole number from 1, not 0',
    'List: a list without an order takes whole shows, so ["loki"], not ["loki", 2]',
    'collection name "Bad: Name" can only use letters, digits, spaces, \' & and -',
    'Bad: Name: group "Bad/Group" can only use letters, digits, spaces, \' & and -',
    "Bad: Name has no seasons",
    "Lost has no group",
  ]);
});

test("watch orders say which order in their name and id; plain lists don't", () => {
  const base = { name: "Marvel Cinematic Universe", description: "Disney+ and Netflix." };
  assert.equal(displayName({ ...base, order: "release" }), "Marvel Cinematic Universe (Release Order)");
  assert.equal(displayName({ ...base, order: "chronological" }), "Marvel Cinematic Universe (Chronological)");
  assert.equal(displayName(base), "Marvel Cinematic Universe");
  assert.equal(collectionId({ ...base, order: "chronological" }), "sercol-marvel-cinematic-universe-chronological");
  assert.equal(collectionId(base), "sercol-marvel-cinematic-universe");
  assert.equal(collectionDescription({ ...base, order: "release" }), "Disney+ and Netflix.");
  assert.equal(collectionDescription({ ...base, order: "chronological" }), `Disney+ and Netflix. ${CHRONOLOGICAL_NOTE}`);
  assert.equal(CHRONOLOGICAL_NOTE, "This collection follows the story's timeline instead of release order.");
  assert.equal(collectionDescription({ name: "X" }), undefined);
});

test("groups can be one or several, and keep the order collections first use them", () => {
  assert.deepEqual(groupsOf({ group: "Sci-Fi" }), ["Sci-Fi"]);
  assert.deepEqual(groupsOf({ group: ["Sci-Fi", "Fantasy"] }), ["Sci-Fi", "Fantasy"]);
  assert.deepEqual(groupNames([{ group: "Superheroes" }, { group: ["Sci-Fi", "Superheroes"] }, { group: "Fantasy" }]), ["Superheroes", "Sci-Fi", "Fantasy"]);
});

test("expandSeasons takes whole shows or single seasons, and holds back unaired ones", () => {
  const { entries, problems, upcoming } = expandSeasons({ name: "C", seasons: [["loki"], ["wandavision", 1], ["wandavision", 4]] }, shows, NOW);
  assert.deepEqual(names(entries), ["Loki 1", "Loki 2", "WandaVision 1"]);
  assert.deepEqual(upcoming, ["Loki season 3"]);
  assert.deepEqual(problems, ["C: WandaVision has no season 4 on Cinemeta"]);
});

test("release order sorts seasons by premiere; chronological keeps the config's order", () => {
  const { entries } = expandSeasons({ name: "C", seasons: [["loki", 2], ["wandavision", 1], ["loki", 1]] }, shows, NOW);
  assert.deepEqual(names(arrange(entries, "release")), ["WandaVision 1", "Loki 1", "Loki 2"]);
  assert.deepEqual(names(arrange(entries, "chronological")), ["Loki 2", "WandaVision 1", "Loki 1"]);
});

test("a watch order lists seasons, opening each season's tab", () => {
  const c = { group: "G", name: "C", order: "release", seasons: [["loki"], ["wandavision"]] };
  assert.deepEqual(listItems(c, arranged(c)).map(({ title, url }) => [title, url]), [
    ["WandaVision S1", "stremio:///detail/series/tt9140560?season=1"],
    ["Loki S1", "stremio:///detail/series/tt9140554?season=1"],
    ["Loki S2", "stremio:///detail/series/tt9140554?season=2"],
  ]);
});

test("a plain list lists each show once, by premiere, opening the show", () => {
  const c = { group: "G", name: "C", seasons: [["loki"], ["wandavision"]] };
  assert.deepEqual(listItems(c, arranged(c)).map(({ title, url }) => [title, url]), [
    ["WandaVision", "stremio:///detail/series/tt9140560"],
    ["Loki", "stremio:///detail/series/tt9140554"],
  ]);
});

test("yearSpan runs from the first premiere to the last finale, open while a show runs", () => {
  const e = (premiere, finale, ongoing = false) => ({ show: { ongoing }, season: { premiere, finale } });
  assert.equal(yearSpan([e("2009-10-02", "2010-06-11"), e("2010-09-28", "2011-05-09")]), "2009–2011");
  assert.equal(yearSpan([e("2021-01-15", "2021-03-05")]), "2021");
  assert.equal(yearSpan([e("2015-04-10", "2015-04-10"), e("2025-03-04", "2025-04-15", true)]), "2015–");
  assert.equal(yearSpan([]), undefined);
});

test("a collection's poster carries its genres, contents and list", () => {
  const c = { group: ["Heroes", "Gods"], name: "Marvel Cinematic Universe", order: "chronological", description: "Disney+.", seasons: [["loki", 1], ["wandavision", 1], ["loki", 2]] };
  const p = toCollectionPreview(c, arranged(c), MANIFEST);
  assert.equal(p.id, "sercol-marvel-cinematic-universe-chronological");
  assert.equal(p.type, "series");
  assert.equal(p.name, "Marvel Cinematic Universe (Chronological)");
  assert.equal(p.poster, loki.poster);
  assert.equal(p.releaseInfo, "2021–2023");
  assert.equal(p.description, `Disney+. ${CHRONOLOGICAL_NOTE}`);
  assert.deepEqual(p.links.map((l) => `${l.category}: ${l.name}`), [
    "Genres: Heroes",
    "Genres: Gods",
    "Contents: 2 Series",
    "Contents: 3 Seasons",
    "Watch order: Loki S1",
    "Watch order: WandaVision S1",
    "Watch order: Loki S2",
  ]);
  assert.equal(p.links[0].url, "stremio:///discover/https%3A%2F%2Fexample.test%2Faddon%2Fmanifest.json/series/collections?genre=Heroes");
  assert.equal(p.links[2].url, "stremio:///detail/series/sercol-marvel-cinematic-universe-chronological", "contents chips stay on the collection");
  assert.ok(!toCollectionPreview(c, arranged(c)).links.some((l) => l.category === "Genres"), "no genre chips without the addon's URL");
  assert.equal(toCollectionPreview({ ...c, poster: "custom" }, arranged(c), MANIFEST).poster, "custom");
});

test("a plain list's poster lists its shows under Series", () => {
  const c = { group: "Heroes", name: "Marvel", seasons: [["loki"], ["wandavision"]] };
  const p = toCollectionPreview(c, arranged(c), MANIFEST);
  assert.equal(p.name, "Marvel");
  assert.deepEqual(p.links.slice(1).map((l) => `${l.category}: ${l.name}`), [
    "Contents: 2 Series",
    "Contents: 3 Seasons",
    "Series: WandaVision",
    "Series: Loki",
  ]);
});

test("the detail page lists the same items as one long run of entries", () => {
  const c = { group: "G", name: "MCU", order: "chronological", seasons: [["loki", 1], ["wandavision", 1], ["loki", 2]] };
  const meta = toCollectionMeta(c, arranged(c), MANIFEST);
  assert.deepEqual(meta.videos.map((v) => [v.id, v.title, v.season, v.episode]), [
    ["sercol-mcu-chronological-1", "Loki S1", 1, 1],
    ["sercol-mcu-chronological-2", "WandaVision S1", 1, 2],
    ["sercol-mcu-chronological-3", "Loki S2", 1, 3],
  ]);
  assert.equal(meta.videos[0].thumbnail, "bg");
});

test("groupLink opens this addon's Collections, filtered to the group", () => {
  assert.equal(groupLink(MANIFEST, "Sci-Fi & Fantasy"), "stremio:///discover/https%3A%2F%2Fexample.test%2Faddon%2Fmanifest.json/series/collections?genre=Sci-Fi%20%26%20Fantasy");
});

test("catalogPaths writes every genre spelling, pages of 100, and the no-genre list", () => {
  assert.deepEqual(valueSpellings("Sci-Fi"), ["Sci-Fi"]);
  assert.deepEqual(valueSpellings("Crime & Drama"), ["Crime & Drama", "Crime+&+Drama", "Crime%20%26%20Drama", "Crime+%26+Drama"]);
  assert.ok(valueSpellings("Kids' Shows").includes("Kids%27%20Shows"), "strict encoding for ' ( ) too");
  const metas = Array.from({ length: 150 }, (_, i) => ({ id: `sercol-${i}` }));
  const files = catalogPaths("Sci-Fi", metas);
  assert.deepEqual(files.map((f) => f.rel), [
    "catalog/series/collections/genre=Sci-Fi.json",
    "catalog/series/collections/genre=Sci-Fi&skip=100.json",
  ]);
  assert.equal(files[0].metas.length, 100);
  assert.equal(files.at(-1).metas.length, 50);
  assert.deepEqual(catalogPaths(undefined, metas).map((f) => f.rel), [
    "catalog/series/collections.json",
    "catalog/series/collections/skip=100.json",
  ]);
});

test("manifest is one Collections catalog whose genres are the groups", () => {
  const m = buildManifest([{ group: "Superheroes" }, { group: ["Superheroes", "Sci-Fi"] }]);
  assert.deepEqual(m.resources, ["catalog", { name: "meta", types: ["series"], idPrefixes: ["sercol-"] }]);
  assert.equal(m.catalogs.length, 1);
  const [c] = m.catalogs;
  assert.deepEqual([c.type, c.id, c.name], ["series", "collections", "Collections"]);
  assert.deepEqual(c.extra, [{ name: "genre", options: ["Superheroes", "Sci-Fi"] }, { name: "skip" }]);
  assert.deepEqual(c.genres, ["Superheroes", "Sci-Fi"]);
});
