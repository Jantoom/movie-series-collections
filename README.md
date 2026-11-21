# Movie & Series Collections

A Stremio addon of movie and TV collections: watch orders for stories told across many films and shows (the Marvel Cinematic Universe, Star Wars, Middle-earth, Back to the Future, Evangelion), and collections of titles that share a franchise, character, studio, creator or format (Every Marvel Movie, Every DreamWorks Animation Movie, Every Christopher Nolan Movie, Love Island). It's built weekly by GitHub Actions and served from Cloudflare: the built files as Workers static assets, and a small Worker for the one kind of request a static file can't answer.

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
6. Every movie and show that's in a collection also lists those collections in its own stream list: each is named for the collection and opens it, and its description starts with the collection's catalog, then the title's place in it where the collection keeps an order ("Storyline" / "#14 of 65 · 2008–", where a show's place is its season's) or the collection's size otherwise ("Franchise" / "48 titles · 1966–"). Watch orders come first, then lists, best-loved first; a watch order's Franchise copy is left out for the titles the watch order already has. Stremio lists each addon's streams in the order the addons were installed, so install this addon after your stream addons (AIOStreams, Torrentio, …) to have the collections last.

### Timelines

A timeline's description ends with the same sentence on every timeline collection:

> This collection follows the story's timeline instead of release order.

Only stories that jump around a lot get one: Star Wars, Middle-earth and The Conjuring Universe. Most franchises' timelines are too close to their release order for a second collection to add anything.

### What Stremio allows, and why it works this way

- **Not one poster per season:** Stremio de-duplicates the items in a catalog by id, and every season of a show shares the show's id, so only each show's first season would show.
- **Stream links:** Stremio 5 desktop opens them in the system browser, behind Stremio's warning page. Clicking an entry always opens its stream list, so the stream is the only way an entry can link anywhere.
- **Link chips** (a meta's `links`, like cast and genres) are turned into in-app routes on web and desktop. `?season=N` opens a show on that season's tab, and a Discover link opens a genre.

### How it's served

Everything the build writes is a static file, and Cloudflare serves those without running the Worker (and doesn't count them as Worker requests). A movie's collections are one such file, `stream/movie/<imdb>.json`. Stremio asks for a show's streams per episode (`tt0903747:1:1`), and a file per episode would be well over 100,000 files, so the build writes one index per show (`index/series/<imdb>.json`) and the Worker turns it into that episode's streams. Likewise, each collection's entry streams are one index (`index/collections/<id>.json`) rather than a file per entry, which keeps the build at about 5,000 files, well under the free plan's 20,000. Besides catalog requests, the Worker only runs when no file matches: those episode and entry requests, and movies and shows in no collection (no streams). It runs for every catalog request (`run_worker_first`) because Cloudflare serves a file at its canonical, encoded path (`genre%3DAction.json`) and redirects any other spelling there; Stremio always asks for `genre=Action.json`, so the Worker fetches the file at its canonical path and saves that redirect.

### Choosing what to install

The install page doubles as the addon's **Configure** page. For each catalog:

- its switch puts it in Discover or leaves it out;
- its genres can each be left out, which takes them out of the catalog's genre filter and takes the collections tagged with them out of the catalog (out of **All** and the other genres too);
- the link icon beside its name sets whether movies and shows link to its collections (none turns the links off);
- the search icon sets whether **Search** finds its collections. With none, Search isn't installed.

The manifest URL and install buttons change to match, carrying the choices in the URL: `https://<site>/catalogs=storyline,other;links=storyline;hide=other.Reality-TV/manifest.json`. With everything on, it's the plain URL. Stremio's **Configure** button reopens the page with the installed choices ticked; changing them means installing again.

A configured install runs every request through the Worker, since its URLs match no file. The Worker serves the manifest trimmed to the choices, drops title links to the kinds left out, and serves everything else from the same files, pointing the genre chips at the configured install. A catalog that leaves genres out is rebuilt page by page: the Worker reads its built pages in order, drops the collections with a left-out genre, and stops once it has the page asked for. A collection's genre chips open its first catalog, so a chip may lead to a catalog or genre the install left out.

### Search

**Search** is a catalog of the collections type that Stremio only uses for search results, not in Discover. It finds collections by their own names and by the titles in them, so "iron man" finds the Marvel Cinematic Universe. Every word of the search must match one name: exactly, as the start of a word, or with a typo or two (one in words of 4 to 7 letters, two from 8, with two swapped letters counting as one). Collections named for the search come first, then those holding a matching title, best-loved first. The build writes a small index (`index/search.json`) with each word once, so the Worker compares a search against a few thousand words rather than every title.

## What to check on each device

On each Stremio client you care about (desktop, web, Android TV, mobile):

- [ ] Discover has a **Collections** tab with **Storyline**, **Franchise**, **Person**, **Studio** and **Other**, each starting on **All** with all of its collections, and none of them on the home screen.
- [ ] Each catalog's genres narrow it, and it only lists the genres it uses.
- [ ] Selecting **Marvel Cinematic Universe** shows its genres, then "41 Movies", "24 Series", "36 Seasons", then Iron Man first under **Watch order**.
- [ ] Clicking a movie opens it, and clicking a season opens its show on that season's tab, inside the app.
- [ ] **Star Wars (Timeline)** starts with The Acolyte S1, then The Phantom Menace.
- [ ] Clicking a genre chip opens that genre in the collection's own catalog.
- [ ] Installed with only **Storyline** and Storyline links (from the install page), Discover has just Storyline, Iron Man's stream list links only its watch orders, and the addon's **Configure** button opens the page with those ticked.
- [ ] Searching "iron man" shows the Marvel collections under **Search**, and leaving out a genre (Reality-TV in Other) takes it out of Other's genre filter and takes Love Island out of Other's **All**.
- [ ] On the detail page, selecting an entry shows its description and details, and its **Link to …** stream opens the title (on TV especially).
- [ ] **Iron Man**'s stream list ends with **Collection** links to Marvel Cinematic Universe (#1) and its other collections, and a **Daredevil** season 2 episode shows its place in the Marvel watch order; each opens its collection.

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

The genre chips need the URL the addon is installed from, which the workflow passes in as `SITE_URL`, from the custom domain in `wrangler.jsonc`. A local build without it leaves them out.

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
npm run serve        # runs the Worker and ./dist locally on http://127.0.0.1:7000 (wrangler dev)
```

With the server running, install `http://127.0.0.1:7000/manifest.json` in the Stremio desktop app on the same machine. For working genre chips, build with `SITE_URL=http://127.0.0.1:7000 npm run build`. Stremio Web (web.stremio.com) can't load addons from your own machine, because browsers block HTTPS pages from fetching local addresses. Use the desktop app, or deploy first.
