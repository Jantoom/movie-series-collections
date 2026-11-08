import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATALOGS, TIMELINE_NOTE, arrange, buildManifest, catalogPaths, catalogsOf, collectionDescription, collectionId, collectionScore,
  collectionVideos, configProblems, displayName, entryStreams, expandEntries, firstSentence, genreLink, genreNames, idOf, listItems,
  sameTitle, titleScore, toCollectionMeta, toCollectionPreview, toMovie, toShow, valueSpellings, withFranchiseCopies, yearSpan,
} from "../src/lib.mjs";

const ep = (imdb, season, episode, released) => ({ id: `${imdb}:${season}:${episode}`, season, episode, released });
const loki = toShow("tt9140554", {
  name: "Loki",
  poster: "https://images.metahub.space/poster/small/tt9140554/img",
  background: "bg",
  description: "The god of mischief steps out of his brother's shadow. More follows.",
  releaseInfo: "2021–2023",
  imdbRating: "8.2",
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
  assert.equal(loki.rating, 8.2);
  assert.equal(noEpisodes.released, "1999-01-01T00:00:00.000Z", "a show's own start year stands in for its premiere");
  assert.equal(toShow("tt1", { name: "X", releaseInfo: "2025–" }).ongoing, true);
  assert.equal(toShow("tt1", { name: "X", status: "Continuing", releaseInfo: "2025" }).ongoing, true);
  assert.equal(ironMan.released, "2008-05-02T00:00:00.000Z");
  const zero = toShow("tt2", { name: "Z", releaseInfo: "2021–", videos: [ep("tt2", 1, 1, "1970-01-01T00:00:00.000Z"), ep("tt2", 1, 2, "2021-05-01T00:00:00.000Z")] });
  assert.equal(zero.seasons.get(1).premiere, "2021-05-01T00:00:00.000Z", "Cinemeta's zero timestamp means no date");
});

test("watch orders go in Storyline; lists go where their catalogs say, or Other", () => {
  assert.deepEqual(CATALOGS.map((c) => c.name), ["Storyline", "Franchise", "Person", "Studio", "Other"]);
  assert.deepEqual(catalogsOf({ order: "release" }), ["storyline"]);
  assert.deepEqual(catalogsOf({ order: "timeline" }), ["storyline"]);
  assert.deepEqual(catalogsOf({ catalogs: ["franchise", "studio"] }), ["franchise", "studio"]);
  assert.deepEqual(catalogsOf({}), ["other"]);
});

test("names: a timeline is marked, everything else keeps its own name", () => {
  assert.equal(displayName({ name: "Star Wars", order: "release" }), "Star Wars");
  assert.equal(displayName({ name: "Star Wars", order: "timeline" }), "Star Wars (Timeline)");
  assert.equal(displayName({ name: "Love Island" }), "Love Island");
  assert.equal(collectionId("Star Wars (Timeline)"), "mscol-star-wars-timeline");
  assert.equal(collectionId("Pokémon"), "mscol-pokemon");
  assert.equal(collectionId("Sony's Spider-Man Universe"), "mscol-sony-s-spider-man-universe");
  assert.equal(idOf({ name: "Star Wars", order: "timeline" }), "mscol-star-wars-timeline");
  assert.equal(idOf({ name: "Star Wars", id: "mscol-franchise-star-wars" }), "mscol-franchise-star-wars");
});

test("only timelines add the standard sentence", () => {
  assert.equal(TIMELINE_NOTE, "This collection follows the story's timeline instead of release order.");
  assert.equal(collectionDescription({ description: "The saga.", order: "timeline" }), `The saga. ${TIMELINE_NOTE}`);
  assert.equal(collectionDescription({ description: "The saga.", order: "release" }), "The saga.");
  assert.equal(collectionDescription({ name: "X" }), undefined);
});

test("big release orders get a Franchise copy of their titles, with any extras", () => {
  const four = [["a"], ["b", 1], ["b", 2], ["c"], ["d"]];
  const out = withFranchiseCopies([
    { name: "Saga", genres: ["G"], order: "release", description: "D.", entries: four },
    { name: "Saga", genres: ["G"], order: "timeline", entries: four },
    { name: "Small", genres: ["G"], order: "release", entries: [["a"], ["b"], ["c"]] },
    { name: "Reboots", genres: ["G"], order: "release", franchise: { name: "Every Reboot", extra: [["z"]], description: "All." }, entries: [["a"], ["b"], ["c"]] },
    { name: "Out", genres: ["G"], order: "release", franchise: false, entries: four },
  ]);
  assert.deepEqual(out.slice(5).map((c) => [c.name, c.id, c.catalogs, c.description, c.entries]), [
    ["Saga", "mscol-franchise-saga", ["franchise"], "D.", [["a"], ["b"], ["c"], ["d"]]],
    ["Every Reboot", "mscol-franchise-every-reboot", ["franchise"], "All.", [["a"], ["b"], ["c"], ["z"]]],
  ], "only release orders over 3 titles (extras count), each title once; timelines and opt-outs get none");
});

