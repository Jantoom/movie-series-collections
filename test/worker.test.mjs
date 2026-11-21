// The Worker, against a fake asset store.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handle } from "../src/worker.mjs";
import { buildManifest } from "../src/lib.mjs";
import { buildSearchIndex } from "../src/search.mjs";

const ref = (name, at) => ({ catalog: name === "Every Daredevil Series" ? "Franchise" : "Storyline", name, years: "2008–", of: 5, noun: name === "Every Daredevil Series" ? "titles" : "entries", at, url: `stremio:///detail/collections/${name}` });
const assets = {
  "/index/series/tt2.json": { collections: [ref("Marvel", { 1: 2, 2: 3 }), ref("Every Daredevil Series")] },
  "/index/collections/mscol-9-1-1.json": { streams: { "mscol-9-1-1-2": { name: "Link to Season" }, "mscol-9-1-1-m1": { name: "Link to Movie" } } },
  "/stream/movie/tt5.json": { streams: [{ name: "Marvel", title: "Storyline\n#1 of 5" }, { name: "Every Marvel Movie", title: "Franchise\n9 titles" }] },
  "/manifest.json": buildManifest([{ order: "release", genres: ["Sci-Fi"] }, { genres: ["Drama"] }]),
  "/meta/collections/mscol-marvel.json": { meta: { links: [{ url: `stremio:///discover/${encodeURIComponent("https://addon.test/manifest.json")}/collections/storyline?genre=Sci-Fi` }] } },
  "/": "<!doctype html><title>Install</title>",
  "/index/search.json": buildSearchIndex([
    { id: "mscol-marvel", name: "Marvel", catalogs: ["storyline"], titles: [{ imdb: "tt5", name: "Iron Man" }] },
    { id: "mscol-love-island", name: "Love Island", catalogs: ["other"], titles: [] },
  ]),
};
// "Other" has 150 collections over two pages; the even ones are Reality-TV.
const shows = Array.from({ length: 150 }, (_, i) => ({ id: `c${i}`, links: [{ url: `stremio:///discover/${encodeURIComponent("https://addon.test/manifest.json")}/collections/other?genre=Romance` }] }));
assets["/catalog/collections/other/genre=All.json"] = { metas: shows.slice(0, 100) };
assets["/catalog/collections/other/genre=All&skip=100.json"] = { metas: shows.slice(100) };
assets["/index/genres.json"] = Object.fromEntries(shows.map((m, i) => [m.id, i % 2 ? ["Romance"] : ["Reality-TV", "Romance"]]));
const env = {
  ASSETS: {
    fetch: async (url) => {
      const data = assets[decodeURIComponent(new URL(url).pathname)];
      if (data === undefined) return new Response("Not found", { status: 404 });
      return new Response(typeof data === "string" ? data : JSON.stringify(data));
    },
  },
};
const get = async (path) => {
  const res = await handle(new Request(`https://addon.test${path}`), env);
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text.startsWith("<") ? text : JSON.parse(text) };
};
const SETTINGS = "catalogs=storyline;links=storyline";

test("a show's episode lists each collection the show is in, with that season's place", async () => {
  const { status, headers, body } = await get("/stream/series/tt2:2:5.json");
  assert.equal(status, 200);
  assert.equal(headers.get("access-control-allow-origin"), "*");
  assert.deepEqual(body.streams.map((s) => [s.name, s.title, s.externalUrl]), [
    ["Marvel", "Storyline\n#3 of 5 · 2008–", "stremio:///detail/collections/Marvel"],
    ["Every Daredevil Series", "Franchise\n5 titles · 2008–", "stremio:///detail/collections/Every Daredevil Series"],
  ]);
});

test("a season the watch order doesn't have, or no season, shows the watch order's size", async () => {
  assert.equal((await get("/stream/series/tt2:7:1.json")).body.streams[0].title, "Storyline\n5 entries · 2008–");
  assert.equal((await get("/stream/series/tt2.json")).body.streams[0].title, "Storyline\n5 entries · 2008–");
});

test("an encoded id works the same", async () => {
  assert.equal((await get("/stream/series/tt2%3A1%3A1.json")).body.streams[0].title, "Storyline\n#2 of 5 · 2008–");
});

test("a collection entry's stream comes from its collection's index, even when the id has digits of its own", async () => {
  assert.deepEqual((await get("/stream/collections/mscol-9-1-1-2.json")).body, { streams: [{ name: "Link to Season" }] });
  assert.deepEqual((await get("/stream/collections/mscol-9-1-1-m1.json")).body, { streams: [{ name: "Link to Movie" }] });
  assert.deepEqual((await get("/stream/collections/mscol-9-1-1-9.json")).body, { streams: [] });
  assert.deepEqual((await get("/stream/collections/mscol-gone-1.json")).body, { streams: [] });
});

