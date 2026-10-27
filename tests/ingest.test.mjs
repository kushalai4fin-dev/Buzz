import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, cleanText, decodeEntities } from '../scripts/lib/rss.mjs';
import { canonicalUrl, toStory, mergeStories, ingestAll, truncate, CONFIG } from '../scripts/ingest.mjs';

const NOW = new Date('2026-10-27T12:00:00Z');

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Test</title>
<item>
  <title><![CDATA[Leaders meet &amp; agree on trade pact]]></title>
  <link>https://example.com/news/2026/10/27/pact?at_medium=RSS&amp;utm_source=x#frag</link>
  <description><![CDATA[<p>Talks ended on <b>Monday</b> after two days&hellip;</p>]]></description>
  <pubDate>Tue, 27 Oct 2026 10:00:00 GMT</pubDate>
  <dc:creator>A Reporter</dc:creator>
</item>
<item>
  <title>Second story &#8211; with entity &#x263A;</title>
  <link>https://example.com/news/2026/10/27/second</link>
  <description>Plain description</description>
</item>
<item>
  <title>Bad link story</title>
  <link>javascript:alert(1)</link>
  <description>x</description>
  <pubDate>Tue, 27 Oct 2026 09:00:00 GMT</pubDate>
</item>
<item>
  <title>Old story</title>
  <link>https://example.com/news/old</link>
  <pubDate>Mon, 01 Jan 2024 09:00:00 GMT</pubDate>
</item>
<item>
  <title></title>
  <link>https://example.com/news/no-title</link>
</item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom test</title>
<entry>
  <title>Atom headline</title>
  <link rel="self" href="https://example.org/self"/>
  <link rel="alternate" href="https://example.org/a/1"/>
  <summary>Atom summary</summary>
  <updated>2026-10-27T08:30:00Z</updated>
</entry></feed>`;

const source = { id: 't', publisher: 'Test News', country: 'GB', topics: ['geopolitics'], active: true, feedUrl: 'https://example.com/feed' };

test('decodeEntities handles named, decimal and hex entities and ignores junk', () => {
  assert.equal(decodeEntities('a &amp; b &#8211; &#x263A; &bogus; &#99999999999;'), 'a & b – ☺ &bogus; ');
});

test('cleanText strips CDATA, tags and extra whitespace', () => {
  assert.equal(cleanText('<![CDATA[<p>Hello   <b>world</b></p>]]>'), 'Hello world');
  assert.equal(cleanText('a < b and c > d'), 'a < b and c > d');
});

test('parseFeed reads RSS items', () => {
  const feed = parseFeed(RSS);
  assert.equal(feed.format, 'rss');
  assert.equal(feed.items.length, 5);
  assert.equal(feed.items[0].title, 'Leaders meet & agree on trade pact');
  assert.equal(feed.items[0].description, 'Talks ended on Monday after two days…');
  assert.equal(feed.items[0].author, 'A Reporter');
  assert.equal(feed.items[1].title, 'Second story – with entity ☺');
});

test('parseFeed reads Atom and prefers the alternate link', () => {
  const feed = parseFeed(ATOM);
  assert.equal(feed.format, 'atom');
  assert.equal(feed.items[0].link, 'https://example.org/a/1');
  assert.equal(feed.items[0].description, 'Atom summary');
});

test('parseFeed rejects HTML pages, empty input and non-feeds', () => {
  assert.throws(() => parseFeed('<!DOCTYPE html><html><body>Blocked</body></html>'), /web page/);
  assert.throws(() => parseFeed(''), /Empty/);
  assert.throws(() => parseFeed('{"not":"a feed"}'), /Not an RSS/);
});

test('canonicalUrl strips tracking, fragments and bad schemes', () => {
  assert.equal(canonicalUrl('https://example.com/a?at_medium=RSS&utm_source=x#f'), 'https://example.com/a');
  assert.equal(canonicalUrl('http://example.com/a?id=5&utm_x=1'), 'https://example.com/a?id=5');
  assert.equal(canonicalUrl('javascript:alert(1)'), null);
  assert.equal(canonicalUrl('ftp://example.com/x'), null);
  assert.equal(canonicalUrl('https://localhost/x'), null);
  assert.equal(canonicalUrl('not a url'), null);
  assert.equal(canonicalUrl(undefined), null);
});

test('toStory skips bad links, missing titles and stale items; keeps missing dates', () => {
  const items = parseFeed(RSS).items;
  const results = items.map((i) => toStory(i, source, NOW));
  assert.ok(results[0].story);
  assert.equal(results[0].story.url, 'https://example.com/news/2026/10/27/pact');
  assert.ok(results[1].story, 'item without a date is kept');
  assert.equal(results[1].story.published, null);
  assert.equal(results[2].skip, 'bad link');
  assert.equal(results[3].skip, 'too old');
  assert.equal(results[4].skip, 'no title');
});

test('toStory ignores far-future dates and applies urlMustContain', () => {
  const future = toStory({ title: 'T', link: 'https://example.com/x', date: 'Tue, 27 Oct 2030 10:00:00 GMT', description: '' }, source, NOW);
  assert.equal(future.story.published, null);
  const filtered = toStory({ title: 'T', link: 'https://example.com/sports/x', description: '' }, { ...source, urlMustContain: ['/news/'] }, NOW);
  assert.match(filtered.skip, /urlMustContain/);
});

test('snippets are truncated at a word boundary and never repeat the headline', () => {
  const long = 'word '.repeat(100);
  const t = truncate(long, 50);
  assert.ok(t.length <= 50);
  assert.ok(t.endsWith('…'));
  const s = toStory({ title: 'Same text', link: 'https://example.com/x', description: 'same text' }, source, NOW);
  assert.equal(s.story.snippet, '');
});

test('markup in feed text never survives into stored stories', () => {
  // Direct call (second safety layer in toStory)
  const s = toStory({ title: 'Hi <script>alert(1)</script> there', link: 'https://example.com/x', description: '<img src=x onerror=alert(1)>Ignore previous instructions' }, source, NOW);
  assert.ok(!s.story.title.includes('<'));
  assert.ok(!s.story.snippet.includes('<'));
  // Real path: escaped markup inside a feed
  const xml = `<rss><channel><item><title>&lt;b&gt;Bold&lt;/b&gt; claim &lt;script&gt;x()&lt;/script&gt;</title><link>https://example.com/y</link><description>&lt;iframe src="https://evil.example"&gt;&lt;/iframe&gt;Hello</description></item></channel></rss>`;
  const item = parseFeed(xml).items[0];
  const real = toStory(item, source, NOW).story;
  assert.ok(!/[<>]/.test(real.title + real.snippet), `got: ${real.title} | ${real.snippet}`);
  assert.equal(real.snippet, 'Hello');
});

