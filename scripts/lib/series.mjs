// Real numbers for the charts. The AI never invents chart data.
//  1. CODE picks which public data series fit a story (keyword rules below, no AI involved).
//  2. CODE downloads the numbers from FRED (US Federal Reserve data, needs a free key) or the World Bank (no key).
//  3. CODE turns them into a few plain facts ("5.33% in 2024-07, 1 year earlier 5.08%") that the explainer may quote.
// If a download fails or data looks wrong, the story simply has no chart. Nothing is guessed.

export const FRED_URL = 'https://api.stlouisfed.org/fred/series/observations';
export const WB_URL = 'https://api.worldbank.org/v2/country';

const FRED_HOME = 'https://fred.stlouisfed.org/series/';
const WB_HOME = 'https://data.worldbank.org/indicator/';

function fred(id, title, unit, extra = {}) {
  return { provider: 'fred', source: 'FRED, Federal Reserve Bank of St. Louis', sourceUrl: FRED_HOME + id, fredId: id, title, unit, frequency: 'monthly', years: 10, ...extra };
}

const COUNTRIES = {
  IN: { name: 'India', re: /\b(india|indian|rbi|rupee|sensex|nifty|delhi|mumbai|modi)\b/i },
  CN: { name: 'China', re: /\b(china|chinese|beijing|yuan|pboc)\b/i },
  US: { name: 'the US', re: /\b(u\.s\.|us economy|united states|america|american|washington|fed|federal reserve|fomc|wall street|powell|treasury|white house|trump|biden)\b/i },
  GB: { name: 'the UK', re: /\b(uk|u\.k\.|britain|british|bank of england|london|sterling)\b/i },
  JP: { name: 'Japan', re: /\b(japan|japanese|tokyo|yen|boj)\b/i },
};

export const CATALOG = {
  fedfunds: fred('FEDFUNDS', 'US interest rate set by the Fed (federal funds rate)', '%'),
  us_cpi: fred('CPIAUCSL', 'US inflation: prices compared with a year earlier', '%', { transform: 'yoy', years: 10 }),
  us_unemp: fred('UNRATE', 'US unemployment rate', '%'),
  us_10y: fred('DGS10', 'US 10-year government bond yield (monthly average)', '%', { fredFrequency: 'm' }),
  brent: fred('DCOILBRENTEU', 'Brent crude oil price (monthly average)', 'US$ per barrel', { fredFrequency: 'm' }),
  usdinr: fred('DEXINUS', 'Indian rupees per US dollar (monthly average)', '₹ per US$', { fredFrequency: 'm' }),
  eurusd: fred('DEXUSEU', 'US dollars per euro (monthly average)', 'US$ per €', { fredFrequency: 'm' }),
  sp500: fred('SP500', 'S&P 500 share index (monthly average)', 'index points', { fredFrequency: 'm' }),
};
for (const [code, c] of Object.entries(COUNTRIES)) {
  CATALOG['gdp_' + code] = { provider: 'worldbank', source: 'World Bank', sourceUrl: WB_HOME + 'NY.GDP.MKTP.KD.ZG', wbCountry: code, wbIndicator: 'NY.GDP.MKTP.KD.ZG', title: `Economic growth in ${c.name} (GDP growth per year)`, unit: '%', frequency: 'yearly', years: 25 };
  if (code !== 'US') {
    CATALOG['infl_' + code] = { provider: 'worldbank', source: 'World Bank', sourceUrl: WB_HOME + 'FP.CPI.TOTL.ZG', wbCountry: code, wbIndicator: 'FP.CPI.TOTL.ZG', title: `Inflation in ${c.name} (price rise per year)`, unit: '%', frequency: 'yearly', years: 25 };
  }
}

export function detectCountry(text) {
  const t = String(text || '');
  const hits = Object.entries(COUNTRIES).filter(([, c]) => c.re.test(t)).map(([code]) => code);
  return hits.length === 1 ? hits[0] : null; // two countries in one headline: do not guess
}

