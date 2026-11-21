// Search over the collections, by their own names and the titles in them. The build
// writes one small index (index/search.json); the Worker answers each search from it.
//
// The index keeps every word once, with the collections and titles whose names have it,
// so a search looks at a few thousand words rather than every title:
//   { collections: [{ id, name, poster, releaseInfo, catalogs }],  best-loved first
//     titles: [[name, collection index, …], …],                    each title and the collections it's in
//     words: [word, …],
//     posts: [[-1 - collection index | title index, …], …] }        each word's names, in step with `words`
// A name's words are lower-cased, without accents or punctuation, plus hyphenated words
// run together, so "spiderman" finds "Spider-Man".
//
// Every word of the search must match one name: exactly, as the start of a word, or
// with a typo or two (one in words of 4 to 7 letters, two from 8, two swapped letters
// counting as one; typos only in words with the right first letter). A collection found
// by its own name ranks above one found by a title in it, and a title holding the search
// as a phrase above one with its words scattered. Then watch orders before lists (the
// catalogs' order), then best-loved first.

const fold = (text) => (text ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
export const words = (text) => fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

const indexWords = (text) => {
  const joined = fold(text).split(/\s+/).map((chunk) => words(chunk)).filter((w) => w.length > 1).map((w) => w.join(""));
  return [...new Set([...words(text), ...joined])];
};

/**
 * The index. `collections` are best-loved first, each with the names of its titles:
 * [{ id, name, poster, releaseInfo, catalogs, titles: [{ imdb, name }] }].
 */
export function buildSearchIndex(collections) {
  const titleIds = new Map();   // imdb → title index
  const titles = [];
  const index = new Map();      // word → posts
  const post = (word, code) => {
    if (!index.has(word)) index.set(word, []);
    const list = index.get(word);
    if (!list.includes(code)) list.push(code);
  };
  collections.forEach((c, ci) => {
    for (const w of indexWords(c.name)) post(w, -1 - ci);
    for (const t of c.titles) {
      if (!titleIds.has(t.imdb)) {
        titleIds.set(t.imdb, titles.length);
        titles.push([t.name]);
      }
      const title = titles[titleIds.get(t.imdb)];
      if (title.at(-1) !== ci) title.push(ci);
    }
  });
  titles.forEach(([name], ti) => { for (const w of indexWords(name)) post(w, ti); });
  return {
    collections: collections.map(({ titles: _, ...c }) => c),
    titles,
    words: [...index.keys()],
    posts: [...index.values()],
  };
}

/**
 * Edit distance between a and b, counting two swapped letters as one edit, or max + 1
 * once it's over max.
 */
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let before = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], before[j - 2] + 1);
      best = Math.min(best, row[j]);
    }
    if (best > max) return max + 1;
    before = prev;
    prev = row;
  }
  return prev[b.length];
}

/** How well a search word matches an indexed word: 1 exact, 0.8 its start, less for typos, 0 not at all. */
function match(query, word) {
  if (query === word) return 1;
  if (query.length >= 2 && word.startsWith(query)) return 0.8;
  const max = query.length >= 8 ? 2 : query.length >= 4 ? 1 : 0;
  if (!max || query[0] !== word[0]) return 0;
  const d = distance(query, word, max);
  return d <= max ? 0.7 - 0.1 * d : 0;
}

/**
 * Each name that matches every search word, with its average match: collections (posts
 * below 0) or titles. `perTerm` is each search word's matching posts, as [posts, match].
 */
function matches(perTerm, collections) {
  let found;
  for (const hits of perTerm) {
    const best = new Map();
    for (const [posts, m] of hits) {
      for (const code of posts) {
        if ((code < 0) !== collections) continue;
        const i = collections ? -1 - code : code;
        if (m > (best.get(i) ?? 0)) best.set(i, m);
      }
    }
    found = found ? new Map([...found].filter(([i]) => best.has(i)).map(([i, s]) => [i, s + best.get(i)])) : best;
    if (!found.size) return found;
  }
  return new Map([...found].map(([i, s]) => [i, s / perTerm.length]));
}

/** A bonus for a name that holds the search as a phrase: more when it's the whole name. */
const phraseBonus = (name, phrase, whole, part) => {
  const n = words(name).join(" ");
  return n === phrase ? whole : ` ${n} `.includes(` ${phrase} `) ? part : 0;
};

/**
 * The collections a search finds, best first, as catalog items. `allowed` is the catalog
 * ids whose collections count (a configured install's Search choices); `catalogs` is
 * every catalog id in order, watch orders first.
 */
export function search(index, query, { allowed, catalogs = [], type, limit = 100 }) {
  const terms = [...new Set(words(query))];
  if (!terms.length) return [];
  const perTerm = terms.map((term) => {
    const hits = [];
    for (let i = 0; i < index.words.length; i++) {
      const m = match(term, index.words[i]);
      if (m) hits.push([index.posts[i], m]);
    }
    return hits;
  });
  const phrase = terms.join(" ");
  const scores = new Map();
  for (const [ci, s] of matches(perTerm, true)) {
    scores.set(ci, s + 1 + phraseBonus(index.collections[ci].name, phrase, 0.5, 0.2));
  }
  for (const [ti, s] of matches(perTerm, false)) {
    const [name, ...inside] = index.titles[ti];
    const score = s + (terms.length > 1 ? phraseBonus(name, phrase, 0.4, 0.3) : 0);
    for (const ci of inside) if (score > (scores.get(ci) ?? 0)) scores.set(ci, score);
  }
  const order = (ci) => {
    const at = index.collections[ci].catalogs.map((c) => catalogs.indexOf(c)).filter((i) => i >= 0);
    return at.length ? Math.min(...at) : catalogs.length;
  };
  // A watch order's Franchise copy shares its name: only the first of a name is listed,
  // so the copy shows only when its watch order doesn't (Storyline isn't searched).
  const named = new Set();
  return [...scores]
    .filter(([ci]) => index.collections[ci].catalogs.some((c) => allowed.has(c)))
    .sort((a, b) => b[1] - a[1] || order(a[0]) - order(b[0]) || a[0] - b[0])
    .filter(([ci]) => !named.has(index.collections[ci].name) && named.add(index.collections[ci].name))
    .slice(0, limit)
    .map(([ci]) => {
      const { id, name, poster, releaseInfo } = index.collections[ci];
      return { id, type, name, poster, releaseInfo };
    });
}
