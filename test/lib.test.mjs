import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATALOGS, TIMELINE_NOTE, arrange, buildManifest, catalogOf, catalogPaths, collectionDescription, collectionId, collectionPopularity, configProblems,
  displayName, entryStreams, expandEntries, firstSentence, genreLink, genreNames, listItems, popularityRanks, sameTitle, toCollectionMeta, toCollectionPreview,
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
const oldShow = toShow("tt0060000", { name: "Old Show", releaseInfo: "1966", videos: [ep("tt0060000", 1, 1, undefined)] });
const noEpisodes = toShow("tt0070000", { name: "No Episodes", releaseInfo: "1999–2004" });
const ironMan = toMovie("tt0371746", { name: "Iron Man", poster: "https://images.metahub.space/poster/small/tt0371746/img", background: "im-bg", description: "A billionaire builds a suit. Then more.", released: "2008-05-02T00:00:00.000Z" });
const doomsday = toMovie("tt21357150", { name: "Avengers: Doomsday", released: "2099-12-18T00:00:00.000Z" });
const shows = new Map([["loki", loki], ["wandavision", wanda], ["old-show", oldShow], ["no-episodes", noEpisodes]]);
const movies = new Map([["iron-man", ironMan], ["doomsday", doomsday]]);
const NOW = "2026-11-08T00:00:00.000Z";
const MANIFEST = "https://example.test/addon/manifest.json";
const label = (e) => (e.kind === "movie" ? e.movie.name : e.kind === "show" ? e.show.name : `${e.show.name} ${e.season.number}`);
const arranged = (c) => arrange(expandEntries(c, shows, movies, NOW).entries, c.order);

test("sameTitle tolerates punctuation but not a different title", () => {
  assert.ok(sameTitle("She-Hulk: Attorney at Law", "She Hulk: Attorney at Law"));
  assert.ok(sameTitle("Thunderbolts", "Thunderbolts*"));
  assert.ok(!sameTitle("Star Trek", "Star Trek: The Next Generation"));
  assert.ok(!sameTitle("Loki", undefined));
  assert.ok(sameTitle("Pokémon Horizons", "Pokemon Horizons"));
  assert.ok(sameTitle("МастерШеф", "МастерШеф"), "titles in other scripts");
});

