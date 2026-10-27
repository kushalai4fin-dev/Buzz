// Sends the scheduled notifications. Run by GitHub Actions every 30 minutes (see .github/workflows/digests.yml).
// Needs these secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
// Without them it prints a note and exits cleanly, so a half-finished setup never breaks the site.

import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { dueSlots, pickDigest, nextState, ENDPOINT_OK } from './lib/digest.mjs';

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// `db` and `send` are injected so this can be tested without a network.
export async function runDigests({ subs, data, now, send, save, remove, log = () => {} }) {
  const report = { checked: subs.length, sent: 0, skippedNothingToSend: 0, removed: 0, failed: 0 };
  for (const sub of subs) {
    if (!ENDPOINT_OK.test(sub.endpoint || '')) { await remove(sub); report.removed += 1; continue; }
    const slots = dueSlots(sub, now);
    if (!slots.length) continue;
    const msg = pickDigest(sub, data, now);
    if (!msg) { report.skippedNothingToSend += 1; continue; }
    try {
      await send(sub, JSON.stringify({ title: msg.title, body: msg.body, url: msg.url, tag: msg.tag }));
      await save(sub, nextState(sub, slots[0], msg.clusterId), 0);
      report.sent += 1;
    } catch (err) {
      const code = err && err.statusCode;
      if (code === 404 || code === 410) { await remove(sub); report.removed += 1; } // the phone unsubscribed
      else {
        report.failed += 1;
        const failures = (sub.failures || 0) + 1;
        if (failures >= 10) { await remove(sub); report.removed += 1; } else await save(sub, sub.state, failures);
        log(`send failed (${code || 'network'})`);
      }
    }
  }
  return report;
}

async function main() {
  const env = process.env;
  const need = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'];
  const missing = need.filter((k) => !env[k]);
  if (missing.length) {
    console.log(`Notifications are not set up yet (missing: ${missing.join(', ')}). Nothing to do.`);
    return;
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(env.SUPABASE_URL)) throw new Error('SUPABASE_URL looks wrong');
  if (!/^(mailto:|https:\/\/)/.test(env.VAPID_SUBJECT)) throw new Error('VAPID_SUBJECT must start with mailto: or https://');

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dataDir = path.join(root, 'data');
  const stories = await readJson(path.join(dataDir, 'stories.json'), { stories: [], clusters: [] });
  if (stories.demo || !stories.clusters || !stories.clusters.length) { console.log('No real stories yet. Nothing to send.'); return; }
  const explainers = (await readJson(path.join(dataDir, 'explainers.json'), { items: {} })).items || {};
  const topics = (await readJson(path.join(dataDir, 'topics.json'), { topics: [] })).topics || [];
  const data = { clusters: stories.clusters, stories: stories.stories, explainers, topicLabels: Object.fromEntries(topics.map((t) => [t.id, t.label])) };

  const { default: webpush } = await import('web-push');
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
  const table = `${env.SUPABASE_URL}/rest/v1/push_subscriptions`;
  const res = await fetch(`${table}?select=*&limit=5000`, { headers });
  if (!res.ok) throw new Error(`Could not read subscriptions (HTTP ${res.status})`);
  const subs = await res.json();

  const where = (sub) => `${table}?endpoint=eq.${encodeURIComponent(sub.endpoint)}`;
  const report = await runDigests({
    subs, data, now: new Date(),
    send: (sub, body) => webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, { TTL: 3600, urgency: 'normal' }),
    save: async (sub, state, failures) => {
      const r = await fetch(where(sub), { method: 'PATCH', headers, body: JSON.stringify({ state, failures }) });
      if (!r.ok) throw new Error(`Could not save state (HTTP ${r.status})`);
    },
    remove: async (sub) => { await fetch(where(sub), { method: 'DELETE', headers }); },
    log: (m) => console.log(m),
  });
  console.log(`Digests: ${report.checked} subscribers checked, ${report.sent} sent, ${report.skippedNothingToSend} had nothing new, ${report.removed} removed, ${report.failed} failed.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(String(err && err.message ? err.message : err).replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[redacted]'));
    process.exit(1);
  });
}
