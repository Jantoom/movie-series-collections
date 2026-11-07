// Pure helpers: turning Cinemeta show data into collection metas, streams and file paths.
//
// The trick: a collection is a "series" whose videos are whole shows. Stremio asks for
// streams when you pick a video, so each show's only stream is a stremio:/// deep link
// that opens the real show page, where seasons, episodes and the user's own stream
// addons take over. Stremio can't nest a meta page inside another, so this is the hop.

export const TYPE = "series";
export const ID_PREFIX = "sercol-";   // no ":" so the ids work as file names on Windows
export const ADDON_NAME = "Series Collections";

export const collectionId = (id) => `${ID_PREFIX}${id}`;
export const showVideoId = (imdb) => `${ID_PREFIX}${imdb}`;
export const showDeepLink = (imdb) => `stremio:///detail/${TYPE}/${imdb}`;

const fold = (s) => (s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

/** Whether Cinemeta's title is the show the config meant ("She Hulk" = "She-Hulk"). */
export function sameTitle(expected, actual) {
  const a = fold(expected);
  return a.length > 0 && a === fold(actual);
}

/** Config mistakes the build should stop on: duplicate ids, unknown order, empty collections. */
export function configProblems(rows) {
  const problems = [];
  const rowIds = new Set(), collectionIds = new Set();
  for (const row of rows) {
    if (rowIds.has(row.id)) problems.push(`row id "${row.id}" is used twice`);
    rowIds.add(row.id);
    for (const c of row.collections) {
      if (collectionIds.has(c.id)) problems.push(`collection id "${c.id}" is used twice`);
      collectionIds.add(c.id);
      if (c.order && !["release", "listed"].includes(c.order)) problems.push(`${c.id}: order must be "release" or "listed", not "${c.order}"`);
      if (!c.shows?.length) problems.push(`${c.id} has no shows`);
    }
  }
  return problems;
}

/** Cinemeta's meta trimmed to what the addon uses. */
export function toShow(imdb, cm) {
  return {
    imdb,
    name: cm.name,
    year: new Date(cm.released).getUTCFullYear() || Number.parseInt(cm.year, 10) || 0,
    released: cm.released,
    releaseInfo: cm.releaseInfo || cm.year,
    poster: cm.poster?.replace("/poster/small/", "/poster/medium/"),
    background: cm.background,
    description: cm.description,
  };
}

function span(shows) {
  const years = shows.map((s) => s.year).filter(Boolean);
  if (!years.length) return undefined;
  const lo = Math.min(...years), hi = Math.max(...years);
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
}

/** The poster in the catalog row. Uses the first show's art unless the config sets its own. */
export function toPreview(collection, shows) {
  const [first] = shows;
  return {
    id: collectionId(collection.id),
    type: TYPE,
    name: collection.name,
    poster: collection.poster ?? first?.poster,
    background: collection.background ?? first?.background,
    releaseInfo: span(shows),
    description: collection.description,
  };
}

/**
 * Season and episode numbers for each show. "release" sorts by premiere date and makes
 * one season per year, so the season picker reads as a timeline. "listed" keeps the
 * config's order as one season, for watch orders.
 */
export function arrange(shows, order = "release") {
  if (order === "listed") return shows.map((show, i) => ({ show, season: 1, episode: i + 1 }));
  const perYear = new Map();
  return [...shows]
    .sort((a, b) => (a.released ?? "").localeCompare(b.released ?? ""))
    .map((show) => {
      const episode = (perYear.get(show.year) ?? 0) + 1;
      perYear.set(show.year, episode);
      return { show, season: show.year, episode };
    });
}

/** The collection's detail page: its shows as videos. */
export function toCollectionMeta(collection, shows) {
  const arranged = arrange(shows, collection.order);
  return {
    ...toPreview(collection, shows),
    description: [collection.description, `${shows.length} series. Pick one, then "Open show".`].filter(Boolean).join("\n\n"),
    videos: arranged.map(({ show: s, season, episode }) => ({
      id: showVideoId(s.imdb),
      title: `${s.name} (${s.releaseInfo})`,
      season,
      episode,
      released: s.released,
      thumbnail: s.background,
      overview: s.description,
    })),
    // A second way in, in case a client ignores deep links in streams: these render as
    // link chips on the detail page (like cast and genres) on clients that show them.
    links: arranged.map(({ show: s }) => ({ name: s.name, category: "Series", url: showDeepLink(s.imdb) })),
  };
}

export function toStream(show) {
  return {
    name: ADDON_NAME,
    title: `Open ${show.name} →\nSeasons and episodes`,
    externalUrl: showDeepLink(show.imdb),
  };
}

// Bump when the manifest changes so installed copies refresh.
export function buildManifest(rows, version = "0.2.0") {
  return {
    id: "community.series-collections",
    version,
    name: ADDON_NAME,
    description: "TV series grouped into collections you browse by poster. Open a collection, pick a show, then \"Open show\" to get its seasons, episodes and streams from your other addons.",
    resources: [
      "catalog",
      { name: "meta", types: [TYPE], idPrefixes: [ID_PREFIX] },
      { name: "stream", types: [TYPE], idPrefixes: [ID_PREFIX] },
    ],
    types: [TYPE],
    idPrefixes: [ID_PREFIX],
    catalogs: rows.map((row) => ({ type: TYPE, id: row.id, name: row.name })),
    behaviorHints: { configurable: false, configurationRequired: false },
  };
}
