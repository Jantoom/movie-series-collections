import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TIMELINE_NOTE, arrange, buildManifest, catalogPaths, collectionDescription, collectionId, configProblems, contentKinds, displayName,
  entryStreams, expandEntries, firstSentence, groupLink, groupNames, groupsOf, listItems, sameTitle, toCollectionMeta, toCollectionPreview,
  toMovie, toShow, valueSpellings, yearSpan,
} from "../src/lib.mjs";

const ep = (imdb, season, episode, released) => ({ id: `${imdb}:${season}:${episode}`, season, episode, released });
const loki = toShow("tt9140554", {
  name: "Loki",
  poster: "https://images.metahub.space/poster/small/tt9140554/img",
  background: "bg",
  description: "The god of mischief steps out of his brother's shadow. More follows.",
  releaseInfo: "2021–2023",
  videos: [
    ep("tt9140554", 2, 2, "2023-10-12T00:00:00.000Z"),
    ep("tt9140554", 1, 1, "2021-06-09T00:00:00.000Z"),
    ep("tt9140554", 1, 2, "2021-06-16T00:00:00.000Z"),
    ep("tt9140554", 2, 1, "2023-10-05T00:00:00.000Z"),
    ep("tt9140554", 3, 1, "2099-01-01T00:00:00.000Z"),
    ep("tt9140554", 0, 1, "2021-01-01T00:00:00.000Z"),
  ],
});
const wanda = toShow("tt9140560", { name: "WandaVision", poster: "wp", releaseInfo: "2021", videos: [ep("tt9140560", 1, 1, "2021-01-15T00:00:00.000Z")] });
const ironMan = toMovie("tt0371746", { name: "Iron Man", poster: "https://images.metahub.space/poster/small/tt0371746/img", background: "im-bg", description: "A billionaire builds a suit. Then more.", released: "2008-05-02T00:00:00.000Z" });
const doomsday = toMovie("tt21357150", { name: "Avengers: Doomsday", released: "2099-12-18T00:00:00.000Z" });
const shows = new Map([["loki", loki], ["wandavision", wanda]]);
const movies = new Map([["iron-man", ironMan], ["doomsday", doomsday]]);
const NOW = "2026-11-08T00:00:00.000Z";
const MANIFEST = "https://example.test/addon/manifest.json";
const label = (e) => (e.kind === "movie" ? e.movie.name : `${e.show.name} ${e.season.number}`);
const arranged = (c) => arrange(expandEntries(c, shows, movies, NOW).entries, c.order);

test("sameTitle tolerates punctuation but not a different title", () => {
  assert.ok(sameTitle("She-Hulk: Attorney at Law", "She Hulk: Attorney at Law"));
  assert.ok(sameTitle("Thunderbolts", "Thunderbolts*"));
  assert.ok(!sameTitle("Star Trek", "Star Trek: The Next Generation"));
  assert.ok(!sameTitle("Loki", undefined));
});

