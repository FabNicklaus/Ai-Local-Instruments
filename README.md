# AI Automation Local Toolkit

Toolkit locale per l'elaborazione multimodale con intelligenza artificiale.

## Panoramica Progetti

Questo repository contiene il toolkit Python per l'elaborazione multimodale. Altri progetti correlati:

| Progetto | Descrizione | Path |
|----------|-------------|------|
| **Ai-Local-Instruments** | OCR, Image Analysis, Whisper | `/home/mfm/Ai-Local-Instruments/` |
| **PwrReader** | PDF Reader con LLM | `/home/mfm/ClaudePrj/PwrReader/` |
| **PwrSearch/bilf** | Business Intelligence Lead Finder | `/home/mfm/ClaudePrj/PwrSearch/bilf/` |
| **Thunderbird-RAG** | RAG per email Thunderbird | `/mnt/c/Users/mfm/thunderbird-rag/` |
| **Instagram-RAG** | RAG per post Instagram salvati | `/mnt/c/Users/mfm/instagram-rag/` |

---

## Ai-Local-Instruments

Toolkit Python per elaborazione multimodale con GPU.

### Struttura

- `ocr/`: OCR e Analisi Immagini (Qwen2.5-VL)
- `whisper/`: Trascrizione audio (OpenAI Whisper)

### Prerequisiti di Sistema

```bash
# OCR e PDF
sudo apt update && sudo apt install -y poppler-utils

# Whisper e audio
sudo apt update && sudo apt install -y ffmpeg
```

### Setup Ambienti Virtuali

```bash
# Ambiente OCR e Analisi Immagini
python3 -m venv venv_ocr
source venv_ocr/bin/activate
pip install -r ocr/requirements.txt

# Ambiente Whisper
python3 -m venv venv_whisper
source venv_whisper/bin/activate
pip install -r whisper/requirements.txt
```

### Utilizzo

**OCR (da PDF o immagini):**
```bash
source venv_ocr/bin/activate
python ocr/ocr_tool.py /percorso/al/documento.pdf
python ocr/ocr_tool.py /percorso/immagine.jpg
```

**Analisi Immagini:**
```bash
source venv_ocr/bin/activate
python ocr/image_analyzer.py /percorso/immagine.jpg
```

**Trascrizione Audio/Video:**
```bash
source venv_whisper/bin/activate
python whisper/whisper_tool.py /percorso/audio.mp3
python whisper/whisper_tool.py /percorso/video.mp4
```

### Modelli

- **OCR/Image Analysis:** Qwen2.5-VL-7B-Instruct (4-bit quantizzato su GPU)
- **Whisper:** Faster Whisper large-v3 (GPU CUDA)

### Ollama (modelli locali opzionali)

```bash
# Verifica servizio
systemctl status ollama
# oppure
ollama serve

# Pull modelli
ollama pull qwen2.5:7b-instruct
ollama pull llama3.1:8b
```

---

## PwrReader

PDF Reader con integrazione LLM per estrazione entità.

**Path:** `/home/mfm/ClaudePrj/PwrReader/`

### Setup

```bash
cd /home/mfm/ClaudePrj/PwrReader
export PATH="$HOME/.local/share/node-v20.11.0-linux-x64/bin:$PATH"
npm install
npm run build
```

### Avvio

```bash
npm run dev
```

Apri: **http://localhost:3000**

### Configurazione (.env)

```env
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=google/gemini-2.5-pro
SERPAPI_KEY=your_serpapi_key_here
```

### Funzionalità

- Apertura e visualizzazione PDF
- Navigazione pagine e indice contenuti
- Ricerca testuale (case-sensitive, whole-word, regex)
- Modalità scura e impostazioni di lettura
- Estrazione entità con LLM (Nomi, Oggetti, Località)
- Evidenziazione visiva per tipo entità
- Ricerca web SerpAPI

---

## PwrSearch/bilf

Business Intelligence Lead Finder - Cerca aziende italiane per provincia e categoria.

**Path:** `/home/mfm/ClaudePrj/PwrSearch/bilf/`

### Setup

```bash
cd /home/mfm/ClaudePrj/PwrSearch/bilf
npm install
```

### Configurazione (.env.local)

```env
SERPAPI_API_KEY=your_api_key_here
```

### Avvio

```bash
npm run dev
```

App: **http://localhost:3000**

### Funzionalità

- Ricerca per 107 province italiane + categoria
- Paginazione (10 risultati per pagina)
- Campi: nome, telefono, email, PEC, sito, social, P.IVA, fatturato, dipendenti
- Deduplicazione per P.IVA o nome+indirizzo
- Storico ricerche
- Esportazione CSV
- Lookup INI-PEC

