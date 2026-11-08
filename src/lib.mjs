// Pure helpers: turning Cinemeta show data into collection posters and catalog files.
//
// There is one catalog, "Collections". Its genre filter picks a group (Superheroes,
// Sci-Fi, …), and with no genre it lists every collection. Each poster is a collection.
// A collection's seasons are link chips, on its Discover side panel and on its detail
// page. Each chip is a stremio:///detail/series/<imdb>?season=<n> link, which Stremio
// turns into an in-app route that opens the real show on that season's tab, on web
// and desktop alike. The detail page also lists the seasons as its "episodes", to look
// through; those entries have no streams.
//
// Why not one poster per season: Stremio de-duplicates catalog items by id, and every
// season of a show has the show's id, so only the first season would survive. Why not
// stream links: Stremio 5 desktop opens those in the system browser.

export const TYPE = "series";
export const ADDON_NAME = "Series Collections";
export const CATALOG_ID = "collections";
export const CATALOG_NAME = "Collections";
export const ID_PREFIX = "sercol-";   // no ":" so the ids work as file names on Windows
export const LINK_CATEGORY = "Watch order";
export const GENRES_CATEGORY = "Genres";   // Stremio's own category, shown first like a show's genres
export const PAGE_SIZE = 100;   // Stremio asks for the next page with skip=100, 200, …

// The one sentence every chronological collection's description ends with.
export const CHRONOLOGICAL_NOTE = "This collection follows the story's timeline instead of release order.";

const fold = (s) => (s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

/** Whether Cinemeta's title is the show the config meant ("She Hulk" = "She-Hulk"). */
export function sameTitle(expected, actual) {
  const a = fold(expected);
  return a.length > 0 && a === fold(actual);
}

/** The poster's name: chronological collections say so, release order is the default. */
export const displayName = (c) => (c.order === "chronological" ? `${c.name} (Chronological)` : c.name);

/** "MCU (Chronological)" → "sercol-mcu-chronological". */
export const collectionId = (c) => `${ID_PREFIX}${displayName(c).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

/** The collection's description, with the chronological note where it applies. */
export function collectionDescription(c) {
  return [c.description, c.order === "chronological" && CHRONOLOGICAL_NOTE].filter(Boolean).join(" ") || undefined;
}

/** The groups in the genre filter, in the order collections first use them. */
export const groupNames = (collections) => [...new Set(collections.map((c) => c.group))];

// Group names are genre filter values and part of file names, so keep them plain.
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
    if (!PLAIN.test(c.group ?? "")) problems.push(`${c.name}: group "${c.group}" ${PLAIN_RULE}`);
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
 * the premiere date and episode count. Season 0 (specials) is left out. A show is
 * ongoing when Cinemeta says so or its years are open-ended ("2025–").
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

/** "release" sorts by each season's premiere; "chronological" keeps the config's order. */
export function arrange(entries, order = "release") {
  if (order === "chronological") return entries;
  return [...entries].sort((a, b) => a.season.premiere.localeCompare(b.season.premiere));
}

/** "Daredevil S2", as the season's chip and entry title. */
export const seasonTitle = ({ show, season }) => `${show.name} S${season.number}`;

/** One season as a link chip that opens the show on that season's tab. */
export function seasonLink(entry) {
  return {
    name: seasonTitle(entry),
    category: LINK_CATEGORY,
    url: `stremio:///detail/${TYPE}/${entry.show.imdb}?season=${entry.season.number}`,
  };
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
 * The series and season counts as genre chips. Stremio would point real `genres` at
 * Cinemeta's catalog, where they'd find nothing, so these are links to the collection's
 * own page instead.
 */
function countLinks(collection, entries) {
  const shows = new Set(entries.map((e) => e.show.imdb)).size;
  const url = `stremio:///detail/${TYPE}/${collectionId(collection)}`;
  return [
    { name: `${shows} Series`, category: GENRES_CATEGORY, url },
    { name: `${entries.length} Season${entries.length === 1 ? "" : "s"}`, category: GENRES_CATEGORY, url },
  ];
}

/**
 * The collection's poster, as a catalog item. The links travel with it, so Discover's
 * side panel lists the seasons as soon as the poster is selected.
 */
export function toCollectionPreview(collection, entries) {
  const [first] = entries;
  return {
    id: collectionId(collection),
    type: TYPE,
    name: displayName(collection),
    poster: collection.poster ?? first?.show.poster,
    background: collection.background ?? first?.show.background,
    releaseInfo: yearSpan(entries),
    description: collectionDescription(collection),
    links: [...countLinks(collection, entries), ...entries.map(seasonLink)],
  };
}

/**
 * The collection's detail page: the same poster and links, plus the seasons as one
 * long list of entries in its episode column. Entries have no streams; the chips are
 * what open a show.
 */
export function toCollectionMeta(collection, entries) {
  const id = collectionId(collection);
  return {
    ...toCollectionPreview(collection, entries),
    videos: entries.map((entry, i) => ({
      id: `${id}-${i + 1}`,
      title: seasonTitle(entry),
      season: 1,
      episode: i + 1,
      thumbnail: entry.show.background,
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
export function buildManifest(collections, version = "0.5.0") {
  const groups = groupNames(collections);
  return {
    id: "community.series-collections",
    version,
    name: ADDON_NAME,
    description: "TV series collections in watch order. Pick a group from Collections' genre filter, open a collection, then pick a season to open that show on it.",
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
