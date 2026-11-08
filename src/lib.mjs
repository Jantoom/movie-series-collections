// Pure helpers: turning Cinemeta data into collection posters and the addon's files.
//
// The addon has its own type, "collections", so it gets its own Discover tab next to
// Movies and Series. That tab has one catalog, "Genre": with no genre picked it lists
// every collection, and each genre is a group (Superheroes, Sci-Fi, …). Each poster is
// a collection of movies and TV seasons, of one of three kinds:
//   - a release-order watch order ("Star Wars"), sorted by release date;
//   - a timeline watch order ("Star Wars (Timeline)"), kept in story order;
//   - a plain list with no shared continuity ("Every Marvel Series"), each title once.
// Each entry is a link: stremio:///detail/series/<imdb>?season=<n> for a season, or
// stremio:///detail/movie/<imdb> for a movie. Stremio turns those links into in-app
// routes on web and desktop alike. The links sit on the collection's Discover side panel
// and detail page; the detail page also lists the entries in its episode column, and
// each entry's one stream is the same link (desktop opens that one in the browser).
//
// Why not one poster per season: Stremio de-duplicates catalog items by id, and every
// season of a show has the show's id, so only the first season would survive.

export const TYPE = "collections";   // shows as "Collections" in Discover
export const ADDON_NAME = "Series Collections";
export const CATALOG_ID = "collections";
export const CATALOG_NAME = "Genre";
export const ID_PREFIX = "sercol-";   // no ":" so the ids work as file names on Windows
export const PAGE_SIZE = 100;   // Stremio asks for the next page with skip=100, 200, …

// Link chip headings on the side panel and detail page.
export const GENRES_CATEGORY = "Genres";       // the groups the collection is in
export const CONTENTS_CATEGORY = "Contents";   // "40 Movies", "24 Series", "36 Seasons"
export const ORDER_CATEGORY = "Watch order";   // a watch order's entries
export const LIST_CATEGORY = "Titles";         // a plain list's entries

export const TIMELINE_NOTE = "This collection follows the story's timeline instead of release order.";
export const ORDERS = ["release", "timeline"];

const fold = (s) => (s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

/** Whether Cinemeta's title is the one the config meant ("She Hulk" = "She-Hulk"). */
export function sameTitle(expected, actual) {
  const a = fold(expected);
  return a.length > 0 && a === fold(actual);
}

/** Which kinds of title a collection's entries are, from the config's tables. */
export function contentKinds(collection, shows, movies) {
  const keys = collection.entries.map(([key]) => key);
  return { movies: keys.some((k) => movies[k]), series: keys.some((k) => shows[k]) };
}

/**
 * The poster's name. Release order keeps the name, a timeline adds " (Timeline)", and
 * a plain list becomes "Every <name> Series", "Every <name> Movie" or
 * "Every <name> Movie and Series". `kinds` is contentKinds() for plain lists.
 */
export function displayName(c, kinds = {}) {
  if (c.order === "timeline") return `${c.name} (Timeline)`;
  if (c.order) return c.name;
  const what = kinds.movies && kinds.series ? "Movie and Series" : kinds.movies ? "Movie" : "Series";
  return `Every ${c.name} ${what}`;
}

/** "Star Wars (Timeline)" → "sercol-star-wars-timeline". */
export const collectionId = (name) => `${ID_PREFIX}${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

/** The collection's description, with the timeline note where it applies. */
export function collectionDescription(c) {
  return [c.description, c.order === "timeline" && TIMELINE_NOTE].filter(Boolean).join(" ") || undefined;
}

/** `group: "Sci-Fi"` or `group: ["Sci-Fi", "Fantasy"]`. */
export const groupsOf = (c) => [c.group].flat().filter((g) => g !== undefined);

/** The groups in the genre filter, in the order collections first use them. */
export const groupNames = (collections) => [...new Set(collections.flatMap(groupsOf))];

// Groups are genre values and part of file names, so keep them plain.
const PLAIN = /^[A-Za-z0-9][A-Za-z0-9 '&-]*$/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9 '&:().,!-]*$/;

/** Config mistakes the build should stop on, before fetching anything. */
export function configProblems(shows, movies, collections) {
  const problems = [];
  for (const key of Object.keys(shows)) if (movies[key]) problems.push(`"${key}" is both a show and a movie; keys must be unique`);
  const names = new Set();
  for (const c of collections) {
    const label = c.name ?? "(unnamed)";
    if (!NAME.test(c.name ?? "")) problems.push(`collection name "${c.name}" can only use letters, digits, spaces and ' & : ( ) . , ! -`);
    if (!groupsOf(c).length) problems.push(`${label} has no group`);
    for (const g of groupsOf(c)) if (!PLAIN.test(g)) problems.push(`${label}: group "${g}" can only use letters, digits, spaces, ' & and -`);
    if (c.order !== undefined && !ORDERS.includes(c.order)) problems.push(`${label}: order must be "release", "timeline" or left out, not "${c.order}"`);
    if (!c.entries?.length) { problems.push(`${label} has no entries`); continue; }
    const name = displayName(c, contentKinds(c, shows, movies));
    if (names.has(name)) problems.push(`collection "${name}" is used twice`);
    names.add(name);
    for (const [key, season] of c.entries) {
      if (!shows[key] && !movies[key]) problems.push(`${label}: no show or movie called "${key}"`);
      if (season === undefined) continue;
      if (movies[key]) problems.push(`${label}: "${key}" is a movie, so it takes no season`);
      else if (!c.order) problems.push(`${label}: a list without an order takes whole shows, so ["${key}"], not ["${key}", ${JSON.stringify(season)}]`);
      else if (!(Number.isInteger(season) && season > 0)) problems.push(`${label}: "${key}" season must be a whole number from 1, not ${JSON.stringify(season)}`);
    }
  }
  return problems;
}

