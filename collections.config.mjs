// Everything you'd normally change lives here. Push a change and the workflow rebuilds.
//
// The addon has its own Discover tab, "Collections", with one catalog, "Genre". Its genre
// filter picks a group ("None" lists every collection), and each poster is a collection
// of movies and TV seasons: a watch order, or a plain list of every title in a franchise.

// Every show and movie the collections use, by a short key (unique across both tables).
// `name` is only a check: the build looks each IMDb id up on Cinemeta and fails if the
// title there doesn't match, so a typo'd id can't quietly point at the wrong title.
// To find an id:
//   https://v3-cinemeta.strem.io/catalog/series/top/search=<title>.json
//   https://v3-cinemeta.strem.io/catalog/movie/top/search=<title>.json
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
  // Marvel Animation, outside the MCU timeline
  "x-men-97": { imdb: "tt16026746", name: "X-Men '97" },
  "spider-man-yfn": { imdb: "tt16027074", name: "Your Friendly Neighborhood Spider-Man" },
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
  // Other Marvel series
  "x-men-tas": { imdb: "tt0103584", name: "X-Men" },
  "spider-man-tas": { imdb: "tt0112175", name: "Spider-Man: The Animated Series" },
  "x-men-evolution": { imdb: "tt0247827", name: "X-Men: Evolution" },
  "legion": { imdb: "tt5114356", name: "Legion" },
  "the-gifted": { imdb: "tt4396630", name: "The Gifted" },
  "moon-girl": { imdb: "tt8041658", name: "Moon Girl and Devil Dinosaur" },
  "modok": { imdb: "tt9811118", name: "M.O.D.O.K." },
  "hit-monkey": { imdb: "tt9811316", name: "Hit-Monkey" },
  // Arrowverse
  "arrow": { imdb: "tt2193021", name: "Arrow" },
  "the-flash": { imdb: "tt3107288", name: "The Flash" },
  "supergirl": { imdb: "tt4016454", name: "Supergirl" },
  "legends-of-tomorrow": { imdb: "tt4532368", name: "Legends of Tomorrow" },
  "black-lightning": { imdb: "tt6045840", name: "Black Lightning" },
  "batwoman": { imdb: "tt8712204", name: "Batwoman" },
  "superman-and-lois": { imdb: "tt11192306", name: "Superman & Lois" },
  // Other DC series
  "batman-tas": { imdb: "tt0103359", name: "Batman: The Animated Series" },
  "superman-tas": { imdb: "tt0115378", name: "Superman: The Animated Series" },
  "justice-league": { imdb: "tt0275137", name: "Justice League" },
  "smallville": { imdb: "tt0279600", name: "Smallville" },
  "gotham": { imdb: "tt3749900", name: "Gotham" },
  "lucifer": { imdb: "tt4052886", name: "Lucifer" },
  "titans": { imdb: "tt1043813", name: "Titans" },
  "doom-patrol": { imdb: "tt8416494", name: "Doom Patrol" },
  "harley-quinn": { imdb: "tt7658402", name: "Harley Quinn" },
  "stargirl": { imdb: "tt8722888", name: "Stargirl" },
  "peacemaker": { imdb: "tt13146488", name: "Peacemaker" },
  "the-penguin": { imdb: "tt15435876", name: "The Penguin" },
  "creature-commandos": { imdb: "tt26545355", name: "Creature Commandos" },
  // Star Wars
  "acolyte": { imdb: "tt12262202", name: "The Acolyte" },
  "clone-wars": { imdb: "tt0458290", name: "Star Wars: The Clone Wars" },
  "tales-of-the-jedi": { imdb: "tt20723374", name: "Star Wars: Tales of the Jedi" },
  "tales-of-the-empire": { imdb: "tt32019314", name: "Star Wars: Tales of the Empire" },
  "tales-of-the-underworld": { imdb: "tt36414431", name: "Star Wars: Tales of the Underworld" },
  "bad-batch": { imdb: "tt12708542", name: "Star Wars: The Bad Batch" },
  "maul-shadow-lord": { imdb: "tt36594331", name: "Star Wars: Maul - Shadow Lord" },
  "obi-wan-kenobi": { imdb: "tt8466564", name: "Obi-Wan Kenobi" },
  "andor": { imdb: "tt9253284", name: "Andor" },
  "rebels": { imdb: "tt2930604", name: "Star Wars: Rebels" },
  "mandalorian": { imdb: "tt8111088", name: "The Mandalorian" },
  "book-of-boba-fett": { imdb: "tt13668894", name: "The Book of Boba Fett" },
  "ahsoka": { imdb: "tt13622776", name: "Ahsoka" },
  "skeleton-crew": { imdb: "tt20600980", name: "Skeleton Crew" },
  "resistance": { imdb: "tt8336340", name: "Star Wars: Resistance" },
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
  // Stargate
  "stargate-sg1": { imdb: "tt0118480", name: "Stargate SG-1" },
  "stargate-atlantis": { imdb: "tt0374455", name: "Stargate: Atlantis" },
  "stargate-universe": { imdb: "tt1286039", name: "Stargate Universe" },
};

