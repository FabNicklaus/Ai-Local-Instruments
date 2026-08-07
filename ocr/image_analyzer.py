import argparse
import json
from PIL import Image
import torch
from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor

def analyze_image(image_path, model_id="Qwen/Qwen2.5-VL-7B-Instruct"):
    print(f"Caricamento del modello {model_id}...")
    processor = AutoProcessor.from_pretrained(model_id)
    model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        model_id,
        torch_dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float32,
        device_map="auto"
    )

    # Leggiamo le dimensioni per il JSON
    image = Image.open(image_path)
    width, height = image.size
    resolution = f"{width}x{height}"

    prompt = f"""Analizza questa immagine e rispondi rigorosamente in formato JSON con i seguenti campi:
    {{
      "risoluzione": "{resolution}",
      "colore_o_bn": "Colore oppure Bianco e Nero",
      "tipo_immagine": "foto, disegno oppure cartoon",
      "ambiente": "interni oppure esterni",
      "luminosità": "chiara oppure scura",
      "presenza_persone": "descrivi se ci sono persone e quante (es. 'Sì, 2 persone' o 'Nessuna persona')",
      "sensazioni": "le sensazioni o emozioni che trasmette",
      "descrizione_breve": "una breve descrizione sintetica del contenuto"
    }}"""

    # Passiamo direttamente l'oggetto PIL Image o il percorso stringa supportato
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image", "image": image},
                {"type": "text", "text": prompt}
            ]
        }
    ]

    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    
    # Processiamo correttamente immagine e testo
    inputs = processor(
        text=[text],
        images=[image],
        padding=True,
        return_tensors="pt"
    ).to(model.device)

    print("Analisi dell'immagine in corso...")
    with torch.no_grad():
        generated_ids = model.generate(**inputs, max_new_tokens=512)

    generated_ids_trimmed = [
        out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
    ]
    output_text = processor.batch_decode(
        generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
    )[0]

    return output_text

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analizzatore di immagini con Qwen2.5-VL")
    parser.add_argument("image_path", type=str, help="Percorso dell'immagine da analizzare")
    args = parser.parse_args()

    result = analyze_image(args.image_path)
    print("\nRisultato dell'analisi:")
    print(result)

