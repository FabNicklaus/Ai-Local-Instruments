import argparse
import sys
from faster_whisper import WhisperModel

def transcribe_audio(file_path, model_size="large-v3"):
    try:
        print(f"--- Caricamento modello {model_size} su GPU... ---")
        model = WhisperModel(model_size, device="cuda", compute_type="float16")
        
        print(f"--- Inizio trascrizione: {file_path} ---")
        segments, info = model.transcribe(file_path, beam_size=5)

        print(f"Lingua rilevata: '{info.language}' (probabilità: {info.language_probability:.2f})")

        for segment in segments:
            print(f"[{segment.start:.2f}s -> {segment.end:.2f}s] {segment.text}")
            
    except Exception as e:
        print(f"Errore durante la trascrizione: {e}")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Trascrizione audio/video ultra-veloce con Whisper su GPU")
    parser.add_argument("file", help="Percorso del file audio o video da trascrivere")
    parser.add_argument("--model", default="large-v3", help="Dimensione modello (default: large-v3)")
    
    args = parser.parse_args()
    transcribe_audio(args.file, args.model)