export const movies = {
  // Marvel Cinematic Universe
  "iron-man": { imdb: "tt0371746", name: "Iron Man" },
  "incredible-hulk": { imdb: "tt0800080", name: "The Incredible Hulk" },
  "iron-man-2": { imdb: "tt1228705", name: "Iron Man 2" },
  "thor": { imdb: "tt0800369", name: "Thor" },
  "captain-america": { imdb: "tt0458339", name: "Captain America: The First Avenger" },
  "avengers": { imdb: "tt0848228", name: "The Avengers" },
  "iron-man-3": { imdb: "tt1300854", name: "Iron Man 3" },
  "thor-dark-world": { imdb: "tt1981115", name: "Thor: The Dark World" },
  "winter-soldier": { imdb: "tt1843866", name: "Captain America: The Winter Soldier" },
  "guardians": { imdb: "tt2015381", name: "Guardians of the Galaxy" },
  "age-of-ultron": { imdb: "tt2395427", name: "Avengers: Age of Ultron" },
  "ant-man": { imdb: "tt0478970", name: "Ant-Man" },
  "civil-war": { imdb: "tt3498820", name: "Captain America: Civil War" },
  "doctor-strange": { imdb: "tt1211837", name: "Doctor Strange" },
  "guardians-2": { imdb: "tt3896198", name: "Guardians of the Galaxy Vol. 2" },
  "spider-man-homecoming": { imdb: "tt2250912", name: "Spider-Man: Homecoming" },
  "thor-ragnarok": { imdb: "tt3501632", name: "Thor: Ragnarok" },
  "black-panther": { imdb: "tt1825683", name: "Black Panther" },
  "infinity-war": { imdb: "tt4154756", name: "Avengers: Infinity War" },
  "ant-man-wasp": { imdb: "tt5095030", name: "Ant-Man and the Wasp" },
  "captain-marvel": { imdb: "tt4154664", name: "Captain Marvel" },
  "endgame": { imdb: "tt4154796", name: "Avengers: Endgame" },
  "far-from-home": { imdb: "tt6320628", name: "Spider-Man: Far From Home" },
  "black-widow": { imdb: "tt3480822", name: "Black Widow" },
  "shang-chi": { imdb: "tt9376612", name: "Shang-Chi and the Legend of the Ten Rings" },
  "eternals": { imdb: "tt9032400", name: "Eternals" },
  "no-way-home": { imdb: "tt10872600", name: "Spider-Man: No Way Home" },
  "multiverse-of-madness": { imdb: "tt9419884", name: "Doctor Strange in the Multiverse of Madness" },
  "love-and-thunder": { imdb: "tt10648342", name: "Thor: Love and Thunder" },
  "wakanda-forever": { imdb: "tt9114286", name: "Black Panther: Wakanda Forever" },
  "werewolf-by-night": { imdb: "tt15318872", name: "Werewolf by Night" },
  "guardians-holiday": { imdb: "tt13623136", name: "The Guardians of the Galaxy Holiday Special" },
  "quantumania": { imdb: "tt10954600", name: "Ant-Man and the Wasp: Quantumania" },
  "guardians-3": { imdb: "tt6791350", name: "Guardians of the Galaxy Vol. 3" },
  "the-marvels": { imdb: "tt10676048", name: "The Marvels" },
  "deadpool-wolverine": { imdb: "tt6263850", name: "Deadpool & Wolverine" },
  "brave-new-world": { imdb: "tt14513804", name: "Captain America: Brave New World" },
  "thunderbolts": { imdb: "tt20969586", name: "Thunderbolts*" },
  "fantastic-four": { imdb: "tt10676052", name: "The Fantastic Four: First Steps" },
  "brand-new-day": { imdb: "tt22084616", name: "Spider-Man: Brand New Day" },
  "doomsday": { imdb: "tt21357150", name: "Avengers: Doomsday" },
  "punisher-one-last-kill": { imdb: "tt36042156", name: "The Punisher: One Last Kill" },
  // Star Wars
  "phantom-menace": { imdb: "tt0120915", name: "Star Wars: Episode I - The Phantom Menace" },
  "attack-of-the-clones": { imdb: "tt0121765", name: "Star Wars: Episode II - Attack of the Clones" },
  "clone-wars-film": { imdb: "tt1185834", name: "Star Wars: The Clone Wars" },
  "revenge-of-the-sith": { imdb: "tt0121766", name: "Star Wars: Episode III - Revenge of the Sith" },
  "solo": { imdb: "tt3778644", name: "Solo: A Star Wars Story" },
  "rogue-one": { imdb: "tt3748528", name: "Rogue One: A Star Wars Story" },
  "new-hope": { imdb: "tt0076759", name: "Star Wars: Episode IV - A New Hope" },
  "empire-strikes-back": { imdb: "tt0080684", name: "Star Wars: Episode V - The Empire Strikes Back" },
  "return-of-the-jedi": { imdb: "tt0086190", name: "Star Wars: Episode VI - Return of the Jedi" },
  "force-awakens": { imdb: "tt2488496", name: "Star Wars: Episode VII - The Force Awakens" },
  "last-jedi": { imdb: "tt2527336", name: "Star Wars: Episode VIII - The Last Jedi" },
  "rise-of-skywalker": { imdb: "tt2527338", name: "Star Wars: Episode IX - The Rise of Skywalker" },
  "mandalorian-and-grogu": { imdb: "tt30825738", name: "Star Wars: The Mandalorian and Grogu" },
};

