#!/usr/bin/env node

import { config } from 'dotenv';
import { initDb, getPostCount, getCollections } from '../lib/db.js';

config();

await initDb();

const collections = getCollections();
const total = getPostCount();

console.log('\n📊 Instagram-RAG Status');
console.log('─'.repeat(30));
console.log(`Totale post: ${total}`);
console.log(`Collezioni: ${collections.length}`);

if (collections.length > 0) {
  console.log('\n📁 Per collezione:');
  for (const coll of collections) {
    const count = getPostCount(coll);
    console.log(`   ${coll}: ${count} post`);
  }
}

console.log();
process.exit(0);
