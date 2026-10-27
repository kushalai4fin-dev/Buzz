// Writes data/explainers.json: a plain-language explainer for each story cluster.
// Rules this script follows:
//  - One AI call per cluster VERSION. Unchanged stories are never explained twice (cached by id + version).
//  - Hard limits: calls per run and per day (data/usage.json). A quota error stops the run for today.
//  - If no AI key is set, or the AI fails, nothing is invented: the cluster simply has no explainer.
//  - Anything the model returns is validated (see lib/explainer.mjs) before it is saved.

import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { clusterVersion } from './lib/cluster.mjs';
import { buildEvidence, buildPrompt, evidenceChars, SYSTEM_PROMPT, validateExplainer, LIMITS, SCHEMA } from './lib/explainer.mjs';
import { pickSeries, loadSeries } from './lib/series.mjs';
import { getProvider } from './lib/llm.mjs';

export const EXPLAIN = {
  maxPerRun: 25,
  dailyCalls: 120,
  maxAttemptsPerVersion: 2,
  maxConsecutiveErrors: 3,
  delayMs: 4500, // keeps us under typical free-tier requests-per-minute limits
  keepUsageDays: 45,
};

const dayKey = (d) => d.toISOString().slice(0, 10);

export function emptyUsage() {
  return { days: {} };
}

function bump(usage, now, patch) {
  const k = dayKey(now);
  const day = (usage.days[k] ||= { calls: 0, inputTokens: 0, outputTokens: 0, ok: 0, insufficient: 0, rejected: 0, errors: 0 });
  for (const [key, val] of Object.entries(patch)) day[key] = (day[key] || 0) + val;
  return day;
}

export function pruneUsage(usage, now) {
  const cutoff = now.getTime() - EXPLAIN.keepUsageDays * 86400000;
  for (const k of Object.keys(usage.days)) if (Date.parse(k) < cutoff) delete usage.days[k];
}

