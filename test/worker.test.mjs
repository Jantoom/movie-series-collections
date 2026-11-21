// The Worker, against a fake asset store.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handle } from "../src/worker.mjs";
import { buildManifest } from "../src/lib.mjs";

const ref = (name, at) => ({ catalog: name === "Every Daredevil Series" ? "Franchise" : "Storyline", name, years: "2008–", of: 5, noun: name === "Every Daredevil Series" ? "titles" : "entries", at, url: `stremio:///detail/collections/${name}` });
const assets = {
  "/index/series/tt2.json": { collections: [ref("Marvel", { 1: 2, 2: 3 }), ref("Every Daredevil Series")] },
  "/index/collections/mscol-9-1-1.json": { streams: { "mscol-9-1-1-2": { name: "Link to Season" }, "mscol-9-1-1-m1": { name: "Link to Movie" } } },
  "/stream/movie/tt5.json": { streams: [{ name: "Collection\nStoryline", title: "Marvel" }, { name: "Collection\nFranchise", title: "Every Marvel Movie" }] },
  "/manifest.json": buildManifest([{ order: "release", genres: ["Sci-Fi"] }, { genres: ["Drama"] }]),
  "/meta/collections/mscol-marvel.json": { meta: { links: [{ url: `stremio:///discover/${encodeURIComponent("https://addon.test/manifest.json")}/collections/storyline?genre=Sci-Fi` }] } },
  "/": "<!doctype html><title>Install</title>",
};
const env = {
  ASSETS: {
    fetch: async (url) => {
      const data = assets[new URL(url).pathname];
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
    ["Collection\nStoryline", "Marvel\n#3 of 5 · 2008–", "stremio:///detail/collections/Marvel"],
    ["Collection\nFranchise", "Every Daredevil Series\n5 titles · 2008–", "stremio:///detail/collections/Every Daredevil Series"],
  ]);
});

test("a season the watch order doesn't have, or no season, shows the watch order's size", async () => {
  assert.equal((await get("/stream/series/tt2:7:1.json")).body.streams[0].title, "Marvel\n5 entries · 2008–");
  assert.equal((await get("/stream/series/tt2.json")).body.streams[0].title, "Marvel\n5 entries · 2008–");
});

test("an encoded id works the same", async () => {
  assert.equal((await get("/stream/series/tt2%3A1%3A1.json")).body.streams[0].title, "Marvel\n#2 of 5 · 2008–");
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
  assert.deepEqual(body.catalogs.map((c) => c.id), ["storyline"]);
  assert.equal((await get(`/${encodeURIComponent(SETTINGS)}/manifest.json`)).body.catalogs.length, 1, "encoded settings work the same");
  assert.match((await get(`/${SETTINGS}/configure`)).body, /<title>Install/);
  assert.match((await get("/configure")).body, /<title>Install/, "the plain install's Configure button too");
});

test("a configured install's title streams link only the chosen kinds of collection", async () => {
  assert.deepEqual((await get(`/${SETTINGS}/stream/movie/tt5.json`)).body.streams.map((s) => s.title), ["Marvel"]);
  assert.deepEqual((await get(`/${SETTINGS}/stream/series/tt2:1:1.json`)).body.streams.map((s) => s.title), ["Marvel\n#2 of 5 · 2008–"]);
  assert.deepEqual((await get("/catalogs=other;links=/stream/movie/tt5.json")).body, { streams: [] });
  assert.deepEqual((await get(`/${SETTINGS}/stream/collections/mscol-9-1-1-2.json`)).body, { streams: [{ name: "Link to Season" }] }, "a collection's entries are untouched");
});

test("a configured install's genre chips open Discover for that install", async () => {
  const { body } = await get(`/${SETTINGS}/meta/collections/mscol-marvel.json`);
  assert.equal(body.meta.links[0].url, `stremio:///discover/${encodeURIComponent(`https://addon.test/${SETTINGS}/manifest.json`)}/collections/storyline?genre=Sci-Fi`);
  assert.equal((await get(`/${SETTINGS}/meta/collections/mscol-gone.json`)).status, 404);
  assert.equal((await get(`/${SETTINGS}/report.json`)).status, 404, "only the addon's own resources");
});