---

## Thunderbird-RAG

Sistema RAG locale per indicizzare e interrogare le email Thunderbird.

**Path:** `/mnt/c/Users/mfm/thunderbird-rag/`

**GitHub:** https://github.com/FabNicklaus/Thunderbird-RAG

### Setup

```bash
cd /mnt/c/Users/mfm/thunderbird-rag
npm install
```

### Configurazione (.env)

```env
MINIMAX_API_KEY=your_key_here
MINIMAX_API_BASE=https://api.minimax.io/v1
```

### Utilizzo

```bash
# 1. Indicizza le email
node bin/parse.js "/percorso/folder" "/percorso/baseMailDir"

# 2. Scarica contenuti URL
node bin/fetch-urls.js --all --limit 50

# 3. Fai domande
node bin/qa.js "cosa ho salvato su Python ultimamente?" --context 5
```

### Struttura

```
thunderbird-rag/
├── bin/
│   ├── parse.js      # Indicizza email
│   ├── fetch-urls.js # Scarica URL
│   ├── qa.js         # Fai domande
│   └── search.js     # Debug BM25
├── lib/
│   ├── db.js         # SQLite + BM25
│   ├── parser.js     # Parser .eml
│   └── fetchUrl.js   # Fetch URL
└── data/
    └── *.db          # SQLite databases
```

### Come Funziona

- **Parsing:** Legge `.mozmsgs` Thunderbird, estrae subject/from/date/body/URLs
- **Storage:** SQLite full-text (nessun vettoriale esterno)
- **Search:** BM25 ranking
- **LLM:** Qualsiasi API OpenAI-compatibile

Indicizzazione incrementale: salta i file non modificati.

---

## Instagram-RAG

Sistema RAG per i post salvati su Instagram usando data export ufficiale.

**Path:** `/mnt/c/Users/mfm/instagram-rag/`

### Setup

```bash
cd /mnt/c/Users/mfm/instagram-rag
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
3. Estrai lo ZIP in `ig_export/extracted/`

### Utilizzo

```bash
# Parsa le collezioni salvate
node bin/parse-instagram-data.js --file ig_export/extracted/your_instagram_activity/saved/saved_collections.json

# Cerca nei post
node bin/search.js "python"
node bin/search.js "python" -c "IT Tricks"

# Fai domande (RAG arricchito con autori e messaggi)
node bin/qa.js "cosa ho salvato su Python?"

# Scarica contenuti URL
node bin/fetch-urls.js --all --limit 50
```

### Struttura

```
instagram-rag/
├── bin/
│   ├── parse-instagram-data.js  # Parser export Instagram
│   ├── fetch-urls.js            # Scarica URL
│   ├── qa.js                    # RAG Q&A
│   └── search.js                # Ricerca BM25
├── lib/
│   ├── db.js         # SQLite + BM25
│   ├── fetchUrl.js   # Fetch URL
│   └── messages.js   # Parser messaggi DM
└── data/
    └── instagram_rag.db
```

### Come Funziona

- **Parsing:** Legge `saved_collections.json` dall'export Instagram
- **Estrazione:** Caption, hashtags, URL, autori, timestamp da 722 post in 18 collezioni
- **Message Integration:** Collega messaggi DM ai post tramite autore (1528 messaggi da 84 conversazioni)
- **Search:** BM25 ranking su caption + hashtags + contenuti URL
- **LLM:** MiniMax o API OpenAI-compatibile

### Statistiche

- 722 post salvati in 18 collezioni
- 181 autori unici
- 257 post nella collezione "IT Tricks"
- 1528 messaggi da 84 conversazioni

---

## Comandi Rapidi

```bash
# Attivazione venv
source /home/mfm/venv_ocr/bin/activate      # OCR/Image
source /home/mfm/venv_whisper/bin/activate  # Whisper
```

---

## Sincronizzazione GitHub

| Progetto | GitHub |
|----------|--------|
| Ai-Local-Instruments | https://github.com/FabNicklaus/Ai-Local-Instruments |
| Thunderbird-RAG | https://github.com/FabNicklaus/Thunderbird-RAG |
| Instagram-RAG | https://github.com/FabNicklaus/Ai-Local-Instruments |
| PwrReader | Locale |
| PwrSearch/bilf | Locale |

---

*Per aggiungere nuovi progetti, aggiornare questo README e la tabella panoramica.*
