// The Worker, against a fake asset store.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handle } from "../src/worker.mjs";

const ref = (name, at) => ({ catalog: name === "Every Daredevil Series" ? "Franchise" : "Storyline", name, years: "2008–", of: 5, noun: name === "Every Daredevil Series" ? "titles" : "entries", at, url: `stremio:///detail/collections/${name}` });
const assets = {
  "/index/series/tt2.json": { collections: [ref("Marvel", { 1: 2, 2: 3 }), ref("Every Daredevil Series")] },
  "/index/collections/mscol-9-1-1.json": { streams: { "mscol-9-1-1-2": { name: "Link to Season" }, "mscol-9-1-1-m1": { name: "Link to Movie" } } },
};
const env = {
  ASSETS: {
    fetch: async (url) => {
      const data = assets[new URL(url).pathname];
      return data ? new Response(JSON.stringify(data)) : new Response("Not found", { status: 404 });
    },
  },
};
const get = async (path) => {
  const res = await handle(new Request(`https://addon.test${path}`), env);
  return { status: res.status, headers: res.headers, body: await res.json() };
};

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
