# Movie & Series Collections

A Stremio addon of movie and TV collections: watch orders for stories told across many films and shows (the Marvel Cinematic Universe, Star Wars, Middle-earth, Back to the Future, Evangelion), and collections of titles that share a franchise, character, studio, creator or format (Every Marvel Movie, Every DreamWorks Animation Movie, Every Christopher Nolan Movie, Love Island). It's hosted as static files on GitHub Pages and rebuilt weekly by GitHub Actions, so there's no server to run.

The collections in `collections.config.mjs` are a starting set: replace or add to them.

## How it works in Stremio

1. The addon has its own Discover tab, **Collections**, next to Movies and Series, with two catalogs:
   - **Connected Storyline:** watch orders, whose entries tell one story. Any run of three or more connected titles gets one, and so do big pairs (The Batman and The Penguin). Alternate tellings of the same characters count, like the Evangelion Rebuild films or Halloween's rival timelines. Most are in release order under their plain name ("Star Wars"); a few follow the story's timeline, named "… (Timeline)".
   - **Other:** titles that share an IP, studio, creator or format but not one story, each listed once by release date ("Every Marvel Movie", "James Bond", "Love Island"). Regional versions that share a title are labelled by country, or by year when that doesn't tell them apart.
   Each catalog lists its most popular collections first: the average rank of each collection's five most popular titles on Cinemeta (TMDB, Stremio and Trakt popularity, movies ranked against movies and series against series).
2. Each catalog's genre filter starts on **None**, which lists all of its collections, and each genre (Action, Sci-Fi, Reality-TV, Anime, …) narrows it. Each catalog only offers the genres its collections use. Both catalogs also get a home-screen row.
3. Each poster is a **collection**, with its years ("2008–" while a show in it is still running). Selecting one shows its **Genres** (each opening that genre in the same catalog), its size under **Contents** ("41 Movies", "24 Series", "36 Seasons"), then its entries under **Watch order** or **Titles**.
4. Clicking an entry opens it inside the app: a season opens its show on that season's tab, a show opens the show, and a movie opens the movie. Streams come from your other addons such as Torrentio, and watch progress stays on the real title.
5. The detail page also lists the entries in its episode column. Selecting one shows a short blurb about it, and its one stream, **Open …**, links to the title. That stream opens inside the app on web, but Stremio 5 desktop sends it to the system browser.

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

- [ ] Discover has a **Collections** tab with **Connected Storyline** and **Other**, each starting on **None** with all of its collections.
- [ ] Each catalog's genres narrow it, and it only lists the genres it uses.
- [ ] Selecting **Marvel Cinematic Universe** shows its genres, then "41 Movies", "24 Series", "36 Seasons", then Iron Man first under **Watch order**.
- [ ] Clicking a movie opens it, and clicking a season opens its show on that season's tab, inside the app.
- [ ] **Star Wars (Timeline)** starts with The Acolyte S1, then The Phantom Menace.
- [ ] Clicking a genre chip opens that genre in the collection's own catalog.
- [ ] On the detail page, selecting an entry shows its blurb, and its **Open …** stream opens the title (on TV especially).

## Where the data comes from

`collections.config.mjs` has a `shows` table and a `movies` table (a short key, IMDb id and title each) and the `collections`, which list entries by key. The build looks every title up on [Cinemeta](https://v3-cinemeta.strem.io), Stremio's own metadata addon, for its poster, description, release date and seasons (episode count, premiere and finale dates).

A title Cinemeta doesn't have, or has under a different name from the config's `name` (a typo'd id, or a regional show it renamed), is left out of that build. The build log and `report.json` list them under `skipped`. Cinemeta's servers don't always agree on these, so one show can't hold up the rest.

The build fails, and the last good deployment stays up, when:

- none of a collection's titles are on Cinemeta;
- a collection asks for a season Cinemeta doesn't have, a key in neither table, or a season of a movie;
- an Other collection asks for a single season (Other collections take whole shows);
- two collections end up with the same name, a collection has no genres, or a name or genre uses characters it can't.

Titles that aren't out yet are left out until a build after their release. `report.json` on the site lists them under `upcoming`, with each collection's popularity score. Cinemeta dates many films by their US release (Japanese anime, older European films) or a re-release (it dates The End of Evangelion to 2024), and has no date for a few; the config gives those a `released` date, which wins over Cinemeta's. Seasons of finished shows that have no episode dates count as aired.

**Marvel Cinematic Universe** is what Marvel Studios counts: the films, the Disney+ series, and the Netflix shows it added to its official timeline in January 2024. **Marvel Cinematic Universe (Unofficial)** adds the ABC, Hulu and Freeform shows, which Marvel Studios has never counted. Marvel Animation's own-universe shows (X-Men '97, Your Friendly Neighborhood Spider-Man) are in **Every Marvel Series**.

**Star Wars (Timeline)** follows the Disney+ Star Wars timeline's grouping, which keeps each show's seasons together. Maul: Shadow Lord, the Tales anthologies and The Mandalorian and Grogu are placed by their settings.

The genre chips need the URL the addon is installed from, which the workflow passes in as `SITE_URL`. A local build without it leaves them out.

## Customising

Edit `collections.config.mjs` and push; the workflow rebuilds automatically. The comment above `collections` lists every option.

- **Add a show or movie:** add it to `shows` or `movies` with a short key. To find its IMDb id, search Cinemeta: `https://v3-cinemeta.strem.io/catalog/series/top/search=<title>.json` (or `catalog/movie/…`). If search can't find it, Cinemeta can usually still look it up by IMDb id.
- **Add a watch order:** `order: "release"`, listing `[key]` for each movie or show (every season), or `[key, 2]` for one season. It goes in Connected Storyline.
- **Add a timeline:** `order: "timeline"`, with entries in story order. Only worth it when the story jumps around a lot.
- **Add an Other collection:** leave `order` out. Name it after the franchise or brand; use "Every …" only when its titles mostly belong to other collections too ("Every Marvel Series", "Every Pixar Movie"). `first: [key]` lists a title ahead of the dates, so the collection's poster comes from a title that has one.
- **Fix a release date:** give the title a `released` date in `shows` or `movies`; it wins over Cinemeta's.
- **Genres:** a list per collection. A new genre adds a filter option to the collection's catalog.
- **Descriptions:** up to three sentences on what the collection is and where its titles come from. Each entry gets its own blurb from Cinemeta automatically.

## Local testing

```
npm test             # unit tests and a full build against a fake Cinemeta
npm run build        # real build into ./dist (needs internet)
npm run serve        # serves ./dist on http://127.0.0.1:7000
```

With the server running, install `http://127.0.0.1:7000/manifest.json` in the Stremio desktop app on the same machine. For working genre chips, build with `SITE_URL=http://127.0.0.1:7000 npm run build`. Stremio Web (web.stremio.com) can't load addons from your own machine, because browsers block HTTPS pages from fetching local addresses. Use the desktop app, or deploy to GitHub Pages first.
