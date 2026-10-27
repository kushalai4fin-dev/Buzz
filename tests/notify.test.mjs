import test from 'node:test';
import assert from 'node:assert/strict';
import { dueSlots, pickDigest, nextState, ENDPOINT_OK } from '../scripts/lib/digest.mjs';
import { runDigests } from '../scripts/send-digests.mjs';
await import('../profile.js');
await import('../notify.js');
const { BuzzNotify } = globalThis;

const sub = (over = {}) => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: 'k'.repeat(30), auth: 'a'.repeat(12), times: ['08:00'], tz: 'Asia/Kolkata', topics: [], terms: [], state: { slots: {}, clusters: [] }, failures: 0, ...over });

test('a time is due just after it passes in the subscriber\'s own time zone, and only then', () => {
  assert.deepEqual(dueSlots(sub(), new Date('2026-10-27T02:40:00Z')), ['2026-10-27T08:00']); // 08:10 IST
  assert.deepEqual(dueSlots(sub(), new Date('2026-10-27T02:10:00Z')), []); // 07:40 IST: not yet
  assert.deepEqual(dueSlots(sub(), new Date('2026-10-27T03:40:00Z')), []); // 09:10 IST: window passed
  assert.deepEqual(dueSlots(sub({ tz: 'America/New_York' }), new Date('2026-10-27T12:10:00Z')), ['2026-10-27T08:00']); // 08:10 EDT
});

test('a slot just after midnight belongs to the previous day, and a sent slot is never repeated', () => {
  const late = sub({ times: ['23:50'] });
  assert.deepEqual(dueSlots(late, new Date('2026-10-26T18:40:00Z')), ['2026-10-26T23:50']); // 00:10 IST on the 27th
  const done = sub({ state: { slots: { '2026-10-27T08:00': true }, clusters: [] } });
  assert.deepEqual(dueSlots(done, new Date('2026-10-27T02:40:00Z')), []);
});

test('bad data never sends: unknown zone, malformed time, daily cap', () => {
  assert.deepEqual(dueSlots(sub({ tz: 'Nowhere/Land' }), new Date('2026-10-27T02:40:00Z')), []);
  assert.deepEqual(dueSlots(sub({ times: ['8am', '99:99'] }), new Date('2026-10-27T02:40:00Z')), []);
  const capped = sub({ times: ['08:00'], state: { slots: { '2026-10-27T01:00': true, '2026-10-27T02:00': true }, clusters: [] } });
  assert.deepEqual(dueSlots(capped, new Date('2026-10-27T02:40:00Z')), []);
});

const NOW = new Date('2026-10-27T03:00:00Z');
const story = (id, title, topic = 'geopolitics') => ({ id, title, snippet: '', topic, publisher: 'BBC', sourceId: 'bbc' });
const cl = (id, topic, hoursAgo, extra = {}) => ({ id, topic, leadId: id, storyIds: [id], publishers: ['BBC'], independentSources: 1, multiSource: false, latest: new Date(NOW - hoursAgo * 3600000).toISOString(), ...extra });
const data = {
  stories: [story('a', 'Peace talks resume in Geneva'), story('b', 'Tata Motors posts record profit', 'economics'), story('c', 'Old news from last week'), story('d', 'Cricket final goes to the wire', 'sports')],
  clusters: [cl('a', 'geopolitics', 2, { multiSource: true, independentSources: 3 }), cl('b', 'economics', 3), cl('c', 'geopolitics', 100), cl('d', 'sports', 1)],
  explainers: {}, topicLabels: { geopolitics: 'World & Geopolitics', sports: 'Sports' },
};

test('digest prefers a tracked-term match, then widely reported stories; honours topics and repeats', () => {
  const t = pickDigest(sub({ terms: ['Tata'] }), data, NOW);
  assert.equal(t.clusterId, 'b');
  assert.match(t.title, /Tata/);
  assert.equal(pickDigest(sub(), data, NOW).clusterId, 'a');
  assert.equal(pickDigest(sub({ topics: ['sports'] }), data, NOW).clusterId, 'd');
  assert.equal(pickDigest(sub({ state: { slots: {}, clusters: ['a'] } }), data, NOW).clusterId, 'd'); // newest of what is left
  const m = pickDigest(sub(), data, NOW);
  assert.match(m.body, /3 outlets/);
  assert.equal(m.url, './?story=a&listen=1');
});

test('digest sends nothing when there is nothing fresh or new', () => {
  assert.equal(pickDigest(sub({ topics: ['animals'] }), data, NOW), null);
  assert.equal(pickDigest(sub(), { ...data, clusters: [cl('c', 'geopolitics', 100)] }, NOW), null);
});

test('nextState remembers the slot and the story and forgets old ones', () => {
  let s = sub();
  for (let i = 1; i <= 8; i++) s = { ...s, state: nextState(s, `2026-10-0${i}T08:00`, 'c' + i) };
  assert.equal(Object.keys(s.state.slots).length, 4);
  assert.equal(s.state.clusters[0], 'c8');
});