/** The first sentence of a description, for an entry's short blurb. */
export function firstSentence(text) {
  const s = (text ?? "").trim().split(/(?<=[.!?])\s+/)[0];
  return s || undefined;
}

const poster = (cm) => cm.poster?.replace("/poster/small/", "/poster/medium/");

/**
 * A show from Cinemeta, trimmed to what the addon uses. Seasons are keyed by number,
 * with the premiere and finale dates and episode count. Season 0 (specials) is left
 * out. A show is ongoing when Cinemeta says so or its years are open-ended ("2025–").
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
    poster: poster(cm),
    background: cm.background,
    description: cm.description,
    releaseInfo: cm.releaseInfo,
    ongoing: cm.status === "Continuing" || /[–-]\s*$/.test(cm.releaseInfo ?? ""),
    seasons: new Map([...seasons].sort(([a], [b]) => a - b)),
  };
}

/** A movie from Cinemeta, trimmed to what the addon uses. */
export function toMovie(imdb, cm) {
  return { imdb, name: cm.name, poster: poster(cm), background: cm.background, description: cm.description, released: cm.released };
}

const isOut = (date, now) => Boolean(date) && date <= now;

/**
 * A collection's entries, as { kind: "season", show, season, date } and
 * { kind: "movie", movie, date }. ["loki"] means every season that has aired;
 * ["loki", 2] one season; ["iron-man"] a movie. Titles that aren't out yet are skipped
 * (and listed), so they appear by themselves once a weekly build catches them.
 */
export function expandEntries(collection, shows, movies, now = new Date().toISOString()) {
  const entries = [], problems = [], upcoming = [];
  for (const [key, number] of collection.entries) {
    const movie = movies.get(key);
    if (movie) {
      if (isOut(movie.released, now)) entries.push({ kind: "movie", movie, date: movie.released });
      else upcoming.push(movie.name);
      continue;
    }
    const show = shows.get(key);
    const wanted = number === undefined ? [...show.seasons.values()] : [show.seasons.get(number)];
    if (number !== undefined && !wanted[0]) {
      problems.push(`${collection.name}: ${show.name} has no season ${number} on Cinemeta`);
      continue;
    }
    for (const season of wanted) {
      if (isOut(season.premiere, now)) entries.push({ kind: "season", show, season, date: season.premiere });
      else upcoming.push(`${show.name} season ${season.number}`);
    }
  }
  return { entries, problems, upcoming };
}

