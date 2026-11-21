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
//   - anything else: 404.
import { ID_PREFIX, TYPE } from "./lib.mjs";
import { titleStream } from "./title-streams.mjs";

const STREAM = /^\/stream\/([^/]+)\/(.+)\.json$/;
const SHOW_EPISODE = /^(tt\d+)(?::(\d+):\d+)?$/;
// An entry's id is its collection's id, "-", then "m" or "s" (the movies or series season)
// and its number.
const ENTRY = /^(.+)-[ms]?\d+$/;
const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  // Collections change once a week, at the build.
  "cache-control": "public, max-age=3600",
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });

/** One of the build's JSON files, or undefined if there's none. */
async function asset(env, base, path) {
  const res = await env.ASSETS.fetch(new URL(path, base));
  return res.ok ? res.json() : undefined;
}

export async function handle(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
  }
  const url = new URL(request.url);
  let path = url.pathname;
  try { path = decodeURIComponent(path); } catch { /* keep it as sent */ }
  const stream = path.match(STREAM);
  if (!stream) return json({ err: "Not found" }, 404);
  const [, type, id] = stream;

  const entry = type === TYPE && id.startsWith(ID_PREFIX) && id.match(ENTRY);
  if (entry) {
    const index = await asset(env, url, `/index/${TYPE}/${entry[1]}.json`);
    const found = index?.streams[id];
    return json({ streams: found ? [found] : [] });
  }

  const episode = type === "series" && id.match(SHOW_EPISODE);
  if (!episode) return json({ streams: [] });
  const [, imdb, season] = episode;
  const index = await asset(env, url, `/index/series/${imdb}.json`);
  if (!index) return json({ streams: [] });
  return json({ streams: index.collections.map((ref) => titleStream(ref, season === undefined ? undefined : Number(season))) });
}

export default { fetch: handle };