test('endpoint allow-list accepts real push services only', () => {
  assert.ok(ENDPOINT_OK.test('https://fcm.googleapis.com/fcm/send/x'));
  assert.ok(ENDPOINT_OK.test('https://web.push.apple.com/abc'));
  assert.ok(ENDPOINT_OK.test('https://updates.push.services.mozilla.com/wpush/v2/x'));
  assert.ok(!ENDPOINT_OK.test('https://evil.example/x'));
  assert.ok(!ENDPOINT_OK.test('http://fcm.googleapis.com/x'));
  assert.ok(!ENDPOINT_OK.test('https://fcm.googleapis.com.evil.example/x'));
  assert.ok(!ENDPOINT_OK.test('https://169.254.169.254/latest'));
});

const harness = (subs, sendImpl) => {
  const saved = [], removed = [], sent = [];
  return {
    saved, removed, sent,
    args: {
      subs, data, now: new Date('2026-10-27T02:40:00Z'),
      send: async (s, body) => { sent.push(JSON.parse(body)); if (sendImpl) return sendImpl(s); },
      save: async (s, state, failures) => { saved.push({ endpoint: s.endpoint, state, failures }); s.state = state; s.failures = failures; },
      remove: async (s) => { removed.push(s.endpoint); },
    },
  };
};

test('sender: sends once, records it, and a second run in the same window sends nothing', async () => {
  const s = sub();
  const h = harness([s]);
  const r1 = await runDigests(h.args);
  assert.equal(r1.sent, 1);
  assert.equal(h.sent[0].tag, 'buzz-digest');
  assert.ok(h.saved[0].state.slots['2026-10-27T08:00']);
  const r2 = await runDigests(h.args);
  assert.equal(r2.sent, 0);
  assert.equal(h.sent.length, 1);
});

test('sender: gone phones are removed, errors are counted, bad endpoints never contacted', async () => {
  const gone = Object.assign(new Error('gone'), { statusCode: 410 });
  const h1 = harness([sub()], () => { throw gone; });
  const r1 = await runDigests(h1.args);
  assert.equal(r1.removed, 1);
  const flaky = Object.assign(new Error('x'), { statusCode: 503 });
  const s = sub();
  const h2 = harness([s], () => { throw flaky; });
  const r2 = await runDigests(h2.args);
  assert.equal(r2.failed, 1);
  assert.equal(h2.saved[0].failures, 1);
  assert.equal(h2.saved[0].state.slots['2026-10-27T08:00'], undefined, 'a failed send is retried in the next run');
  const h3 = harness([sub({ endpoint: 'https://evil.example/x' })]);
  const r3 = await runDigests(h3.args);
  assert.equal(h3.sent.length, 0);
  assert.equal(r3.removed, 1);
  const h4 = harness([sub({ failures: 9 })], () => { throw flaky; });
  assert.equal((await runDigests(h4.args)).removed, 1);
});

test('sender: nothing to say means no message', async () => {
  const h = harness([sub({ topics: ['animals'] })]);
  const r = await runDigests(h.args);
  assert.equal(r.sent, 0);
  assert.equal(r.skippedNothingToSend, 1);
});

test('phone side: payload is validated and trimmed, config check is strict', () => {
  const p = BuzzNotify.payload({ times: ['08:00', 'bad', '19:30', '21:00'], tz: 'Asia/Kolkata', topics: ['sports', '../x'], terms: [{ text: 'Tata' }, { text: '<b>' }, { text: 'x' }] });
  assert.deepEqual(p.times, ['08:00', '19:30']);
  assert.deepEqual(p.topics, ['sports']);
  assert.deepEqual(p.terms, ['Tata']); // markup-only and 1-letter terms are dropped
  assert.equal(p.tz, 'Asia/Kolkata');
  assert.equal(BuzzNotify.payload({ times: [], tz: 'bogus', topics: null, terms: [] }).tz.length > 0, true);
  const { configured, urlBase64ToBytes, bytesToBase64Url } = BuzzNotify._internals;
  assert.equal(configured({}), false);
  assert.equal(configured({ supabaseUrl: 'https://abc.supabase.co', supabaseAnonKey: 'k', vapidPublicKey: 'v' }), true);
  assert.equal(configured({ supabaseUrl: 'https://evil.example', supabaseAnonKey: 'k', vapidPublicKey: 'v' }), false);
  assert.equal(configured({ supabaseUrl: 'http://abc.supabase.co', supabaseAnonKey: 'k', vapidPublicKey: 'v' }), false);
  const bytes = new Uint8Array([251, 255, 0, 1, 2, 250]);
  assert.deepEqual([...urlBase64ToBytes(bytesToBase64Url(bytes))], [...bytes]);
});

test('phone side: with no config, status is "unconfigured" and nothing is attempted', async () => {
  assert.deepEqual(await BuzzNotify.status(), { state: 'unconfigured' });
  await assert.rejects(BuzzNotify.enable({ times: ['08:00'] }));
  await BuzzNotify.sync({ times: [], terms: [] });
  await BuzzNotify.disable();
});
