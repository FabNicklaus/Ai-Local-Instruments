# AI Automation Local Toolkit

Toolkit locale basato su intelligenza artificiale per l'elaborazione multimodale (Vision OCR e Speech-to-Text) progettato per integrarsi nei flussi di automazione.

## Struttura del Repository

- `ocr/`: Modulo OCR avanzato basato su **Qwen2.5-VL** e accelerato tramite GPU.
- `whisper/`: Modulo di trascrizione audio basato su **OpenAI Whisper**.

## Prerequisiti e Setup

Gli strumenti utilizzano ambienti virtuali (`venv`) separati per evitare conflitti di dipendenze tra i framework di visione e audio.

### 1. Setup OCR (`venv_ocr`)
Requisiti di sistema: `poppler-utils` (per la gestione dei PDF).
```bash
sudo apt update && sudo apt install -y poppler-utils

# Attivazione e installazione dipendenze
python -m venv venv_ocr
source venv_ocr/bin/activate
pip install -r ocr/requirements.txt