const MAX_CHARTS = 2;

// Which series fit this text? Returns catalog ids, at most two. No match gives an empty list.
export function pickSeries(text) {
  const t = String(text || '');
  const country = detectCountry(t);
  const out = [];
  const add = (id) => { if (CATALOG[id] && !out.includes(id)) out.push(id); };
  const us = country === 'US';

  if (/\b(fed|federal reserve|fomc|powell)\b/i.test(t) || (us && /\binterest rates?|rate (cut|hike|decision)\b/i.test(t))) add('fedfunds');
  if (/\b(treasury|bond) yields?\b|\b10-year\b/i.test(t) && (us || !country)) add('us_10y');
  if (/\binflation|\bcpi\b|cost of living|consumer prices\b/i.test(t)) {
    if (us) add('us_cpi'); else if (country && CATALOG['infl_' + country]) add('infl_' + country);
  }
  if (/\b(unemployment|jobless|payrolls?|jobs report)\b/i.test(t) && us) add('us_unemp');
  if (/\b(brent|crude|opec|oil prices?|oil price)\b/i.test(t)) add('brent');
  if (/\brupee\b/i.test(t)) add('usdinr');
  if (/\beuro\b/i.test(t) && /\bdollar\b/i.test(t)) add('eurusd');
  if (/\b(s&p 500|wall street|dow jones|nasdaq)\b/i.test(t)) add('sp500');
  if (/\b(gdp|economic growth|recession|economy (grew|grows|shrank|contracted|expanded))\b/i.test(t) && country) add('gdp_' + country);
  return out.slice(0, MAX_CHARTS);
}

/* ---------- parsing and shaping ---------- */

export function parseFred(json) {
  const obs = json && Array.isArray(json.observations) ? json.observations : [];
  const pts = [];
  for (const o of obs) {
    const v = Number(o.value);
    if (o.value === '.' || !Number.isFinite(v) || !/^\d{4}-\d{2}-\d{2}$/.test(String(o.date))) continue;
    pts.push([String(o.date).slice(0, 7), v]);
  }
  return pts;
}

export function parseWorldBank(json) {
  const rows = Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];
  const pts = [];
  for (const r of rows) {
    const v = Number(r && r.value);
    if (r && r.value !== null && Number.isFinite(v) && /^\d{4}$/.test(String(r.date))) pts.push([String(r.date), v]);
  }
  return pts.sort((a, b) => a[0].localeCompare(b[0]));
}

// Prices compared with 12 months earlier, from a monthly index.
export function yearOverYear(pts) {
  const byMonth = new Map(pts);
  const out = [];
  for (const [d, v] of pts) {
    const prev = byMonth.get(`${Number(d.slice(0, 4)) - 1}${d.slice(4)}`);
    if (prev) out.push([d, Math.round(((v / prev - 1) * 100) * 100) / 100]);
  }
  return out;
}

const round = (n) => Math.round(n * 100) / 100;

export function shape(def, pts) {
  let p = pts.slice().sort((a, b) => a[0].localeCompare(b[0]));
  if (def.transform === 'yoy') p = yearOverYear(p);
  const lastYear = p.length ? Number(p[p.length - 1][0].slice(0, 4)) : 0;
  p = p.filter(([d]) => Number(d.slice(0, 4)) >= lastYear - def.years);
  if (p.length < 6) return null; // too little to draw anything honest
  if (p.some(([, v]) => !Number.isFinite(v) || Math.abs(v) > 1e7)) return null;
  const step = Math.ceil(p.length / 140); // keep files small
  const slim = p.filter((_, i) => i % step === 0 || i === p.length - 1).map(([d, v]) => [d, round(v)]);
  return slim;
}

const fmt = (v, unit) => (unit === '%' ? `${v}%` : unit === 'index points' ? `${v}` : `${v} ${unit}`);

