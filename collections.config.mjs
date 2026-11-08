// Everything you'd normally change lives here. Push a change and the workflow rebuilds.
//
// The addon has one catalog, "Collections" (Discover → Series → Collections). Its genre
// filter picks a group, and each poster in a group is a collection. A collection lists
// its seasons in watch order as "Watch order" links; each opens the real show on that
// season's tab.

// Every show the collections use, by a short key. `name` is only a check: the build
// looks each IMDb id up on Cinemeta and fails if the title there doesn't match, so a
// typo'd id can't quietly point at the wrong show. To find an id:
//   https://v3-cinemeta.strem.io/catalog/series/top/search=<title>.json
export const shows = {
  // Marvel Studios
  "wandavision": { imdb: "tt9140560", name: "WandaVision" },
  "falcon-winter-soldier": { imdb: "tt9208876", name: "The Falcon and the Winter Soldier" },
  "loki": { imdb: "tt9140554", name: "Loki" },
  "what-if": { imdb: "tt10168312", name: "What If...?" },
  "hawkeye": { imdb: "tt10160804", name: "Hawkeye" },
  "moon-knight": { imdb: "tt10234724", name: "Moon Knight" },
  "ms-marvel": { imdb: "tt10857164", name: "Ms. Marvel" },
  "she-hulk": { imdb: "tt10857160", name: "She-Hulk: Attorney at Law" },
  "i-am-groot": { imdb: "tt13623148", name: "I Am Groot" },
  "secret-invasion": { imdb: "tt13157618", name: "Secret Invasion" },
  "echo": { imdb: "tt13966962", name: "Echo" },
  "agatha": { imdb: "tt15571732", name: "Agatha All Along" },
  "daredevil-born-again": { imdb: "tt18923754", name: "Daredevil: Born Again" },
  "ironheart": { imdb: "tt13623126", name: "Ironheart" },
  "eyes-of-wakanda": { imdb: "tt13968252", name: "Eyes of Wakanda" },
  "marvel-zombies": { imdb: "tt16027014", name: "Marvel Zombies" },
  "wonder-man": { imdb: "tt21066182", name: "Wonder Man" },
  "visionquest": { imdb: "tt23112594", name: "VisionQuest" },
  // Marvel Television: Netflix
  "daredevil": { imdb: "tt3322312", name: "Daredevil" },
  "jessica-jones": { imdb: "tt2357547", name: "Jessica Jones" },
  "luke-cage": { imdb: "tt3322314", name: "Luke Cage" },
  "iron-fist": { imdb: "tt3322310", name: "Iron Fist" },
  "defenders": { imdb: "tt4230076", name: "The Defenders" },
  "punisher": { imdb: "tt5675620", name: "The Punisher" },
  // Marvel Television: ABC, Hulu, Freeform
  "agents-of-shield": { imdb: "tt2364582", name: "Agents of S.H.I.E.L.D." },
  "agent-carter": { imdb: "tt3475734", name: "Agent Carter" },
  "inhumans": { imdb: "tt4154858", name: "Inhumans" },
  "runaways": { imdb: "tt1236246", name: "Runaways" },
  "cloak-and-dagger": { imdb: "tt5614844", name: "Cloak & Dagger" },
  "helstrom": { imdb: "tt10266874", name: "Helstrom" },
  // Arrowverse
  "arrow": { imdb: "tt2193021", name: "Arrow" },
  "the-flash": { imdb: "tt3107288", name: "The Flash" },
  "supergirl": { imdb: "tt4016454", name: "Supergirl" },
  "legends-of-tomorrow": { imdb: "tt4532368", name: "Legends of Tomorrow" },
  "black-lightning": { imdb: "tt6045840", name: "Black Lightning" },
  "batwoman": { imdb: "tt8712204", name: "Batwoman" },
  "superman-and-lois": { imdb: "tt11192306", name: "Superman & Lois" },
  // Stargate
  "stargate-sg1": { imdb: "tt0118480", name: "Stargate SG-1" },
  "stargate-atlantis": { imdb: "tt0374455", name: "Stargate: Atlantis" },
  "stargate-universe": { imdb: "tt1286039", name: "Stargate Universe" },
  // Star Trek
  "star-trek": { imdb: "tt0060028", name: "Star Trek" },
  "star-trek-tas": { imdb: "tt0069637", name: "Star Trek: The Animated Series" },
  "star-trek-tng": { imdb: "tt0092455", name: "Star Trek: The Next Generation" },
  "star-trek-ds9": { imdb: "tt0106145", name: "Star Trek: Deep Space Nine" },
  "star-trek-voyager": { imdb: "tt0112178", name: "Star Trek: Voyager" },
  "star-trek-enterprise": { imdb: "tt0244365", name: "Star Trek: Enterprise" },
  "star-trek-discovery": { imdb: "tt5171438", name: "Star Trek: Discovery" },
  "star-trek-picard": { imdb: "tt8806524", name: "Star Trek: Picard" },
  "star-trek-lower-decks": { imdb: "tt9184820", name: "Star Trek: Lower Decks" },
  "star-trek-prodigy": { imdb: "tt9795876", name: "Star Trek: Prodigy" },
  "star-trek-snw": { imdb: "tt12327578", name: "Star Trek: Strange New Worlds" },
  "star-trek-academy": { imdb: "tt8622160", name: "Star Trek: Starfleet Academy" },
};