test("toShow groups episodes into seasons, without specials; toMovie keeps the release date", () => {
  assert.deepEqual([...loki.seasons.keys()], [1, 2, 3]);
  assert.deepEqual(loki.seasons.get(2), { number: 2, episodes: 2, premiere: "2023-10-05T00:00:00.000Z", finale: "2023-10-12T00:00:00.000Z" });
  assert.match(loki.poster, /\/poster\/medium\//);
  assert.equal(loki.ongoing, false);
  assert.equal(toShow("tt1", { name: "X", releaseInfo: "2025–" }).ongoing, true);
  assert.equal(toShow("tt1", { name: "X", status: "Continuing", releaseInfo: "2025" }).ongoing, true);
  assert.equal(ironMan.released, "2008-05-02T00:00:00.000Z");
  assert.match(ironMan.poster, /\/poster\/medium\//);
});

test("names: release order as is, timeline marked, plain lists say what they hold", () => {
  assert.equal(displayName({ name: "Star Wars", order: "release" }), "Star Wars");
  assert.equal(displayName({ name: "Star Wars", order: "timeline" }), "Star Wars (Timeline)");
  assert.equal(displayName({ name: "Marvel" }, { series: true }), "Every Marvel Series");
  assert.equal(displayName({ name: "Marvel" }, { movies: true }), "Every Marvel Movie");
  assert.equal(displayName({ name: "Marvel" }, { movies: true, series: true }), "Every Marvel Movie and Series");
  assert.deepEqual(contentKinds({ entries: [["loki"], ["iron-man"]] }, { loki: {} }, { "iron-man": {} }), { movies: true, series: true });
  assert.equal(collectionId("Star Wars (Timeline)"), "mscol-star-wars-timeline");
  assert.equal(collectionId("Marvel Cinematic Universe (Unofficial)"), "mscol-marvel-cinematic-universe-unofficial");
});

test("only timelines add the standard sentence", () => {
  assert.equal(TIMELINE_NOTE, "This collection follows the story's timeline instead of release order.");
  assert.equal(collectionDescription({ description: "The saga.", order: "timeline" }), `The saga. ${TIMELINE_NOTE}`);
  assert.equal(collectionDescription({ description: "The saga.", order: "release" }), "The saga.");
  assert.equal(collectionDescription({ name: "X" }), undefined);
});

test("configProblems catches unknown titles, bad seasons, names, groups and order", () => {
  const s = { loki: { imdb: "tt9140554", name: "Loki" } };
  const m = { "iron-man": { imdb: "tt0371746", name: "Iron Man" } };
  assert.deepEqual(configProblems(s, m, [
    { group: "Heroes", name: "Fine (Unofficial)", order: "release", entries: [["loki"], ["loki", 2], ["iron-man"]] },
    { group: ["Heroes", "Gods"], name: "Fine (Unofficial)", order: "timeline", entries: [["loki"]] },
    { group: "Heroes", name: "Fine", entries: [["loki"], ["iron-man"]] },
  ]), []);
  assert.deepEqual(configProblems({ ...s, "iron-man": {} }, m, [
    { group: "G", name: "A", order: "release", entries: [["loki"]] },
    { group: "G", name: "A", order: "random", entries: [["thor"], ["loki", 0], ["iron-man", 1]] },
    { group: "G", name: "List", entries: [["loki", 2]] },
    { group: ["Bad/Group"], name: "Bad/Name", entries: [] },
    { name: "Lost", entries: [["loki"]] },
  ]), [
    '"iron-man" is both a show and a movie; keys must be unique',
    'A: order must be "release", "timeline" or left out, not "random"',
    'collection "A" is used twice',
    'A: no show or movie called "thor"',
    'A: "loki" season must be a whole number from 1, not 0',
    'A: "iron-man" is a movie, so it takes no season',
    'List: a list without an order takes whole shows, so ["loki"], not ["loki", 2]',
    "collection name \"Bad/Name\" can only use letters, digits, spaces and ' & : ( ) . , ! -",
    'Bad/Name: group "Bad/Group" can only use letters, digits, spaces, \' & and -',
    "Bad/Name has no entries",
    "Lost has no group",
  ]);
});

test("groups can be one or several, and keep the order collections first use them", () => {
  assert.deepEqual(groupsOf({ group: "Sci-Fi" }), ["Sci-Fi"]);
  assert.deepEqual(groupsOf({ group: ["Sci-Fi", "Fantasy"] }), ["Sci-Fi", "Fantasy"]);
  assert.deepEqual(groupNames([{ group: "Superheroes" }, { group: ["Sci-Fi", "Superheroes"] }, { group: "Fantasy" }]), ["Superheroes", "Sci-Fi", "Fantasy"]);
});

test("expandEntries takes movies, whole shows and single seasons, and holds back what isn't out", () => {
  const { entries, problems, upcoming } = expandEntries(
    { name: "C", entries: [["loki"], ["iron-man"], ["doomsday"], ["wandavision", 1], ["wandavision", 4]] }, shows, movies, NOW);
  assert.deepEqual(entries.map(label), ["Loki 1", "Loki 2", "Iron Man", "WandaVision 1"]);
  assert.deepEqual(upcoming, ["Loki season 3", "Avengers: Doomsday"]);
  assert.deepEqual(problems, ["C: WandaVision has no season 4 on Cinemeta"]);
});

test("release order sorts movies and seasons by date; timeline keeps the config's order", () => {
  const { entries } = expandEntries({ name: "C", entries: [["loki", 2], ["wandavision", 1], ["iron-man"], ["loki", 1]] }, shows, movies, NOW);
  assert.deepEqual(arrange(entries, "release").map(label), ["Iron Man", "WandaVision 1", "Loki 1", "Loki 2"]);
  assert.deepEqual(arrange(entries, "timeline").map(label), ["Loki 2", "WandaVision 1", "Iron Man", "Loki 1"]);
});

test("firstSentence keeps an entry's blurb short", () => {
  assert.equal(firstSentence("One thing. Another thing."), "One thing.");
  assert.equal(firstSentence("No full stop"), "No full stop");
  assert.equal(firstSentence(undefined), undefined);
});

test("a watch order lists each season and movie, each with a link and a blurb", () => {
  const c = { group: "G", name: "C", order: "release", entries: [["loki"], ["iron-man"]] };
  const items = listItems(c, arranged(c));
  assert.deepEqual(items.map(({ title, url }) => [title, url]), [
    ["Iron Man", "stremio:///detail/movie/tt0371746"],
    ["Loki S1", "stremio:///detail/series/tt9140554?season=1"],
    ["Loki S2", "stremio:///detail/series/tt9140554?season=2"],
  ]);
  assert.equal(items[0].overview, "Iron Man (2008 movie). A billionaire builds a suit.");
  assert.equal(items[1].overview, "Season 1 of Loki (2021, 2 episodes). The god of mischief steps out of his brother's shadow.");
  assert.equal(items[2].overview, "Season 2 of Loki (2023, 2 episodes). The god of mischief steps out of his brother's shadow.");
});

test("a plain list lists each show and movie once, by release, opening the title", () => {
  const c = { group: "G", name: "C", entries: [["loki"], ["wandavision"], ["iron-man"]] };
  const items = listItems(c, arranged(c));
  assert.deepEqual(items.map(({ title, url }) => [title, url]), [
    ["Iron Man", "stremio:///detail/movie/tt0371746"],
    ["WandaVision", "stremio:///detail/series/tt9140560"],
    ["Loki", "stremio:///detail/series/tt9140554"],
  ]);
  assert.equal(items[2].overview, "Loki (2021–2023, 3 seasons). The god of mischief steps out of his brother's shadow.");
});

test("yearSpan runs from the first release to the last finale, open while a show runs", () => {
  const s = (date, finale, ongoing = false) => ({ kind: "season", date, show: { ongoing }, season: { finale } });
  const m = (date) => ({ kind: "movie", date });
  assert.equal(yearSpan([s("2009-10-02", "2010-06-11"), s("2010-09-28", "2011-05-09")]), "2009–2011");
  assert.equal(yearSpan([m("2008-05-02"), s("2021-01-15", "2021-03-05")]), "2008–2021");
  assert.equal(yearSpan([m("2021-07-09")]), "2021");
  assert.equal(yearSpan([m("2008-05-02"), s("2025-03-04", "2025-04-15", true)]), "2008–");
  assert.equal(yearSpan([]), undefined);
});

test("a collection's poster carries its genres, contents (movies first) and list", () => {
  const c = { group: ["Heroes", "Gods"], name: "Marvel", order: "timeline", description: "Heroes.", entries: [["iron-man"], ["loki", 1], ["wandavision", 1], ["loki", 2]] };
  const name = displayName(c);
  const p = toCollectionPreview(c, name, arranged(c), MANIFEST);
  assert.equal(p.id, "mscol-marvel-timeline");
  assert.equal(p.type, "collections");
  assert.equal(p.name, "Marvel (Timeline)");
  assert.equal(p.poster, ironMan.poster, "the first title's poster");
  assert.equal(p.releaseInfo, "2008–2023");
  assert.equal(p.description, `Heroes. ${TIMELINE_NOTE}`);
  assert.deepEqual(p.links.map((l) => `${l.category}: ${l.name}`), [
    "Genres: Heroes",
    "Genres: Gods",
    "Contents: 1 Movie",
    "Contents: 2 Series",
    "Contents: 3 Seasons",
    "Watch order: Iron Man",
    "Watch order: Loki S1",
    "Watch order: WandaVision S1",
    "Watch order: Loki S2",
  ]);
  assert.equal(p.links[0].url, "stremio:///discover/https%3A%2F%2Fexample.test%2Faddon%2Fmanifest.json/collections/collections?genre=Heroes");
  assert.equal(p.links[2].url, "stremio:///detail/collections/mscol-marvel-timeline", "contents chips stay on the collection");
  assert.ok(!toCollectionPreview(c, name, arranged(c)).links.some((l) => l.category === "Genres"), "no genre chips without the addon's URL");
});

test("a plain list's poster lists titles, with no movie count when it has none", () => {
  const c = { group: "Heroes", name: "Marvel", entries: [["loki"], ["wandavision"]] };
  const p = toCollectionPreview(c, displayName(c, { series: true }), arranged(c), MANIFEST);
  assert.equal(p.name, "Every Marvel Series");
  assert.deepEqual(p.links.slice(1).map((l) => `${l.category}: ${l.name}`), [
    "Contents: 2 Series",
    "Contents: 3 Seasons",
    "Titles: WandaVision",
    "Titles: Loki",
  ]);
});

test("the detail page lists the entries with blurbs, and each entry's stream is its link", () => {
  const c = { group: "G", name: "C", order: "timeline", entries: [["loki", 1], ["iron-man"]] };
  const name = displayName(c);
  const meta = toCollectionMeta(c, name, arranged(c), MANIFEST);
  assert.deepEqual(meta.videos.map((v) => [v.id, v.title, v.season, v.episode]), [
    ["mscol-c-timeline-1", "Loki S1", 1, 1],
    ["mscol-c-timeline-2", "Iron Man", 1, 2],
  ]);
  assert.match(meta.videos[0].overview, /^Season 1 of Loki/);
  assert.deepEqual(entryStreams(c, name, arranged(c)), [
    { id: "mscol-c-timeline-1", streams: [{ name: "Movie & Series Collections", title: "Open Loki S1", externalUrl: "stremio:///detail/series/tt9140554?season=1" }] },
    { id: "mscol-c-timeline-2", streams: [{ name: "Movie & Series Collections", title: "Open Iron Man", externalUrl: "stremio:///detail/movie/tt0371746" }] },
  ]);
});

test("groupLink opens this addon's Genre catalog, filtered to the group", () => {
  assert.equal(groupLink(MANIFEST, "Sci-Fi & Fantasy"), "stremio:///discover/https%3A%2F%2Fexample.test%2Faddon%2Fmanifest.json/collections/collections?genre=Sci-Fi%20%26%20Fantasy");
});

test("catalogPaths writes every genre spelling, pages of 100, and the no-genre list", () => {
  assert.deepEqual(valueSpellings("Sci-Fi"), ["Sci-Fi"]);
  assert.deepEqual(valueSpellings("Crime & Drama"), ["Crime & Drama", "Crime+&+Drama", "Crime%20%26%20Drama", "Crime+%26+Drama"]);
  assert.ok(valueSpellings("Kids' Shows").includes("Kids%27%20Shows"), "strict encoding for ' ( ) too");
  const metas = Array.from({ length: 150 }, (_, i) => ({ id: `mscol-${i}` }));
  const files = catalogPaths("Sci-Fi", metas);
  assert.deepEqual(files.map((f) => f.rel), [
    "catalog/collections/collections/genre=Sci-Fi.json",
    "catalog/collections/collections/genre=Sci-Fi&skip=100.json",
  ]);
  assert.equal(files[0].metas.length, 100);
  assert.equal(files.at(-1).metas.length, 50);
  assert.deepEqual(catalogPaths(undefined, metas).map((f) => f.rel), [
    "catalog/collections/collections.json",
    "catalog/collections/collections/skip=100.json",
  ]);
});

test("manifest is one Genre catalog in the collections type, with streams for entries", () => {
  const m = buildManifest([{ group: "Superheroes" }, { group: ["Superheroes", "Sci-Fi"] }]);
  assert.deepEqual(m.types, ["collections"]);
  assert.deepEqual(m.resources, [
    "catalog",
    { name: "meta", types: ["collections"], idPrefixes: ["mscol-"] },
    { name: "stream", types: ["collections"], idPrefixes: ["mscol-"] },
  ]);
  assert.equal(m.catalogs.length, 1);
  const [c] = m.catalogs;
  assert.deepEqual([c.type, c.id, c.name], ["collections", "collections", "Genre"]);
  assert.deepEqual(c.extra, [{ name: "genre", options: ["Superheroes", "Sci-Fi"] }, { name: "skip" }], "not required, so it starts on None");
  assert.deepEqual(c.genres, ["Superheroes", "Sci-Fi"]);
});
