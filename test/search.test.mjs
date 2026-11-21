import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSearchIndex, search, words } from "../src/search.mjs";

const all = new Set(["storyline", "franchise", "person", "studio", "other"]);
const index = buildSearchIndex([
  { id: "mcu", name: "Marvel Cinematic Universe", catalogs: ["storyline"], titles: [{ imdb: "tt1", name: "Iron Man" }, { imdb: "tt2", name: "Spider-Man: Homecoming" }] },
  { id: "every-marvel", name: "Every Marvel Movie", catalogs: ["franchise"], titles: [{ imdb: "tt1", name: "Iron Man" }, { imdb: "tt3", name: "Spider-Man" }] },
  { id: "ghibli", name: "Every Studio Ghibli Movie", catalogs: ["studio"], titles: [{ imdb: "tt4", name: "Spirited Away" }] },
  { id: "pokemon", name: "Pokémon", catalogs: ["franchise", "other"], titles: [] },
  { id: "spidey", name: "Spider-Man", catalogs: ["franchise"], titles: [{ imdb: "tt3", name: "Spider-Man" }] },
]);
const ids = (query, allowed = all) => search(index, query, { allowed, type: "collections" }).map((m) => m.id);

test("words are lower-case, without accents or punctuation", () => {
  assert.deepEqual(words("Pokémon: Spider-Man & Friends"), ["pokemon", "spider", "man", "friends"]);
});

test("finds collections by their names, whole words, starts of words, and typos", () => {
  assert.deepEqual(ids("marvel"), ["mcu", "every-marvel"], "best-loved first among equals");
  assert.deepEqual(ids("cinematic univ"), ["mcu"]);
  assert.deepEqual(ids("ghilbi"), ["ghibli"], "one typo");
  assert.deepEqual(ids("pokemon"), ["pokemon"], "accents don't matter");
  assert.deepEqual(ids("marvel ghibli"), [], "every word must match one name");
  assert.deepEqual(ids(""), []);
});

test("finds collections by the titles in them, below collections named for the search", () => {
  assert.deepEqual(ids("iron man"), ["mcu", "every-marvel"]);
  assert.deepEqual(ids("spirited"), ["ghibli"]);
  assert.deepEqual(ids("spider man"), ["spidey", "every-marvel", "mcu"], "a collection named for the search first, then a title that's the whole phrase");
  assert.deepEqual(ids("spiderman"), ["spidey", "mcu", "every-marvel"], "run-together words match; then watch orders before lists");
  assert.deepEqual(ids("man iron"), ["mcu", "every-marvel"], "words in any order");
});

test("only collections in the allowed catalogs, as catalog items", () => {
  assert.deepEqual(ids("marvel", new Set(["franchise"])), ["every-marvel"]);
  assert.deepEqual(ids("pokemon", new Set(["other"])), ["pokemon"], "any of its catalogs counts");
  assert.deepEqual(search(index, "ghibli", { allowed: all, type: "collections" })[0], { id: "ghibli", type: "collections", name: "Every Studio Ghibli Movie", poster: undefined, releaseInfo: undefined });
});
