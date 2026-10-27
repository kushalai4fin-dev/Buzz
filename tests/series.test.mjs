import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickSeries, parseFred, parseWorldBank, yearOverYear, shape, facts, CATALOG, fetchSeries, loadSeries, detectCountry } from '../scripts/lib/series.mjs';

test('keyword rules pick sensible series', () => {
  assert.deepEqual(pickSeries('Fed raises interest rates by 0.25 points'), ['fedfunds']);
  assert.deepEqual(pickSeries('Brent crude jumps as OPEC cuts output'), ['brent']);
  assert.deepEqual(pickSeries('India inflation eases in September'), ['infl_IN']);
  assert.deepEqual(pickSeries('US inflation hotter than expected, Fed under pressure'), ['fedfunds', 'us_cpi']);
  assert.deepEqual(pickSeries('Rupee falls to record low'), ['usdinr']);
  assert.deepEqual(pickSeries('China GDP growth slows'), ['gdp_CN']);
});
test('no guessing when the country is unclear or nothing matches', () => {
  assert.deepEqual(pickSeries('Central bank holds interest rates steady as inflation cools'), []);
  assert.deepEqual(pickSeries('Cricket final: India win by two wickets'), []);
  assert.equal(detectCountry('India and China sign a deal'), null);
});
test('parsers drop missing values and bad rows', () => {
  assert.deepEqual(parseFred({ observations: [{ date: '2024-01-01', value: '5.33' }, { date: '2024-02-01', value: '.' }, { date: 'x', value: '1' }] }), [['2024-01', 5.33]]);
  assert.deepEqual(parseWorldBank([{}, [{ date: '2022', value: 7.2 }, { date: '2021', value: null }, { date: '2020', value: -5.8 }]]), [['2020', -5.8], ['2022', 7.2]]);
});
test('year-over-year and shaping', () => {
  const idx = [];
  for (let y = 2018; y <= 2024; y++) for (let m = 1; m <= 12; m++) idx.push([`${y}-${String(m).padStart(2, '0')}`, 100 * Math.pow(1.03, y - 2018)]);
  const yoy = yearOverYear(idx);
  assert.equal(yoy[0][0], '2019-01');
  assert.equal(yoy[0][1], 3);
  assert.equal(shape({ years: 3 }, [['2024-01', 1]]), null, 'too little data');
  const s = shape({ years: 10 }, idx.map(([d, v]) => [d, v]));
  assert.ok(s.length <= 141 && s[s.length - 1][0] === '2024-12');
});
test('facts are computed from the data', () => {
  const pts = [['2019-06', 2.4], ['2020-06', 0.1], ['2021-06', 0.1], ['2022-06', 1.5], ['2023-06', 5.1], ['2024-06', 5.3]];
  const f = facts({ title: 'Rate', unit: '%' }, pts).join(' ');
  assert.match(f, /5\.3% in 2024-06/);
  assert.match(f, /One year earlier \(2023-06\): 5\.1%/);
  assert.match(f, /Highest in this period: 5\.3%/);
  assert.match(f, /Lowest: 0\.1% \(2020-06\)/);
});
test('fetchSeries needs a FRED key, uses the key only in the request, and rejects bad data', async () => {
  await assert.rejects(fetchSeries('fedfunds', { fredKey: '' }), /no FRED key/);
  const obs = []; for (let y = 2016; y <= 2025; y++) for (let m = 1; m <= 12; m++) obs.push({ date: `${y}-${String(m).padStart(2, '0')}-01`, value: String(1 + (y - 2016) * 0.3) });
  let seen;
  const ok = await fetchSeries('fedfunds', { fredKey: 'KEY123', now: new Date('2025-12-15'), fetchFn: async (u) => { seen = u; return { ok: true, json: async () => ({ observations: obs }) }; } });
  assert.match(seen, /api_key=KEY123/);
  assert.ok(ok.points.length > 20 && ok.facts.length >= 3 && ok.asOf === '2025-12');
  assert.ok(!JSON.stringify(ok).includes('KEY123'), 'key must never end up in saved data');
  await assert.rejects(fetchSeries('fedfunds', { fredKey: 'k', fetchFn: async () => ({ ok: false, status: 500 }) }), /HTTP 500/);
  const wb = await fetchSeries('gdp_IN', { fetchFn: async () => ({ ok: true, json: async () => [{}, Array.from({ length: 30 }, (_, i) => ({ date: String(1995 + i), value: 6 + (i % 3) }))] }), now: new Date('2025-06-01') });
  assert.equal(wb.source, 'World Bank');
});
test('loadSeries caches and survives failures', async () => {
  let calls = 0;
  const fetchFn = async () => { calls++; throw new Error('x'); };
  const old = { id: 'fedfunds', fetchedAt: '2025-01-01T00:00:00Z', points: [['2025-01', 1]], facts: [] };
  const r = await loadSeries(['fedfunds', 'brent'], { cache: { fedfunds: old }, fredKey: 'k', fetchFn, now: new Date('2025-06-01') });
  assert.equal(r.series.fedfunds, old);
  assert.equal(r.errors.length, 2);
  assert.ok(Object.keys(CATALOG).length > 10);
});