test("configProblems catches unknown titles, bad seasons, names, genres, catalogs and order", () => {
  const s = { loki: { imdb: "tt9140554", name: "Loki" } };
  const m = { "iron-man": { imdb: "tt0371746", name: "Iron Man" } };
  assert.deepEqual(configProblems(s, m, withFranchiseCopies([
    { genres: ["Action"], name: "Fine (Unofficial)", order: "release", entries: [["loki"], ["loki", 2], ["iron-man"]] },
    { genres: ["Action", "Sci-Fi"], name: "Fine (Unofficial)", order: "timeline", entries: [["loki"]] },
    { genres: ["Reality-TV"], name: "Are You the One?", catalogs: ["franchise", "person"], entries: [["loki"], ["iron-man"]] },
    { genres: ["G"], name: "Fine (Unofficial)", id: "mscol-franchise-fine", catalogs: ["franchise"], entries: [["loki"]] },
  ])), []);
  assert.deepEqual(configProblems({ ...s, "iron-man": {} }, m, [
    { genres: ["G"], name: "A", order: "release", franchise: { extra: [["ghost"]] }, entries: [["loki"]] },
    { genres: ["G"], name: "A", order: "random", entries: [["thor"], ["loki", 0], ["iron-man", 1]] },
    { genres: ["G"], name: "List", catalogs: ["games"], entries: [["loki", 2]] },
    { genres: ["G"], name: "T", order: "timeline", catalogs: ["franchise"], franchise: false, entries: [["loki"]] },
    { genres: ["Bad/Genre"], name: "Bad/Name", entries: [] },
    { name: "Lost", entries: [["loki"]] },
  ]), [
    '"iron-man" is both a show and a movie; keys must be unique',
    'A (franchise): no show or movie called "ghost"',
    'collection "A" is used twice',
    'A: order must be "release", "timeline" or left out, not "random"',
    'A: no show or movie called "thor"',
    'A: "loki" season must be a whole number from 1, not 0',
    'A: "iron-man" is a movie, so it takes no season',
    "List: catalogs must be some of franchise, person, studio, other",
    'List: a collection without an order takes whole shows, so ["loki"], not ["loki", 2]',
    'T: a watch order is always in Storyline, so it takes no "catalogs"',
    'T: only a release-order watch order has a Franchise copy, so it takes no "franchise"',
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
    { catalogs: ["franchise", "studio"], genres: ["Animation"] },
  ];
  assert.deepEqual(genreNames(cs, "storyline"), ["Action", "Fantasy", "Sci-Fi"]);
  assert.deepEqual(genreNames(cs, "other"), ["Reality-TV"]);
  assert.deepEqual(genreNames(cs, "studio"), ["Animation"]);
  assert.deepEqual(genreNames(cs, "person"), []);
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

test("release order sorts by date, a timeline keeps the config's order, a list goes newest title first", () => {
  const { entries } = expandEntries({ name: "C", entries: [["loki", 2], ["wandavision", 1], ["iron-man"], ["loki", 1]] }, shows, movies, NOW);
  assert.deepEqual(arrange(entries, "release").map(label), ["Iron Man", "WandaVision 1", "Loki 1", "Loki 2"]);
  assert.deepEqual(arrange(entries, "timeline").map(label), ["Loki 2", "WandaVision 1", "Iron Man", "Loki 1"]);
  assert.deepEqual(arrange(entries).map(label), ["Loki 1", "Loki 2", "WandaVision 1", "Iron Man"], "by each title's first release");
});

test("a title scores its rating weighted by votes; a collection averages its five best", () => {
  assert.equal(titleScore({ rating: 8, votes: 999 }), 24);
  assert.equal(titleScore({ rating: 8 }), 8 * Math.log10(1001), "no vote count counts as a thousand");
  assert.equal(titleScore(), 0);
  assert.ok(titleScore({ rating: 7.4, votes: 900000 }) > titleScore({ rating: 8.6, votes: 20000 }), "a well-loved hit beats a beloved obscurity");
  const scores = new Map([["m1", 40], ["s1", 20]]);
  const entries = [{ kind: "movie", movie: { imdb: "m1" } }, { kind: "season", show: { imdb: "s1" } }, { kind: "season", show: { imdb: "s1" } }];
  assert.equal(collectionScore(entries, scores), 30, "each title counts once");
  assert.equal(collectionScore([], scores), 0);
  const many = new Map([["a", 9], ["b", 9], ["c", 9], ["d", 9], ["e", 9], ["f", 0], ["g", 0]]);
  assert.equal(collectionScore([..."abcdefg"].map((imdb) => ({ kind: "movie", movie: { imdb } })), many), 9, "a long tail doesn't drag down its five best");
});

test("firstSentence keeps an entry's blurb short", () => {
  assert.equal(firstSentence("One thing. Another thing."), "One thing.");
  assert.equal(firstSentence("No full stop"), "No full stop");
  assert.equal(firstSentence(undefined), undefined);
});

test("a watch order lists each season and movie, each with a link and a blurb", () => {
  const c = { name: "C", order: "release", entries: [["loki"], ["iron-man"]] };
  const items = listItems(c, arranged(c));
  assert.deepEqual(items.map(({ kind, title, url }) => [kind, title, url]), [
    ["movie", "Iron Man", "stremio:///detail/movie/tt0371746"],
    ["series", "Loki S1", "stremio:///detail/series/tt9140554?season=1"],
    ["series", "Loki S2", "stremio:///detail/series/tt9140554?season=2"],
  ]);
  assert.equal(items[0].overview, "Iron Man (2008 movie). A billionaire builds a suit.");
  assert.equal(items[1].overview, "Season 1 of Loki (2021, 2 episodes). The god of mischief steps out of his brother's shadow.");
});

test("a list has each show and movie once, newest first, opening the title", () => {
  const c = { name: "C", entries: [["loki"], ["wandavision"], ["iron-man"], ["no-episodes"]] };
  const items = listItems(c, arranged(c));
  assert.deepEqual(items.map(({ title, url }) => [title, url]), [
    ["Loki", "stremio:///detail/series/tt9140554"],
    ["WandaVision", "stremio:///detail/series/tt9140560"],
    ["Iron Man", "stremio:///detail/movie/tt0371746"],
    ["No Episodes", "stremio:///detail/series/tt0070000"],
  ]);
  assert.equal(items[0].overview, "Loki (2021–2023, 3 seasons). The god of mischief steps out of his brother's shadow.");
  assert.equal(items[3].overview, "No Episodes (1999–2004).");
});

test("titles that clash get their country, or just their year when they come from one or two countries", () => {
  const island = (imdb, country, year) => toShow(imdb, { name: "Love Island", country, releaseInfo: year, videos: [ep(imdb, 1, 1, `${year}-06-01T00:00:00.000Z`)] });
  const s = new Map([["uk", island("tt1", "United Kingdom", "2015")], ["fr", island("tt2", "France", "2020")], ["uk2", island("tt3", "United Kingdom", "2005")], ["loki", loki]]);
  const titles = (entries, from = s) => { const c = { name: "C", entries }; return listItems(c, arrange(expandEntries(c, from, movies, NOW).entries)).map((i) => i.title); };
  assert.deepEqual(titles([["uk"], ["fr"], ["uk2"], ["loki"]]), ["Loki", "Love Island (2020)", "Love Island (2015)", "Love Island (2005)"]);
  assert.deepEqual(titles([["uk"], ["fr"]]), ["Love Island (France)", "Love Island (UK)"]);
  const s3 = new Map([...s, ["de", island("tt4", "Germany", "2017")], ["fr2", island("tt5", "France", "2021")]]);
  assert.deepEqual(titles([["uk"], ["fr"], ["de"], ["fr2"]], s3),
    ["Love Island (France 2021)", "Love Island (France 2020)", "Love Island (Germany)", "Love Island (UK)"], "three or more countries: countries, with years where one repeats");
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
  const p = toCollectionPreview(c, arranged(c), MANIFEST);
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
  assert.equal(p.links[0].url, "stremio:///discover/https%3A%2F%2Fexample.test%2Faddon%2Fmanifest.json/collections/storyline?genre=Superhero");
  assert.equal(p.links[2].url, "stremio:///detail/collections/mscol-marvel-timeline", "contents chips stay on the collection");
  assert.ok(!toCollectionPreview(c, arranged(c)).links.some((l) => l.category === "Genres"), "no genre chips without the addon's URL");
});

test("a list's poster is its newest title's, and its genres open its first catalog", () => {
  const c = { genres: ["Superhero"], name: "Every Marvel Series", catalogs: ["franchise", "studio"], entries: [["wandavision"], ["loki"]] };
  const p = toCollectionPreview(c, arranged(c), MANIFEST);
  assert.equal(p.name, "Every Marvel Series");
  assert.equal(p.poster, loki.poster);
  assert.match(p.links[0].url, /\/collections\/franchise\?genre=Superhero$/);
  assert.deepEqual(p.links.slice(1).map((l) => `${l.category}: ${l.name}`), [
    "Contents: 2 Series",
    "Contents: 3 Seasons",
    "Titles: Loki",
    "Titles: WandaVision",
  ]);
});

test("the detail page has everything in season 1, then movies and series apart; each episode's stream is its link", () => {
  const c = { genres: ["G"], name: "C", order: "timeline", entries: [["loki", 1], ["iron-man"]] };
  const meta = toCollectionMeta(c, arranged(c), MANIFEST);
  assert.deepEqual(meta.videos.map((v) => [v.id, v.title, v.season, v.episode]), [
    ["mscol-c-timeline-1", "Loki S1", 1, 1],
    ["mscol-c-timeline-2", "Iron Man", 1, 2],
    ["mscol-c-timeline-m1", "Iron Man", 2, 1],
    ["mscol-c-timeline-s1", "Loki S1", 3, 1],
  ]);
  assert.match(meta.videos[0].overview, /^Season 1 of Loki/);
  assert.deepEqual(entryStreams(c, arranged(c)).map(({ id, streams }) => [id, streams[0].title, streams[0].externalUrl]), [
    ["mscol-c-timeline-1", "Open Loki S1", "stremio:///detail/series/tt9140554?season=1"],
    ["mscol-c-timeline-2", "Open Iron Man", "stremio:///detail/movie/tt0371746"],
    ["mscol-c-timeline-m1", "Open Iron Man", "stremio:///detail/movie/tt0371746"],
    ["mscol-c-timeline-s1", "Open Loki S1", "stremio:///detail/series/tt9140554?season=1"],
  ]);
  assert.equal(entryStreams(c, arranged(c))[0].streams[0].name, "Movie & Series Collections");
  const seriesOnly = { genres: ["G"], name: "S", entries: [["loki"], ["wandavision"]] };
  assert.deepEqual(collectionVideos(seriesOnly, arranged(seriesOnly)).map((v) => v.season), [1, 1], "one kind of title: just season 1");
});

test("genreLink opens one of this addon's catalogs, filtered to the genre", () => {
  assert.equal(genreLink(MANIFEST, "other", "Reality-TV"), "stremio:///discover/https%3A%2F%2Fexample.test%2Faddon%2Fmanifest.json/collections/other?genre=Reality-TV");
});

test("catalogPaths writes every genre spelling, pages of 100, and the no-genre list", () => {
  assert.deepEqual(valueSpellings("Sci-Fi"), ["Sci-Fi"]);
  assert.deepEqual(valueSpellings("Crime & Drama"), ["Crime & Drama", "Crime+&+Drama", "Crime%20%26%20Drama", "Crime+%26+Drama"]);
  assert.ok(valueSpellings("Kids' Shows").includes("Kids%27%20Shows"), "strict encoding for ' ( ) too");
  const metas = Array.from({ length: 150 }, (_, i) => ({ id: `mscol-${i}` }));
  const files = catalogPaths("storyline", "Sci-Fi", metas);
  assert.deepEqual(files.map((f) => f.rel), [
    "catalog/collections/storyline/genre=Sci-Fi.json",
    "catalog/collections/storyline/genre=Sci-Fi&skip=100.json",
  ]);
  assert.equal(files[0].metas.length, 100);
  assert.equal(files.at(-1).metas.length, 50);
  assert.deepEqual(catalogPaths("other", undefined, metas).map((f) => f.rel), [
    "catalog/collections/other.json",
    "catalog/collections/other/skip=100.json",
  ]);
});

test("manifest has the five catalogs, each with its own genres", () => {
  const m = buildManifest([{ order: "release", genres: ["Sci-Fi"] }, { genres: ["Reality-TV", "Romance"] }, { catalogs: ["person"], genres: ["Drama"] }]);
  assert.deepEqual(m.types, ["collections"]);
  assert.deepEqual(m.resources, [
    "catalog",
    { name: "meta", types: ["collections"], idPrefixes: ["mscol-"] },
    { name: "stream", types: ["collections"], idPrefixes: ["mscol-"] },
  ]);
  assert.deepEqual(m.catalogs.map((c) => [c.type, c.id, c.name, c.genres]), [
    ["collections", "storyline", "Storyline", ["Sci-Fi"]],
    ["collections", "franchise", "Franchise", []],
    ["collections", "person", "Person", ["Drama"]],
    ["collections", "studio", "Studio", []],
    ["collections", "other", "Other", ["Reality-TV", "Romance"]],
  ]);
  assert.deepEqual(m.catalogs[0].extra, [{ name: "genre", options: ["Sci-Fi"] }, { name: "skip" }], "not required, so it starts on None");
});
