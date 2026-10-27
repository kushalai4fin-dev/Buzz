import test from 'node:test';
import assert from 'node:assert/strict';
import { tokens, sameEvent, clusterStories, wireAgency, originKey, clusterVersion } from '../scripts/lib/cluster.mjs';
import { routeTopic, ingestAll } from '../scripts/ingest.mjs';

const T0 = Date.parse('2026-10-27T06:00:00Z');
const mk = (id, title, sourceId, publisher, hoursAfter = 0, extra = {}) => ({
  id, title, snippet: extra.snippet || '', topic: extra.topic || 'geopolitics', sourceId, publisher,
  published: new Date(T0 + hoursAfter * 3600000).toISOString(), firstSeen: new Date(T0).toISOString(), url: 'https://example.com/' + id,
});
const sources = {
  bbc: { id: 'bbc', group: 'bbc' }, bbc2: { id: 'bbc2', group: 'bbc' },
  gu: { id: 'gu', group: 'guardian' }, aj: { id: 'aj', group: 'aljazeera' },
};

test('tokens drops stopwords, short words and punctuation', () => {
  const t = tokens("The Fed's rate decision, after talks!");
  assert.ok(t.has('fed') && t.has('rate') && t.has('decision') && t.has('talk'));
  assert.ok(!t.has('the') && !t.has('after'));
});

test('same event with different wording is matched', () => {
  const a = mk('a', 'India and US agree interim trade deal after tariff talks', 'bbc', 'BBC');
  const b = mk('b', 'US, India agree trade deal as tariff talks end', 'gu', 'Guardian');
  assert.equal(sameEvent(a, b), true);
});

test('different events with a shared country are not matched', () => {
  const a = mk('a', 'India wins cricket test series against Australia', 'bbc', 'BBC');
  const b = mk('b', 'India inflation falls to lowest level this year', 'gu', 'Guardian');
  assert.equal(sameEvent(a, b), false);
});

test('clusters group the same event and count independent outlets', () => {
  const stories = [
    mk('a', 'Leaders sign historic climate pact in Geneva summit', 'bbc', 'BBC', 0),
    mk('b', 'Historic climate pact signed by leaders at Geneva summit', 'gu', 'Guardian', 2),
    mk('c', 'Stock markets close higher on Tuesday', 'aj', 'Al Jazeera', 1),
  ];
  const clusters = clusterStories(stories, sources);
  assert.equal(clusters.length, 2);
  const pact = clusters.find((c) => c.storyIds.includes('a'));
  assert.deepEqual(pact.storyIds.sort(), ['a', 'b']);
  assert.equal(pact.independentSources, 2);
  assert.equal(pact.multiSource, true);
  assert.equal(pact.leadId, 'a');
});

test('two feeds from the same outlet group count as ONE source', () => {
  const stories = [
    mk('a', 'Leaders sign historic climate pact in Geneva summit', 'bbc', 'BBC', 0),
    mk('b', 'Historic climate pact signed by leaders at Geneva summit', 'bbc2', 'BBC', 1),
  ];
  const [c] = clusterStories(stories, sources);
  assert.equal(c.storyIds.length, 2);
  assert.equal(c.independentSources, 1);
  assert.equal(c.multiSource, false);
});

test('wire copy from the same agency counts once, even across outlets', () => {
  const stories = [
    mk('a', 'Oil prices jump as OPEC cuts output (Reuters)', 'bbc', 'BBC', 0),
    mk('b', 'OPEC cuts output, oil prices jump - Reuters', 'gu', 'Guardian', 1),
  ];
  assert.equal(wireAgency(stories[0]), 'reuters');
  const [c] = clusterStories(stories, sources);
  assert.equal(c.independentSources, 1);
  assert.equal(originKey(stories[0], sources.bbc), 'wire:reuters');
});

test('stories far apart in time or in different topics are never merged', () => {
  const far = [
    mk('a', 'Leaders sign historic climate pact in Geneva summit', 'bbc', 'BBC', 0),
    mk('b', 'Leaders sign historic climate pact in Geneva summit', 'gu', 'Guardian', 100),
  ];
  assert.equal(clusterStories(far, sources).length, 2);
  const other = [
    mk('a', 'Leaders sign historic climate pact in Geneva summit', 'bbc', 'BBC', 0),
    mk('b', 'Leaders sign historic climate pact in Geneva summit', 'gu', 'Guardian', 1, { topic: 'science' }),
  ];
  assert.equal(clusterStories(other, sources).length, 2);
});

test('clustering is deterministic and the id follows the earliest report', () => {
  const stories = [
    mk('b', 'Historic climate pact signed by leaders at Geneva summit', 'gu', 'Guardian', 2),
    mk('a', 'Leaders sign historic climate pact in Geneva summit', 'bbc', 'BBC', 0),
  ];
  const one = clusterStories(stories, sources);
  const two = clusterStories([...stories].reverse(), sources);
  assert.deepEqual(one, two);
  assert.equal(one[0].id, 'a');
});

test('clusterVersion changes when the underlying text changes', () => {
  const s = [mk('a', 'Title one here now', 'bbc', 'BBC')];
  const c = { storyIds: ['a'] };
  const v1 = clusterVersion(c, { a: s[0] });
  const v2 = clusterVersion(c, { a: { ...s[0], title: 'Title two here now' } });
  assert.notEqual(v1, v2);
  assert.equal(v1, clusterVersion(c, { a: s[0] }));
});

test('routeTopic picks by keywords and falls back to the first topic', () => {
  const topics = [
    { id: 'economics', keywords: ['inflation', 'gdp'], subtopics: [] },
    { id: 'finance', keywords: ['stocks', 'bank', 'gold'], subtopics: [] },
  ];
  const src = { topics: ['economics', 'finance'] };
  assert.equal(routeTopic('Gold hits record as stocks slide', src, topics), 'finance');
  assert.equal(routeTopic('A very quiet day', src, topics), 'economics');
  assert.equal(routeTopic('anything', { topics: ['sports'] }, topics), 'sports');
});

test('ingestAll attaches a clusterId to every story and returns clusters', async () => {
  const feed = (title, link) => `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><item><title>${title}</title><link>${link}</link><description>d</description><pubDate>Tue, 27 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
  const srcs = [
    { id: 'bbc', group: 'bbc', publisher: 'BBC', feedUrl: 'https://a.example/rss', topics: ['geopolitics'], active: true },
    { id: 'gu', group: 'guardian', publisher: 'Guardian', feedUrl: 'https://b.example/rss', topics: ['geopolitics'], active: true },
  ];
  const fetchFn = async (url) => (url.includes('a.example')
    ? feed('Leaders sign historic climate pact in Geneva summit', 'https://a.example/1')
    : feed('Historic climate pact signed by leaders at Geneva summit', 'https://b.example/1'));
  const r = await ingestAll({ sources: srcs, fetchFn, now: new Date('2026-10-27T12:00:00Z') });
  assert.equal(r.stories.length, 2);
  assert.ok(r.stories.every((s) => s.clusterId));
  assert.equal(r.clusters.length, 1);
  assert.equal(r.clusters[0].independentSources, 2);
});