export async function explainAll({ clusters, stories, sources = [], existing = {}, provider, usage = emptyUsage(), now = new Date(), limits = {}, getSeries = async () => ({}), sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const cfg = { ...EXPLAIN, ...limits };
  const storiesById = Object.fromEntries(stories.map((s) => [s.id, s]));
  const sourcesById = Object.fromEntries(sources.map((s) => [s.id, s]));
  const items = {};
  const report = { reused: 0, generated: 0, insufficient: 0, rejected: 0, errors: 0, skippedByLimit: 0, stoppedBecause: null };

  // Keep only clusters that still exist; reuse what is still valid.
  const todo = [];
  for (const c of clusters) {
    const version = clusterVersion(c, storiesById);
    const old = existing[c.id];
    const current = old && old.schema === SCHEMA; // an older saved shape is rewritten
    if (current && old.version === version && (old.status === 'ok' || old.status === 'insufficient')) {
      items[c.id] = old;
      report.reused += 1;
    } else if (current && old.version === version && old.status === 'failed' && (old.attempts || 0) >= cfg.maxAttemptsPerVersion) {
      items[c.id] = old; // give up on this exact text; a changed story gets a fresh try
    } else {
      todo.push({ c, version, attempts: current && old.version === version ? old.attempts || 0 : 0 });
    }
  }

  if (!provider) {
    report.stoppedBecause = 'no AI provider configured';
    return { items, usage, report };
  }

  todo.sort((a, b) => Number(b.c.multiSource) - Number(a.c.multiSource) || Date.parse(b.c.latest) - Date.parse(a.c.latest));

  let calls = 0;
  let consecutiveErrors = 0;
  for (const { c, version, attempts } of todo) {
    if (report.stoppedBecause) { report.skippedByLimit += 1; continue; }
    const dayCalls = (usage.days[dayKey(now)] || {}).calls || 0;
    if (calls >= cfg.maxPerRun) { report.stoppedBecause = 'per-run limit reached'; report.skippedByLimit += 1; continue; }
    if (dayCalls >= cfg.dailyCalls) { report.stoppedBecause = 'daily limit reached'; report.skippedByLimit += 1; continue; }

    const evidence = buildEvidence(c, storiesById, sourcesById);
    const base = { schema: SCHEMA, version, provider: provider.name, model: provider.model, generatedAt: now.toISOString(), attempts: attempts + 1 };

    if (evidenceChars(evidence) < LIMITS.minEvidenceChars) {
      items[c.id] = { ...base, status: 'insufficient', reason: 'Not enough information in the reports to explain this responsibly yet.' };
      report.insufficient += 1;
      continue; // no model call, no cost
    }

    // Real numbers for charts, chosen by keyword rules in code (never by the AI).
    const wanted = pickSeries(evidence.map((e) => e.title + ' ' + e.snippet).join(' '));
    let have = {};
    try { have = wanted.length ? await getSeries(wanted) : {}; } catch { have = {}; }
    const picked = wanted.filter((id) => have[id]);
    const dataFacts = picked.map((id, i) => ({ id: 'D' + (i + 1), seriesId: id, lines: have[id].facts }));
    const charts = picked.map((id) => { const { facts, ...rest } = have[id]; return rest; });

    let verdict = null;
    let errorMessage = null;
    for (let attempt = 0; attempt < 2 && !verdict?.ok; attempt += 1) {
      if (((usage.days[dayKey(now)] || {}).calls || 0) >= cfg.dailyCalls) { errorMessage = 'daily limit reached'; break; }
      try {
        const prompt = buildPrompt(evidence, dataFacts) + (attempt ? `\n\nYour previous answer was rejected: ${verdict.errors.join('; ')}. Fix exactly that and answer with the JSON only.` : '');
        const out = await provider.generate({ system: SYSTEM_PROMPT, user: prompt });
        calls += 1;
        bump(usage, now, { calls: 1, inputTokens: out.inputTokens || 0, outputTokens: out.outputTokens || 0 });
        verdict = validateExplainer(out.text, evidence, dataFacts);
        consecutiveErrors = 0;
        if (!verdict.ok) bump(usage, now, { rejected: 1 });
      } catch (err) {
        bump(usage, now, { calls: 1, errors: 1 });
        calls += 1;
        errorMessage = String(err.message || err).slice(0, 160);
        consecutiveErrors += 1;
        if (err.quota) { report.stoppedBecause = 'AI quota or rate limit reached'; break; }
        if (err.fatal) { report.stoppedBecause = 'AI provider refused the request: ' + errorMessage; break; }
        if (consecutiveErrors >= cfg.maxConsecutiveErrors) { report.stoppedBecause = 'too many errors in a row'; break; }
        break;
      }
      if (!verdict.ok && attempt === 0 && cfg.delayMs) await sleep(cfg.delayMs);
    }

    if (verdict && verdict.ok && verdict.insufficient) {
      items[c.id] = { ...base, status: 'insufficient', reason: verdict.reason };
      bump(usage, now, { insufficient: 1 });
      report.insufficient += 1;
    } else if (verdict && verdict.ok) {
      items[c.id] = { ...base, status: 'ok', content: verdict.content, charts };
      bump(usage, now, { ok: 1 });
      report.generated += 1;
    } else {
      const reason = errorMessage || (verdict ? 'rejected: ' + verdict.errors.join('; ') : 'no result');
      if (verdict && !verdict.ok) report.rejected += 1; else report.errors += 1;
      if (!report.stoppedBecause || /rejected|too many/.test(reason)) items[c.id] = { ...base, status: 'failed', reason: reason.slice(0, 200) };
    }
    if (!report.stoppedBecause && cfg.delayMs) await sleep(cfg.delayMs);
  }

  pruneUsage(usage, now);
  return { items, usage, report };
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
  const storiesFile = await readJson(path.join(dataDir, 'stories.json'), { stories: [], clusters: [] });
  const sourcesFile = await readJson(path.join(dataDir, 'sources.json'), { sources: [] });
  const existing = (await readJson(path.join(dataDir, 'explainers.json'), { items: {} })).items || {};
  const usage = await readJson(path.join(dataDir, 'usage.json'), emptyUsage());
  usage.days ||= {};
  const now = new Date();

  if (storiesFile.demo || !Array.isArray(storiesFile.clusters) || storiesFile.clusters.length === 0) {
    console.log('No real stories yet. Nothing to explain.');
    return;
  }
  const provider = getProvider();
  const seriesCache = (await readJson(path.join(dataDir, 'series-cache.json'), { series: {} })).series || {};
  const seriesErrors = [];
  const getSeries = async (ids) => {
    const r = await loadSeries(ids, { cache: seriesCache, fredKey: process.env.FRED_API_KEY || '', now });
    Object.assign(seriesCache, r.series);
    for (const e of r.errors) if (!seriesErrors.includes(e)) seriesErrors.push(e);
    return r.series;
  };
  const { items, report } = await explainAll({ clusters: storiesFile.clusters, stories: storiesFile.stories, sources: sourcesFile.sources, existing, provider, usage, now, getSeries });
  await writeJsonAtomic(path.join(dataDir, 'series-cache.json'), { series: seriesCache });
  if (seriesErrors.length) console.log(`Charts: ${seriesErrors.length} data download problem(s): ${seriesErrors.slice(0, 5).join('; ')}${process.env.FRED_API_KEY ? '' : ' (no FRED_API_KEY set: US charts are skipped)'}`);
  await writeJsonAtomic(path.join(dataDir, 'explainers.json'), { generatedAt: now.toISOString(), items });
  await writeJsonAtomic(path.join(dataDir, 'usage.json'), usage);

  const day = usage.days[now.toISOString().slice(0, 10)] || {};
  console.log(`Explainers: ${report.generated} new, ${report.reused} reused, ${report.insufficient} not enough info, ${report.rejected} rejected, ${report.errors} errors, ${report.skippedByLimit} left for later.`);
  if (report.stoppedBecause) console.log(`::warning::Explainer run stopped: ${report.stoppedBecause}`);
  console.log(`Today so far: ${day.calls || 0} AI calls, ${day.inputTokens || 0} input and ${day.outputTokens || 0} output tokens.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(String(err && err.message ? err.message : err));
    process.exit(1);
  });
}
