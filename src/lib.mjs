// Pure helpers: turning Cinemeta data into collection posters and the addon's files.
//
// The addon has its own type, "collections", so it gets its own Discover tab next to
// Movies and Series, with five catalogs:
//   - "Storyline": watch orders, whose entries tell one story. Release order ("Star
//     Wars") sorts by release date; a timeline ("Star Wars (Timeline)") keeps the story's
//     order.
//   - "Franchise", "Person", "Studio" and "Other": titles that share a franchise, a
//     director or personality, a studio, or something else, each listed once, newest
//     first. A collection can be in several of these. Big watch orders also get a copy
//     in Franchise, listing their titles.
// Each catalog's genre filter starts on "None", listing all of its collections, and each
// genre (Action, Sci-Fi, Reality-TV, …) narrows it.
//
// Each entry is a link: stremio:///detail/series/<imdb>?season=<n> for a season,
// stremio:///detail/series/<imdb> for a whole show, or stremio:///detail/movie/<imdb>.
// Stremio turns those links into in-app routes on web and desktop alike. The links sit
// on the collection's Discover side panel and detail page; the detail page also lists the
// entries in its episode column, and each entry's one stream is the same link (desktop
// opens that one in the browser).
//
// Why not one poster per season: Stremio de-duplicates catalog items by id, and every
// season of a show has the show's id, so only the first season would survive.

export const TYPE = "collections";   // shows as "Collections" in Discover
export const ADDON_NAME = "Movie & Series Collections";
export const ID_PREFIX = "mscol-";   // no ":" so the ids work as file names on Windows
export const PAGE_SIZE = 100;   // Stremio asks for the next page with skip=100, 200, …

export const CATALOGS = [
  { id: "storyline", name: "Storyline" },
  { id: "franchise", name: "Franchise" },
  { id: "person", name: "Person" },
  { id: "studio", name: "Studio" },
  { id: "other", name: "Other" },
];
/** The catalogs a collection without a watch order can name in `catalogs`. */
export const LIST_CATALOGS = ["franchise", "person", "studio", "other"];
/** Watch orders go in Storyline; everything else where its `catalogs` say, or Other. */
export const catalogsOf = (c) => (c.order ? ["storyline"] : c.catalogs ?? ["other"]);

// Link chip headings on the side panel and detail page.
export const GENRES_CATEGORY = "Genres";       // the collection's genres
export const CONTENTS_CATEGORY = "Contents";   // "40 Movies", "24 Series", "36 Seasons"
export const ORDER_CATEGORY = "Watch order";   // a watch order's entries
export const LIST_CATEGORY = "Titles";         // a list's entries

export const TIMELINE_NOTE = "This collection follows the story's timeline instead of release order.";
export const ORDERS = ["release", "timeline"];

// Letters and digits in any script, without accents ("Pokémon" = "pokemon", "МастерШеф" kept).
const fold = (s) => (s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]/gu, "");

/** Whether Cinemeta's title is the one the config meant ("She Hulk" = "She-Hulk"). */
export function sameTitle(expected, actual) {
  const a = fold(expected);
  return a.length > 0 && a === fold(actual);
}

/** The poster's name: a timeline adds " (Timeline)", everything else keeps its name. */
export const displayName = (c) => (c.order === "timeline" ? `${c.name} (Timeline)` : c.name);