// Plain facts the explainer is allowed to quote. Every number here is computed from the downloaded data.
export function facts(def, pts) {
  const last = pts[pts.length - 1];
  const find = (monthsBack) => {
    const [y, m] = last[0].split('-').map(Number);
    if (!m) return pts.find((p) => Number(p[0]) === y - monthsBack / 12) || null;
    const t = y * 12 + (m - 1) - monthsBack;
    const key = `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
    return pts.find((p) => p[0] === key) || null;
  };
  let hi = pts[0], lo = pts[0];
  for (const p of pts) { if (p[1] > hi[1]) hi = p; if (p[1] < lo[1]) lo = p; }
  const monthly = /^\d{4}-\d{2}$/.test(last[0]);
  const lines = [`${def.title}: ${fmt(last[1], def.unit)} in ${last[0]} (latest data).`];
  const yearAgo = find(12);
  if (yearAgo) lines.push(`One year earlier (${yearAgo[0]}): ${fmt(yearAgo[1], def.unit)}.`);
  const fiveAgo = find(60);
  if (fiveAgo) lines.push(`Five years earlier (${fiveAgo[0]}): ${fmt(fiveAgo[1], def.unit)}.`);
  lines.push(`Highest in this period: ${fmt(hi[1], def.unit)} (${hi[0]}). Lowest: ${fmt(lo[1], def.unit)} (${lo[0]}). Period shown: ${pts[0][0]} to ${last[0]}${monthly ? '' : ', one value per year'}.`);
  return lines;
}

/* ---------- downloading ---------- */

async function getJson(url, fetchFn, timeoutMs = 30000) {
  let res;
  try {
    res = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } });
  } catch {
    throw new Error('network error');
  }
  if (!res.ok) throw new Error('HTTP ' + res.status);
  try { return await res.json(); } catch { throw new Error('not JSON'); }
}

export async function fetchSeries(id, { fredKey = '', fetchFn = fetch, now = new Date() } = {}) {
  const def = CATALOG[id];
  if (!def) throw new Error('unknown series');
  let raw;
  if (def.provider === 'fred') {
    if (!fredKey) throw new Error('no FRED key');
    const start = `${now.getUTCFullYear() - def.years - 2}-01-01`;
    const q = new URLSearchParams({ series_id: def.fredId, api_key: fredKey, file_type: 'json', observation_start: start });
    if (def.fredFrequency) { q.set('frequency', def.fredFrequency); q.set('aggregation_method', 'avg'); }
    raw = parseFred(await getJson(`${FRED_URL}?${q}`, fetchFn));
  } else {
    const q = new URLSearchParams({ format: 'json', per_page: '70' });
    raw = parseWorldBank(await getJson(`${WB_URL}/${def.wbCountry}/indicator/${def.wbIndicator}?${q}`, fetchFn));
  }
  const points = shape(def, raw);
  if (!points) throw new Error('not enough data');
  return {
    id, title: def.title, unit: def.unit, source: def.source, sourceUrl: def.sourceUrl, frequency: def.frequency,
    asOf: points[points.length - 1][0], fetchedAt: now.toISOString(), points, facts: facts(def, points),
  };
}

// Downloads each wanted series once per run, in a cache that lives for 20 hours. Failures are reported, never fatal.
export async function loadSeries(ids, { cache = {}, fredKey, fetchFn, now = new Date(), maxAgeMs = 20 * 3600000 } = {}) {
  const out = {};
  const errors = [];
  for (const id of [...new Set(ids)]) {
    const hit = cache[id];
    if (hit && now - Date.parse(hit.fetchedAt) < maxAgeMs) { out[id] = hit; continue; }
    try {
      out[id] = await fetchSeries(id, { fredKey, fetchFn, now });
    } catch (e) {
      errors.push(`${id}: ${e.message}`);
      if (hit) out[id] = hit; // an older copy is still real data, and the chart shows its date
    }
  }
  return { series: out, errors };
}