/** "timeline" keeps the config's order; release order and plain lists sort by date. */
export function arrange(entries, order) {
  if (order === "timeline") return entries;
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

const year = (date) => Number.parseInt(date, 10) || undefined;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const span = (a, b) => (a === b || !b ? `${a}` : `${a}–${b}`);

/**
 * What the collection lists, in order. A watch order lists each season ("Daredevil S2",
 * opening that season's tab) and movie; a plain list lists each show and movie once.
 * Each item has a short blurb, shown when the entry is selected, so selecting it says
 * more than the collection's own description. `entries` must already be arranged.
 */
export function listItems(collection, entries) {
  const movieItem = ({ movie }) => ({
    title: movie.name,
    url: `stremio:///detail/movie/${movie.imdb}`,
    thumbnail: movie.background,
    overview: [`${movie.name} (${year(movie.released)} movie).`, firstSentence(movie.description)].filter(Boolean).join(" "),
  });
  if (collection.order) {
    return entries.map((e) => e.kind === "movie" ? movieItem(e) : {
      title: `${e.show.name} S${e.season.number}`,
      url: `stremio:///detail/series/${e.show.imdb}?season=${e.season.number}`,
      thumbnail: e.show.background,
      overview: [
        `Season ${e.season.number} of ${e.show.name} (${span(year(e.season.premiere), year(e.season.finale))}, ${plural(e.season.episodes, "episode")}).`,
        firstSentence(e.show.description),
      ].filter(Boolean).join(" "),
    });
  }
  const seen = new Set();
  return entries
    .filter((e) => {
      const id = e.kind === "movie" ? e.movie.imdb : e.show.imdb;
      return !seen.has(id) && seen.add(id);
    })
    .map((e) => e.kind === "movie" ? movieItem(e) : {
      title: e.show.name,
      url: `stremio:///detail/series/${e.show.imdb}`,
      thumbnail: e.show.background,
      overview: [
        `${e.show.name} (${e.show.releaseInfo}, ${plural(e.show.seasons.size, "season")}).`,
        firstSentence(e.show.description),
      ].filter(Boolean).join(" "),
    });
}

/** "2008–2026", first release to last, or "2008–" while a show in it is still running. */
export function yearSpan(entries) {
  const starts = entries.map((e) => year(e.date)).filter(Boolean);
  const ends = entries.map((e) => year(e.kind === "season" ? e.season.finale : e.date)).filter(Boolean);
  if (!starts.length) return undefined;
  const first = Math.min(...starts), last = Math.max(...ends, ...starts);
  if (entries.some((e) => e.kind === "season" && e.show.ongoing)) return `${first}–`;
  return span(first, last);
}

/**
 * Discover, filtered to one group of this addon's catalog. Stremio matches the
 * installed addon by its manifest URL, so this needs the URL it was installed from.
 */
export const groupLink = (manifestUrl, group) =>
  `stremio:///discover/${encodeURIComponent(manifestUrl)}/${TYPE}/${CATALOG_ID}?genre=${encodeURIComponent(group)}`;

/**
 * Chips above the list: the groups the collection is in (each opening that group in
 * Discover, when the addon's URL is known), then what it holds, movies first (each
 * just pointing back at the collection).
 */
function headerLinks(collection, name, entries, manifestUrl) {
  const self = `stremio:///detail/${TYPE}/${collectionId(name)}`;
  const movies = new Set(entries.filter((e) => e.kind === "movie").map((e) => e.movie.imdb)).size;
  const seasons = entries.filter((e) => e.kind === "season");
  const series = new Set(seasons.map((e) => e.show.imdb)).size;
  const genres = manifestUrl ? groupsOf(collection).map((g) => ({ name: g, category: GENRES_CATEGORY, url: groupLink(manifestUrl, g) })) : [];
  const contents = [
    movies && plural(movies, "Movie"),
    series && `${series} Series`,
    seasons.length && plural(seasons.length, "Season"),
  ].filter(Boolean).map((label) => ({ name: label, category: CONTENTS_CATEGORY, url: self }));
  return [...genres, ...contents];
}

/**
 * The collection's poster, as a catalog item. The links travel with it, so Discover's
 * side panel lists the entries as soon as the poster is selected. `name` is
 * displayName() for this collection.
 */
export function toCollectionPreview(collection, name, entries, manifestUrl) {
  const [first] = entries;
  const art = first && (first.kind === "movie" ? first.movie : first.show);
  const category = collection.order ? ORDER_CATEGORY : LIST_CATEGORY;
  return {
    id: collectionId(name),
    type: TYPE,
    name,
    poster: collection.poster ?? art?.poster,
    background: collection.background ?? art?.background,
    releaseInfo: yearSpan(entries),
    description: collectionDescription(collection),
    links: [
      ...headerLinks(collection, name, entries, manifestUrl),
      ...listItems(collection, entries).map(({ title, url }) => ({ name: title, category, url })),
    ],
  };
}

/** Each entry's id on the detail page and in its stream file. */
const entryId = (name, i) => `${collectionId(name)}-${i + 1}`;

/**
 * The collection's detail page: the same poster and links, plus the list again as one
 * long run of entries in its episode column, each with its blurb.
 */
export function toCollectionMeta(collection, name, entries, manifestUrl) {
  return {
    ...toCollectionPreview(collection, name, entries, manifestUrl),
    videos: listItems(collection, entries).map(({ title, thumbnail, overview }, i) => ({
      id: entryId(name, i),
      title,
      season: 1,
      episode: i + 1,
      thumbnail,
      overview,
    })),
  };
}

/**
 * Each entry's one stream: its link, as "Open …". Web follows it inside the app;
 * Stremio 5 desktop opens it in the system browser behind Stremio's warning page.
 */
export function entryStreams(collection, name, entries) {
  return listItems(collection, entries).map(({ title, url }, i) => ({
    id: entryId(name, i),
    streams: [{ name: ADDON_NAME, title: `Open ${title}`, externalUrl: url }],
  }));
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
export function buildManifest(collections, version = "0.7.0") {
  const groups = groupNames(collections);
  return {
    id: "community.series-collections",
    version,
    name: ADDON_NAME,
    description: "Collections of movies and TV series: watch orders, by release or by the story's timeline, and lists of every title in a franchise. Find them under Discover → Collections.",
    resources: [
      "catalog",
      { name: "meta", types: [TYPE], idPrefixes: [ID_PREFIX] },
      { name: "stream", types: [TYPE], idPrefixes: [ID_PREFIX] },
    ],
    types: [TYPE],
    idPrefixes: [ID_PREFIX],
    catalogs: [{
      type: TYPE,
      id: CATALOG_ID,
      name: CATALOG_NAME,
      // Not required, so the genre filter starts on "None", which lists every
      // collection, and the catalog also gets a home-screen row of all of them.
      extra: [{ name: "genre", options: groups }, { name: "skip" }],
      // Older clients (Stremio desktop v4) read these instead of `extra`.
      genres: groups,
      extraSupported: ["genre", "skip"],
    }],
    behaviorHints: { configurable: false, configurationRequired: false },
  };
}
