// Buzz news ingestion (Stage 1).
// Reads data/sources.json, fetches each RSS/Atom feed, and writes
//   data/stories.json  (public headlines, snippets and links)
//   data/status.json   (per-source health)
// It stores ONLY: headline, short snippet, link, publisher, date. Never full articles.
// Safe to run repeatedly: a story's id comes from its link, so reruns never duplicate it.

import { readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { parseFeed } from './lib/rss.mjs';
import { clusterStories } from './lib/cluster.mjs';

export const CONFIG = {
  maxAgeDays: 7,
  maxPerTopic: 60,
  maxPerSource: 25,
  snippetMax: 220,
  titleMax: 200,
  fetchTimeoutMs: 15000,
  maxBytes: 3_000_000,
  pauseAfterFailures: 5,
  retryPausedAfterHours: 24,
  userAgent: 'BuzzNewsReader/0.1 (personal project; reads RSS headlines only, links back to publishers)',
};

const TRACKING_PARAM = /^(utm_|at_|mc_|cmp|ocid$|ito$|ref$|traffic_source$|fbclid$|gclid$|xtor$)/i;
const DAY_MS = 24 * 60 * 60 * 1000;

export function canonicalUrl(raw) {
  if (typeof raw !== 'string') return null;
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (!u.hostname.includes('.')) return null;
  u.protocol = 'https:'; // links go to publishers; https is safe for all sources used
  u.username = '';
  u.password = '';
  u.hash = '';
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) u.searchParams.delete(key);
  }
  return u.toString().replace(/\?$/, '');
}

export function storyId(url) {
  return createHash('sha1').update(url).digest('hex').slice(0, 12);
}

export function truncate(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:!?-]+$/, '') + '…';
}

function parseDate(value, now) {
  if (!value) return null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  if (t > now.getTime() + 36 * 60 * 60 * 1000) return null; // far-future date: ignore it
  return new Date(t).toISOString();
}