// The Marvel Cinematic Universe as Marvel Studios counts it: the films, the Disney+
// series, and the Netflix shows it added to its official timeline in January 2024.
// Order doesn't matter here; release-order collections sort by date.
const mcu = [
  ["iron-man"], ["incredible-hulk"], ["iron-man-2"], ["thor"], ["captain-america"], ["avengers"],
  ["iron-man-3"], ["thor-dark-world"], ["winter-soldier"], ["guardians"], ["age-of-ultron"], ["ant-man"],
  ["civil-war"], ["doctor-strange"], ["guardians-2"], ["spider-man-homecoming"], ["thor-ragnarok"], ["black-panther"],
  ["infinity-war"], ["ant-man-wasp"], ["captain-marvel"], ["endgame"], ["far-from-home"],
  ["black-widow"], ["shang-chi"], ["eternals"], ["no-way-home"], ["multiverse-of-madness"], ["love-and-thunder"],
  ["wakanda-forever"], ["werewolf-by-night"], ["guardians-holiday"], ["quantumania"], ["guardians-3"], ["the-marvels"],
  ["deadpool-wolverine"], ["brave-new-world"], ["thunderbolts"], ["fantastic-four"], ["brand-new-day"], ["doomsday"],
  ["punisher-one-last-kill"],
  ["daredevil"], ["jessica-jones"], ["luke-cage"], ["iron-fist"], ["defenders"], ["punisher"],
  ["wandavision"], ["falcon-winter-soldier"], ["loki"], ["what-if"], ["hawkeye"], ["moon-knight"], ["ms-marvel"],
  ["she-hulk"], ["i-am-groot"], ["secret-invasion"], ["echo"], ["agatha"], ["daredevil-born-again"], ["ironheart"],
  ["eyes-of-wakanda"], ["marvel-zombies"], ["wonder-man"], ["visionquest"],
];
const marvelTelevision = [["agents-of-shield"], ["agent-carter"], ["inhumans"], ["runaways"], ["cloak-and-dagger"], ["helstrom"]];
const arrowverse = [["arrow"], ["the-flash"], ["supergirl"], ["legends-of-tomorrow"], ["black-lightning"], ["batwoman"], ["superman-and-lois"]];