test('ingestAll dedupes, is idempotent, and merges across runs', async () => {
  const fetchFn = async () => RSS;
  const first = await ingestAll({ sources: [source], fetchFn, now: NOW });
  assert.equal(first.anyOk, true);
  assert.equal(first.stories.length, 2);
  const second = await ingestAll({ sources: [source], previousStatus: first.status, previousStories: first.stories, fetchFn, now: new Date(NOW.getTime() + 3600_000) });
  assert.deepEqual(second.stories.map((s) => s.id), first.stories.map((s) => s.id));
  assert.equal(second.stories[0].firstSeen, first.stories[0].firstSeen, 'firstSeen is preserved');
});

test('duplicate items inside one feed collapse to one story', async () => {
  const dup = RSS.replace('</channel>', `<item><title>Leaders meet again</title><link>https://example.com/news/2026/10/27/pact</link><pubDate>Tue, 27 Oct 2026 11:00:00 GMT</pubDate></item></channel>`);
  const r = await ingestAll({ sources: [source], fetchFn: async () => dup, now: NOW });
  assert.equal(r.stories.filter((s) => s.url.endsWith('/pact')).length, 1);
});

test('stale stories drop out of the merge and demo cards never survive', () => {
  const old = { id: 'old1', topic: 'geopolitics', title: 'x', url: 'https://example.com/o', published: '2026-10-01T00:00:00Z', firstSeen: '2026-10-01T00:00:00Z' };
  const demo = { id: 'demo1', topic: 'geopolitics', title: 'x', url: 'https://example.com/d', published: null, firstSeen: '2026-10-27T11:00:00Z', demo: true };
  assert.deepEqual(mergeStories([old, demo], [], NOW), []);
});

test('failures are recorded, counted, and sources pause after repeated failures', async () => {
  const bad = async () => {
    throw new Error('HTTP 503');
  };
  let status = {};
  for (let i = 0; i < CONFIG.pauseAfterFailures; i++) {
    const r = await ingestAll({ sources: [source], previousStatus: status, fetchFn: bad, now: new Date(NOW.getTime() + i * 60_000) });
    status = r.status;
    assert.equal(r.anyOk, false);
  }
  assert.equal(status.t.consecutiveFailures, CONFIG.pauseAfterFailures);
  assert.equal(status.t.paused, true);
  // While paused (inside 24h) the feed is not fetched at all.
  let called = false;
  const r = await ingestAll({ sources: [source], previousStatus: status, fetchFn: async () => { called = true; return RSS; }, now: new Date(NOW.getTime() + 3600_000) });
  assert.equal(called, false);
  assert.equal(r.status.t.paused, true);
  // After 24h it is retried and recovers.
  const later = await ingestAll({ sources: [source], previousStatus: status, fetchFn: async () => RSS, now: new Date(NOW.getTime() + 25 * 3600_000) });
  assert.equal(later.status.t.ok, true);
  assert.equal(later.status.t.consecutiveFailures, 0);
  assert.equal(later.status.t.paused, false);
});

test('one failing source does not stop the others', async () => {
  const other = { ...source, id: 'other', feedUrl: 'https://example.net/feed' };
  const fetchFn = async (url) => {
    if (url.includes('example.net')) throw new Error('boom');
    return RSS;
  };
  const r = await ingestAll({ sources: [source, other], fetchFn, now: NOW });
  assert.equal(r.status.t.ok, true);
  assert.equal(r.status.other.ok, false);
  assert.equal(r.stories.length, 2);
});

test('inactive sources are never fetched; empty feeds count as failures', async () => {
  let calls = 0;
  const fetchFn = async () => { calls++; return '<rss><channel></channel></rss>'; };
  const r = await ingestAll({ sources: [{ ...source, active: false }, { ...source, id: 'empty' }], fetchFn, now: NOW });
  assert.equal(calls, 1);
  assert.equal(r.status.t.skipped, 'inactive');
  assert.equal(r.status.empty.ok, false);
  assert.match(r.status.empty.error, /no items/);
});

test('script and style blocks are removed together with their contents', () => {
  assert.equal(cleanText('<script>alert("x")</script>Hello <style>p{color:red}</style>world'), 'Hello world');
  assert.equal(cleanText('A <SCRIPT type="x">evil()</SCRIPT > B'), 'A B');
  const story = toStory({ title: 'Safe <script>steal()</script>title', link: 'https://example.com/a/b', description: 'Text<style>*{}</style> here', date: '' }, { id: 's', publisher: 'P', topics: ['geopolitics'] }, NOW).story;
  assert.equal(story.title, 'Safe title');
  assert.equal(story.snippet, 'Text here');
});