test("toShow groups episodes into seasons, without specials; toMovie keeps the release date", () => {
  assert.deepEqual([...loki.seasons.keys()], [1, 2, 3]);
  assert.deepEqual(loki.seasons.get(2), { number: 2, episodes: 2, premiere: "2023-10-05T00:00:00.000Z", finale: "2023-10-12T00:00:00.000Z" });
  assert.match(loki.poster, /\/poster\/medium\//);
  assert.equal(loki.ongoing, false);
  assert.equal(noEpisodes.released, "1999-01-01T00:00:00.000Z", "a show's own start year stands in for its premiere");
  assert.equal(toShow("tt1", { name: "X", releaseInfo: "2025–" }).ongoing, true);
  assert.equal(toShow("tt1", { name: "X", status: "Continuing", releaseInfo: "2025" }).ongoing, true);
  assert.equal(ironMan.released, "2008-05-02T00:00:00.000Z");
  const zero = toShow("tt2", { name: "Z", releaseInfo: "2021–", videos: [ep("tt2", 1, 1, "1970-01-01T00:00:00.000Z"), ep("tt2", 1, 2, "2021-05-01T00:00:00.000Z")] });
  assert.equal(zero.seasons.get(1).premiere, "2021-05-01T00:00:00.000Z", "Cinemeta's zero timestamp means no date");
});

test("watch orders go in Connected Storyline, everything else in Other", () => {
  assert.deepEqual(CATALOGS.map((c) => c.name), ["Connected Storyline", "Other"]);
  assert.equal(catalogOf({ order: "release" }), "connected");
  assert.equal(catalogOf({ order: "timeline" }), "connected");
  assert.equal(catalogOf({}), "other");
});

test("names: a timeline is marked, everything else keeps its own name", () => {
  assert.equal(displayName({ name: "Star Wars", order: "release" }), "Star Wars");
  assert.equal(displayName({ name: "Star Wars", order: "timeline" }), "Star Wars (Timeline)");
  assert.equal(displayName({ name: "Love Island" }), "Love Island");
  assert.equal(collectionId("Star Wars (Timeline)"), "mscol-star-wars-timeline");
  assert.equal(collectionId("Pokémon"), "mscol-pokemon");
  assert.equal(collectionId("Sony's Spider-Man Universe"), "mscol-sony-s-spider-man-universe");
});

test("only timelines add the standard sentence", () => {
  assert.equal(TIMELINE_NOTE, "This collection follows the story's timeline instead of release order.");
  assert.equal(collectionDescription({ description: "The saga.", order: "timeline" }), `The saga. ${TIMELINE_NOTE}`);
  assert.equal(collectionDescription({ description: "The saga.", order: "release" }), "The saga.");
  assert.equal(collectionDescription({ name: "X" }), undefined);
});

test("configProblems catches unknown titles, bad seasons, names, genres and order", () => {
  const s = { loki: { imdb: "tt9140554", name: "Loki" } };
  const m = { "iron-man": { imdb: "tt0371746", name: "Iron Man" } };
  assert.deepEqual(configProblems(s, m, [
    { genres: ["Action"], name: "Fine (Unofficial)", order: "release", entries: [["loki"], ["loki", 2], ["iron-man"]] },
    { genres: ["Action", "Sci-Fi"], name: "Fine (Unofficial)", order: "timeline", entries: [["loki"]] },
    { genres: ["Reality-TV"], name: "Pokémon", first: ["iron-man"], entries: [["loki"], ["iron-man"]] },
  ]), []);
  assert.deepEqual(configProblems({ ...s, "iron-man": {} }, m, [
    { genres: ["G"], name: "A", order: "release", entries: [["loki"]] },
    { genres: ["G"], name: "A", order: "random", entries: [["thor"], ["loki", 0], ["iron-man", 1]] },
    { genres: ["G"], name: "List", first: ["thor"], entries: [["loki", 2]] },
    { genres: ["G"], name: "T", order: "timeline", first: ["loki"], entries: [["loki"]] },
    { genres: ["Bad/Genre"], name: "Bad/Name", entries: [] },
    { name: "Lost", entries: [["loki"]] },
  ]), [
    '"iron-man" is both a show and a movie; keys must be unique',
    'collection "A" is used twice',
    'A: order must be "release", "timeline" or left out, not "random"',
    'A: no show or movie called "thor"',
    'A: "loki" season must be a whole number from 1, not 0',
    'A: "iron-man" is a movie, so it takes no season',
    "List: \"first\" names \"thor\", which isn't one of its entries",
    'List: a collection without an order takes whole shows, so ["loki"], not ["loki", 2]',
    'T: a timeline is already in the order listed, so it takes no "first"',
    "collection name \"Bad/Name\" can only use letters, digits, spaces and ' & : ; ( ) . , ! ? -",
    'Bad/Name: genre "Bad/Genre" can only use letters, digits, spaces, \' & and -',
    "Bad/Name has no entries",
    "Lost has no genres",
  ]);
});

test("each catalog's genres are the ones its collections use, alphabetically", () => {
  const cs = [
    { order: "release", genres: ["Sci-Fi", "Action"] },
    { order: "timeline", genres: ["Fantasy", "Action"] },
    { genres: ["Reality-TV"] },
  ];
  assert.deepEqual(genreNames(cs, "connected"), ["Action", "Fantasy", "Sci-Fi"]);
  assert.deepEqual(genreNames(cs, "other"), ["Reality-TV"]);
});

test("expandEntries takes movies, whole shows and single seasons, and holds back what isn't out", () => {
  const { entries, problems, upcoming } = expandEntries(
    { name: "C", entries: [["loki"], ["iron-man"], ["doomsday"], ["wandavision", 1], ["wandavision", 4]] }, shows, movies, NOW);
  assert.deepEqual(entries.map(label), ["Loki 1", "Loki 2", "Iron Man", "WandaVision 1"]);
  assert.deepEqual(upcoming, ["Loki season 3", "Avengers: Doomsday"]);
  assert.deepEqual(problems, ["C: WandaVision has no season 4 on Cinemeta"]);
});

test("shows without episode dates or episodes still count once they've aired", () => {
  const { entries } = expandEntries({ name: "C", entries: [["old-show"], ["no-episodes"]] }, shows, movies, NOW);
  assert.deepEqual(entries.map((e) => [e.kind, label(e), e.date]), [
    ["season", "Old Show 1", "1966-01-01T00:00:00.000Z"],
    ["show", "No Episodes", "1999-01-01T00:00:00.000Z"],
  ]);
});

test("release order sorts movies and seasons by date; timeline keeps the config's order", () => {
  const { entries } = expandEntries({ name: "C", entries: [["loki", 2], ["wandavision", 1], ["iron-man"], ["loki", 1]] }, shows, movies, NOW);
  assert.deepEqual(arrange(entries, "release").map(label), ["Iron Man", "WandaVision 1", "Loki 1", "Loki 2"]);
  assert.deepEqual(arrange(entries, "timeline").map(label), ["Loki 2", "WandaVision 1", "Iron Man", "Loki 1"]);
  assert.deepEqual(arrange(entries, undefined, ["loki"]).map(label), ["Loki 1", "Loki 2", "Iron Man", "WandaVision 1"], "first goes ahead of the dates");
});

test("popularity ranks titles against their own kind and averages a collection's top titles", () => {
  const t = (imdb, popularity) => ({ imdb, popularity });
  const ranks = popularityRanks([
    [t("s1", { moviedb: 900, trakt: 10, SCM: 5 }), t("s2", { moviedb: 50, trakt: 30 }), t("s3", { moviedb: 1, trakt: 20 }), t("s4", {})],
    [t("m1", { moviedb: 5 }), t("m2", { moviedb: 1 })],
  ]);
  assert.deepEqual(Object.fromEntries(ranks), { s1: 0.5, s2: 0.75, s3: 0.25, s4: 0.5, m1: 1, m2: 0 },
    "ranks, so 900 is no better than first place; internal signals are ignored and no data counts as middling");
  const entries = [{ kind: "movie", movie: { imdb: "m1" } }, { kind: "season", show: { imdb: "s3" } }, { kind: "season", show: { imdb: "s3" } }];
  assert.equal(collectionPopularity(entries, ranks), 0.625, "each title counts once");
  assert.equal(collectionPopularity([], ranks), 0);
  const many = new Map([["a", 1], ["b", 1], ["c", 1], ["d", 1], ["e", 1], ["f", 0], ["g", 0]]);
  const big = [..."abcdefg"].map((imdb) => ({ kind: "movie", movie: { imdb } }));
  assert.equal(collectionPopularity(big, many), 1, "a long tail doesn't drag down its five biggest titles");
});

test("firstSentence keeps an entry's blurb short", () => {
  assert.equal(firstSentence("One thing. Another thing."), "One thing.");
  assert.equal(firstSentence("No full stop"), "No full stop");
  assert.equal(firstSentence(undefined), undefined);
});

test("a watch order lists each season and movie, each with a link and a blurb", () => {
  const c = { name: "C", order: "release", entries: [["loki"], ["iron-man"]] };
  const items = listItems(c, arranged(c));
  assert.deepEqual(items.map(({ title, url }) => [title, url]), [
    ["Iron Man", "stremio:///detail/movie/tt0371746"],
    ["Loki S1", "stremio:///detail/series/tt9140554?season=1"],
    ["Loki S2", "stremio:///detail/series/tt9140554?season=2"],
  ]);
  assert.equal(items[0].overview, "Iron Man (2008 movie). A billionaire builds a suit.");
  assert.equal(items[1].overview, "Season 1 of Loki (2021, 2 episodes). The god of mischief steps out of his brother's shadow.");
});

test("an Other collection lists each show and movie once, by release, opening the title", () => {
  const c = { name: "C", entries: [["loki"], ["wandavision"], ["iron-man"], ["no-episodes"]] };
  const items = listItems(c, arranged(c));
  assert.deepEqual(items.map(({ title, url }) => [title, url]), [
    ["No Episodes", "stremio:///detail/series/tt0070000"],
    ["Iron Man", "stremio:///detail/movie/tt0371746"],
    ["WandaVision", "stremio:///detail/series/tt9140560"],
    ["Loki", "stremio:///detail/series/tt9140554"],
  ]);
  assert.equal(items[3].overview, "Loki (2021–2023, 3 seasons). The god of mischief steps out of his brother's shadow.");
  assert.equal(items[0].overview, "No Episodes (1999–2004).");
});

test("titles that clash get their country, or just their year when they come from one or two countries", () => {
  const island = (imdb, country, year) => toShow(imdb, { name: "Love Island", country, releaseInfo: year, videos: [ep(imdb, 1, 1, `${year}-06-01T00:00:00.000Z`)] });
  const s = new Map([["uk", island("tt1", "United Kingdom", "2015")], ["fr", island("tt2", "France", "2020")], ["uk2", island("tt3", "United Kingdom", "2005")], ["loki", loki]]);
  const c = { name: "C", entries: [["uk"], ["fr"], ["uk2"], ["loki"]] };
  const items = listItems(c, arrange(expandEntries(c, s, movies, NOW).entries));
  assert.deepEqual(items.map((i) => i.title), ["Love Island (2005)", "Love Island (2015)", "Love Island (2020)", "Loki"]);
  const uk = listItems({ name: "C", entries: [["uk"], ["fr"]] }, arrange(expandEntries({ name: "C", entries: [["uk"], ["fr"]] }, s, movies, NOW).entries));
  assert.deepEqual(uk.map((i) => i.title), ["Love Island (UK)", "Love Island (France)"]);
  const de = island("tt4", "Germany", "2017"), fr2 = island("tt5", "France", "2021");
  const s3 = new Map([...s, ["de", de], ["fr2", fr2]]);
  const c3 = { name: "C", entries: [["uk"], ["fr"], ["de"], ["fr2"]] };
  assert.deepEqual(listItems(c3, arrange(expandEntries(c3, s3, movies, NOW).entries)).map((i) => i.title),
    ["Love Island (UK)", "Love Island (Germany)", "Love Island (France 2020)", "Love Island (France 2021)"], "three or more countries: countries, with years where one repeats");
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
  const c = { genres: ["Superhero", "Sci-Fi"], name: "Marvel", order: "timeline", description: "Heroes.", entries: [["iron-man"], ["loki", 1], ["wandavision", 1], ["loki", 2]] };
  const name = displayName(c);
  const p = toCollectionPreview(c, name, arranged(c), MANIFEST);
  assert.equal(p.id, "mscol-marvel-timeline");
  assert.equal(p.type, "collections");
  assert.equal(p.name, "Marvel (Timeline)");
  assert.equal(p.poster, ironMan.poster, "the first title's poster");
  assert.equal(p.releaseInfo, "2008–2023");
  assert.equal(p.description, `Heroes. ${TIMELINE_NOTE}`);
  assert.deepEqual(p.links.map((l) => `${l.category}: ${l.name}`), [
    "Genres: Superhero",
    "Genres: Sci-Fi",
    "Contents: 1 Movie",
    "Contents: 2 Series",
    "Contents: 3 Seasons",
    "Watch order: Iron Man",
    "Watch order: Loki S1",
    "Watch order: WandaVision S1",
    "Watch order: Loki S2",
  ]);
  assert.equal(p.links[0].url, "stremio:///discover/https%3A%2F%2Fexample.test%2Faddon%2Fmanifest.json/collections/connected?genre=Superhero");
  assert.equal(p.links[2].url, "stremio:///detail/collections/mscol-marvel-timeline", "contents chips stay on the collection");
  assert.ok(!toCollectionPreview(c, name, arranged(c)).links.some((l) => l.category === "Genres"), "no genre chips without the addon's URL");
});

test("an Other collection's poster lists titles, links genres to Other, and has no movie count without movies", () => {
  const c = { genres: ["Superhero"], name: "Every Marvel Series", entries: [["loki"], ["wandavision"]] };
  const p = toCollectionPreview(c, displayName(c), arranged(c), MANIFEST);
  assert.equal(p.name, "Every Marvel Series");
  assert.match(p.links[0].url, /\/collections\/other\?genre=Superhero$/);
  assert.deepEqual(p.links.slice(1).map((l) => `${l.category}: ${l.name}`), [
    "Contents: 2 Series",
    "Contents: 3 Seasons",
    "Titles: WandaVision",
    "Titles: Loki",
  ]);
});

test("the detail page lists the entries with blurbs, and each entry's stream is its link", () => {
  const c = { genres: ["G"], name: "C", order: "timeline", entries: [["loki", 1], ["iron-man"]] };
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

test("genreLink opens one of this addon's catalogs, filtered to the genre", () => {
  assert.equal(genreLink(MANIFEST, "other", "Reality-TV"), "stremio:///discover/https%3A%2F%2Fexample.test%2Faddon%2Fmanifest.json/collections/other?genre=Reality-TV");
});

test("catalogPaths writes every genre spelling, pages of 100, and the no-genre list", () => {
  assert.deepEqual(valueSpellings("Sci-Fi"), ["Sci-Fi"]);
  assert.deepEqual(valueSpellings("Crime & Drama"), ["Crime & Drama", "Crime+&+Drama", "Crime%20%26%20Drama", "Crime+%26+Drama"]);
  assert.ok(valueSpellings("Kids' Shows").includes("Kids%27%20Shows"), "strict encoding for ' ( ) too");
  const metas = Array.from({ length: 150 }, (_, i) => ({ id: `mscol-${i}` }));
  const files = catalogPaths("connected", "Sci-Fi", metas);
  assert.deepEqual(files.map((f) => f.rel), [
    "catalog/collections/connected/genre=Sci-Fi.json",
    "catalog/collections/connected/genre=Sci-Fi&skip=100.json",
  ]);
  assert.equal(files[0].metas.length, 100);
  assert.equal(files.at(-1).metas.length, 50);
  assert.deepEqual(catalogPaths("other", undefined, metas).map((f) => f.rel), [
    "catalog/collections/other.json",
    "catalog/collections/other/skip=100.json",
  ]);
});

test("manifest has Connected Storyline and Other, each with its own genres", () => {
  const m = buildManifest([{ order: "release", genres: ["Sci-Fi"] }, { genres: ["Reality-TV", "Romance"] }]);
  assert.deepEqual(m.types, ["collections"]);
  assert.deepEqual(m.resources, [
    "catalog",
    { name: "meta", types: ["collections"], idPrefixes: ["mscol-"] },
    { name: "stream", types: ["collections"], idPrefixes: ["mscol-"] },
  ]);
  assert.deepEqual(m.catalogs.map((c) => [c.type, c.id, c.name]), [
    ["collections", "connected", "Connected Storyline"],
    ["collections", "other", "Other"],
  ]);
  assert.deepEqual(m.catalogs[0].extra, [{ name: "genre", options: ["Sci-Fi"] }, { name: "skip" }], "not required, so it starts on None");
  assert.deepEqual(m.catalogs[1].genres, ["Reality-TV", "Romance"]);
});
