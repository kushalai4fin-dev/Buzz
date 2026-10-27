import test from 'node:test';
import assert from 'node:assert/strict';
await import('../profile.js');
await import('../search.js');
const { BuzzProfile, BuzzSearch } = globalThis;

const memStore = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, _m: m }; };

test('terms: saved, de-duplicated ignoring case, capped, removable', () => {
  const p = BuzzProfile.create(memStore());
  assert.equal(p.addTerm('Tata Motors', 't1').saved, true);
  assert.equal(p.addTerm('  tata   MOTORS ', 't2').already, true);
  assert.equal(p.get().terms.length, 1);
  assert.equal(p.addTerm('a').ok, false);
  assert.equal(p.addTerm('x'.repeat(61)).ok, false);
  for (let i = 0; i < 25; i++) p.addTerm('term number ' + i, 't');
  assert.equal(p.get().terms.length, BuzzProfile.MAX_TERMS);
  assert.equal(p.addTerm('one more term').ok, false);
  assert.equal(p.removeTerm('TATA motors'), true);
  p.clearTerms();
  assert.equal(p.get().terms.length, 0);
});

test('searches auto-save unless the reader turns it off', () => {
  const p = BuzzProfile.create(memStore());
  assert.equal(p.recordSearch('gold price', 'n').saved, true);
  p.setAutoSave(false);
  assert.equal(p.recordSearch('copper', 'n').saved, false);
  assert.equal(p.hasTerm('copper'), false);
  assert.equal(p.recordSearch('', 'n').ok, false);
});

test('profile persists, and corrupt or hostile stored data falls back safely', () => {
  const st = memStore();
  const p = BuzzProfile.create(st);
  p.addTerm('India', 'n');
  p.setTimes(['19:30', '08:00', '08:00', '25:99', 'x'], 'Asia/Kolkata');
  const again = BuzzProfile.create(st);
  assert.equal(again.get().terms[0].text, 'India');
  assert.deepEqual(again.get().times, ['08:00', '19:30']);
  assert.equal(again.get().tz, 'Asia/Kolkata');
  st.setItem('buzz.profile.v1', '{not json');
  assert.deepEqual(BuzzProfile.create(st).get().terms, []);
  st.setItem('buzz.profile.v1', JSON.stringify({ terms: [{ text: '<img onerror=x>' }, 5, null, { text: 'ok term' }], times: ['01:00', '02:00', '03:00'], tz: 'Not/AZone', topics: ['sports', '../x', 7] }));
  const h = BuzzProfile.create(st).get();
  assert.deepEqual(h.terms.map((t) => t.text), ['img onerror=x', 'ok term']);
  assert.equal(h.times.length, 2);
  assert.equal(h.tz, null);
  assert.deepEqual(h.topics, ['sports']);
});

test('profile still works when storage is blocked', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  const p = BuzzProfile.create(blocked);
  assert.equal(p.addTerm('India', 'n').ok, true);
  assert.equal(p.get().terms.length, 1);
});

const stories = {
  a: { id: 'a', title: 'Tata Motors reports record quarterly profit', snippet: 'The carmaker beat forecasts.', publisher: 'The Hindu' },
  b: { id: 'b', title: 'Zelenskyy meets allies in Berlin', snippet: 'Talks on air defence.', publisher: 'BBC News' },
  c: { id: 'c', title: 'Fed holds rates steady', snippet: 'Officials signalled a possible rate cut in December.', publisher: 'The Guardian' },
  d: { id: 'd', title: 'Müller wins match in Vienna', snippet: 'Tennis.', publisher: 'BBC Sport' },
};
const clusters = [
  { id: 'a', storyIds: ['a'], latest: '2026-10-27T10:00:00Z' },
  { id: 'b', storyIds: ['b'], latest: '2026-10-27T11:00:00Z' },
  { id: 'c', storyIds: ['c'], latest: '2026-10-27T09:00:00Z' },
  { id: 'd', storyIds: ['d'], latest: '2026-10-27T08:00:00Z' },
];

test('search: words, phrases, accents, short words, and honest empty results', () => {
  const ids = (q) => BuzzSearch.searchClusters(q, clusters, stories).map((r) => r.cluster.id);
  assert.deepEqual(ids('tata'), ['a']);
  assert.deepEqual(ids('TATA motors'), ['a']);
  assert.deepEqual(ids('muller'), ['d']);
  assert.deepEqual(ids('zelensky'), ['b']);
  assert.deepEqual(ids('"rate cut"'), ['c']);
  assert.deepEqual(ids('rate steady'), ['c']);
  assert.deepEqual(ids('us'), [], 'short words need a whole-word match');
  assert.deepEqual(ids('nothing like this'), []);
  assert.deepEqual(ids(''), []);
  assert.deepEqual(ids('a'), []);
  assert.deepEqual(ids('.*'), []);
  assert.deepEqual(ids('(((['), []);
});

test('search ranks title hits above snippet-only hits, then newest first', () => {
  const r = BuzzSearch.searchClusters('talks', clusters, stories);
  assert.deepEqual(r.map((x) => x.cluster.id), ['b']);
  const r2 = BuzzSearch.searchClusters('rate', clusters, stories);
  assert.equal(r2[0].cluster.id, 'c');
});

test('tracked matching reports which terms matched', () => {
  const m = BuzzSearch.matchTracked([{ text: 'Tata' }, { text: 'Berlin' }, { text: 'nothing' }], clusters, stories);
  assert.deepEqual(m.map((x) => [x.cluster.id, x.terms]), [['b', ['Berlin']], ['a', ['Tata']]]);
});