// Second safety layer: feed text must end up as plain text even if a caller skipped parseFeed.
function plain(text) {
  return String(text || '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<\/?[a-zA-Z][^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// A feed that covers several topics: pick the one whose keywords appear most in the headline and snippet.
// Falls back to the feed's first listed topic.
export function routeTopic(text, source, topicList = []) {
  const options = source.topics || [];
  if (options.length <= 1) return options[0] || 'general';
  const hay = ' ' + String(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ') + ' ';
  let best = options[0];
  let bestScore = 0;
  for (const id of options) {
    const t = topicList.find((x) => x.id === id);
    if (!t) continue;
    let score = 0;
    for (const kw of [...(t.keywords || []), ...((t.subtopics || []).flatMap((st) => st.keywords || []))]) {
      const k = kw.toLowerCase();
      if (hay.includes(' ' + k + ' ') || (k.length > 4 && hay.includes(' ' + k))) score += 1;
    }
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}

// Turns one feed item into a story, or returns { skip: reason } if it should be skipped.
export function toStory(item, source, now, topicList = []) {
  const title = truncate(plain(item.title), CONFIG.titleMax);
  if (!title) return { skip: 'no title' };
  const url = canonicalUrl(item.link);
  if (!url) return { skip: 'bad link' };
  if (Array.isArray(source.urlMustContain) && source.urlMustContain.length > 0) {
    if (!source.urlMustContain.some((part) => url.includes(part))) return { skip: 'filtered out by urlMustContain' };
  }
  let snippet = plain(item.description);
  if (snippet.toLowerCase() === title.toLowerCase()) snippet = '';
  snippet = truncate(snippet, CONFIG.snippetMax);
  const published = parseDate(item.date, now);
  if (published && now.getTime() - Date.parse(published) > CONFIG.maxAgeDays * DAY_MS) return { skip: 'too old' };
  return {
    story: {
      id: storyId(url),
      topic: routeTopic(title + ' ' + snippet, source, topicList),
      title,
      snippet,
      url,
      sourceId: source.id,
      publisher: source.publisher,
      country: source.country || '',
      published,
      firstSeen: now.toISOString(),
      singleSource: true,
    },
  };
}

function storyTime(s) {
  return Date.parse(s.published || s.firstSeen) || 0;
}

export function mergeStories(existing, incoming, now) {
  const byId = new Map();
  for (const s of existing) {
    if (s.demo) continue; // demonstration cards never survive a real run
    byId.set(s.id, s);
  }
  for (const s of incoming) {
    const old = byId.get(s.id);
    byId.set(s.id, old ? { ...s, firstSeen: old.firstSeen } : s);
  }
  const cutoff = now.getTime() - CONFIG.maxAgeDays * DAY_MS;
  const fresh = [...byId.values()].filter((s) => storyTime(s) >= cutoff);
  fresh.sort((a, b) => storyTime(b) - storyTime(a) || a.id.localeCompare(b.id));
  const perTopic = new Map();
  return fresh.filter((s) => {
    const n = perTopic.get(s.topic) || 0;
    if (n >= CONFIG.maxPerTopic) return false;
    perTopic.set(s.topic, n + 1);
    return true;
  });
}

export async function fetchText(url, fetchImpl = fetch) {
  const res = await fetchImpl(url, {
    headers: {
      'User-Agent': CONFIG.userAgent,
      Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
    },
    signal: AbortSignal.timeout(CONFIG.fetchTimeoutMs),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (text.length > CONFIG.maxBytes) throw new Error('Feed too large');
  return text;
}

function isPaused(prev, now) {
  if (!prev || (prev.consecutiveFailures || 0) < CONFIG.pauseAfterFailures) return false;
  const last = Date.parse(prev.lastAttempt || 0);
  return now.getTime() - last < CONFIG.retryPausedAfterHours * 60 * 60 * 1000;
}

// Runs every active source once. `fetchFn(url)` is injectable so tests need no network.
export async function ingestAll({ sources, topics = [], previousStatus = {}, previousStories = [], fetchFn = fetchText, now = new Date() }) {
  const status = {};
  const incoming = [];
  let anyOk = false;

  for (const source of sources) {
    const prev = previousStatus[source.id];
    if (!source.active) {
      status[source.id] = { ...(prev || {}), skipped: 'inactive' };
      continue;
    }
    if (isPaused(prev, now)) {
      status[source.id] = { ...prev, paused: true };
      continue;
    }
    const entry = {
      ok: false,
      lastAttempt: now.toISOString(),
      lastSuccess: prev?.lastSuccess || null,
      consecutiveFailures: prev?.consecutiveFailures || 0,
      itemCount: 0,
      acceptedCount: 0,
      skippedCount: 0,
      error: null,
      paused: false,
    };
    try {
      const xml = await fetchFn(source.feedUrl);
      const feed = parseFeed(xml);
      if (feed.items.length === 0) throw new Error('Feed has no items');
      entry.itemCount = feed.items.length;
      const accepted = [];
      for (const item of feed.items) {
        const result = toStory(item, source, now, topics);
        if (result.story) accepted.push(result.story);
        else entry.skippedCount += 1;
      }
      accepted.sort((a, b) => storyTime(b) - storyTime(a));
      const kept = accepted.slice(0, CONFIG.maxPerSource);
      entry.acceptedCount = kept.length;
      incoming.push(...kept);
      entry.ok = true;
      entry.lastSuccess = now.toISOString();
      entry.consecutiveFailures = 0;
      anyOk = true;
    } catch (err) {
      entry.consecutiveFailures += 1;
      entry.error = String(err && err.message ? err.message : err).slice(0, 200);
      entry.paused = entry.consecutiveFailures >= CONFIG.pauseAfterFailures;
    }
    status[source.id] = entry;
  }

  const stories = mergeStories(previousStories, incoming, now);
  const sourcesById = Object.fromEntries(sources.map((x) => [x.id, x]));
  const clusters = clusterStories(stories, sourcesById);
  const clusterOf = new Map();
  for (const c of clusters) for (const id of c.storyIds) clusterOf.set(id, c.id);
  for (const st of stories) st.clusterId = clusterOf.get(st.id);
  return { stories, clusters, status, anyOk };
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(file, data) {
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  await rename(tmp, file);
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dataDir = path.join(root, 'data');
  const sourcesFile = await readJson(path.join(dataDir, 'sources.json'), { sources: [] });
  const previousStories = await readJson(path.join(dataDir, 'stories.json'), { stories: [] });
  const previousStatus = await readJson(path.join(dataDir, 'status.json'), { sources: {} });
  const topicsFile = await readJson(path.join(dataDir, 'topics.json'), { topics: [] });
  const now = new Date();

  const { stories, clusters, status, anyOk } = await ingestAll({
    sources: sourcesFile.sources || [],
    topics: topicsFile.topics || [],
    previousStatus: previousStatus.sources || {},
    previousStories: previousStories.stories || [],
    now,
  });

  await writeJsonAtomic(path.join(dataDir, 'status.json'), { generatedAt: now.toISOString(), sources: status });

  if (anyOk) {
    await writeJsonAtomic(path.join(dataDir, 'stories.json'), { generatedAt: now.toISOString(), demo: false, stories, clusters });
  } else {
    console.log('::warning::Every source failed. Keeping the previous stories.json untouched.');
  }

  for (const [id, s] of Object.entries(status)) {
    const line = s.skipped ? `skipped (${s.skipped})` : s.paused ? `PAUSED after ${s.consecutiveFailures} failures` : s.ok ? `ok, ${s.acceptedCount}/${s.itemCount} kept` : `FAILED: ${s.error}`;
    console.log(`${id.padEnd(26)} ${line}`);
  }
  console.log(`Stories written: ${anyOk ? stories.length + ' in ' + clusters.length + ' clusters (' + clusters.filter((c) => c.multiSource).length + ' with 2+ independent outlets)' : 'none (kept previous)'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
