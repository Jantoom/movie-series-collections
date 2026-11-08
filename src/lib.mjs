// Pure helpers: turning Cinemeta show data into collection posters and catalog files.
//
// There is one catalog, "Collections". Its genre filter picks a group (Superheroes,
// Sci-Fi, …), and with no genre it lists every collection. Each poster is a collection,
// of one of two kinds:
//   - a watch order ("Release Order" or "Chronological"), listed season by season, each
//     a stremio:///detail/series/<imdb>?season=<n> link;
//   - a plain list of shows with no shared continuity, each a link to the show.
// Stremio turns those links into in-app routes on web and desktop alike. The links sit
// on the collection's Discover side panel and detail page; the detail page also lists
// them as entries in its episode column, to look through (entries have no streams).
//
// Why not one poster per season: Stremio de-duplicates catalog items by id, and every
// season of a show has the show's id, so only the first season would survive. Why not
// stream links: Stremio 5 desktop opens those in the system browser.

export const TYPE = "series";
export const ADDON_NAME = "Series Collections";
export const CATALOG_ID = "collections";
export const CATALOG_NAME = "Collections";
export const ID_PREFIX = "sercol-";   // no ":" so the ids work as file names on Windows
export const PAGE_SIZE = 100;   // Stremio asks for the next page with skip=100, 200, …

// Link chip headings on the side panel and detail page.
export const GENRES_CATEGORY = "Genres";       // the groups the collection is in
export const CONTENTS_CATEGORY = "Contents";   // "24 Series", "36 Seasons"
export const ORDER_CATEGORY = "Watch order";   // a watch order's seasons
export const SHOWS_CATEGORY = "Series";        // a plain list's shows

export const ORDERS = {
  release: { suffix: "Release Order" },
  chronological: { suffix: "Chronological", note: "This collection follows the story's timeline instead of release order." },
};
export const CHRONOLOGICAL_NOTE = ORDERS.chronological.note;