test("titles in no collection, and other ids, get no streams; other paths 404", async () => {
  assert.deepEqual((await get("/stream/series/tt9:1:1.json")).body, { streams: [] });
  assert.deepEqual((await get("/stream/movie/tt9.json")).body, { streams: [] }, "a movie in a collection is a static file, so a miss is a movie in none");
  assert.deepEqual((await get("/stream/series/kitsu:1:1.json")).body, { streams: [] });
  assert.equal((await get("/nothing.json")).status, 404);
});

test("a configured install gets its trimmed manifest, and the install page for Configure", async () => {
  const { body } = await get(`/${SETTINGS}/manifest.json`);
  assert.deepEqual(body.catalogs.map((c) => c.id), ["storyline", "search"]);
  assert.equal((await get(`/${encodeURIComponent(SETTINGS)}/manifest.json`)).body.catalogs.length, 2, "encoded settings work the same");
  assert.match((await get(`/${SETTINGS}/configure`)).body, /<title>Install/);
  assert.match((await get("/configure")).body, /<title>Install/, "the plain install's Configure button too");
});

test("a configured install's title streams link only the chosen kinds of collection", async () => {
  assert.deepEqual((await get(`/${SETTINGS}/stream/movie/tt5.json`)).body.streams.map((s) => s.name), ["Marvel"]);
  assert.deepEqual((await get(`/${SETTINGS}/stream/series/tt2:1:1.json`)).body.streams.map((s) => s.name), ["Marvel"]);
  assert.deepEqual((await get("/catalogs=other;links=/stream/movie/tt5.json")).body, { streams: [] });
  assert.deepEqual((await get(`/${SETTINGS}/stream/collections/mscol-9-1-1-2.json`)).body, { streams: [{ name: "Link to Season" }] }, "a collection's entries are untouched");
});

test("a configured install's genre chips open Discover for that install", async () => {
  const { body } = await get(`/${SETTINGS}/meta/collections/mscol-marvel.json`);
  assert.equal(body.meta.links[0].url, `stremio:///discover/${encodeURIComponent(`https://addon.test/${SETTINGS}/manifest.json`)}/collections/storyline?genre=Sci-Fi`);
  assert.equal((await get(`/${SETTINGS}/meta/collections/mscol-gone.json`)).status, 404);
  assert.equal((await get(`/${SETTINGS}/report.json`)).status, 404, "only the addon's own resources");
});

test("Search finds collections for every install, and only the chosen kinds for a configured one", async () => {
  assert.deepEqual((await get("/catalog/collections/search/search=iron%20man.json")).body.metas.map((m) => m.id), ["mscol-marvel"]);
  assert.deepEqual((await get("/catalog/collections/search/search=love.json")).body.metas.map((m) => m.id), ["mscol-love-island"]);
  assert.deepEqual((await get(`/${SETTINGS};search=storyline/catalog/collections/search/search=love.json`)).body.metas, [], "Other isn't searched");
  assert.deepEqual((await get(`/search=;links=/catalog/collections/search/search=marvel.json`)).body.metas, []);
});

test("a left-out genre takes its collections out of the catalog's pages, which stay full", async () => {
  const hide = "hide=other.Reality-TV";
  const first = (await get(`/${hide}/catalog/collections/other/genre=All.json`)).body.metas;
  assert.equal(first.length, 75, "the 75 that aren't Reality-TV, read across both built pages");
  assert.deepEqual([first[0].id, first.at(-1).id], ["c1", "c149"]);
  assert.match(first[0].links[0].url, new RegExp(encodeURIComponent(`/${hide}/manifest.json`)), "genre chips still point at the install");
  assert.deepEqual((await get(`/${hide}/catalog/collections/other/genre=All&skip=100.json`)).body.metas, []);
  assert.deepEqual((await get(`/${hide}/catalog/collections/other/genre=Reality-TV.json`)).body.metas, [], "the left-out genre itself is empty");
  assert.equal((await get(`/${SETTINGS}/catalog/collections/other/genre=All.json`)).body.metas.length, 100, "nothing left out: the built page as it is");
});

test("a plain catalog request is served from the built file at its canonical path, saving Cloudflare's redirect", async () => {
  const asked = [];
  const spy = { ASSETS: { fetch: async (req) => { asked.push(new URL(req.url ?? req).pathname); return new Response("{\"metas\":[]}"); } } };
  const res = await handle(new Request("https://addon.test/catalog/collections/storyline/genre=Sci-Fi&skip=100.json"), spy);
  assert.equal(res.status, 200);
  assert.deepEqual(asked, ["/catalog/collections/storyline/genre%3DSci-Fi%26skip%3D100.json"]);
});