// Disney+'s official complete MCU timeline (as of VisionQuest), series only. It
// includes the Netflix shows (added January 2024) but not the ABC/Hulu shows or the
// own-universe animation (X-Men '97, Your Friendly Neighborhood Spider-Man).
const mcuTimeline = [
  ["eyes-of-wakanda", 1],
  ["i-am-groot", 1],
  ["i-am-groot", 2],
  ["daredevil", 1],
  ["jessica-jones", 1],
  ["daredevil", 2],
  ["luke-cage", 1],
  ["iron-fist", 1],
  ["defenders", 1],
  ["punisher", 1],
  ["jessica-jones", 2],
  ["luke-cage", 2],
  ["iron-fist", 2],
  ["daredevil", 3],
  ["punisher", 2],
  ["jessica-jones", 3],
  ["loki", 1],
  ["what-if", 1],
  ["marvel-zombies", 1],
  ["wandavision", 1],
  ["falcon-winter-soldier", 1],
  ["hawkeye", 1],
  ["moon-knight", 1],
  ["echo", 1],
  ["she-hulk", 1],
  ["ms-marvel", 1],
  ["ironheart", 1],
  ["secret-invasion", 1],
  ["loki", 2],
  ["what-if", 2],
  ["agatha", 1],
  ["what-if", 3],
  ["daredevil-born-again", 1],
  ["wonder-man", 1],
  ["daredevil-born-again", 2],
  ["visionquest", 1],
];

// Each collection:
//   group        the genre filter value it appears under, such as "Superheroes". Groups
//                appear in the order collections first use them. With no genre picked
//                (and on the home-screen row), every collection shows, group by group.
//                Letters, digits, spaces, ' & and - only.
//   name         the poster's name. Same characters as group.
//   order        "release" (default): sorted by each season's premiere date.
//                "chronological": seasons stay in the order listed, which should follow
//                the story's timeline. The name gets " (Chronological)" added and the
//                description a standard sentence explaining the difference.
//   description  optional. Shown on the collection's side panel and detail page, and
//                on the install page. The series and season counts and the years are
//                added for you.
//   poster       optional image URL; defaults to the first season's show poster.
//   seasons      [showKey, season] for one season, or [showKey] for every season.
// Seasons that haven't aired yet are skipped until a build after their premiere.
export const collections = [
  {
    group: "Superheroes",
    name: "MCU",
    description: "Marvel Studios' Disney+ series and the Netflix Defenders shows.",
    seasons: mcuTimeline,
  },
  {
    group: "Superheroes",
    name: "MCU",
    order: "chronological",
    description: "Marvel Studios' Disney+ series and the Netflix Defenders shows, in Disney+'s official MCU timeline order.",
    seasons: mcuTimeline,
  },
  {
    // Not on Marvel's official timeline, so release order only.
    group: "Superheroes",
    name: "Marvel Television",
    description: "Marvel Television's series for ABC, Hulu and Freeform.",
    seasons: [
      ["agents-of-shield"],
      ["agent-carter"],
      ["inhumans"],
      ["runaways"],
      ["cloak-and-dagger"],
      ["helstrom"],
    ],
  },
  {
    // The yearly crossovers only make sense in airing order.
    group: "Superheroes",
    name: "Arrowverse",
    description: "The CW's DC shows, from Arrow to Superman & Lois.",
    seasons: [
      ["arrow"],
      ["the-flash"],
      ["supergirl"],
      ["legends-of-tomorrow"],
      ["black-lightning"],
      ["batwoman"],
      ["superman-and-lois"],
    ],
  },
  {
    // The Next Generation, Deep Space Nine and Voyager overlap and cross over, so
    // airing order is how they were meant to be watched.
    group: "Sci-Fi",
    name: "Star Trek",
    description: "Every Star Trek series, from the original to Starfleet Academy.",
    seasons: [
      ["star-trek"],
      ["star-trek-tas"],
      ["star-trek-tng"],
      ["star-trek-ds9"],
      ["star-trek-voyager"],
      ["star-trek-enterprise"],
      ["star-trek-discovery"],
      ["star-trek-picard"],
      ["star-trek-lower-decks"],
      ["star-trek-prodigy"],
      ["star-trek-snw"],
      ["star-trek-academy"],
    ],
  },
  {
    // Atlantis spun off mid-SG-1, so the two overlap for three years.
    group: "Sci-Fi",
    name: "Stargate",
    description: "SG-1, Atlantis and Universe.",
    seasons: [
      ["stargate-sg1"],
      ["stargate-atlantis"],
      ["stargate-universe"],
    ],
  },
];
