# Series Collections

A Stremio addon of movie and TV collections: watch orders for stories told across many films and shows (the Marvel Cinematic Universe, Star Wars, the Arrowverse, Star Trek), and lists of every title in a franchise (Marvel, DC). It's hosted as static files on GitHub Pages and rebuilt weekly by GitHub Actions, so there's no server to run.

The collections in `collections.config.mjs` are examples: replace or add to them.

## How it works in Stremio

1. The addon has its own Discover tab, **Collections**, next to Movies and Series. It holds one catalog, **Genre**. Its genre filter starts on **None**, which lists every collection; each genre, such as **Superheroes** or **Sci-Fi**, narrows it to a group. The full list is also the **Genre – Collections** row on the home screen.
2. Each poster is a **collection**, with its years ("2008–" while a show in it is still running). There are three kinds:
   - **Release order**, under its plain name ("Star Wars", "Marvel Cinematic Universe"): movies and seasons by release date.
   - **Timeline**, named "… (Timeline)": movies and seasons in story order. Its description ends with the same sentence on every timeline collection:
     > This collection follows the story's timeline instead of release order.
   - **Plain lists**, named "Every Marvel Series", "Every … Movie" or "Every … Movie and Series", for franchises with no shared continuity. They list each title once, by release.
3. Select a collection: its side panel in Discover, and its detail page, show its groups under **Genres** (each opening that group in Discover), its size under **Contents** ("41 Movies", "24 Series", "36 Seasons"), then its entries, under **Watch order** or **Titles**.
4. Clicking an entry opens it inside the app: a season opens its show on that season's tab, and a movie opens the movie. Streams come from your other addons such as Torrentio, and watch progress stays on the real title.
5. The detail page also lists the entries in its episode column. Selecting one shows a short blurb about it, and its one stream, **Open …**, links to the title. That stream opens inside the app on web, but Stremio 5 desktop sends it to the system browser; it's there to test on TV.

### What Stremio allows, and why it works this way

- **Not one poster per season:** Stremio de-duplicates the items in a catalog by id, and every season of a show shares the show's id, so only each show's first season would show.
- **Stream links:** Stremio 5 desktop opens them in the system browser, behind Stremio's warning page. Clicking an entry always opens its stream list, so the stream is the only way an entry can link anywhere.
- **Link chips** (a meta's `links`, like cast and genres) are turned into in-app routes on web and desktop. `?season=N` opens a show on that season's tab, and a Discover link opens a group.

## What to check on each device

On each Stremio client you care about (desktop, web, Android TV, mobile):

- [ ] Discover has a **Collections** tab with one catalog, **Genre**, that starts on **None** and lists every collection.
- [ ] Each genre (Superheroes, Sci-Fi) shows its own collections.
- [ ] Selecting **Marvel Cinematic Universe** shows **Superheroes** under Genres, then "41 Movies", "24 Series", "36 Seasons" under Contents, then Iron Man first under **Watch order**.
- [ ] Clicking a movie opens it, and clicking a season opens its show on that season's tab, inside the app.
- [ ] **Star Wars (Timeline)** starts with The Acolyte S1, then The Phantom Menace.
- [ ] On the detail page, selecting an entry shows its blurb, and its **Open …** stream opens the title (on TV especially).
- [ ] Clicking **Superheroes** under Genres opens the catalog filtered to Superheroes.

## Where the data comes from

`collections.config.mjs` has a `shows` table and a `movies` table (a short key, IMDb id and title each) and the `collections`, which list entries by key. The build looks every title up on [Cinemeta](https://v3-cinemeta.strem.io), Stremio's own metadata addon, for its poster, description, release date and seasons (episode count, premiere and finale dates).

The build fails, and the last good deployment stays up, when:

- an IMDb id is missing from Cinemeta, or its title there doesn't match the `name` in the config;
- a collection asks for a season Cinemeta doesn't have, a key in neither table, or a season of a movie;
- a plain list asks for a single season (plain lists take whole shows);
- two collections end up with the same name, a collection has no group, or a name or group uses characters it can't.

Titles that aren't out yet are left out until a build after their release. `report.json` on the site lists them under `upcoming`.

**Marvel Cinematic Universe** is what Marvel Studios counts: the films, the Disney+ series, and the Netflix shows it added to its official timeline in January 2024. **Marvel Cinematic Universe (Unofficial)** adds the ABC, Hulu and Freeform shows, which Marvel Studios has never counted. Marvel Animation's own-universe shows (X-Men '97, Your Friendly Neighborhood Spider-Man) are in **Every Marvel Series**.

**Star Wars (Timeline)** follows the Disney+ Star Wars timeline's grouping, which keeps each show's seasons together. Maul: Shadow Lord, the Tales anthologies and The Mandalorian and Grogu are placed by their settings.

The genre chips need the URL the addon is installed from, which the workflow passes in as `SITE_URL`. A local build without it leaves them out.

## Customising

Edit `collections.config.mjs` and push; the workflow rebuilds automatically. The comment above `collections` lists every option.

- **Add a show or movie:** add it to `shows` or `movies` with a short key. To find its IMDb id, search Cinemeta: `https://v3-cinemeta.strem.io/catalog/series/top/search=<title>.json` (or `catalog/movie/…`).
- **Add a release-order collection:** `order: "release"`, listing `[key]` for each movie or show (every season), or `[key, 2]` for one season.
- **Add a timeline:** `order: "timeline"`, with entries in story order. Only worth it when the story jumps around a lot, as Star Wars does.
- **Add a plain list:** leave `order` out. The name becomes "Every <name> Series/Movie/Movie and Series" from what it holds.
- **Groups:** `group` is one group or a list of them. A new group adds a genre option.
- **Descriptions:** up to three sentences on what the collection is and where its titles come from. Each entry gets its own blurb from Cinemeta automatically.

## Local testing

```
npm test             # unit tests and a full build against a fake Cinemeta
npm run build        # real build into ./dist (needs internet)
npm run serve        # serves ./dist on http://127.0.0.1:7000
```

With the server running, install `http://127.0.0.1:7000/manifest.json` in the Stremio desktop app on the same machine. For working genre chips, build with `SITE_URL=http://127.0.0.1:7000 npm run build`. Stremio Web (web.stremio.com) can't load addons from your own machine, because browsers block HTTPS pages from fetching local addresses. Use the desktop app, or deploy to GitHub Pages first.
