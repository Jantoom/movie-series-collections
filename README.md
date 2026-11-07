# Series Collections

A Stremio addon that groups TV series into collections you browse by poster rather than through Discover's dropdowns. It's hosted as static files on GitHub Pages and rebuilt weekly by GitHub Actions, so there's no server to run.

This is a prototype of the "deep-link" pattern for collections of *shows*, which need their own season and episode pages, unlike collections of films. The collections in `collections.config.mjs` (Marvel and Star Trek) are examples: replace or add to them.

## How it works in Stremio

1. Each **row** in the config is a row of posters on the home screen, such as **Marvel Collections – Series** and **Star Trek Collections – Series**. Rows also appear under Discover → Series.
2. Each **collection** is one poster in its row. Opening it shows its series as "episodes":
   - By default, they're sorted by premiere date, with one "season" per year (Season 2021, Season 2022, …), so the season picker reads as a timeline.
   - With `order: "listed"`, they keep the config's order in a single season, for a watch order or story order (see *Star Trek in Story Order*).
3. Picking a series opens the stream list, which has a single entry: **Open \<show\> →**.
4. That entry is a `stremio:///detail/series/<imdb id>` link. It opens the show's real page, with its seasons, episodes, and streams from your other addons such as Torrentio. Watch progress stays on that real show.

The extra click in step 3 is the price of the pattern. Stremio can't nest one detail page inside another, so a video's stream list is the only place an addon can put a "go here" link.

The collection page also lists each show as a link chip, in a **Series** group next to cast and genres. That's a fallback for clients that ignore deep links in streams, on clients that display custom link groups.

## What to check on each device

This is the reason the prototype exists. On each Stremio client you care about (desktop, web, Android TV, mobile), check:

- [ ] Both collection rows show on the home screen, with posters.
- [ ] Opening a collection lists the shows under year "seasons". *Star Trek in Story Order* shows them as one season, in story order.
- [ ] Picking a show and then **Open \<show\> →** lands on the real show page, without opening a browser or showing an error.
- [ ] From there, an episode plays through your normal stream addons.
- [ ] The **Series** link chips show on the collection page, and they open the show.

## Where the data comes from

`collections.config.mjs` lists each collection's shows by IMDb id. The build looks every id up on [Cinemeta](https://v3-cinemeta.strem.io), Stremio's own metadata addon, for the title, premiere date, poster, background and description. The build fails, and the last good deployment stays up, when:

- an id is missing from Cinemeta, or its title there doesn't match the show's `name` in the config;
- a row or collection id is used twice;
- an `order` is something other than `"release"` or `"listed"`.

Specials and films (Werewolf by Night, for example) can't go in a collection, since the deep link always opens a *series* page.

## Customising

Edit `collections.config.mjs` and push; the workflow rebuilds automatically. The comment at the top of the file lists every option.

- **Add a show:** add `{ imdb: "tt…", name: "…" }` to a collection's `shows`. To find an id, search Cinemeta: `https://v3-cinemeta.strem.io/catalog/series/top/search=<title>.json`.
- **Add a collection:** add an entry to a row's `collections`. Its poster is the first show's poster, unless you set `poster` (and optionally `background`) to an image URL.
- **Add a row:** add an entry to `rows`. It becomes another catalog, so you can show, hide or reorder rows in Stremio's addon settings.
- **Order:** rows and collections appear in the order listed. Inside a collection, shows are sorted by premiere date unless the collection has `order: "listed"`.

A show can appear in any number of collections.

## Local testing

```
npm test             # unit tests and a full build against a fake Cinemeta
npm run build        # real build into ./dist (needs internet)
npm run serve        # serves ./dist on http://127.0.0.1:7000
```

With the server running, install `http://127.0.0.1:7000/manifest.json` in the Stremio desktop app on the same machine. Stremio Web (web.stremio.com) can't load addons from your own machine, because browsers block HTTPS pages from fetching local addresses. Use the desktop app, or deploy to GitHub Pages first.
