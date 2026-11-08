# Series Collections

A Stremio addon of TV series collections in watch order, season by season, so stories that weave between shows (MCU, Arrowverse, Star Trek) can be watched in the right order. It's hosted as static files on GitHub Pages and rebuilt weekly by GitHub Actions, so there's no server to run.

The collections in `collections.config.mjs` are examples: replace or add to them.

## How it works in Stremio

1. The addon adds one catalog, **Collections**, under Discover → Series. Its genre filter picks a **group**, such as **Superheroes** or **Sci-Fi**. The first group is also the **Collections** row on the home screen.
2. Each poster in a group is a **collection**, such as **MCU**, **MCU (Chronological)** or **Arrowverse**.
3. Select a collection: its side panel in Discover, and its detail page, list every season in order under **Watch order** ("Daredevil · Season 1", "Jessica Jones · Season 1", "Daredevil · Season 2", …).
4. Click a season: Stremio opens that show, inside the app, on that season's tab. Streams come from your other addons such as Torrentio, and watch progress stays on the real show.

### Release order and chronological order

Collections are in **release order** by default: seasons sorted by premiere date. A collection made for the story's timeline is marked **(Chronological)**, and its description ends with the same sentence on every such collection:

> Chronological collections follow the story's own timeline instead of air dates, so seasons can jump between shows and out of release order.

### Why links, not posters or streams

- **Not one poster per season:** Stremio de-duplicates the items in a catalog by id, and every season of a show shares the show's id, so only each show's first season would show.
- **Not a stream link per season:** Stremio 5 desktop opens stream links in the system browser, behind Stremio's warning page.
- **Link chips** (a meta's `links`, like cast and genres) are turned into in-app routes on web and desktop, and `?season=N` opens the season's tab.

## What to check on each device

On each Stremio client you care about (desktop, web, Android TV, mobile):

- [ ] The **Collections** row shows on the home screen, with the Superheroes collections.
- [ ] Discover → Series → **Collections** lists the groups in the genre filter, and each group shows its collection posters.
- [ ] Selecting **MCU (Chronological)** lists its seasons under **Watch order**, starting with Eyes of Wakanda · Season 1, then I Am Groot · Season 1 and 2.
- [ ] Clicking a season opens that show on that season's tab, inside the app.
- [ ] The collection's detail page shows the same **Watch order** links.

## Where the data comes from

`collections.config.mjs` has a `shows` table (a short key, IMDb id and title per show) and the `collections`, which list seasons by show key. The build looks every show up on [Cinemeta](https://v3-cinemeta.strem.io), Stremio's own metadata addon, for its poster and seasons (episode count, premiere date).

The build fails, and the last good deployment stays up, when:

- a show's IMDb id is missing from Cinemeta, or its title there doesn't match the `name` in `shows`;
- a collection asks for a season Cinemeta doesn't have, or a show key that isn't in `shows`;
- two collections end up with the same name, or a name or group uses characters other than letters, digits, spaces, `'`, `&` and `-`.

Seasons that haven't aired yet are left out until a build after their premiere. `report.json` on the site lists them under `upcoming`.

The **MCU (Chronological)** order is Disney+'s official complete MCU timeline (as of VisionQuest), series only. It includes the Netflix shows, which Marvel added in January 2024. It leaves out the ABC/Hulu/Freeform shows and the own-universe animation (X-Men '97, Your Friendly Neighborhood Spider-Man), which aren't on that timeline.

## Customising

Edit `collections.config.mjs` and push; the workflow rebuilds automatically. The comment above `collections` lists every option.

- **Add a show:** add it to `shows` with a short key. To find its IMDb id, search Cinemeta: `https://v3-cinemeta.strem.io/catalog/series/top/search=<title>.json`.
- **Add a collection:** add an entry to `collections` with a `group`. List `[showKey]` for every season of a show, or `[showKey, 2]` for one season.
- **Chronological collection:** set `order: "chronological"` and list the seasons in story order. The " (Chronological)" suffix and the standard sentence are added for you. A release-order and a chronological collection can share a name and a season list, as the two MCU collections do.
- **Groups:** a new `group` value adds a genre filter option. Groups appear in the order collections first use them, and the first is the home-screen row.

## Local testing

```
npm test             # unit tests and a full build against a fake Cinemeta
npm run build        # real build into ./dist (needs internet)
npm run serve        # serves ./dist on http://127.0.0.1:7000
```

With the server running, install `http://127.0.0.1:7000/manifest.json` in the Stremio desktop app on the same machine. Stremio Web (web.stremio.com) can't load addons from your own machine, because browsers block HTTPS pages from fetching local addresses. Use the desktop app, or deploy to GitHub Pages first.
