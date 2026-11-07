# Series Collections

A Stremio addon of TV series collections in watch order, one poster per **season**, so stories that weave between shows (MCU, Star Trek) can be watched in the right order. It's hosted as static files on GitHub Pages and rebuilt weekly by GitHub Actions, so there's no server to run.

The collections in `collections.config.mjs` (MCU, Marvel Television, Star Trek) are examples: replace or add to them.

## How it works in Stremio

- The addon adds one catalog, **Collections**, under Discover → Series. Its genre filter picks the collection, so the Series tab doesn't fill up with one catalog per franchise.
- The first collection (**MCU**, in release order) is also the **Collections** row on the home screen.
- Each poster is one season, named like "Season 2 · Loki". Clicking it opens Loki itself, on season 2's first episode, with streams from your other addons such as Torrentio. Watch progress and Continue Watching stay on the real show.

### Release order and chronological order

Collections are in **release order** by default: seasons sorted by premiere date. A collection made for the story's timeline is marked **(Chronological)**, and its description ends with the same sentence on every such collection:

> Chronological collections follow the story's own timeline instead of air dates, so seasons can jump between shows and out of release order.

Collection descriptions appear on each poster in Discover's side panel, since Stremio has nowhere to show a genre's description, and on the install page.

### Why posters and not links

An earlier version used a "collection" page whose entries linked to the shows through a stream. Stremio 5 desktop opens every stream link in the system browser, behind Stremio's warning page, so that hop could never stay inside the app. Catalog posters navigate inside the app on web and desktop alike. The trade-off: a poster lands on the season's first episode, not on the season tab of the episode list.

## What to check on each device

On each Stremio client you care about (desktop, web, Android TV, mobile):

- [ ] The **Collections** row shows on the home screen, with the MCU seasons in release order.
- [ ] Discover → Series → **Collections** lists every collection in the genre filter, and each one loads.
- [ ] **MCU (Chronological)** starts with Eyes of Wakanda, then I Am Groot.
- [ ] Clicking a poster opens the real show, on that season's first episode, inside the app.
- [ ] From there, the episode plays through your normal stream addons.

## Where the data comes from

`collections.config.mjs` has a `shows` table (a short key, IMDb id and title per show) and the `collections`, which list seasons by show key. The build looks every show up on [Cinemeta](https://v3-cinemeta.strem.io), Stremio's own metadata addon, for its poster, description and seasons (episode count, first episode, premiere date).

The build fails, and the last good deployment stays up, when:

- a show's IMDb id is missing from Cinemeta, or its title there doesn't match the `name` in `shows`;
- a collection asks for a season Cinemeta doesn't have, or a show key that isn't in `shows`;
- two collections end up with the same name, or a name uses characters other than letters, digits, spaces, `'`, `&` and `-`.

Seasons that haven't aired yet are left out until a build after their premiere. `report.json` on the site lists them under `upcoming`.

The **MCU (Chronological)** order is Disney+'s official complete MCU timeline (as of VisionQuest), series only. It includes the Netflix shows, which Marvel added in January 2024. It leaves out the ABC/Hulu/Freeform shows and the own-universe animation (X-Men '97, Your Friendly Neighborhood Spider-Man), which aren't on that timeline.

## Customising

Edit `collections.config.mjs` and push; the workflow rebuilds automatically. The comment above `collections` lists every option.

- **Add a show:** add it to `shows` with a short key. To find its IMDb id, search Cinemeta: `https://v3-cinemeta.strem.io/catalog/series/top/search=<title>.json`.
- **Add a collection:** add an entry to `collections`. List `[showKey]` for every season of a show, or `[showKey, 2]` for one season.
- **Chronological collection:** set `order: "chronological"` and list the seasons in story order. The " (Chronological)" suffix and the standard sentence are added for you. A release-order and a chronological collection can share a name and a season list, as the two MCU collections do.
- **Home-screen row:** the first collection is the default, so keep a release-order one first.

## Local testing

```
npm test             # unit tests and a full build against a fake Cinemeta
npm run build        # real build into ./dist (needs internet)
npm run serve        # serves ./dist on http://127.0.0.1:7000
```

With the server running, install `http://127.0.0.1:7000/manifest.json` in the Stremio desktop app on the same machine. Stremio Web (web.stremio.com) can't load addons from your own machine, because browsers block HTTPS pages from fetching local addresses. Use the desktop app, or deploy to GitHub Pages first.
