import sys
import json
import os
import io

# KRİTİK: TensorFlow ve rembg bilgi mesajlarını kapat.
# Aksi takdirde C++ logları stdout'a girer ve Node.js JSON'ı parse edemez!
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['REMBG_LOG_LEVEL'] = 'ERROR'

try:
    import tensorflow as tf
except ImportError:
    try:
        import tflite_runtime.interpreter as tflite
        tf = tflite
    except ImportError:
        print(json.dumps({"basarili": False, "hata": "TensorFlow veya tflite_runtime kurulu degil."}))
        sys.exit(1)

from PIL import Image
import numpy as np

# rembg arka plan temizleme (opsiyonel - kurulu değilse atlanır)
try:
    from rembg import remove as rembg_remove
    REMBG_AVAILABLE = True
except ImportError:
    REMBG_AVAILABLE = False


def remove_background(img):
    """
    rembg ile arka planı kaldırıp siyah (0,0,0) ile doldurur.
    Çiftçi tarlada çektiğinde karmaşık arka plan modeli şaşırmasın diye kullanılır.
    """
    if not REMBG_AVAILABLE:
        return img  # rembg yoksa orijinal döndür

    # PIL → bytes → rembg → PIL
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes = img_bytes.getvalue()

    # Arka planı kaldır (RGBA döner, arka plan şeffaf olur)
    result_bytes = rembg_remove(img_bytes)
    result_img = Image.open(io.BytesIO(result_bytes)).convert('RGBA')

    # Kenarlara yapışmaması için PADDING (Pay) Ekleme Mantığı:
    # 1. Yaprağın olduğu dolu piksellerin sınırlarını (bounding box) bul
    bbox = result_img.getbbox()
    if bbox:
        # Yaprağı kendi sınırlarına göre kırp
        leaf = result_img.crop(bbox)
        leaf_w, leaf_h = leaf.size
        
        # 2. Yeni bir kare alan oluştur (Yaprağın en uzun kenarından %15 daha büyük)
        # Bu sayede kenarlarda boşluk kalacak
        max_dim = max(leaf_w, leaf_h)
        new_size = int(max_dim * 1.20) # %20 pay bırak
        
        # GRİ ARKA PLAN (180, 180, 180) - Stüdyo gri fonlarına yakın
        final_img = Image.new('RGBA', (new_size, new_size), (180, 180, 180, 255))
        
        # Yaprağı merkeze yapıştır
        offset = ((new_size - leaf_w) // 2, (new_size - leaf_h) // 2)
        final_img.paste(leaf, offset, leaf)
        return final_img.convert('RGB')

    # Eğer bbox bulunamazsa (hata veya boş resim) varsayılan gri fon
    grey_bg = Image.new('RGBA', result_img.size, (180, 180, 180, 255))
    composite = Image.alpha_composite(grey_bg, result_img)
    return composite.convert('RGB')


def predict():
    try:
        # Args
        if len(sys.argv) < 3:
            print(json.dumps({"basarili": False, "hata": "Eksik argumanlar"}))
            return

        model_path = sys.argv[1]
        image_path = sys.argv[2]
        labels_path = sys.argv[3] if len(sys.argv) > 3 else None

        # Etiketleri oku
        labels = []
        if labels_path and os.path.exists(labels_path):
            with open(labels_path, 'r', encoding='utf-8') as f:
                labels = [line.strip() for line in f if line.strip()]

        # Modeli yukle
        if hasattr(tf, 'lite') and hasattr(tf.lite, 'Interpreter'):
            interpreter = tf.lite.Interpreter(model_path=model_path)
        else:
            interpreter = tf.Interpreter(model_path=model_path)

        interpreter.allocate_tensors()
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()

        # Goruntuyu hazirla
        img = Image.open(image_path).convert('RGB')

        # Domain Shift Çözümü: Arka planı GRİ yap ve Merkeze Al (Padding ile)
        img = remove_background(img)

        img = img.resize((224, 224), Image.LANCZOS)
        
        # Görüntüyü hafifçe keskinleştir (Blur etkisini kırmak için)
        from PIL import ImageEnhance
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(1.5) # 1.5 kat keskinlik artışı
        
        # DEBUG: Modelin tam olarak ne gördüğünü kaydet
        debug_path = os.path.join(os.path.dirname(image_path), "debug_model_input.jpg")
        img.save(debug_path)

        input_data = np.array(img, dtype=np.float32)
        input_data = np.expand_dims(input_data, axis=0)  # [1, 224, 224, 3]

        # Modele ver
        interpreter.set_tensor(input_details[0]['index'], input_data)
        interpreter.invoke()

        # Çıktıyı al
        output_data = interpreter.get_tensor(output_details[0]['index'])[0]

        # Top 5 sonucu sırala
        top_k = output_data.argsort()[-5:][::-1]

        results = []
        for i in top_k:
            oran = float(output_data[i])
            etiket = labels[i] if i < len(labels) else f"Class_{i}"
            results.append({
                "index": int(i),
                "etiket": etiket,
                "oran": oran
            })

        # DEBUG: Base64 formatında resmi döndür (Uygulama tarafında görmek için)
        import base64
        with open(debug_path, "rb") as debug_file:
            debug_base64 = base64.b64encode(debug_file.read()).decode('utf-8')

        print(json.dumps({
            "basarili": True,
            "sonuclar": results,
            "debug_image": debug_base64
        }))

    except Exception as e:
        print(json.dumps({
            "basarili": False,
            "hata": str(e)
        }))

if __name__ == "__main__":
    predict()
