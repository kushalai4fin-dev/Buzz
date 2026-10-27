// Decides WHO gets a notification right now and WHAT it says. Pure functions: no network, easy to test.
// Rules: at most one message per chosen time, at most 2 per day, never the same story twice,
// and no message at all when there is nothing worth sending.

import '../../search.js'; // defines globalThis.BuzzSearch, the same matching the app uses

export const DIGEST = { windowMinutes: 50, maxPerDay: 2, freshHours: 36, keepSlots: 4, keepClusters: 30 };

export const ENDPOINT_OK = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)\//;

function localParts(date, tz) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

function previousDay(ymd) {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Which of this subscriber's times have just come due and have not been sent yet?
export function dueSlots(sub, now, windowMinutes = DIGEST.windowMinutes) {
  let local;
  try {
    local = localParts(now, sub.tz);
  } catch {
    return []; // unknown time zone: send nothing rather than guess
  }
  const sent = (sub.state && sub.state.slots) || {};
  const due = [];
  for (const t of sub.times || []) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) continue;
    const tm = Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
    let diff = local.minutes - tm;
    let day = local.date;
    if (diff < 0) { diff += 1440; day = previousDay(local.date); }
    if (diff >= windowMinutes) continue;
    const key = `${day}T${t}`;
    if (sent[key]) continue;
    const sentThatDay = Object.keys(sent).filter((k) => k.startsWith(day)).length;
    if (sentThatDay >= DIGEST.maxPerDay) continue;
    due.push(key);
  }
  return due.slice(0, 1); // one message per run, even if two times came due together
}

const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// Returns { title, body, url, tag, clusterId } or null when there is nothing worth sending.
export function pickDigest(sub, { clusters, stories, explainers = {}, topicLabels = {} }, now) {
  const byId = Object.fromEntries(stories.map((s) => [s.id, s]));
  const already = new Set((sub.state && sub.state.clusters) || []);
  const cutoff = now.getTime() - DIGEST.freshHours * 3600000;
  const mine = (sub.topics || []).length ? new Set(sub.topics) : null;
  const fresh = clusters.filter((c) => Date.parse(c.latest) >= cutoff && !already.has(c.id) && byId[c.leadId]);

  const tracked = globalThis.BuzzSearch.matchTracked((sub.terms || []).map((t) => ({ text: t })), fresh, byId);
  let pick = null;
  let reason = null;
  if (tracked.length) {
    pick = tracked[0].cluster;
    reason = tracked[0].terms[0];
  } else {
    const pool = fresh.filter((c) => !mine || mine.has(c.topic));
    pool.sort((a, b) => {
      const ea = explainers[a.id] && explainers[a.id].status === 'ok' ? 1 : 0;
      const eb = explainers[b.id] && explainers[b.id].status === 'ok' ? 1 : 0;
      return Number(b.multiSource) - Number(a.multiSource) || eb - ea || Date.parse(b.latest) - Date.parse(a.latest) || a.id.localeCompare(b.id);
    });
    pick = pool[0] || null;
  }
  if (!pick) return null;
  const lead = byId[pick.leadId];
  const outlets = pick.multiSource ? ` · ${pick.independentSources} outlets` : '';
  return {
    title: reason ? clip(`Buzz: new on “${reason}”`, 70) : clip(`Buzz: ${topicLabels[pick.topic] || 'top story'}`, 70),
    body: clip(lead.title, 150) + outlets,
    url: `./?story=${encodeURIComponent(pick.id)}&listen=1`,
    tag: 'buzz-digest',
    clusterId: pick.id,
  };
}

// New stored state after a successful send: remember the slot and the story, and forget old ones.
export function nextState(sub, slotKey, clusterId) {
  const state = { slots: { ...((sub.state && sub.state.slots) || {}) }, clusters: [...((sub.state && sub.state.clusters) || [])] };
  state.slots[slotKey] = true;
  const keys = Object.keys(state.slots).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - DIGEST.keepSlots))) delete state.slots[k];
  state.clusters = [clusterId, ...state.clusters.filter((c) => c !== clusterId)].slice(0, DIGEST.keepClusters);
  return state;
}