/** "Star Wars (Timeline)" → "mscol-star-wars-timeline". */
export const collectionId = (name) =>
  `${ID_PREFIX}${name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

/** A collection's id: from its name, unless it has its own (a Franchise copy does). */
export const idOf = (c) => c.id ?? collectionId(displayName(c));

/** The collection's description, with the timeline note where it applies. */
export function collectionDescription(c) {
  return [c.description, c.order === "timeline" && TIMELINE_NOTE].filter(Boolean).join(" ") || undefined;
}

export const genresOf = (c) => c.genres ?? [];

/** The genres in one catalog's filter, alphabetically. */
export const genreNames = (collections, catalogId) =>
  [...new Set(collections.filter((c) => catalogsOf(c).includes(catalogId)).flatMap(genresOf))].sort();

/** Watch orders with more titles than this also get a copy in Franchise. */
export const FRANCHISE_COPY_OVER = 3;

/**
 * The collections plus a Franchise copy of each big release-order watch order, listing
 * its titles once each, so Franchise doesn't miss Wizarding World or Middle-earth. A
 * watch order opts out with `franchise: false`, or adds titles the story leaves out
 * (reboots, remakes) with `franchise: { extra: [[key], …] }`, and can rename it.
 */
export function withFranchiseCopies(collections) {
  const copies = [];
  for (const c of collections) {
    if (c.order !== "release" || c.franchise === false) continue;
    const keys = [...new Set([...c.entries, ...(c.franchise?.extra ?? [])].map(([k]) => k))];
    if (keys.length <= FRANCHISE_COPY_OVER) continue;
    const name = c.franchise?.name ?? c.name;
    copies.push({
      name,
      id: `${ID_PREFIX}franchise-${collectionId(name).slice(ID_PREFIX.length)}`,
      genres: c.genres,
      catalogs: ["franchise"],
      description: c.franchise?.description ?? c.description,
      entries: keys.map((k) => [k]),
    });
  }
  return [...collections, ...copies];
}

// Genres are filter values and part of file names, so keep them plain.
const PLAIN = /^[A-Za-z0-9][A-Za-z0-9 '&-]*$/;
const NAME = /^[\p{L}\p{N}][\p{L}\p{N} '&:;().,!?-]*$/u;

/** Config mistakes the build should stop on, before fetching anything. */
export function configProblems(shows, movies, collections) {
  const problems = [];
  for (const key of Object.keys(shows)) if (movies[key]) problems.push(`"${key}" is both a show and a movie; keys must be unique`);
  const ids = new Set();
  const known = (label, key) => shows[key] || movies[key] || problems.push(`${label}: no show or movie called "${key}"`);
  for (const c of collections) {
    const label = c.name ?? "(unnamed)";
    if (!NAME.test(c.name ?? "")) problems.push(`collection name "${c.name}" can only use letters, digits, spaces and ' & : ; ( ) . , ! ? -`);
    if (ids.has(idOf(c))) problems.push(`collection "${displayName(c)}" is used twice`);
    ids.add(idOf(c));
    if (!genresOf(c).length) problems.push(`${label} has no genres`);
    for (const g of genresOf(c)) if (!PLAIN.test(g)) problems.push(`${label}: genre "${g}" can only use letters, digits, spaces, ' & and -`);
    if (c.order !== undefined && !ORDERS.includes(c.order)) problems.push(`${label}: order must be "release", "timeline" or left out, not "${c.order}"`);
    if (c.order && c.catalogs) problems.push(`${label}: a watch order is always in Storyline, so it takes no "catalogs"`);
    if (!c.order && c.catalogs !== undefined && (!c.catalogs.length || c.catalogs.some((id) => !LIST_CATALOGS.includes(id)))) {
      problems.push(`${label}: catalogs must be some of ${LIST_CATALOGS.join(", ")}`);
    }
    if (c.franchise !== undefined && c.order !== "release") problems.push(`${label}: only a release-order watch order has a Franchise copy, so it takes no "franchise"`);
    for (const [key] of c.franchise?.extra ?? []) known(`${label} (franchise)`, key);
    if (!c.entries?.length) { problems.push(`${label} has no entries`); continue; }
    for (const [key, season] of c.entries) {
      known(label, key);
      if (season === undefined) continue;
      if (movies[key]) problems.push(`${label}: "${key}" is a movie, so it takes no season`);
      else if (!c.order) problems.push(`${label}: a collection without an order takes whole shows, so ["${key}"], not ["${key}", ${JSON.stringify(season)}]`);
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

// Cinemeta stands in 1970-01-01 (a zero timestamp) for dates it doesn't have.
const dated = (date) => (date && !date.startsWith("1970-01-01") ? date : undefined);
const poster = (cm) => cm.poster?.replace("/poster/small/", "/poster/medium/");
const rating = (cm) => Number.parseFloat(cm.imdbRating) || undefined;

/**
 * A show from Cinemeta, trimmed to what the addon uses. Seasons are keyed by number,
 * with the premiere and finale dates and episode count. Season 0 (specials) is left
 * out. A show is ongoing when Cinemeta says so or its years are open-ended ("2025–").
 * `released` is the show's own premiere, for shows Cinemeta has no episodes for.
 */
export function toShow(imdb, cm) {
  const seasons = new Map();
  for (const v of cm.videos ?? []) {
    if (!Number.isInteger(v.season) || v.season < 1) continue;
    const s = seasons.get(v.season) ?? { number: v.season, episodes: 0, premiere: undefined, finale: undefined };
    s.episodes++;
    const released = dated(v.released);
    if (released && (!s.premiere || released < s.premiere)) s.premiere = released;
    if (released && (!s.finale || released > s.finale)) s.finale = released;
    seasons.set(v.season, s);
  }
  const startYear = Number.parseInt(cm.releaseInfo ?? cm.year, 10);
  return {
    imdb,
    name: cm.name,
    poster: poster(cm),
    background: cm.background,
    description: cm.description,
    releaseInfo: cm.releaseInfo ?? cm.year,
    released: dated(cm.released) ?? (startYear ? `${startYear}-01-01T00:00:00.000Z` : undefined),
    ongoing: cm.status === "Continuing" || /[–-]\s*$/.test(cm.releaseInfo ?? ""),
    seasons: new Map([...seasons].sort(([a], [b]) => a - b)),
    country: cm.country,
    rating: rating(cm),
  };
}

/** A movie from Cinemeta, trimmed to what the addon uses. */
export function toMovie(imdb, cm) {
  return {
    imdb, name: cm.name, poster: poster(cm), background: cm.background, description: cm.description, released: dated(cm.released),
    country: cm.country, rating: rating(cm),
  };
}

const isOut = (date, now) => Boolean(date) && date <= now;
const titleOf = (e) => (e.kind === "movie" ? e.movie : e.show);

/**
 * A collection's entries, as { kind: "season", key, show, season, date },
 * { kind: "movie", key, movie, date }, or { kind: "show", key, show, date } for a show Cinemeta
 * lists no episodes for. ["loki"] means every season that has aired; ["loki", 2] one
 * season; ["iron-man"] a movie. Titles that aren't out yet are skipped (and listed), so
 * they appear by themselves once a weekly build catches them.
 */
export function expandEntries(collection, shows, movies, now = new Date().toISOString()) {
  const entries = [], problems = [], upcoming = [];
  for (const [key, number] of collection.entries) {
    const movie = movies.get(key);
    if (movie) {
      if (isOut(movie.released, now)) entries.push({ kind: "movie", key, movie, date: movie.released });
      else upcoming.push(movie.name);
      continue;
    }
    const show = shows.get(key);
    if (number === undefined && show.seasons.size === 0) {
      if (isOut(show.released, now)) entries.push({ kind: "show", key, show, date: show.released });
      else upcoming.push(show.name);
      continue;
    }
    const wanted = number === undefined ? [...show.seasons.values()] : [show.seasons.get(number)];
    if (number !== undefined && !wanted[0]) {
      problems.push(`${displayName(collection)}: ${show.name} has no season ${number} on Cinemeta`);
      continue;
    }
    for (const season of wanted) {
      // Old or web-only shows can have seasons without episode dates. If the show has
      // ended, those seasons have aired; date them by the show's premiere.
      const date = season.premiere ?? (show.ongoing ? undefined : show.released);
      if (isOut(date, now)) entries.push({ kind: "season", key, show, season, date });
      else upcoming.push(`${show.name} season ${season.number}`);
    }
  }
  return { entries, problems, upcoming };
}

/**
 * "timeline" keeps the config's order and "release" sorts by date. A list (no order)
 * goes newest title first, by each title's first release, so its poster is its newest
 * title's and the latest additions are on top.
 */
export function arrange(entries, order) {
  if (order === "timeline") return entries;
  const byDate = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (order === "release") return byDate;
  const firstOut = new Map();
  for (const e of byDate) if (!firstOut.has(titleOf(e).imdb)) firstOut.set(titleOf(e).imdb, e.date);
  return byDate.sort((a, b) => firstOut.get(titleOf(b).imdb).localeCompare(firstOut.get(titleOf(a).imdb)));
}

/**
 * A title's score: its IMDb rating weighted by how many people rated it (the log of the
 * vote count), so a well-loved hit beats both a beloved obscurity and a widely seen flop.
 * Without a vote count (a title missing from IMDb's dataset), Cinemeta's rating counts
 * as if a thousand people rated it.
 */
export const titleScore = ({ rating, votes } = {}) => (rating ? rating * Math.log10((votes ?? 1000) + 1) : 0);

export const HEADLINERS = 5;

/**
 * A collection's score: the average of its few best-scoring titles, each title counted
 * once. A franchise is known by its biggest titles, so a long tail of lesser spin-offs
 * shouldn't sink it below a collection of two.
 */
export function collectionScore(entries, scores) {
  const ids = [...new Set(entries.map((e) => titleOf(e).imdb))];
  const top = ids.map((id) => scores.get(id) ?? 0).sort((a, b) => b - a).slice(0, HEADLINERS);
  return top.length ? top.reduce((sum, s) => sum + s, 0) / top.length : 0;
}

const year = (date) => Number.parseInt(date, 10) || undefined;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const span = (a, b) => (a === b || !b ? `${a}` : `${a}–${b}`);

const movieItem = ({ movie }) => ({
  kind: "movie",
  title: movie.name,
  url: `stremio:///detail/movie/${movie.imdb}`,
  thumbnail: movie.background,
  overview: [`${movie.name} (${year(movie.released)} movie).`, firstSentence(movie.description)].filter(Boolean).join(" "),
});

const showItem = ({ show }) => ({
  kind: "series",
  title: show.name,
  url: `stremio:///detail/series/${show.imdb}`,
  thumbnail: show.background,
  overview: [
    `${show.name} (${[show.releaseInfo, show.seasons.size && plural(show.seasons.size, "season")].filter(Boolean).join(", ")}).`,
    firstSentence(show.description),
  ].filter(Boolean).join(" "),
});

const seasonItem = ({ show, season, date }) => ({
  kind: "series",
  title: `${show.name} S${season.number}`,
  url: `stremio:///detail/series/${show.imdb}?season=${season.number}`,
  thumbnail: show.background,
  overview: [
    `Season ${season.number} of ${show.name} (${span(year(date), year(season.finale))}, ${plural(season.episodes, "episode")}).`,
    firstSentence(show.description),
  ].filter(Boolean).join(" "),
});

/**
 * What the collection lists, in order. A watch order lists each season ("Daredevil S2",
 * opening that season's tab) and movie; a list has each show and movie once. Each item
 * has a short blurb, shown when the entry is selected, so selecting it says more than the
 * collection's own description. `entries` must already be arranged.
 */
export function listItems(collection, entries) {
  const seen = new Set();
  const listed = collection.order ? entries : entries.filter((e) => !seen.has(titleOf(e).imdb) && seen.add(titleOf(e).imdb));
  const item = (e) => (e.kind === "movie" ? movieItem(e) : e.kind === "season" && collection.order ? seasonItem(e) : showItem(e));
  return disambiguate(listed.map(item), listed);
}

const SHORT_COUNTRY = { "United Kingdom": "UK", "United States": "US", USA: "US" };
const countryOf = (e) => {
  const c = titleOf(e).country?.split(",")[0].trim();
  return SHORT_COUNTRY[c] ?? c;
};

/**
 * Regional versions often share a title ("Love Island" from the UK and from France), so
 * titles that clash get their country, plus the year where a country repeats ("Big
 * Brother (Portugal 2000)"). Remakes from one or two countries get just the year
 * ("Spider-Man (1967)", "Spider-Man (1981)").
 */
function disambiguate(items, entries) {
  return items.map((item, i) => {
    const group = items.map((it, j) => j).filter((j) => items[j].title === item.title);
    if (group.length < 2) return item;
    const countries = group.map((j) => countryOf(entries[j]));
    const distinct = new Set(countries.filter(Boolean)).size;
    const byCountry = distinct >= 3 || (countries.every(Boolean) && distinct === group.length);
    const country = countryOf(entries[i]), when = year(entries[i].date);
    const repeated = countries.filter((c) => c === country).length > 1;
    const tag = !byCountry || !country ? when : repeated ? `${country} ${when}` : country;
    return { ...item, title: `${item.title} (${tag})` };
  });
}

/** "2008–2026", first release to last, or "2008–" while a show in it is still running. */
export function yearSpan(entries) {
  const starts = entries.map((e) => year(e.date)).filter(Boolean);
  const ends = entries.map((e) => year(e.kind === "season" ? e.season.finale : e.date)).filter(Boolean);
  if (!starts.length) return undefined;
  const first = Math.min(...starts), last = Math.max(...ends, ...starts);
  if (entries.some((e) => e.kind !== "movie" && e.show.ongoing)) return `${first}–`;
  return span(first, last);
}

/**
 * Discover, filtered to one genre of one of this addon's catalogs. Stremio matches the
 * installed addon by its manifest URL, so this needs the URL it was installed from.
 */
export const genreLink = (manifestUrl, catalogId, genre) =>
  `stremio:///discover/${encodeURIComponent(manifestUrl)}/${TYPE}/${catalogId}?genre=${encodeURIComponent(genre)}`;

/**
 * Chips above the list: the collection's genres (each opening that genre of its first
 * catalog in Discover, when the addon's URL is known), then what it holds, movies first
 * (each just pointing back at the collection).
 */
function headerLinks(collection, entries, manifestUrl) {
  const self = `stremio:///detail/${TYPE}/${idOf(collection)}`;
  const movies = new Set(entries.filter((e) => e.kind === "movie").map((e) => e.movie.imdb)).size;
  const series = new Set(entries.filter((e) => e.kind !== "movie").map((e) => e.show.imdb)).size;
  const seasons = entries.filter((e) => e.kind === "season").length;
  const genres = manifestUrl
    ? genresOf(collection).map((g) => ({ name: g, category: GENRES_CATEGORY, url: genreLink(manifestUrl, catalogsOf(collection)[0], g) }))
    : [];
  const contents = [
    movies && plural(movies, "Movie"),
    series && `${series} Series`,
    seasons && plural(seasons, "Season"),
  ].filter(Boolean).map((label) => ({ name: label, category: CONTENTS_CATEGORY, url: self }));
  return [...genres, ...contents];
}

/**
 * The collection's poster, as a catalog item. The links travel with it, so Discover's
 * side panel lists the entries as soon as the poster is selected.
 */
export function toCollectionPreview(collection, entries, manifestUrl) {
  const art = entries[0] && titleOf(entries[0]);
  const category = collection.order ? ORDER_CATEGORY : LIST_CATEGORY;
  return {
    id: idOf(collection),
    type: TYPE,
    name: displayName(collection),
    poster: collection.poster ?? art?.poster,
    background: collection.background ?? art?.background,
    releaseInfo: yearSpan(entries),
    description: collectionDescription(collection),
    links: [
      ...headerLinks(collection, entries, manifestUrl),
      ...listItems(collection, entries).map(({ title, url }) => ({ name: title, category, url })),
    ],
  };
}

/**
 * The entries as the detail page's episodes. Season 1 has everything; a collection with
 * both movies and series adds season 2 with just its movies and season 3 with just its
 * series, in the same order. Each episode's id also names its stream file.
 */
export function collectionVideos(collection, entries) {
  const items = listItems(collection, entries);
  const seasons = [{ season: 1, tag: "", items }];
  const movies = items.filter((it) => it.kind === "movie"), series = items.filter((it) => it.kind === "series");
  if (movies.length && series.length) seasons.push({ season: 2, tag: "m", items: movies }, { season: 3, tag: "s", items: series });
  return seasons.flatMap(({ season, tag, items: list }) => list.map(({ title, url, thumbnail, overview }, i) => ({
    id: `${idOf(collection)}-${tag}${i + 1}`, season, episode: i + 1, title, url, thumbnail, overview,
  })));
}

/**
 * The collection's detail page: the same poster and links, plus the entries in its
 * episode column, each with its blurb.
 */
export function toCollectionMeta(collection, entries, manifestUrl) {
  return {
    ...toCollectionPreview(collection, entries, manifestUrl),
    videos: collectionVideos(collection, entries).map(({ id, season, episode, title, thumbnail, overview }) => ({
      id, title, season, episode, thumbnail, overview,
    })),
  };
}

/**
 * Each episode's one stream: its link, as "Open …". Web follows it inside the app;
 * Stremio 5 desktop opens it in the system browser behind Stremio's warning page.
 */
export function entryStreams(collection, entries) {
  return collectionVideos(collection, entries).map(({ id, title, url }) => ({
    id,
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
 * Every file for one catalog's genre, or for no genre at all (genre undefined: all of
 * the catalog's collections, which is also its home-screen row): each genre spelling,
 * each page of 100. Stremio sends extras in manifest order, so the next page of a genre
 * is "genre=X&skip=100".
 */
export function catalogPaths(catalogId, genre, metas) {
  const dir = `catalog/${TYPE}/${catalogId}`;
  const files = [];
  for (let skip = 0; skip === 0 || skip < metas.length; skip += PAGE_SIZE) {
    const page = metas.slice(skip, skip + PAGE_SIZE);
    const skipPart = skip === 0 ? "" : `skip=${skip}`;
    if (genre === undefined) {
      files.push({ rel: skip === 0 ? `${dir}.json` : `${dir}/${skipPart}.json`, metas: page });
      continue;
    }
    for (const v of valueSpellings(genre)) {
      files.push({ rel: `${dir}/genre=${v}${skipPart && `&${skipPart}`}.json`, metas: page });
    }
  }
  return files;
}

// Bump when the manifest changes so installed copies refresh.
export function buildManifest(collections, version = "0.11.0") {
  return {
    id: "community.movie-series-collections",
    version,
    name: ADDON_NAME,
    description: "Collections of movies and TV series. Storyline has watch orders for stories told across many titles, by release or by the story's timeline; Franchise, Person and Studio gather the titles of a franchise, a director or personality, or a studio, newest first. Find them under Discover → Collections.",
    resources: [
      "catalog",
      { name: "meta", types: [TYPE], idPrefixes: [ID_PREFIX] },
      { name: "stream", types: [TYPE], idPrefixes: [ID_PREFIX] },
    ],
    types: [TYPE],
    idPrefixes: [ID_PREFIX],
    catalogs: CATALOGS.map(({ id, name }) => {
      const genres = genreNames(collections, id);
      return {
        type: TYPE,
        id,
        name,
        // Not required, so the genre filter starts on "None", which lists all of the
        // catalog's collections, and the catalog also gets a home-screen row.
        extra: [{ name: "genre", options: genres }, { name: "skip" }],
        // Older clients (Stremio desktop v4) read these instead of `extra`.
        genres,
        extraSupported: ["genre", "skip"],
      };
    }),
    behaviorHints: { configurable: false, configurationRequired: false },
  };
}
