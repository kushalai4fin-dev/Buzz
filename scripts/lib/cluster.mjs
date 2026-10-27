// Groups stories about the same event and counts how many INDEPENDENT outlets reported it.
// Conservative on purpose: wrongly merging two different events would overstate confidence,
// while missing a merge only means two cards instead of one.
// "Independent" means a different publishing group AND not the same wire agency copy.
// This says "several outlets report this". It does NOT say the claim is true.

import { createHash } from 'node:crypto';

export const CLUSTER = {
  windowHours: 48,
  joinFraction: 0.5, // a story joins a cluster if it matches at least half of its members
};

const STOP = new Set((
  'the and for with from that this have has had was were are will would could should about after before over into onto than then them they their there ' +
  'what when where which while who whom whose why how not but its his her she him our out all any can may might more most new says said say also amid ' +
  'just his who now one two three four five six seven eight nine ten'
).split(' '));

function stem(t) {
  t = t.replace(/'s$/, '');
  if (t.length > 5 && t.endsWith('ing')) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith('ed')) return t.slice(0, -2);
  if (t.length > 4 && t.endsWith('es')) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

export function tokens(text) {
  const out = new Set();
  for (const raw of String(text || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9'\s-]/g, ' ').split(/\s+/)) {
    const t = stem(raw.replace(/^[-']+|[-']+$/g, ''));
    if (t.length >= 3 && !STOP.has(t)) out.add(t);
  }
  return out;
}

function overlap(a, b) {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return { inter, jaccard: union ? inter / union : 0, small: Math.min(a.size, b.size) ? inter / Math.min(a.size, b.size) : 0 };
}

// Are two stories about the same event? (title-led, snippet as weaker support)
export function sameEvent(x, y) {
  const tx = x._t || tokens(x.title);
  const ty = y._t || tokens(y.title);
  const o = overlap(tx, ty);
  if (Math.min(tx.size, ty.size) <= 3) {
    if (o.inter >= 2 && o.jaccard >= 0.6) return true;
  } else if (o.inter >= 3 && (o.small >= 0.6 || o.jaccard >= 0.4)) {
    return true;
  }
  const fx = x._f || tokens(x.title + ' ' + x.snippet);
  const fy = y._f || tokens(y.title + ' ' + y.snippet);
  const f = overlap(fx, fy);
  return f.inter >= 5 && f.small >= 0.5 && o.inter >= 2;
}

const WIRE = [
  ['reuters', /\breuters\b/i],
  ['ap', /\(ap\)|\bassociated press\b/i],
  ['afp', /\bafp\b/i],
  ['pti', /\bpti\b/i],
  ['ani', /\(ani\)/i],
];

export function wireAgency(story) {
  const text = `${story.title || ''} ${story.snippet || ''}`;
  for (const [name, re] of WIRE) if (re.test(text)) return name;
  return null;
}

// What counts as one "origin" of the reporting.
export function originKey(story, source) {
  const wire = wireAgency(story);
  if (wire) return 'wire:' + wire;
  return (source && (source.group || source.id)) || story.sourceId || 'unknown';
}

function stableTime(s) {
  return Date.parse(s.published || s.firstSeen) || 0;
}

export function clusterStories(stories, sourcesById = {}, opts = {}) {
  const windowMs = (opts.windowHours ?? CLUSTER.windowHours) * 3600 * 1000;
  const frac = opts.joinFraction ?? CLUSTER.joinFraction;
  const items = stories.map((s) => ({ s, _t: tokens(s.title), _f: tokens(s.title + ' ' + (s.snippet || '')) }));
  items.sort((a, b) => stableTime(a.s) - stableTime(b.s) || a.s.id.localeCompare(b.s.id));

  const groups = []; // each: { topic, members: [item] }
  for (const it of items) {
    let best = null;
    let bestScore = 0;
    for (const g of groups) {
      if (g.topic !== it.s.topic) continue;
      let matches = 0;
      for (const m of g.members) {
        if (Math.abs(stableTime(m.s) - stableTime(it.s)) > windowMs) continue;
        if (sameEvent({ ...it.s, _t: it._t, _f: it._f }, { ...m.s, _t: m._t, _f: m._f })) matches += 1;
      }
      const score = matches / g.members.length;
      if (matches > 0 && score >= frac && score > bestScore) {
        best = g;
        bestScore = score;
      }
    }
    if (best) best.members.push(it);
    else groups.push({ topic: it.s.topic, members: [it] });
  }

  const clusters = groups.map((g) => {
    const members = g.members.map((m) => m.s);
    members.sort((a, b) => stableTime(a) - stableTime(b) || a.id.localeCompare(b.id));
    const lead = members[0]; // earliest report leads; the id stays stable as later reports join
    const origins = new Set(members.map((m) => originKey(m, sourcesById[m.sourceId])));
    const publishers = [...new Set(members.map((m) => m.publisher))];
    const latest = members.reduce((acc, m) => Math.max(acc, stableTime(m)), 0);
    return {
      id: lead.id,
      topic: g.topic,
      leadId: lead.id,
      storyIds: members.map((m) => m.id),
      publishers,
      independentSources: origins.size,
      multiSource: origins.size >= 2,
      latest: new Date(latest).toISOString(),
    };
  });
  clusters.sort((a, b) => Date.parse(b.latest) - Date.parse(a.latest) || a.id.localeCompare(b.id));
  return clusters;
}

// A short fingerprint of what the explainer would be based on. If it changes, the explainer is regenerated.
export function clusterVersion(cluster, storiesById) {
  const h = createHash('sha1');
  for (const id of [...cluster.storyIds].sort()) {
    const s = storiesById[id];
    h.update(id + '|' + (s ? s.title + '|' + (s.snippet || '') : '') + '\n');
  }
  return h.digest('hex').slice(0, 10);
}
