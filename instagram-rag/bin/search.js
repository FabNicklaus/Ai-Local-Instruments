#!/usr/bin/env node

import { parseArgs } from 'util';
import { config } from 'dotenv';
import { initDb, searchDb, getPostCount } from '../lib/db.js';

config();

const { values, positionals } = parseArgs({
  options: {
    collection: { type: 'string', short: 'c' },
    limit: { type: 'string', short: 'l', default: '10' },
    json: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' }
  },
  allowPositionals: true
});

const query = positionals[0];
const collection = values.collection || null;
const limit = parseInt(values.limit);

if (values.help || !query) {
  console.log(`
Instagram-RAG Search

Usage:
  node bin/search.js "query"                    Cerca nei post
  node bin/search.js "query" -c "Collection"   Cerca in una collezione
  node bin/search.js "query" --json            Output JSON
  node bin/search.js "query" -l 20             Limita a 20 risultati
`);
  process.exit(0);
}

await initDb();

const result = searchDb(query, collection, limit);

if (!result.values.length) {
  console.log('Nessun risultato trovato.');
  process.exit(0);
}

if (values.json) {
  console.log(JSON.stringify({
    query,
    collection,
    count: result.values.length,
    results: result.values.map(row => {
      const obj = {};
      result.columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    })
  }, null, 2));
} else {
  console.log(`\n🔍 Risultati per "${query}"${collection ? ` in "${collection}"` : ''}:`);
  console.log('─'.repeat(60));

  result.values.forEach((row, idx) => {
    const captionIdx = result.columns.indexOf('caption');
    const collIdx = result.columns.indexOf('collection');
    const likesIdx = result.columns.indexOf('like_count');
    const timestampIdx = result.columns.indexOf('timestamp');

    const caption = (row[captionIdx] || '').substring(0, 100);
    const coll = row[collIdx] || '';
    const likes = row[likesIdx] || 0;
    const ts = row[timestampIdx] || '';

    console.log(`\n${idx + 1}. [${coll}] ${ts}`);
    console.log(`   ${caption}...`);
    console.log(`   ❤️ ${likes}`);
  });
}

process.exit(0);
