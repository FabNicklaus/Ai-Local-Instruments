# Instagram-RAG

Sistema RAG (Retrieval Augmented Generation) per i post salvati su Instagram.

## Requisiti

- Node.js 18+
- Instagram data export (download da instagram.com/download/request)
- API key MiniMax (o altra API OpenAI-compatibile)

## Setup

```bash
npm install
```

### Configurazione (.env)

```env
MINIMAX_API_KEY=your_key_here
MINIMAX_API_BASE=https://api.minimax.io/v1
```

### Esportazione dati Instagram

1. Vai su `https://instagram.com/download/request`
2. Richiedi il download dei tuoi dati
3. Attendi l'email con il link di download
4. Estrai lo ZIP in `ig_export/extracted/`

La struttura attesa:
```
ig_export/extracted/your_instagram_activity/
├── saved/
│   └── saved_collections.json
├── messages/
│   └── inbox/*/message_1.json
└── media/
```

## Utilizzo

### 1. Parsa le collezioni salvate

```bash
node bin/parse-instagram-data.js --file ig_export/extracted/your_instagram_activity/saved/saved_collections.json
```

Estrae: caption, hashtags, URL, autori, timestamp da 722 post in 18 collezioni.

### 2. Cerca nei post

```bash
node bin/search.js "python"
node bin/search.js "python" -c "IT Tricks"
node bin/search.js "python" --json
```

### 3. Fai domande (RAG)

```bash
node bin/qa.js "cosa ho salvato su Python?"
node bin/qa.js "trucchi IT" -c "IT Tricks" -k 10
```

Il sistema cerca i post rilevanti, estrae autori e messaggi correlati, e costruisce un prompt arricchito per il LLM.

### 4. Scarica contenuti URL (opzionale)

```bash
node bin/fetch-urls.js --all --limit 50
node bin/fetch-urls.js -c "IT Tricks" --force
```

Scarica il contenuto testuale degli URL menzionati nei post (GitHub, YouTube, blog, ecc.).

## Struttura

```
instagram-rag/
├── bin/
│   ├── parse-instagram-data.js  # Parser export Instagram
│   ├── fetch-urls.js            # Scarica contenuti URL
│   ├── qa.js                    # RAG Q&A
│   └── search.js                # Ricerca BM25
├── lib/
│   ├── db.js         # SQLite + BM25
│   ├── fetchUrl.js   # URL content fetcher
│   └── messages.js   # Parser messaggi DM
├── data/
│   └── instagram_rag.db
└── ig_export/        # Dati Instagram (non committare)
```

## Come Funziona

### Parsing
Il parser legge `saved_collections.json` e per ogni collezione estrae:
- **Caption**: testo del post
- **Hashtags**: estratti da caption e dal campo dedicato
- **Autori**: username del creatore del post
- **URL**: link al post Instagram
- **Timestamp**: data di salvataggio

### Ricerca
- **BM25 ranking** su caption + hashtags + contenuti URL
- Filtro opzionale per collezione
- Scoring basato su term frequency e document length

### Message Integration
I messaggi DM sono parsati da `messages/inbox/` e collegati ai post tramite l'autore:
- 1528 messaggi da 84 conversazioni
- 3 autori con overlap post-messaggi: piratinviaggio, create_daniel2, psychicum
- I messaggi con link reali (promozioni, risorse) sono inclusi nel contesto RAG

### LLM
MiniMax API (o qualsiasi API OpenAI-compatibile) per generare risposte basate sul contesto estratto.

## Statistiche

- 722 post salvati in 18 collezioni
- 181 autori unici
- 257 post nella collezione "IT Tricks"
- 1528 messaggi da 84 conversazioni

## Note

- Il database SQLite è in `data/instagram_rag.db`
- I messaggi contengono spesso risposte automatiche a commenti ("Hai inviato una risposta privata...")
- Gli URL Instagram (post/reel) non sono scaricabili senza auth, ma gli URL esterni (GitHub, YouTube, ecc.) sì
- `.gitignore` include `data/*.db`, `ig_export/`, e `*.session.json`
