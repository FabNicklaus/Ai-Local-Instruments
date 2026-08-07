# AI Automation Local Toolkit

Toolkit locale basato su intelligenza artificiale per l'elaborazione multimodale (Vision-OCR, Image-Analysis  e Speech-to-Text) progettato per integrarsi nei flussi di automazione.


## Struttura del Repository

- `ocr/`: Modulo OCR e Analisi Immagini avanzato basato su **Qwen2.5-VL** e accelerato tramite GPU.
- `whisper/`: Modulo di trascrizione audio basato su **OpenAI Whisper**.

## Prerequisiti e Setup

Gli strumenti utilizzano ambienti virtuali (`venv`) separati per evitare conflitti di dipendenze tra i framework di visione e audio.

### 1. Setup OCR e Analisi Immagini (`venv_ocr`)
Requisiti di sistema: `poppler-utils` (per la gestione dei PDF).
```bash
sudo apt update && sudo apt install -y poppler-utils

# Attivazione e installazione dipendenze
python3 -m venv venv_ocr
source venv_ocr/bin/activate
pip install -r ocr/requirements.txt

### 2. Setup Whisper ('venv_whisper')
Requisiti di sistema: 'ffmpeg' (consigliato per la gestione dei flussi audio/video).
```bash
sudo apt update && sudo apt install -y ffmpeg

# Attivazione e installazione dipendenze
python3 -m venv venv_whisper
source venv_whisper/bin/activate
pip install -r whisper/requirements.txt

### 3. Utilizzo di OCR
source venv_ocr/bin/activate
python ocr/ocr_tool.py /percorso/al/tuo/documento-o-immagine.jpg (o .pdf)

### 4. Utilizzo di Image Analyzer
source venv_ocr/bin/activate
python ocr/image_analyzer.py /percorso/alla/tua/immagine.jpg

### 5. Utilizzo di Whisper
source venv_whisper/bin/activate
python whisper/image_analyzer.py /percorso/alla/tua/immagine.jpg

### 6. Gestione Modelli e Ollama
Per i servizi che sfruttano motori locali leggeri o runner dedicati tramite Ollama:

1. **Verifica il servizio Ollama**:
   Assicurati che il demone sia attivo sulla macchina locale.
   ```bash
   systemctl status ollama
   # oppure avvio manuale
   ollama serve

2. Pull dei modelli supportati:
   Scarica i modelli necessari per i task di inferenza testuale o supporto agli script:
   ```bash
   ollama pull qwen2.5:7b-instruct
   ollama pull llama3.1:8b

