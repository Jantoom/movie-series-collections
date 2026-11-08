// Pure helpers: turning Cinemeta show data into collection posters and catalog files.
//
// There is one catalog, "Collections". Its genre filter picks a group (Superheroes,
// Sci-Fi, …), and each poster in a group is a collection. A collection's seasons are
// link chips, on its Discover side panel and on its detail page. Each chip is a
// stremio:///detail/series/<imdb>?season=<n> link, which Stremio turns into an in-app
// route that opens the real show on that season's tab, on web and desktop alike.
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
export const PAGE_SIZE = 100;   // Stremio asks for the next page with skip=100, 200, …

// The one sentence every chronological collection's description ends with.
export const CHRONOLOGICAL_NOTE = "Chronological collections follow the story's own timeline instead of air dates, so seasons can jump between shows and out of release order.";

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
 * the premiere date and episode count. Season 0 (specials) is left out.
 */
export function toShow(imdb, cm) {
  const seasons = new Map();
  for (const v of cm.videos ?? []) {
    if (!Number.isInteger(v.season) || v.season < 1) continue;
    const s = seasons.get(v.season) ?? { number: v.season, episodes: 0, premiere: undefined };
    s.episodes++;
    if (v.released && (!s.premiere || v.released < s.premiere)) s.premiere = v.released;
    seasons.set(v.season, s);
  }
  return {
    imdb,
    name: cm.name,
    poster: cm.poster?.replace("/poster/small/", "/poster/medium/"),
    background: cm.background,
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

/** One season as a link chip that opens the show on that season's tab. */
export function seasonLink({ show, season }) {
  return {
    name: `${show.name} · Season ${season.number}`,
    category: LINK_CATEGORY,
    url: `stremio:///detail/${TYPE}/${show.imdb}?season=${season.number}`,
  };
}

/**
 * The collection's poster, as a catalog item. The links travel with it, so Discover's
 * side panel lists the seasons as soon as the poster is selected.
 */
export function toCollectionPreview(collection, entries) {
  const [first] = entries;
  const shows = new Set(entries.map((e) => e.show.imdb)).size;
  return {
    id: collectionId(collection),
    type: TYPE,
    name: displayName(collection),
    poster: collection.poster ?? first?.show.poster,
    background: collection.background ?? first?.show.background,
    description: [
      collectionDescription(collection),
      `${entries.length} seasons of ${shows} series. Pick a season under "${LINK_CATEGORY}" to open that show on it.`,
    ].filter(Boolean).join("\n\n"),
    links: entries.map(seasonLink),
  };
}

/** The collection's detail page: the same poster and links, and no episodes of its own. */
export function toCollectionMeta(collection, entries) {
  return { ...toCollectionPreview(collection, entries), videos: [] };
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
 * Every file for one group: each genre spelling, each page of 100. Stremio sends
 * extras in manifest order, so the next page of a genre is "genre=X&skip=100". The
 * first group is also the catalog's no-genre default (the home-screen row).
 */
export function catalogPaths(group, metas, isDefault) {
  const dir = `catalog/${TYPE}/${CATALOG_ID}`;
  const files = [];
  for (let skip = 0; skip === 0 || skip < metas.length; skip += PAGE_SIZE) {
    const page = metas.slice(skip, skip + PAGE_SIZE);
    const skipPart = skip === 0 ? "" : `skip=${skip}`;
    for (const v of valueSpellings(group)) {
      files.push({ rel: `${dir}/genre=${v}${skipPart && `&${skipPart}`}.json`, metas: page });
    }
    if (isDefault) files.push({ rel: skip === 0 ? `${dir}.json` : `${dir}/${skipPart}.json`, metas: page });
  }
  return files;
}

// Bump when the manifest changes so installed copies refresh.
export function buildManifest(collections, version = "0.4.0") {
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
      // Not required, so the catalog also gets a home-screen row (the first group).
      extra: [{ name: "genre", options: groups }, { name: "skip" }],
      // Older clients (Stremio desktop v4) read these instead of `extra`.
      genres: groups,
      extraSupported: ["genre", "skip"],
    }],
    behaviorHints: { configurable: false, configurationRequired: false },
  };
}