// Star Wars in story order. It follows the Disney+ timeline's grouping, which keeps each
// show's seasons together; Maul: Shadow Lord (a year after The Clone Wars), the Tales
// anthologies and The Mandalorian and Grogu are placed by their settings.
const starWarsTimeline = [
  ["acolyte"],
  ["phantom-menace"],
  ["attack-of-the-clones"],
  ["clone-wars-film"],
  ["clone-wars"],
  ["tales-of-the-jedi"],
  ["revenge-of-the-sith"],
  ["tales-of-the-empire"],
  ["tales-of-the-underworld"],
  ["bad-batch"],
  ["maul-shadow-lord"],
  ["solo"],
  ["obi-wan-kenobi"],
  ["andor"],
  ["rebels"],
  ["rogue-one"],
  ["new-hope"],
  ["empire-strikes-back"],
  ["return-of-the-jedi"],
  ["mandalorian", 1],
  ["mandalorian", 2],
  ["book-of-boba-fett"],
  ["mandalorian", 3],
  ["mandalorian-and-grogu"],
  ["ahsoka"],
  ["skeleton-crew"],
  ["resistance"],
  ["force-awakens"],
  ["last-jedi"],
  ["rise-of-skywalker"],
];

// Each collection:
//   group        the genre it appears under, such as "Superheroes", or a list of them,
//                such as ["Sci-Fi", "Fantasy"]. Groups show as the collection's genres
//                too. "None" lists every collection. Letters, digits, spaces, ' & and -.
//   name         spelled out ("Marvel Cinematic Universe", not "MCU").
//   order        "release": a watch order sorted by release date. The name stays as is.
//                "timeline": a watch order kept in the order listed, following the
//                story. The name gets " (Timeline)" and the description a standard
//                sentence. Only worth it when the story jumps around a lot, as Star
//                Wars does; the MCU's timeline is too close to its release order.
//                Left out: a plain list of titles with no shared continuity, each once,
//                by release date, named "Every <name> Series", "Every <name> Movie" or
//                "Every <name> Movie and Series" depending on what it holds.
//   description  up to three sentences on what the collection is and where its titles
//                come from. The years and the movie, series and season counts are added
//                for you.
//   poster       optional image URL; defaults to the first title's poster.
//   entries      [key] for a movie, or for every season of a show; [key, season] for one
//                season (watch orders only).
// Titles that aren't out yet are skipped until a build after their release.
export const collections = [
  {
    group: "Superheroes",
    name: "Marvel Cinematic Universe",
    order: "release",
    description: "Marvel Studios' shared universe, which began with Iron Man in 2008, built for a decade to Avengers: Endgame, and carried on into the Multiverse Saga. It brings together every film, the Disney+ series, and the Netflix Defenders shows Marvel added to its official timeline in 2024. In release order, each story lands the way audiences first saw it, with every entry setting up the next.",
    entries: mcu,
  },
  {
    group: "Superheroes",
    name: "Marvel Cinematic Universe (Unofficial)",
    order: "release",
    description: "The Marvel Cinematic Universe as it was first sold to viewers, with the shows Marvel Television made for ABC, Hulu and Freeform under the same banner. Agents of S.H.I.E.L.D. picked up threads from The Avengers and kept answering the films for seven seasons, but Marvel Studios has never counted these shows on its timeline. In release order, you can see the two halves of Marvel running side by side.",
    entries: [...mcu, ...marvelTelevision],
  },
  {
    group: "Superheroes",
    name: "Arrowverse",
    order: "release",
    description: "The CW's shared DC universe, which grew from Arrow in 2012 into seven interlocking shows. Characters move between series all the time, and the yearly crossover events, building to Crisis on Infinite Earths, run across several shows in one week. Release order keeps those crossovers in step.",
    entries: arrowverse,
  },
  {
    group: "Superheroes",
    name: "Marvel",
    description: "Every Marvel series across all of its universes: the MCU, the Netflix and ABC shows, Fox's X-Men series, and three decades of animation from the 1992 X-Men to X-Men '97. They don't share one story, so they're listed by premiere rather than as a watch order.",
    entries: [
      ...mcu.filter(([key]) => !(key in movies)), ...marvelTelevision,
      ["x-men-97"], ["spider-man-yfn"], ["x-men-tas"], ["spider-man-tas"], ["x-men-evolution"],
      ["legion"], ["the-gifted"], ["moon-girl"], ["modok"], ["hit-monkey"],
    ],
  },
  {
    group: "Superheroes",
    name: "DC",
    description: "Every DC series, from Batman: The Animated Series to the new DC Universe of Creature Commandos and Peacemaker. Smallville, the Arrowverse, Gotham, Titans and the rest each tell their own version of the DC heroes, so they're listed by premiere rather than as a watch order.",
    entries: [
      ...arrowverse,
      ["batman-tas"], ["superman-tas"], ["justice-league"], ["smallville"], ["gotham"], ["lucifer"],
      ["titans"], ["doom-patrol"], ["harley-quinn"], ["stargirl"], ["peacemaker"], ["the-penguin"], ["creature-commandos"],
    ],
  },
  {
    group: "Sci-Fi",
    name: "Star Wars",
    order: "release",
    description: "George Lucas's saga of the Skywalker family and a galaxy far, far away, from the 1977 original through the prequels, the sequel trilogy and the Disney+ series. In release order you meet it the way audiences did: the original trilogy first, then the prequels that explain how it began, then everything since.",
    entries: starWarsTimeline,
  },
  {
    group: "Sci-Fi",
    name: "Star Wars",
    order: "timeline",
    description: "The whole saga in story order, from the High Republic of The Acolyte, through the fall of the Jedi and the reign of the Empire, to the New Republic and the First Order. The films and series jump decades back and forth, so seeing them in sequence shows how each era hands over to the next.",
    entries: starWarsTimeline,
  },
  {
    group: "Sci-Fi",
    name: "Star Trek",
    order: "release",
    description: "Gene Roddenberry's future of the United Federation of Planets and Starfleet, from the 1966 original series to Starfleet Academy. The Next Generation, Deep Space Nine and Voyager aired side by side through the '90s and crossed over, so airing order is how they were meant to be watched.",
    entries: [
      ["star-trek"], ["star-trek-tas"], ["star-trek-tng"], ["star-trek-ds9"], ["star-trek-voyager"], ["star-trek-enterprise"],
      ["star-trek-discovery"], ["star-trek-picard"], ["star-trek-lower-decks"], ["star-trek-prodigy"], ["star-trek-snw"], ["star-trek-academy"],
    ],
  },
  {
    group: "Sci-Fi",
    name: "Stargate",
    order: "release",
    description: "A military team steps through an ancient alien gate to other worlds, beginning with SG-1's ten seasons. Atlantis spun off mid-run and the two shows overlapped and crossed over for three years, before Universe sent the story further out.",
    entries: [["stargate-sg1"], ["stargate-atlantis"], ["stargate-universe"]],
  },
];