const fold = (s) => (s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

/** Whether Cinemeta's title is the show the config meant ("She Hulk" = "She-Hulk"). */
export function sameTitle(expected, actual) {
  const a = fold(expected);
  return a.length > 0 && a === fold(actual);
}

/** Watch-order collections say which order; plain lists keep their name. */
export const displayName = (c) => (ORDERS[c.order] ? `${c.name} (${ORDERS[c.order].suffix})` : c.name);

/** "Marvel Cinematic Universe (Chronological)" → "sercol-marvel-cinematic-universe-chronological". */
export const collectionId = (c) => `${ID_PREFIX}${displayName(c).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

/** The collection's description, with its order's note where it has one. */
export function collectionDescription(c) {
  return [c.description, ORDERS[c.order]?.note].filter(Boolean).join(" ") || undefined;
}

/** `group: "Sci-Fi"` or `group: ["Sci-Fi", "Fantasy"]`. */
export const groupsOf = (c) => [c.group].flat().filter((g) => g !== undefined);

/** The groups in the genre filter, in the order collections first use them. */
export const groupNames = (collections) => [...new Set(collections.flatMap(groupsOf))];

// Names and groups are genre values or part of file names, so keep them plain.
const PLAIN = /^[A-Za-z0-9][A-Za-z0-9 '&-]*$/;
const PLAIN_RULE = "can only use letters, digits, spaces, ' & and -";

/** Config mistakes the build should stop on, before fetching anything. */
export function configProblems(shows, collections) {
  const problems = [];
  const ids = new Set();
  for (const c of collections) {
    if (ids.has(collectionId(c))) problems.push(`collection "${displayName(c)}" is used twice`);
    ids.add(collectionId(c));
    if (!PLAIN.test(c.name ?? "")) problems.push(`collection name "${c.name}" ${PLAIN_RULE}`);
    if (!groupsOf(c).length) problems.push(`${c.name} has no group`);
    for (const g of groupsOf(c)) if (!PLAIN.test(g)) problems.push(`${c.name}: group "${g}" ${PLAIN_RULE}`);
    if (c.order !== undefined && !ORDERS[c.order]) problems.push(`${c.name}: order must be "release", "chronological" or left out, not "${c.order}"`);
    if (!c.seasons?.length) problems.push(`${c.name} has no seasons`);
    for (const [key, season] of c.seasons ?? []) {
      if (!shows[key]) problems.push(`${c.name}: no show called "${key}" in shows`);
      if (season === undefined) continue;
      if (!c.order) problems.push(`${c.name}: a list without an order takes whole shows, so ["${key}"], not ["${key}", ${JSON.stringify(season)}]`);
      else if (!(Number.isInteger(season) && season > 0)) problems.push(`${c.name}: "${key}" season must be a whole number from 1, not ${JSON.stringify(season)}`);
    }
  }
  return problems;
}

/**
 * Cinemeta's meta trimmed to what the addon uses. Seasons are keyed by number, with
 * the premiere and finale dates and episode count. Season 0 (specials) is left out. A
 * show is ongoing when Cinemeta says so or its years are open-ended ("2025–").
 */
export function toShow(imdb, cm) {
  const seasons = new Map();
  for (const v of cm.videos ?? []) {
    if (!Number.isInteger(v.season) || v.season < 1) continue;
    const s = seasons.get(v.season) ?? { number: v.season, episodes: 0, premiere: undefined, finale: undefined };
    s.episodes++;
    if (v.released && (!s.premiere || v.released < s.premiere)) s.premiere = v.released;
    if (v.released && (!s.finale || v.released > s.finale)) s.finale = v.released;
    seasons.set(v.season, s);
  }
  return {
    imdb,
    name: cm.name,
    poster: cm.poster?.replace("/poster/small/", "/poster/medium/"),
    background: cm.background,
    ongoing: cm.status === "Continuing" || /[–-]\s*$/.test(cm.releaseInfo ?? ""),
    seasons: new Map([...seasons].sort(([a], [b]) => a - b)),
  };
}

const aired = (season, now) => Boolean(season.premiere) && season.premiere <= now;

/**
 * A collection's seasons as { show, season } pairs. ["loki"] means every season that
 * has aired; ["loki", 2] means that one season. Seasons that haven't aired yet are
 * skipped (and listed), so they appear by themselves once a weekly build catches them.
 */
export function expandSeasons(collection, shows, now = new Date().toISOString()) {
  const entries = [], problems = [], upcoming = [];
  for (const [key, number] of collection.seasons) {
    const show = shows.get(key);
    const wanted = number === undefined ? [...show.seasons.values()] : [show.seasons.get(number)];
    if (number !== undefined && !wanted[0]) {
      problems.push(`${displayName(collection)}: ${show.name} has no season ${number} on Cinemeta`);
      continue;
    }
    for (const season of wanted) {
      if (aired(season, now)) entries.push({ show, season });
      else upcoming.push(`${show.name} season ${season.number}`);
    }
  }
  return { entries, problems, upcoming };
}

/** "release" and plain lists sort by premiere; "chronological" keeps the config's order. */
export function arrange(entries, order) {
  if (order === "chronological") return entries;
  return [...entries].sort((a, b) => a.season.premiere.localeCompare(b.season.premiere));
}

/**
 * What the collection lists, in order: each season for a watch order ("Daredevil S2",
 * opening that season's tab), each show once for a plain list ("Daredevil", opening
 * the show). `entries` must already be arranged.
 */
export function listItems(collection, entries) {
  if (collection.order) {
    return entries.map(({ show, season }) => ({
      title: `${show.name} S${season.number}`,
      url: `stremio:///detail/${TYPE}/${show.imdb}?season=${season.number}`,
      thumbnail: show.background,
    }));
  }
  const seen = new Set();
  return entries.filter(({ show }) => !seen.has(show.imdb) && seen.add(show.imdb)).map(({ show }) => ({
    title: show.name,
    url: `stremio:///detail/${TYPE}/${show.imdb}`,
    thumbnail: show.background,
  }));
}

/** "2015–2026", first premiere to last finale, or "2015–" while a show in it is still running. */
export function yearSpan(entries) {
  const year = (date) => Number.parseInt(date, 10);
  const starts = entries.map((e) => year(e.season.premiere)).filter(Boolean);
  const ends = entries.map((e) => year(e.season.finale)).filter(Boolean);
  if (!starts.length) return undefined;
  const first = Math.min(...starts), last = Math.max(...ends, ...starts);
  if (entries.some((e) => e.show.ongoing)) return `${first}–`;
  return first === last ? `${first}` : `${first}–${last}`;
}

/**
 * Discover, filtered to one group of this addon's Collections. Stremio matches the
 * installed addon by its manifest URL, so this needs the URL it was installed from.
 */
export const groupLink = (manifestUrl, group) =>
  `stremio:///discover/${encodeURIComponent(manifestUrl)}/${TYPE}/${CATALOG_ID}?genre=${encodeURIComponent(group)}`;

