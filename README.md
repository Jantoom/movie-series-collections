# Series Collections

A Stremio addon of TV series collections: watch orders, season by season, for stories that weave between shows (the Marvel Cinematic Universe, the Arrowverse, Star Trek), and lists of every show in a franchise (Marvel, DC). It's hosted as static files on GitHub Pages and rebuilt weekly by GitHub Actions, so there's no server to run.

The collections in `collections.config.mjs` are examples: replace or add to them.

## How it works in Stremio

1. The addon adds one catalog, **Collections**, under Discover → Series. Its genre filter picks a **group**, such as **Superheroes** or **Sci-Fi**. With no genre picked (the dropdown just reads "Genre"), it lists every collection. That full list is also the **Collections** row on the home screen.
2. Each poster is a **collection**, with its years ("2015–" while a show in it is still running). There are two kinds:
   - **Watch orders**, named "… (Release Order)" or "… (Chronological)". They list every season in order under **Watch order** ("Daredevil S1", "Jessica Jones S1", "Daredevil S2", …), and each one opens that show on that season's tab.
   - **Plain lists**, named without a suffix ("Marvel", "DC"), for shows with no shared continuity. They list each show once, by premiere, under **Series**, and each one opens the show.
3. Select a collection: its side panel in Discover, and its detail page, show its groups under **Genres** (each opening that group in Discover), its size under **Contents** ("24 Series", "36 Seasons"), then the list.
4. Clicking a season or show opens it inside the app. Streams come from your other addons such as Torrentio, and watch progress stays on the real show.
5. The detail page also shows the list as one long run of entries in its episode column. Entries have no streams, so clicking one shows Stremio's "no streams" message: the links on the left are what open a show (see below).

### Release order and chronological order

A **Release Order** collection sorts seasons by premiere date. A **Chronological** one follows the story, and its description ends with the same sentence on every such collection:

> This collection follows the story's timeline instead of release order.

### What Stremio allows, and why it works this way

- **Not one poster per season:** Stremio de-duplicates the items in a catalog by id, and every season of a show shares the show's id, so only each show's first season would show.
- **Not a stream link per season:** Stremio 5 desktop opens stream links in the system browser, behind Stremio's warning page.
- **Entries can't open a show:** clicking an entry always opens that entry's stream list, and the only way out of a stream list is a stream link, which desktop sends to the browser.
- **Link chips** (a meta's `links`, like cast and genres) are turned into in-app routes on web and desktop. `?season=N` opens a show on that season's tab, and a Discover link opens a group.

## What to check on each device

On each Stremio client you care about (desktop, web, Android TV, mobile):

- [ ] The **Collections** row shows on the home screen, with every collection.
- [ ] Discover → Series → **Collections** lists every collection with no genre picked, and each group in the genre filter shows its own.
- [ ] Selecting **Marvel Cinematic Universe (Chronological)** shows **Superheroes** under Genres, "24 Series" and "36 Seasons" under Contents, then its seasons under **Watch order**, starting with Eyes of Wakanda S1, then I Am Groot S1 and S2.
- [ ] Clicking a season opens that show on that season's tab, inside the app.
- [ ] Selecting **Marvel** lists its shows under **Series**, and clicking one opens the show.
- [ ] Clicking **Superheroes** under Genres opens Collections filtered to Superheroes.

## Where the data comes from

`collections.config.mjs` has a `shows` table (a short key, IMDb id and title per show) and the `collections`, which list seasons by show key. The build looks every show up on [Cinemeta](https://v3-cinemeta.strem.io), Stremio's own metadata addon, for its poster and seasons (episode count, premiere and finale dates).

The build fails, and the last good deployment stays up, when:

- a show's IMDb id is missing from Cinemeta, or its title there doesn't match the `name` in `shows`;
- a collection asks for a season Cinemeta doesn't have, or a show key that isn't in `shows`;
- a plain list asks for a single season (plain lists take whole shows);
- two collections end up with the same name, a collection has no group, or a name or group uses characters other than letters, digits, spaces, `'`, `&` and `-`.

Seasons that haven't aired yet are left out until a build after their premiere. `report.json` on the site lists them under `upcoming`.

The **Marvel Cinematic Universe (Chronological)** order is Disney+'s official complete MCU timeline (as of VisionQuest), series only. It includes the Netflix shows, which Marvel added in January 2024. It leaves out the ABC/Hulu/Freeform shows and Marvel Animation's own-universe shows (X-Men '97, Your Friendly Neighborhood Spider-Man), which aren't on that timeline; those are in **Marvel**.

The genre chips need the URL the addon is installed from, which the workflow passes in as `SITE_URL`. A local build without it leaves them out.

## Customising

Edit `collections.config.mjs` and push; the workflow rebuilds automatically. The comment above `collections` lists every option.

- **Add a show:** add it to `shows` with a short key. To find its IMDb id, search Cinemeta: `https://v3-cinemeta.strem.io/catalog/series/top/search=<title>.json`.
- **Add a watch order:** add a collection with `order: "release"`, listing `[showKey]` for every season of a show or `[showKey, 2]` for one season. For `order: "chronological"`, list the seasons in story order. The suffix and the chronological sentence are added for you.
- **Add a plain list:** leave `order` out and list `[showKey]` for each show.
- **Groups:** `group` is one group or a list of them. A new group adds a genre filter option. Groups appear in the order collections first use them.
- **Names:** spell them out ("Marvel Cinematic Universe", not "MCU"). The same name can be used for a release order, a chronological order and a plain list.

## Local testing

```
npm test             # unit tests and a full build against a fake Cinemeta
npm run build        # real build into ./dist (needs internet)
npm run serve        # serves ./dist on http://127.0.0.1:7000
```

With the server running, install `http://127.0.0.1:7000/manifest.json` in the Stremio desktop app on the same machine. For working genre chips, build with `SITE_URL=http://127.0.0.1:7000 npm run build`. Stremio Web (web.stremio.com) can't load addons from your own machine, because browsers block HTTPS pages from fetching local addresses. Use the desktop app, or deploy to GitHub Pages first.
