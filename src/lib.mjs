// Pure helpers: turning Cinemeta show data into season posters and catalog files.
//
// There is one catalog, "Collections", and its genre filter picks the collection. Each
// poster is one season of a show. The poster's id is the show's own IMDb id, so Stremio
// opens the real show page from Cinemeta, and its defaultVideoId is the season's first
// episode, so it lands on that episode's streams. Catalog posters navigate inside the
// app on web and desktop alike. Links in streams don't: the desktop app hands them to
// the system browser.

export const TYPE = "series";
export const ADDON_NAME = "Series Collections";
export const CATALOG_ID = "collections";
export const CATALOG_NAME = "Collections";
export const PAGE_SIZE = 100;   // Stremio asks for the next page with skip=100, 200, …

const fold = (s) => (s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

/** Whether Cinemeta's title is the show the config meant ("She Hulk" = "She-Hulk"). */
export function sameTitle(expected, actual) {
  const a = fold(expected);
  return a.length > 0 && a === fold(actual);
}

// The one sentence every chronological collection's description ends with.
export const CHRONOLOGICAL_NOTE = "Chronological collections follow the story's own timeline instead of air dates, so seasons can jump between shows and out of release order.";

/** The genre filter value: chronological collections say so, release order is the default. */
export const displayName = (c) => (c.order === "chronological" ? `${c.name} (Chronological)` : c.name);

/** The collection's description, with the chronological note where it applies. */
export function collectionDescription(c) {
  return [c.description, c.order === "chronological" && CHRONOLOGICAL_NOTE].filter(Boolean).join(" ") || undefined;
}

/** Config mistakes the build should stop on, before fetching anything. */
export function configProblems(shows, collections) {
  const problems = [];
  const names = new Set();
  for (const c of collections) {
    if (names.has(displayName(c))) problems.push(`collection "${displayName(c)}" is used twice`);
    names.add(displayName(c));
    // The name is the genre filter value and part of a file name, so keep it plain.
    if (!/^[A-Za-z0-9][A-Za-z0-9 '&-]*$/.test(c.name ?? "")) problems.push(`collection name "${c.name}" can only use letters, digits, spaces, ' & and -`);
    if (c.order && !["release", "chronological"].includes(c.order)) problems.push(`${c.name}: order must be "release" or "chronological", not "${c.order}"`);
    if (!c.seasons?.length) problems.push(`${c.name} has no seasons`);
    for (const [key, season] of c.seasons ?? []) {
      if (!shows[key]) problems.push(`${c.name}: no show called "${key}" in shows`);
      if (season !== undefined && !(Number.isInteger(season) && season > 0)) problems.push(`${c.name}: "${key}" season must be a whole number from 1, not ${JSON.stringify(season)}`);
    }
  }
  return problems;
}

/**
 * Cinemeta's meta trimmed to what the addon uses. Seasons are keyed by number, with
 * the first episode's video id (where the poster lands), the premiere date and the
 * episode count. Season 0 (specials) is left out.
 */
export function toShow(imdb, cm) {
  const seasons = new Map();
  for (const v of cm.videos ?? []) {
    if (!Number.isInteger(v.season) || v.season < 1) continue;
    const s = seasons.get(v.season) ?? { number: v.season, episodes: 0, first: v, premiere: undefined };
    s.episodes++;
    if (v.episode < s.first.episode) s.first = v;
    if (v.released && (!s.premiere || v.released < s.premiere)) s.premiere = v.released;
    seasons.set(v.season, s);
  }
  return {
    imdb,
    name: cm.name,
    poster: cm.poster?.replace("/poster/small/", "/poster/medium/"),
    background: cm.background,
    description: cm.description,
    seasons: new Map([...seasons].sort(([a], [b]) => a - b).map(([n, s]) => [n, { number: n, episodes: s.episodes, firstVideoId: s.first.id, premiere: s.premiere }])),
  };
}

const aired = (season, now) => Boolean(season.premiere) && season.premiere <= now;

/**
 * A collection's entries as { show, season } pairs. ["loki"] means every season that
 * has aired; ["loki", 2] means that one season. Seasons that haven't aired yet are
 * skipped (and listed), so they appear by themselves once a weekly build catches them.
 */
export function expandSeasons(collection, shows, now = new Date().toISOString()) {
  const entries = [], problems = [], upcoming = [];
  for (const [key, number] of collection.seasons) {
    const show = shows.get(key);
    const wanted = number === undefined ? [...show.seasons.values()] : [show.seasons.get(number)];
    if (number !== undefined && !wanted[0]) {
      problems.push(`${collection.name}: ${show.name} has no season ${number} on Cinemeta`);
      continue;
    }
    for (const season of wanted) {
      if (aired(season, now)) entries.push({ show, season });
      else upcoming.push(`${show.name} season ${season.number}`);
    }
  }
  return { entries, problems, upcoming };
}

/** "release" sorts by each season's premiere; "chronological" keeps the config's order. */
export function arrange(entries, order = "release") {
  if (order === "chronological") return entries;
  return [...entries].sort((a, b) => a.season.premiere.localeCompare(b.season.premiere));
}

/**
 * One season's poster. The season comes first in the name because the poster art is
 * the show's, and long titles get cut off at the end ("Season 1 · The Falcon and…").
 * Stremio has nowhere to show a genre's description, so the collection's goes on each
 * poster, where Discover's side panel shows it.
 */
export function toSeasonPreview({ show, season }, collection) {
  const episodes = `${season.episodes} episode${season.episodes === 1 ? "" : "s"}`;
  const about = collectionDescription(collection);
  return {
    id: show.imdb,
    type: TYPE,
    name: `Season ${season.number} · ${show.name}`,
    poster: show.poster,
    background: show.background,
    description: [
      `${show.name}, season ${season.number} (${episodes}).`,
      about && `${displayName(collection)}: ${about}`,
      show.description,
    ].filter(Boolean).join("\n\n"),
    behaviorHints: { defaultVideoId: season.firstVideoId },
  };
}

/**
 * Static files can't parse query strings, so each request path must exist as a file.
 * Clients encode extra values differently and hosts may or may not decode the path,
 * so write every spelling ("Star Trek" as Star%20Trek and Star+Trek).
 */
export function valueSpellings(value) {
  // encodeURIComponent leaves ( ) ' alone; stricter encoders (RFC 3986) don't.
  const strict = encodeURIComponent(value).replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
  return [...new Set([
    value,
    value.replace(/ /g, "+"),
    encodeURIComponent(value),
    encodeURIComponent(value).replace(/%20/g, "+"),
    strict,
    strict.replace(/%20/g, "+"),
  ])];
}

/**
 * Every file for one collection: each genre spelling, each page of 100. Stremio sends
 * extras in manifest order, so the next page of a genre is "genre=X&skip=100". The
 * first collection is also the catalog's no-genre default (the home-screen row).
 */
export function catalogPaths(collectionName, metas, isDefault) {
  const dir = `catalog/${TYPE}/${CATALOG_ID}`;
  const files = [];
  for (let skip = 0; skip === 0 || skip < metas.length; skip += PAGE_SIZE) {
    const page = metas.slice(skip, skip + PAGE_SIZE);
    const skipPart = skip === 0 ? "" : `skip=${skip}`;
    for (const v of valueSpellings(collectionName)) {
      files.push({ rel: `${dir}/genre=${v}${skipPart && `&${skipPart}`}.json`, metas: page });
    }
    if (isDefault) files.push({ rel: skip === 0 ? `${dir}.json` : `${dir}/${skipPart}.json`, metas: page });
  }
  return files;
}

// Bump when the manifest changes so installed copies refresh.
export function buildManifest(collections, version = "0.3.0") {
  const names = collections.map(displayName);
  return {
    id: "community.series-collections",
    version,
    name: ADDON_NAME,
    description: "TV series collections in watch order, as season posters. Pick a collection from Collections' genre filter; each poster opens that season of the show, with streams from your other addons.",
    // Catalogs only: the posters are the shows' own IMDb ids, so Cinemeta and your
    // stream addons handle everything after the click.
    resources: ["catalog"],
    types: [TYPE],
    catalogs: [{
      type: TYPE,
      id: CATALOG_ID,
      name: CATALOG_NAME,
      // Not required, so the catalog also gets a home-screen row (the first collection).
      extra: [{ name: "genre", options: names }, { name: "skip" }],
      // Older clients (Stremio desktop v4) read these instead of `extra`.
      genres: names,
      extraSupported: ["genre", "skip"],
    }],
    behaviorHints: { configurable: false, configurationRequired: false },
  };
}