/**
 * Chips above the list: the groups the collection is in (each opening that group in
 * Discover, when the addon's URL is known), and how many series and seasons it holds
 * (which just point back at the collection).
 */
function headerLinks(collection, entries, manifestUrl) {
  const self = `stremio:///detail/${TYPE}/${collectionId(collection)}`;
  const shows = new Set(entries.map((e) => e.show.imdb)).size;
  const genres = manifestUrl ? groupsOf(collection).map((g) => ({ name: g, category: GENRES_CATEGORY, url: groupLink(manifestUrl, g) })) : [];
  return [
    ...genres,
    { name: `${shows} Series`, category: CONTENTS_CATEGORY, url: self },
    { name: `${entries.length} Season${entries.length === 1 ? "" : "s"}`, category: CONTENTS_CATEGORY, url: self },
  ];
}

/**
 * The collection's poster, as a catalog item. The links travel with it, so Discover's
 * side panel lists the seasons or shows as soon as the poster is selected.
 */
export function toCollectionPreview(collection, entries, manifestUrl) {
  const [first] = entries;
  const category = collection.order ? ORDER_CATEGORY : SHOWS_CATEGORY;
  return {
    id: collectionId(collection),
    type: TYPE,
    name: displayName(collection),
    poster: collection.poster ?? first?.show.poster,
    background: collection.background ?? first?.show.background,
    releaseInfo: yearSpan(entries),
    description: collectionDescription(collection),
    links: [
      ...headerLinks(collection, entries, manifestUrl),
      ...listItems(collection, entries).map(({ title, url }) => ({ name: title, category, url })),
    ],
  };
}

/**
 * The collection's detail page: the same poster and links, plus the list again as one
 * long run of entries in its episode column. Entries have no streams; the links are
 * what open a show.
 */
export function toCollectionMeta(collection, entries, manifestUrl) {
  const id = collectionId(collection);
  return {
    ...toCollectionPreview(collection, entries, manifestUrl),
    videos: listItems(collection, entries).map(({ title, thumbnail }, i) => ({
      id: `${id}-${i + 1}`,
      title,
      season: 1,
      episode: i + 1,
      thumbnail,
    })),
  };
}

/**
 * Static files can't parse query strings, so each request path must exist as a file.
 * Clients encode extra values differently and hosts may or may not decode the path,
 * so write every spelling ("Sci-Fi & Fantasy" as Sci-Fi%20%26%20Fantasy and so on).
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
 * Every file for one group, or for no genre at all (group undefined: every collection,
 * which is also the home-screen row): each genre spelling, each page of 100. Stremio
 * sends extras in manifest order, so the next page of a genre is "genre=X&skip=100".
 */
export function catalogPaths(group, metas) {
  const dir = `catalog/${TYPE}/${CATALOG_ID}`;
  const files = [];
  for (let skip = 0; skip === 0 || skip < metas.length; skip += PAGE_SIZE) {
    const page = metas.slice(skip, skip + PAGE_SIZE);
    const skipPart = skip === 0 ? "" : `skip=${skip}`;
    if (group === undefined) {
      files.push({ rel: skip === 0 ? `${dir}.json` : `${dir}/${skipPart}.json`, metas: page });
      continue;
    }
    for (const v of valueSpellings(group)) {
      files.push({ rel: `${dir}/genre=${v}${skipPart && `&${skipPart}`}.json`, metas: page });
    }
  }
  return files;
}

// Bump when the manifest changes so installed copies refresh.
export function buildManifest(collections, version = "0.6.0") {
  const groups = groupNames(collections);
  return {
    id: "community.series-collections",
    version,
    name: ADDON_NAME,
    description: "TV series collections: watch orders season by season, and lists of every show in a franchise. Pick a group from Collections' genre filter, open a collection, then pick a season or show.",
    resources: [
      "catalog",
      { name: "meta", types: [TYPE], idPrefixes: [ID_PREFIX] },
    ],
    types: [TYPE],
    idPrefixes: [ID_PREFIX],
    catalogs: [{
      type: TYPE,
      id: CATALOG_ID,
      name: CATALOG_NAME,
      // Not required, so the catalog also gets a home-screen row, and no genre lists
      // every collection. Stremio's dropdown then just reads "Genre".
      extra: [{ name: "genre", options: groups }, { name: "skip" }],
      // Older clients (Stremio desktop v4) read these instead of `extra`.
      genres: groups,
      extraSupported: ["genre", "skip"],
    }],
    behaviorHints: { configurable: false, configurationRequired: false },
  };
}
