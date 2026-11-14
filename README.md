# Movie & Series Collections

A Stremio addon of movie and TV collections: watch orders for stories told across many films and shows (the Marvel Cinematic Universe, Star Wars, Middle-earth, Back to the Future, Evangelion), and collections of titles that share a franchise, character, studio, creator or format (Every Marvel Movie, Every DreamWorks Animation Movie, Every Christopher Nolan Movie, Love Island). It's hosted as static files on GitHub Pages and rebuilt weekly by GitHub Actions, so there's no server to run.

The collections in `collections.config.mjs` are a starting set: replace or add to them.

## How it works in Stremio

1. The addon has its own Discover tab, **Collections**, next to Movies and Series, with five catalogs:
   - **Storyline:** watch orders, whose entries tell one story. Any run of three or more connected titles gets one, and so do big pairs (The Batman and The Penguin). Titles count as connected only if they share continuity: sequels, prequels and spin-offs, or a reboot that reuses earlier titles 1:1, through the same performances or the same events retold closely (the Evangelion Rebuild films, Halloween's 2018 trilogy with Jamie Lee Curtis). Remakes that reinterpret the story, like Rob Zombie's Halloween, are left out. Most are in release order under their plain name ("Star Wars"); a few follow the story's timeline, named "… (Timeline)".
   - **Franchise:** everything in a franchise, game, character, brand or show with many regional versions ("Every Marvel Movie", "Marvel Cinematic Universe (Multiverse)", "James Bond", "Love Island"). Every Storyline watch order with more than three titles also appears here as a list, in the same order, along with the remakes it leaves out (in release order among them). That includes the Marvel Cinematic Universe and its Unofficial version.
   - **Person:** everything by a director or personality ("Every Christopher Nolan Movie", "Every Gordon Ramsay Series").
   - **Studio:** everything from a studio ("Every Pixar Movie", "Every Studio Ghibli Movie").
   - **Other:** lists that fit none of these ("Every Christmas Movie", "IMDb Top 250 Movies", "IMDb Top 250 Series", and award winners named after the award, like "Oscar Awards - Best Picture", "Cannes Film Festival - Palme d'Or" and "Emmy Awards - Outstanding Drama Series").
   Lists have each title once. Directly connected titles (sequels, prequels and spin-offs that carry the story on) stay together in release order, so you can take in a series at a glance, and the most watched groups come first: by the average number of IMDb votes, so by how many people have seen them rather than how well they rated (titles IMDb has no vote count for go after, by rating). A title with no sequels is a group of one, so a list of reality shows is simply most watched first. A collection's poster is the first title of its top group. A Franchise copy of a watch order keeps the watch order's order instead, the IMDb Top 250 lists keep IMDb's rank order, and the award lists go by award year, newest winner first (a show that won more than once sits at its latest win). A collection can be in more than one catalog. An "Every …" collection's years stay open ("1995–"), since more titles may come, unless its studio has closed or its person has died or retired. Regional versions that share a title are labelled by country, or by year when that doesn't tell them apart, and local-language titles show their English names ("Big Brother Spain").
   Each catalog lists its best-loved collections first: the average score of each collection's five best titles, where a title's score is its IMDb rating weighted by the log of its vote count, so a well-loved hit beats both a little-seen favourite and a widely seen flop. The ratings come from [IMDb's public dataset](https://developer.imdb.com/non-commercial-datasets/), downloaded at each build.
2. Each catalog's genre filter starts on **All**, which lists all of its collections, and each genre (Action, Sci-Fi, Reality-TV, Anime, …) narrows it. Each catalog only offers the genres its collections use. The genre is required, which keeps the catalogs off the home screen: they're only in Discover.
3. Each poster is a **collection**, with its years ("2008–" while a show in it is still running). Selecting one shows its **Genres** (each opening that genre in the same catalog), its size under **Contents** ("41 Movies", "24 Series", "36 Seasons"), then its entries under **Watch order** or **Titles**.
4. Clicking an entry opens it inside the app: a season opens its show on that season's tab, a show opens the show, and a movie opens the movie. Streams come from your other addons such as Torrentio, and watch progress stays on the real title.
5. The detail page also lists the entries in its episode column. Season 1 has everything; a collection with both movies and series adds season 2 with just its movies and season 3 with just its series. (Stremio has no per-season descriptions, so the seasons only have numbers.) Selecting one shows its description from Cinemeta, ending with its year, or its seasons or episodes, in brackets ("(1988 movie)", "(Season 1, 2008–2009, 22 episodes)"). Its one stream, **Link to Movie**, **Link to Series** or **Link to Season** with "Tap to watch", links to the title. That stream opens inside the app on web, but Stremio 5 desktop sends it to the system browser.

### Timelines

A timeline's description ends with the same sentence on every timeline collection:

> This collection follows the story's timeline instead of release order.

Only stories that jump around a lot get one: Star Wars, Middle-earth and The Conjuring Universe. Most franchises' timelines are too close to their release order for a second collection to add anything.

### What Stremio allows, and why it works this way

- **Not one poster per season:** Stremio de-duplicates the items in a catalog by id, and every season of a show shares the show's id, so only each show's first season would show.
- **Stream links:** Stremio 5 desktop opens them in the system browser, behind Stremio's warning page. Clicking an entry always opens its stream list, so the stream is the only way an entry can link anywhere.
- **Link chips** (a meta's `links`, like cast and genres) are turned into in-app routes on web and desktop. `?season=N` opens a show on that season's tab, and a Discover link opens a genre.

## What to check on each device

On each Stremio client you care about (desktop, web, Android TV, mobile):

- [ ] Discover has a **Collections** tab with **Storyline**, **Franchise**, **Person**, **Studio** and **Other**, each starting on **All** with all of its collections, and none of them on the home screen.
- [ ] Each catalog's genres narrow it, and it only lists the genres it uses.
- [ ] Selecting **Marvel Cinematic Universe** shows its genres, then "41 Movies", "24 Series", "36 Seasons", then Iron Man first under **Watch order**.
- [ ] Clicking a movie opens it, and clicking a season opens its show on that season's tab, inside the app.
- [ ] **Star Wars (Timeline)** starts with The Acolyte S1, then The Phantom Menace.
- [ ] Clicking a genre chip opens that genre in the collection's own catalog.
- [ ] On the detail page, selecting an entry shows its description and details, and its **Link to …** stream opens the title (on TV especially).

## Where the data comes from

`collections.config.mjs` has a `shows` table and a `movies` table (a short key, IMDb id and title each) and the `collections`, which list entries by key. The build looks every title up on [Cinemeta](https://v3-cinemeta.strem.io), Stremio's own metadata addon, for its poster, description, release date and seasons (episode count, premiere and finale dates).

A title Cinemeta doesn't have, or has under a different name from the config's `name` (a typo'd id, or a regional show it renamed), is left out of that build. The build log and `report.json` list them under `skipped`. Cinemeta's servers don't always agree on these, so one show can't hold up the rest.

The build fails, and the last good deployment stays up, when:

- none of a collection's titles are on Cinemeta;
- a collection asks for a season Cinemeta doesn't have, a key in neither table, or a season of a movie;
- a list asks for a single season (lists take whole shows);
- two collections end up with the same name, a collection has no genres, or a name or genre uses characters it can't.

Titles that aren't out yet are left out until a build after their release. `report.json` on the site lists them under `upcoming`, with each collection's score. Cinemeta dates many films by their US release (Japanese anime, older European films) or a re-release (it dates The End of Evangelion to 2024), and has no date for a few; the config gives those a `released` date, which wins over Cinemeta's. Seasons of finished shows that have no episode dates count as aired.

**Marvel Cinematic Universe** is what Marvel Studios counts: the films, the Disney+ series, and the Netflix shows it added to its official timeline in January 2024. **Marvel Cinematic Universe (Unofficial)** adds the ABC, Hulu and Freeform shows, which Marvel Studios has never counted. Marvel Animation's own-universe shows (X-Men '97, Your Friendly Neighborhood Spider-Man) are in **Every Marvel Series**.

**IMDb Top 250 Movies** and **IMDb Top 250 Series** come from [MDBList](https://mdblist.com)'s copies of IMDb's charts ([movies](https://mdblist.com/lists/snoak/imdb-top-250-movies), [shows](https://mdblist.com/lists/snoak/imdb-top-250-shows)), fetched at every build, since IMDb blocks automated downloads of its own chart pages. MDBList's shows list leaves out the few shows it can't match, so it has a little under 250. If MDBList can't be reached, the build fails and the last good deployment stays up.

**Star Wars (Timeline)** follows the Disney+ Star Wars timeline's grouping, which keeps each show's seasons together. Maul: Shadow Lord, the Tales anthologies and The Mandalorian and Grogu are placed by their settings.

The genre chips need the URL the addon is installed from, which the workflow passes in as `SITE_URL`. A local build without it leaves them out.

## Customising

Edit `collections.config.mjs` and push; the workflow rebuilds automatically. The comment above `collections` lists every option.

- **Add a show or movie:** add it to `shows` or `movies` with a short key. To find its IMDb id, search Cinemeta: `https://v3-cinemeta.strem.io/catalog/series/top/search=<title>.json` (or `catalog/movie/…`). If search can't find it, Cinemeta can usually still look it up by IMDb id.
- **Add a watch order:** `order: "release"`, listing `[key]` for each movie or show (every season), or `[key, 2]` for one season. It goes in Storyline. Only list titles that share continuity (see above).
- **Add a timeline:** `order: "timeline"`, with entries in story order. Only worth it when the story jumps around a lot.
- **Add a list:** leave `order` out and give it `catalogs` (`"franchise"`, `"person"`, `"studio"` or `"other"`). Name it after the franchise, person or studio; use "Every …" only when its titles mostly belong to other collections too ("Every Marvel Series", "Every Pixar Movie").
- **Franchise copies:** a release-order watch order with more than three titles gets one automatically. `franchise: false` turns it off; `franchise: { extra: [[key]], description }` adds remakes the story leaves out.
- **Close an "Every …" collection:** `ended: true` once its studio closes or its person dies or retires, so its years stop at the last title.
- **Keep a list in your own order:** `sort: "listed"` keeps its entries in the order given instead of most watched first.
- **Fill a list from MDBList:** `source: "https://mdblist.com/lists/<user>/<list>"` instead of `entries`. Each build fetches the list and takes its titles in its order; titles not in `shows` or `movies` are looked up by IMDb id under Cinemeta's name.
- **Keep titles together in lists:** each release-order watch order counts as one group, except those marked `universe: true` (the MCU's films are connected, but they aren't all sequels). Add the rest to `sequels`, one array of keys per group.
- **Show an English name:** give the title a `title` in `shows` or `movies`.
- **Fix a release date:** give the title a `released` date in `shows` or `movies`; it wins over Cinemeta's.
- **Genres:** a list per collection. A new genre adds a filter option to the collection's catalog.
- **Descriptions:** up to three sentences on what the collection is and where its titles come from. Each entry gets its own description from Cinemeta automatically.

## Local testing

```
npm test             # unit tests and a full build against a fake Cinemeta
npm run build        # real build into ./dist (needs internet)
npm run serve        # serves ./dist on http://127.0.0.1:7000
```

With the server running, install `http://127.0.0.1:7000/manifest.json` in the Stremio desktop app on the same machine. For working genre chips, build with `SITE_URL=http://127.0.0.1:7000 npm run build`. Stremio Web (web.stremio.com) can't load addons from your own machine, because browsers block HTTPS pages from fetching local addresses. Use the desktop app, or deploy to GitHub Pages first.
