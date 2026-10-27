// Buzz development & production server with periodic news scraper.
// Serves static web app files and runs scripts/ingest.mjs every 6 hours.

import http from 'node:http';
import fs from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.dirname(__filename);

const PORT = parseInt(process.env.PORT, 10) || 8080;
const INTERVAL_HOURS = parseFloat(process.env.SCRAPE_INTERVAL_HOURS) || 6;
const INTERVAL_MS = INTERVAL_HOURS * 60 * 60 * 1000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

let isScraping = false;
let lastScrapeTime = null;
let lastScrapeResult = null;
let nextScrapeTime = new Date(Date.now() + INTERVAL_MS);

/**
 * Runs the news ingestion script (and explainer script if GEMINI_API_KEY is configured).
 */
function runScrape(triggerSource = 'scheduled') {
  if (isScraping) {
    console.log(`[Scraper] Scrape already in progress, skipping (${triggerSource}).`);
    return Promise.resolve({ skipped: true, reason: 'Already in progress' });
  }

  isScraping = true;
  console.log(`\n======================================================`);
  console.log(`[Scraper] Starting news scrape (${triggerSource}) at ${new Date().toISOString()}`);
  console.log(`======================================================`);

  return new Promise((resolve) => {
    const ingest = spawn(process.execPath, [path.join(ROOT_DIR, 'scripts', 'ingest.mjs')], {
      cwd: ROOT_DIR,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    ingest.stdout.on('data', (d) => {
      const text = d.toString();
      process.stdout.write(text);
      stdout += text;
    });

    ingest.stderr.on('data', (d) => {
      const text = d.toString();
      process.stderr.write(text);
      stderr += text;
    });

    ingest.on('close', (code) => {
      lastScrapeTime = new Date();
      nextScrapeTime = new Date(Date.now() + INTERVAL_MS);
      isScraping = false;

      const success = code === 0;
      lastScrapeResult = {
        success,
        exitCode: code,
        completedAt: lastScrapeTime.toISOString(),
        summary: stdout.split('\n').filter(Boolean).slice(-2).join('; '),
      };

      console.log(`[Scraper] Finished with code ${code}. Next run at ${nextScrapeTime.toLocaleTimeString()} (${nextScrapeTime.toISOString()}).`);
      console.log(`======================================================\n`);

      // If GEMINI_API_KEY is set, run explain.mjs
      if (process.env.GEMINI_API_KEY && success) {
        console.log(`[Explainer] GEMINI_API_KEY found, running explain.mjs...`);
        const explain = spawn(process.execPath, [path.join(ROOT_DIR, 'scripts', 'explain.mjs')], {
          cwd: ROOT_DIR,
          env: process.env,
          stdio: 'inherit',
        });
        explain.on('close', () => resolve(lastScrapeResult));
      } else {
        resolve(lastScrapeResult);
      }
    });

    ingest.on('error', (err) => {
      isScraping = false;
      lastScrapeResult = { success: false, error: err.message, completedAt: new Date().toISOString() };
      console.error(`[Scraper] Error running ingest: ${err.message}`);
      resolve(lastScrapeResult);
    });
  });
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(reqUrl.pathname);

  // API endpoint: /api/status
  if (pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(
      JSON.stringify(
        {
          status: 'ok',
          currentTime: new Date().toISOString(),
          isScraping,
          intervalHours: INTERVAL_HOURS,
          lastScrapeTime: lastScrapeTime ? lastScrapeTime.toISOString() : null,
          nextScrapeTime: nextScrapeTime ? nextScrapeTime.toISOString() : null,
          lastResult: lastScrapeResult,
        },
        null,
        2
      )
    );
    return;
  }

  // API endpoint: /api/scrape (manual trigger)
  if (pathname === '/api/scrape') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    if (isScraping) {
      res.end(JSON.stringify({ status: 'busy', message: 'A scrape is already in progress' }));
      return;
    }
    runScrape('manual-api');
    res.end(JSON.stringify({ status: 'started', message: 'Scrape started in background' }));
    return;
  }

  // Static file serving
  let relPath = pathname;
  if (relPath === '/' || relPath === '') {
    relPath = '/index.html';
  }

  const safePath = path.normalize(path.join(ROOT_DIR, relPath));
  if (!safePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  try {
    const fileStat = await stat(safePath);
    if (!fileStat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const headers = {
      'Content-Type': contentType,
      'Content-Length': fileStat.size,
    };

    // Never cache news data JSON so the frontend always displays the latest headlines
    if (ext === '.json') {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    } else {
      headers['Cache-Control'] = 'public, max-age=3600';
    }

    res.writeHead(200, headers);
    fs.createReadStream(safePath).pipe(res);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
    }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`Buzz Server running at: http://localhost:${PORT}`);
  console.log(`News scraping configured to run every ${INTERVAL_HOURS} hours.`);
  console.log(`Next scrape scheduled at: ${nextScrapeTime.toLocaleTimeString()} (${nextScrapeTime.toISOString()})`);
  console.log(`Manual scrape trigger: http://localhost:${PORT}/api/scrape`);
  console.log(`Server status: http://localhost:${PORT}/api/status`);
  console.log(`======================================================\n`);

  // Start periodic 6-hour scraper
  setInterval(() => {
    runScrape('scheduled-6h');
  }, INTERVAL_MS);

  // Trigger an initial scrape on startup in background
  runScrape('server-startup');
});

// Graceful termination
function shutdown() {
  console.log('\nShutting down Buzz server...');
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
