import argparse
import sys
import os
from PIL import Image
import torch
from transformers import AutoProcessor, Qwen2_5_VLForConditionalGeneration, BitsAndBytesConfig
from pdf2image import convert_from_path

# Limita i thread CPU per evitare conflitti di blocco in WSL
torch.set_num_threads(4)
os.environ["OMP_NUM_THREADS"] = "4"

def process_file(file_path):
    if file_path.lower().endswith('.pdf'):
        print(f"--- Rilevato PDF: conversione pagina 1 in immagine... ---")
        images = convert_from_path(file_path, first_page=1, last_page=1)
        return images[0]
    else:
        return Image.open(file_path)

def run_ocr(file_path, prompt="Estrai tutto il testo presente in questo documento in lingua italiana, correggendo eventuali piccoli errori di battitura della scansione."):
    try:
        model_id = "Qwen/Qwen2.5-VL-7B-Instruct"
        print(f"--- Caricamento modello {model_id} in 4-bit su GPU ---")
        
        # Configurazione quantizzazione a 4-bit
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=torch.float16
        )
        
        processor = AutoProcessor.from_pretrained(model_id)
        model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
            model_id,
            quantization_config=quantization_config,
            device_map="auto"
        )
        
        image = process_file(file_path)
        
        messages = [
            {"role": "user", "content": [
                {"type": "image", "image": image},
                {"type": "text", "text": prompt},
            ]}
        ]
        
        text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = processor(text=[text], images=[image], padding=True, return_tensors="pt").to("cuda")
        
        print("--- Elaborazione in corso (4-bit)... ---")
        generated_ids = model.generate(**inputs, max_new_tokens=1024)
        generated_ids_trimmed = [
            out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
        ]
        output_text = processor.batch_decode(
            generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
        )
        
        print("\nRisultato:")
        print(output_text[0])
        
    except Exception as e:
        print(f"Errore durante l'elaborazione: {e}")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OCR avanzato per Immagini e PDF (4-bit)")
    parser.add_argument("file", help="Percorso del file (JPG, PNG, PDF)")
    parser.add_argument("--prompt", default="Estrai tutto il testo presente in questo documento in lingua italiana, correggendo eventuali piccoli errori di battitura della scansione.", help="Istruzione personalizzata")
    
    args = parser.parse_args()
    run_ocr(args.file, args.prompt)

