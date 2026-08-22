#!/usr/bin/env node

import { parseArgs } from 'util';
import { config } from 'dotenv';
import { initDb, insertPost, getCollections, getPostCount } from '../lib/db.js';
import { loginInstagram, scrapeCollection, scrapeAllSaved, getSavedCollections } from '../lib/instagram.js';

config();

const { values } = parseArgs({
  options: {
    collection: { type: 'string', short: 'c' },
    'list-collections': { type: 'boolean' },
    all: { type: 'boolean', short: 'a' },
    help: { type: 'boolean', short: 'h' }
  }
});

if (values.help) {
  console.log(`
Instagram-RAG Scraper

Usage:
  node bin/scrape.js --list-collections    Lista le collezioni salvate
  node bin/scrape.js --collection "Name"   Estrae post da una collezione
  node bin/scrape.js --all                  Estrae da tutte le collezioni

Environment:
  INSTAGRAM_USERNAME  Username Instagram
  INSTAGRAM_PASSWORD  Password Instagram
`);
  process.exit(0);
}

const username = process.env.INSTAGRAM_USERNAME;
const password = process.env.INSTAGRAM_PASSWORD;

if (!username || !password) {
  console.error('Errore: INSTAGRAM_USERNAME e INSTAGRAM_PASSWORD devono essere settati nel .env');
  process.exit(1);
}

await initDb();

console.log('🔐 Login Instagram...');
const { context, browser, page: loginPage } = await loginInstagram(username, password);

if (values['list-collections']) {
  console.log('\n📁 Collezioni salvate:');
  const collections = await getSavedCollections(context, browser, username);
  collections.forEach(c => console.log(`  - ${c.name}`));
  if (collections.length === 0) {
    console.log('  (nessuna collezione trovata)');
  }
  await browser.close();
  process.exit(0);
}

if (values.collection) {
  console.log(`\n📥 Estrazione collezione: "${values.collection}"`);
  const posts = await scrapeCollection(context, username, values.collection);
  console.log(`\n💾 Salvo ${posts.length} post nel database...`);
  for (const post of posts) {
    insertPost(post);
  }
  console.log('✓ Completato!');
}

if (values.all) {
  console.log('\n📥 Estrazione tutte le collezioni...');
  const { collections, posts } = await scrapeAllSaved(context, browser, username);
  console.log(`\n💾 Salvo ${posts.length} post nel database...`);
  for (const post of posts) {
    insertPost(post);
  }
  console.log(`\n✓ Completato! ${posts.length} post da ${collections.length} collezioni.`);
}

if (!values.collection && !values.all && !values['list-collections']) {
  console.log('Specifica --collection "Nome" oppure --all oppure --list-collections');
}

await browser.close();
process.exit(0);
