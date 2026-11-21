// The Cloudflare Worker in front of the built addon.
//
// Everything the build writes to ./dist is served as static assets, which Cloudflare
// serves without running this Worker at all (and doesn't bill as Worker requests). The
// Worker only runs when no file matches, which is:
//   - a show's stream request, which Stremio sends per episode (tt0903747:1:1). The build
//     writes one index per show (index/series/<imdb>.json) and this turns it into that
//     episode's streams, one per collection the show is in;
//   - a collection entry's stream (mscol-marvel-cinematic-universe-m3), from that
//     collection's index (index/collections/<id>.json), rather than a file per entry;
//   - a movie or show in no collection, or any other id: no streams;
//   - a configured install, whose URLs start with its settings
//     (/catalogs=storyline;links=storyline/manifest.json, see parseSettings): a trimmed
//     manifest, title streams for the chosen kinds of collection only, the install page
//     for Stremio's Configure button, and the same files as everyone else, with the
//     genre chips pointed at the configured install;
//   - anything else: 404.
import { CATALOGS, ID_PREFIX, TYPE, configureManifest, parseSettings } from "./lib.mjs";
import { streamCatalog, titleStream } from "./title-streams.mjs";

const STREAM = /^\/stream\/([^/]+)\/(.+)\.json$/;
const SHOW_EPISODE = /^(tt\d+)(?::(\d+):\d+)?$/;
// An entry's id is its collection's id, "-", then "m" or "s" (the movies or series season)
// and its number.
const ENTRY = /^(.+)-[ms]?\d+$/;
// Stremio's Configure button opens <install URL>/configure.
const CONFIGURE = /^\/configure(\.html)?\/?$/;
const CHIP = /(stremio:\/\/\/discover\/[^/"]+?)%2Fmanifest\.json\//g;
const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  // Collections change once a week, at the build.
  "cache-control": "public, max-age=3600",
};
const json = (data, status = 200) => new Response(typeof data === "string" ? data : JSON.stringify(data), { status, headers: HEADERS });
const notFound = () => json({ err: "Not found" }, 404);

/** One of the build's files, or undefined if there's none. */
async function asset(env, base, path, as = "json") {
  const res = await env.ASSETS.fetch(new URL(path, base));
  return res.ok ? res[as]() : undefined;
}

/** The streams for a stream request, or undefined if the path isn't one. */
async function streams(path, env, base) {
  const stream = path.match(STREAM);
  if (!stream) return undefined;
  const [, type, id] = stream;

  const entry = type === TYPE && id.startsWith(ID_PREFIX) && id.match(ENTRY);
  if (entry) {
    const index = await asset(env, base, `/index/${TYPE}/${entry[1]}.json`);
    const found = index?.streams[id];
    return found ? [found] : [];
  }
  // A movie in a collection is a static file; the Worker only reads it for a configured install.
  if (type === "movie" && /^tt\d+$/.test(id)) return (await asset(env, base, `/stream/movie/${id}.json`))?.streams ?? [];
  const episode = type === "series" && id.match(SHOW_EPISODE);
  if (!episode) return [];
  const [, imdb, season] = episode;
  const index = await asset(env, base, `/index/series/${imdb}.json`);
  return index?.collections.map((ref) => titleStream(ref, season === undefined ? undefined : Number(season))) ?? [];
}

async function configured(path, settings, segment, url, env) {
  if (path === "/manifest.json") return json(configureManifest(await asset(env, url, "/manifest.json"), settings));
  // Stremio's Configure button: the install page, which ticks the settings in its address.
  if (CONFIGURE.test(path)) return env.ASSETS.fetch(new URL("/", url));

  const found = await streams(path, env, url);
  if (found) {
    const kinds = new Set(CATALOGS.filter(({ id }) => settings.links.has(id)).map(({ name }) => name));
    const titles = /^\/stream\/(movie|series)\//.test(path);
    return json({ streams: titles ? found.filter((s) => kinds.has(streamCatalog(s))) : found });
  }
  if (!/^\/(catalog|meta)\//.test(path)) return notFound();
  const text = await asset(env, url, path, "text");
  if (text === undefined) return notFound();
  // Genre chips open Discover for the install they came from, named by its encoded
  // manifest URL (stremio:///discover/https%3A%2F%2F<site>%2Fmanifest.json/…).
  return json(text.replace(CHIP, `$1%2F${encodeURIComponent(segment)}%2Fmanifest.json/`));
}

export async function handle(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
  }
  const url = new URL(request.url);
  let path = url.pathname;
  try { path = decodeURIComponent(path); } catch { /* keep it as sent */ }

  const [, first, rest] = path.match(/^\/([^/]+)(\/.*)$/) ?? [];
  const settings = first && parseSettings(first);
  if (settings) return configured(rest, settings, first, url, env);
  if (CONFIGURE.test(path)) return env.ASSETS.fetch(new URL("/", url));

  const found = await streams(path, env, url);
  return found ? json({ streams: found }) : notFound();
}

export default { fetch: handle };
