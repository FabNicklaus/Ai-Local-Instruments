#!/usr/bin/env node

import { parseArgs } from 'util';
import { config } from 'dotenv';
import { initDb, searchDb, updateUrlContents } from '../lib/db.js';
import { fetchUrls } from '../lib/fetchUrl.js';

config();

const { values } = parseArgs({
  options: {
    collection: { type: 'string', short: 'c' },
    folder: { type: 'string', short: 'f' },
    all: { type: 'boolean', short: 'a' },
    force: { type: 'boolean' },
    limit: { type: 'string', short: 'l', default: '50' },
    help: { type: 'boolean', short: 'h' }
  }
});

if (values.help) {
  console.log(`
Instagram-RAG URL Fetcher

Scarica i contenuti degli URL menzionati nei post salvati.

Usage:
  node bin/fetch-urls.js --all              Fetch da tutti i post
  node bin/fetch-urls.js --all --force      Forza re-fetch anche se già scaricati
  node bin/fetch-urls.js -c "Collection"    Fetch da una collezione
  node bin/fetch-urls.js --all -l 100      Limita a 100 post
`);
  process.exit(0);
}

await initDb();

const collection = values.collection || null;
const limit = parseInt(values.limit);
const force = values.force || false;

// Get posts
const results = searchDb('', collection, limit * 2);

if (!results.values.length) {
  console.log('Nessun post trovato.');
  process.exit(0);
}

// Extract URLs from post_id field (where URLs are stored)
const postIdIdx = results.columns.indexOf('post_id');
const urlContentsIdx = results.columns.indexOf('url_contents');

const postsToProcess = results.values.filter(row => {
  if (!force && row[urlContentsIdx]) return false;
  const postId = row[postIdIdx] || '';
  return /^https?:\/\//.test(postId);  // post_id is the URL
});

console.log(`\n📥 Trovati ${postsToProcess.length} post con URL da processare`);

let processed = 0;
for (const row of postsToProcess.slice(0, limit)) {
  const postId = row[postIdIdx];

  if (!postId || !/^https?:\/\//.test(postId)) continue;

  console.log(`\n  Fetch: ${postId}`);

  const contents = await fetchUrls([postId], 3);

  updateUrlContents(postId, contents);
  processed++;

  // Delay to avoid rate limiting
  await new Promise(r => setTimeout(r, 1500));
}

console.log(`\n✓ Completato! ${processed} post aggiornati.`);
process.exit(0);
