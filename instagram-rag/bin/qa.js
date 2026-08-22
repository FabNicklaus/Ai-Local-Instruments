#!/usr/bin/env node

import { parseArgs } from 'util';
import { config } from 'dotenv';
import { initDb, searchPostsWithMessages } from '../lib/db.js';

config();

const { values, positionals } = parseArgs({
  options: {
    collection: { type: 'string', short: 'c' },
    context: { type: 'string', short: 'k', default: '5' },
    help: { type: 'boolean', short: 'h' }
  },
  allowPositionals: true
});

const question = positionals[0];

if (values.help || !question) {
  console.log(`
Instagram-RAG Q&A

Usage:
  node bin/qa.js "cosa ho salvato su Python?"              Fai una domanda
  node bin/qa.js "query" -c "Collection"                   Cerca in una collezione
  node bin/qa.js "query" -k 10                            Usa più contesto
`);
  process.exit(0);
}

const collection = values.collection || null;
const contextSize = parseInt(values.context);

await initDb();

console.log(`\n🤔 Domanda: "${question}"`);
if (collection) console.log(`   (collezione: ${collection})`);

const results = await searchPostsWithMessages(question, collection, contextSize);

if (!results.values.length) {
  console.log('\nNessun risultato trovato per la tua domanda.');
  process.exit(0);
}

console.log(`\n📊 Trovati ${results.values.length} risultati, costruisco il prompt...\n`);

// Build context for LLM
const captionIdx = results.columns.indexOf('caption');
const collIdx = results.columns.indexOf('collection');
const hashtagsIdx = results.columns.indexOf('hashtags');
const likesIdx = results.columns.indexOf('like_count');
const timestampIdx = results.columns.indexOf('timestamp');
const urlContentsIdx = results.columns.indexOf('url_contents');
const messagesIdx = results.columns.indexOf('messages');

let contextText = '';
results.values.forEach((row, idx) => {
  const caption = row[captionIdx] || '';
  const coll = row[collIdx] || '';
  const hashtags = row[hashtagsIdx] || '';
  const likes = row[likesIdx] || 0;
  const ts = row[timestampIdx] || '';
  const urlContents = row[urlContentsIdx];
  const messages = row[messagesIdx] || [];

  contextText += `\n--- Post ${idx + 1} ---\n`;
  contextText += `Collezione: ${coll}\n`;
  contextText += `Data: ${ts}\n`;
  contextText += `Likes: ${likes}\n`;
  contextText += `Caption: ${caption}\n`;
  if (hashtags) contextText += `Hashtags: ${hashtags}\n`;

  if (urlContents) {
    try {
      const parsed = JSON.parse(urlContents);
      Object.entries(parsed).forEach(([url, content]) => {
        contextText += `Contenuto URL (${url}): ${content.substring(0, 500)}...\n`;
      });
    } catch (e) {}
  }

  // Include related messages from this post's author
  if (messages.length > 0) {
    contextText += `Messaggi dall'autore:\n`;
    messages.forEach((m, mi) => {
      if (m.content && !m.content.includes('Hai inviato una risposta privata')) {
        contextText += `  DM ${mi + 1}: ${m.content.substring(0, 200)}\n`;
      }
      if (m.link) contextText += `  Link: ${m.link}\n`;
    });
  }
});

const systemPrompt = `Sei un assistente che risponde alle domande basandosi sui post Instagram salvati dall'utente.
Rispondi in italiano. Cita sempre le fonti (es. "Secondo il post X...").
Usa i dati disponibili (caption, hashtags, contenuti URL scaricati) per rispondere accuratamente.
Se non hai abbastanza informazioni, dillo chiaramente.`;

const apiKey = process.env.MINIMAX_API_KEY;
const apiBase = process.env.MINIMAX_API_BASE || 'https://api.minimax.io/v1';

if (!apiKey) {
  console.error('Errore: MINIMAX_API_KEY non è settata nel .env');
  process.exit(1);
}

const messages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: `Contesto (${results.values.length} post):${contextText}\n\nDomanda: ${question}` }
];

try {
  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'MiniMax-M3',
      messages
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API Error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content || 'Nessuna risposta.';

  console.log('💬 Risposta:\n');
  console.log(answer);
} catch (e) {
  console.error('Errore chiamata API:', e.message);
  process.exit(1);
}

process.exit(0);
