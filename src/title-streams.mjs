// The streams a real movie or show gets, one per collection it's in, each linking to that
// collection. Shared by the build, which writes each movie's streams as a static file, and
// the Worker, which answers a show's per-episode requests from the show's one index file.
//
// A collection reference ("ref") is what the build stores for each title and collection:
//   { catalog, name, years, of, noun, at, url }
// `at` is the title's place in a collection that keeps an order (a watch order, a Franchise
// copy of one, a ranked list): a number for a movie or a whole show, or season → place for a
// watch order's seasons. A list sorted by popularity has no `at`.

/**
 * The stream for one collection. `season` is the season of the episode Stremio asked about
 * (undefined for a movie or a show without episodes), so a watch order shows that season's
 * place ("#14 of 65") and otherwise its size ("65 entries").
 */
export function titleStream(ref, season) {
  const place = typeof ref.at === "number" ? ref.at : season === undefined ? undefined : ref.at?.[season];
  const where = place ? `#${place} of ${ref.of}` : `${ref.of} ${ref.noun}`;
  return {
    name: `Collection\n${ref.catalog}`,
    title: `${ref.name}\n${[where, ref.years].filter(Boolean).join(" · ")}`,
    externalUrl: ref.url,
  };
}
