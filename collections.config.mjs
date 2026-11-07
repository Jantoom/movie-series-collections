// Everything you'd normally change lives here. Push a change and the workflow rebuilds.
//
// Each row is one catalog: a row of posters on Stremio's home screen (and under
// Discover → Series). Each collection is one poster in its row. Opening a collection
// lists its shows; picking a show and then its "Open show" stream jumps to the real
// show page, where seasons, episodes and your stream addons take over.
//
// Row and collection ids end up in URLs, so keep them lowercase-with-hyphens, and
// make every collection id unique across all rows.
//
// Per collection:
//   order       "release" (default): sorted by premiere date, one "season" per year.
//               "listed": kept in the order below, all in one season. Use it for a
//               watch order or story order.
//   poster      optional image URL; defaults to the first show's poster.
//   background  optional image URL; defaults to the first show's background.
//
// Per show, `name` is only a check: the build looks each IMDb id up on Cinemeta and
// fails if the title there doesn't match, so a typo'd id can't quietly point at the
// wrong show. To find an id:
//   https://v3-cinemeta.strem.io/catalog/series/top/search=<title>.json

export const rows = [
  {
    id: "marvel",
    name: "Marvel Collections",
    collections: [
      {
        id: "marvel-studios",
        name: "Marvel Studios Series",
        description: "The Disney+ series from Marvel Studios, live action and animated.",
        shows: [
          { imdb: "tt9140560", name: "WandaVision" },
          { imdb: "tt9208876", name: "The Falcon and the Winter Soldier" },
          { imdb: "tt9140554", name: "Loki" },
          { imdb: "tt10168312", name: "What If...?" },
          { imdb: "tt10160804", name: "Hawkeye" },
          { imdb: "tt10234724", name: "Moon Knight" },
          { imdb: "tt10857164", name: "Ms. Marvel" },
          { imdb: "tt10857160", name: "She-Hulk: Attorney at Law" },
          { imdb: "tt13623148", name: "I Am Groot" },
          { imdb: "tt13157618", name: "Secret Invasion" },
          { imdb: "tt13966962", name: "Echo" },
          { imdb: "tt16026746", name: "X-Men '97" },
          { imdb: "tt15571732", name: "Agatha All Along" },
          { imdb: "tt16027074", name: "Your Friendly Neighborhood Spider-Man" },
          { imdb: "tt18923754", name: "Daredevil: Born Again" },
          { imdb: "tt13623126", name: "Ironheart" },
          { imdb: "tt13968252", name: "Eyes of Wakanda" },
          { imdb: "tt16027014", name: "Marvel Zombies" },
          { imdb: "tt21066182", name: "Wonder Man" },
          { imdb: "tt23112594", name: "VisionQuest" },
        ],
      },
      {
        id: "defenders-saga",
        name: "Defenders Saga",
        description: "The Netflix street-level heroes, and Daredevil's return on Disney+.",
        shows: [
          { imdb: "tt3322312", name: "Daredevil" },
          { imdb: "tt2357547", name: "Jessica Jones" },
          { imdb: "tt3322314", name: "Luke Cage" },
          { imdb: "tt3322310", name: "Iron Fist" },
          { imdb: "tt4230076", name: "The Defenders" },
          { imdb: "tt5675620", name: "The Punisher" },
          { imdb: "tt18923754", name: "Daredevil: Born Again" },
        ],
      },
      {
        id: "marvel-television",
        name: "Marvel Television",
        description: "Marvel Television's series for ABC, Hulu and Freeform.",
        shows: [
          { imdb: "tt2364582", name: "Agents of S.H.I.E.L.D." },
          { imdb: "tt3475734", name: "Agent Carter" },
          { imdb: "tt4154858", name: "Inhumans" },
          { imdb: "tt1236246", name: "Runaways" },
          { imdb: "tt5614844", name: "Cloak & Dagger" },
          { imdb: "tt10266874", name: "Helstrom" },
        ],
      },
    ],
  },
  {
    id: "star-trek",
    name: "Star Trek Collections",
    collections: [
      {
        id: "star-trek-classic",
        name: "Star Trek: The Classic Era",
        description: "From the original series to Enterprise, 1966–2005.",
        shows: [
          { imdb: "tt0060028", name: "Star Trek" },
          { imdb: "tt0069637", name: "Star Trek: The Animated Series" },
          { imdb: "tt0092455", name: "Star Trek: The Next Generation" },
          { imdb: "tt0106145", name: "Star Trek: Deep Space Nine" },
          { imdb: "tt0112178", name: "Star Trek: Voyager" },
          { imdb: "tt0244365", name: "Star Trek: Enterprise" },
        ],
      },
      {
        id: "star-trek-streaming",
        name: "Star Trek: The Streaming Era",
        description: "The Paramount+ series, from Discovery on.",
        shows: [
          { imdb: "tt5171438", name: "Star Trek: Discovery" },
          { imdb: "tt8806524", name: "Star Trek: Picard" },
          { imdb: "tt9184820", name: "Star Trek: Lower Decks" },
          { imdb: "tt9795876", name: "Star Trek: Prodigy" },
          { imdb: "tt12327578", name: "Star Trek: Strange New Worlds" },
          { imdb: "tt8622160", name: "Star Trek: Starfleet Academy" },
        ],
      },
      {
        id: "star-trek-story-order",
        name: "Star Trek in Story Order",
        description: "Every series in in-universe order, by where each one begins.",
        order: "listed",
        shows: [
          { imdb: "tt0244365", name: "Star Trek: Enterprise" },
          { imdb: "tt5171438", name: "Star Trek: Discovery" },
          { imdb: "tt12327578", name: "Star Trek: Strange New Worlds" },
          { imdb: "tt0060028", name: "Star Trek" },
          { imdb: "tt0069637", name: "Star Trek: The Animated Series" },
          { imdb: "tt0092455", name: "Star Trek: The Next Generation" },
          { imdb: "tt0106145", name: "Star Trek: Deep Space Nine" },
          { imdb: "tt0112178", name: "Star Trek: Voyager" },
          { imdb: "tt9184820", name: "Star Trek: Lower Decks" },
          { imdb: "tt9795876", name: "Star Trek: Prodigy" },
          { imdb: "tt8806524", name: "Star Trek: Picard" },
          { imdb: "tt8622160", name: "Star Trek: Starfleet Academy" },
        ],
      },
    ],
  },
];
