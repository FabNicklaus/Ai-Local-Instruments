#!/usr/bin/env node

import { parseArgs } from 'util';
import { config } from 'dotenv';
import { initDb, insertPost, getPostCount } from '../lib/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { values } = parseArgs({
  options: {
    file: { type: 'string', short: 'f' },
    help: { type: 'boolean', short: 'h' }
  }
});

if (values.help || !values.file) {
  console.log(`
Instagram Data Export Parser

Estrae post salvati da un export JSON di Instagram.
Arricchisce con autori e hashtags.

Usage:
  node bin/parse-instagram-data.js --file your_instagram_activity/saved/saved_collections.json
`);
  process.exit(0);
}

const dataPath = path.resolve(values.file);

if (!fs.existsSync(dataPath)) {
  console.error(`File non trovato: ${dataPath}`);
  process.exit(1);
}

console.log(`\n📂 Leggo: ${dataPath}`);

await initDb();

const raw = fs.readFileSync(dataPath, 'utf8');
const data = JSON.parse(raw);

console.log(`Trovati ${data.length} elementi\n`);

let totalPosts = 0;
let totalCollections = 0;

for (const collection of data) {
  // Get collection name
  const nameEntry = collection.label_values?.find(l => l.label === 'Nome');
  if (!nameEntry) continue;

  const collectionName = nameEntry.value;
  totalCollections++;

  // The actual posts are in label_values[4].dict
  const postsData = collection.label_values?.[4]?.dict || [];

  console.log(`📁 "${collectionName}" - ${postsData.length} post`);

  for (const postWrapper of postsData) {
    const postDict = postWrapper.dict || [];

    let url = null;
    let caption = '';
    let author = null;
    let hashtags = '';

    for (const item of postDict) {
      // URL
      if (item.label === 'URL' && item.value && item.value.startsWith('http')) {
        url = item.value;
      }
      // Caption/Discispecies
      if (item.label === 'Discispecies' && item.value) {
        caption = item.value;
        hashtags = extractHashtags(item.value);
      }
      // Hashtags section (title: 'Hashtag')
      if (item.title === 'Hashtag' && item.dict) {
        const extractedTags = extractHashtagsFromDict(item.dict);
        if (extractedTags) hashtags = (hashtags ? hashtags + ' ' : '') + extractedTags;
      }
      // Author section (title: 'Titolare')
      if (item.title === 'Titolare' && item.dict) {
        author = extractAuthor(item.dict);
      }
    }

    if (!url) continue;

    insertPost({
      collection: collectionName,
      post_id: url,
      caption: caption,
      media_url: '',
      hashtags: hashtags,
      like_count: 0,
      comment_count: 0,
      timestamp: collection.timestamp ? new Date(collection.timestamp * 1000).toISOString() : null,
      author: author
    });

    totalPosts++;
  }
}

console.log(`\n✅ Totale: ${totalPosts} post da ${totalCollections} collezioni`);
console.log(`   Post totali nel DB: ${getPostCount()}`);

function extractHashtags(text) {
  if (!text) return '';
  const matches = text.match(/#[a-zA-Z0-9_]+/g);
  return matches ? matches.join(' ') : '';
}

function extractHashtagsFromDict(dict) {
  if (!dict || !Array.isArray(dict)) return '';
  const tags = [];
  for (const item of dict) {
    if (item.dict) {
      for (const sub of item.dict) {
        if (sub.label === 'Nome' && sub.value) {
          tags.push('#' + sub.value);
        }
      }
    }
  }
  return tags.join(' ');
}

function extractAuthor(dict) {
  if (!dict || !Array.isArray(dict)) return null;
  for (const item of dict) {
    if (item.dict) {
      for (const sub of item.dict) {
        if (sub.label === 'Nome utente' && sub.value) {
          return sub.value;
        }
      }
    }
  }
  return null;
}
