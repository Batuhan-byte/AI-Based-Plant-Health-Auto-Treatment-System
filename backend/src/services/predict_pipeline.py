"""
3 Katmanlı AI Pipeline - Bitki Analiz Sistemi
==============================================
Katman 1: YOLO ile yaprak tespiti (bounding box → crop)
Katman 2: MobileNet (Keras) ile bitki türü sınıflandırma
Katman 3: Bitki türüne özel hastalık tespiti (Keras)

Kullanım:
    python predict_pipeline.py <yolo_model> <plant_model> <class_names> <image_path> <disease_models_dir>
"""

import sys
import json
import os

# Kritik: Tüm bilgi mesajlarını kapat (stdout'u kirletmesin)
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['YOLO_VERBOSE'] = 'False'
os.environ['TF_USE_LEGACY_KERAS'] = '1'

import numpy as np
from PIL import Image

# ─── YOLO Import ───────────────────────────────────────────
try:
    from ultralytics import YOLO
except ImportError:
    print(json.dumps({
        "basarili": False,
        "hata": "ultralytics paketi kurulu değil. Kurulum: pip install ultralytics"
    }))
    sys.exit(1)

# ─── Keras Import ─────────────────────────────────────────
try:
    import tf_keras as keras
except ImportError:
    try:
        import tensorflow.keras as keras
    except ImportError:
        print(json.dumps({
            "basarili": False,
            "hata": "Keras kurulu değil."
        }))
        sys.exit(1)

# ─── Türkçe Bitki İsimleri ─────────────────────────────────
BITKI_TR = {
    'apple': 'Elma',
    'cherry': 'Kiraz',
    'corn': 'Mısır',
    'grape': 'Üzüm',
    'peach': 'Şeftali',
    'pepper_bell': 'Biber',
    'potato': 'Patates',
    'squash': 'Kabak',
    'strawberry': 'Çilek',
    'tea': 'Çay',
    'tomato': 'Domates',
}

# ─── Türkçe Hastalık İsimleri ──────────────────────────────
HASTALIK_TR = {
    'Healthy': 'Sağlıklı',
    'Apple Scab': 'Elma Karalekesi',
    'Black Rot': 'Siyah Çürüklük',
    'Cedar Apple Rust': 'Sedir-Elma Pası',
    'Powdery Mildew': 'Külleme',
    'Cercospora Leaf Spot': 'Cercospora Yaprak Lekesi',
    'Common Rust': 'Pas Hastalığı',
    'Northern Leaf Blight': 'Kuzey Yaprak Yanıklığı',
    'Esca (Black Measles)': 'Esca (Siyah Kızamık)',
    'Leaf Blight': 'Yaprak Yanıklığı',
    'Bacterial Spot': 'Bakteriyel Leke',
    'Early Blight': 'Erken Yanıklık',
    'Late Blight': 'Geç Yanıklık',
    'Septoria Leaf Spot': 'Septoria Yaprak Lekesi',
    'Yellow Leaf Curl Virus': 'Sarı Yaprak Kıvırma Virüsü',
}

# ─── Desteklenen hastalık modeli olan bitkiler ─────────────
DESTEKLENEN_BITKILER = ['apple', 'cherry', 'corn', 'grape', 'potato', 'tomato']


def katman1_yaprak_tespit(yolo_model_path, image_path):
    """
    Katman 1: YOLO ile yaprak tespiti
    - conf=0.55 threshold
    - Küçük kutuları filtrele (w veya h < 80px)
    - En yüksek confidence'lı kutuyu seç
    - %15 padding ekleyerek crop çıkar
    """
    try:
        model = YOLO(yolo_model_path)
        img = Image.open(image_path).convert('RGB')
        img_w, img_h = img.size

        # YOLO inference
        results = model.predict(
            source=image_path,
            conf=0.55,
            verbose=False
        )

        if not results or len(results) == 0:
            return None, "YOLO sonuç döndürmedi."

        boxes = results[0].boxes
        if boxes is None or len(boxes) == 0:
            return None, "Fotoğrafta yaprak tespit edilemedi. Lütfen yaprağı daha net çekin."

        # Kutulardan uygun olanları filtrele
        valid_boxes = []
        for box in boxes:
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            w = x2 - x1
            h = y2 - y1
            conf = float(box.conf[0].cpu().numpy())

            # Çok küçük kutuları filtrele
            if w < 80 or h < 80:
                continue

            valid_boxes.append({
                'x1': float(x1), 'y1': float(y1),
                'x2': float(x2), 'y2': float(y2),
                'w': float(w), 'h': float(h),
                'conf': conf
            })

        if not valid_boxes:
            return None, "Yeterli büyüklükte yaprak tespit edilemedi. Lütfen bitkiye biraz daha yaklaşın."

        # En yüksek confidence'lı kutuyu seç
        best_box = max(valid_boxes, key=lambda b: b['conf'])

        # %15 padding ekle
        pad_x = best_box['w'] * 0.15
        pad_y = best_box['h'] * 0.15

        crop_x1 = max(0, best_box['x1'] - pad_x)
        crop_y1 = max(0, best_box['y1'] - pad_y)
        crop_x2 = min(img_w, best_box['x2'] + pad_x)
        crop_y2 = min(img_h, best_box['y2'] + pad_y)

        # Crop çıkar
        cropped = img.crop((int(crop_x1), int(crop_y1), int(crop_x2), int(crop_y2)))

        return {
            'crop': cropped,
            'confidence': best_box['conf'],
            'bbox': [int(crop_x1), int(crop_y1), int(crop_x2), int(crop_y2)],
            'toplam_tespit': len(valid_boxes)
        }, None

    except Exception as e:
        return None, f"YOLO yaprak tespiti hatası: {str(e)}"


def katman2_bitki_siniflandirma(plant_model_path, class_names_path, cropped_image):
    """
    Katman 2: MobileNet (Keras) ile bitki türü sınıflandırma
    - 224x224 RGB float32 görüntü
    - class_names.txt'den sınıf ismi okunur
    """
    try:
        # Sınıf isimlerini oku
        with open(class_names_path, 'r', encoding='utf-8') as f:
            class_names = [line.strip() for line in f if line.strip()]

        # Keras modeli yükle
        model = keras.models.load_model(plant_model_path)

        # Debug: Crop'u diske kaydet
        debug_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        debug_path = os.path.join(debug_dir, "yolotest_fotosu.jpg")
        cropped_image.save(debug_path)

        # Görüntüyü 224x224'e resize et
        img_resized = cropped_image.resize((224, 224), Image.LANCZOS)

        # RGB dönüşümü kontrolü
        if img_resized.mode != 'RGB':
            img_resized = img_resized.convert('RGB')

        # Görüntüyü array'e çevir
        input_data = np.array(img_resized, dtype=np.float32)
        input_data = np.expand_dims(input_data, axis=0)  # [1, 224, 224, 3]

        # MobileNetV3 preprocess_input uygula
        input_data = keras.applications.mobilenet_v3.preprocess_input(input_data)

        # Inference
        predictions = model.predict(input_data, verbose=0)
        output_data = predictions[0]

        # En yüksek olasılıklı sınıfı bul
        best_idx = int(np.argmax(output_data))
        best_conf = float(output_data[best_idx])

        # Sınıf ismini al
        if best_idx < len(class_names):
            class_name = class_names[best_idx]
        else:
            class_name = f"bilinmeyen_{best_idx}"

        # Türkçe isim
        tur_tr = BITKI_TR.get(class_name, class_name.capitalize())

        # Top 3 sonuç
        top3_indices = np.argsort(output_data)[::-1][:3]
        top3 = []
        for idx in top3_indices:
            idx = int(idx)
            name = class_names[idx] if idx < len(class_names) else f"bilinmeyen_{idx}"
            top3.append({
                'tur': name,
                'tur_tr': BITKI_TR.get(name, name.capitalize()),
                'confidence': float(output_data[idx])
            })

        return {
            'tur': class_name,
            'tur_tr': tur_tr,
            'confidence': best_conf,
            'sinif_index': best_idx,
            'top3': top3
        }, None

    except Exception as e:
        return None, f"Bitki sınıflandırma hatası: {str(e)}"


def katman3_hastalik_tespit(disease_models_dir, bitki_turu, cropped_image):
    """
    Katman 3: Bitki türüne özel hastalık tespiti (Keras)
    
    Kurallar:
    1. Görüntü mutlaka RGB olacak.
    2. Input boyutu 224x224 olacak.
    3. include_preprocessing=True kullanıldığı için ekstra preprocess yok.
       Sadece RGB + 224x224 + float32 görüntü verilir.
    4. Her model kendi class txt dosyasıyla eşleşir.
    5. Confidence < 0.70 ise düşük güven uyarısı verilir.
    6. Output array komple loglanır.
    """
    try:
        # Bu bitki türü için hastalık modeli var mı?
        if bitki_turu not in DESTEKLENEN_BITKILER:
            return {
                'durum': 'model_yok',
                'hastalik': None,
                'hastalik_tr': None,
                'saglikli': None,
                'confidence': None,
                'mesaj': f"'{bitki_turu}' için henüz hastalık modeli bulunmuyor."
            }

        # Model ve class dosyası yolları
        model_path = os.path.join(disease_models_dir, f"{bitki_turu}_disease_model.keras")
        class_path = os.path.join(disease_models_dir, f"{bitki_turu}_disease_classes.txt")

        # Dosya kontrolleri
        if not os.path.exists(model_path):
            return {
                'durum': 'model_yok',
                'hastalik': None,
                'hastalik_tr': None,
                'saglikli': None,
                'confidence': None,
                'mesaj': f"Hastalık modeli bulunamadı: {model_path}"
            }

        if not os.path.exists(class_path):
            return {
                'durum': 'model_yok',
                'hastalik': None,
                'hastalik_tr': None,
                'saglikli': None,
                'confidence': None,
                'mesaj': f"Hastalık sınıf dosyası bulunamadı: {class_path}"
            }

        # Sınıf isimlerini oku
        with open(class_path, 'r', encoding='utf-8') as f:
            disease_classes = [line.strip() for line in f if line.strip()]

        # Keras hastalık modelini yükle
        model = keras.models.load_model(model_path)

        # 1. RGB dönüşümü
        if cropped_image.mode != 'RGB':
            cropped_image = cropped_image.convert('RGB')

        # 2. 224x224 resize
        img_resized = cropped_image.resize((224, 224), Image.LANCZOS)

        # 3. Float32 array (include_preprocessing=True olduğu için ekstra preprocess YOK)
        input_data = np.array(img_resized, dtype=np.float32)
        input_data = np.expand_dims(input_data, axis=0)  # [1, 224, 224, 3]

        # Inference
        predictions = model.predict(input_data, verbose=0)
        output_data = predictions[0]

        # 6. Output array'i komple logla (stderr'e yazılır, stdout'u kirletmez)
        import sys as _sys
        _sys.stderr.write(f"[Katman3 Debug] {bitki_turu} raw_predictions: {output_data.tolist()}\n")
        _sys.stderr.write(f"[Katman3 Debug] {bitki_turu} disease_classes: {disease_classes}\n")

        # En yüksek olasılıklı sınıfı bul
        best_idx = int(np.argmax(output_data))
        best_conf = float(output_data[best_idx])

        # Sınıf ismini al
        if best_idx < len(disease_classes):
            disease_name = disease_classes[best_idx]
        else:
            disease_name = f"bilinmeyen_{best_idx}"

        # Sağlıklı mı?
        saglikli = disease_name.lower() == 'healthy'

        # Türkçe hastalık ismi
        hastalik_tr = HASTALIK_TR.get(disease_name, disease_name)

        # 7. Confidence < 0.70 kontrolü
        dusuk_confidence = best_conf < 0.70

        # Top 3 hastalık sonucu
        top3_indices = np.argsort(output_data)[::-1][:3]
        top3 = []
        for idx in top3_indices:
            idx = int(idx)
            name = disease_classes[idx] if idx < len(disease_classes) else f"bilinmeyen_{idx}"
            top3.append({
                'hastalik': name,
                'hastalik_tr': HASTALIK_TR.get(name, name),
                'confidence': float(output_data[idx])
            })

        return {
            'durum': 'tespit_edildi',
            'hastalik': disease_name,
            'hastalik_tr': hastalik_tr,
            'saglikli': saglikli,
            'confidence': best_conf,
            'sinif_index': best_idx,
            'dusuk_confidence': dusuk_confidence,
            'top3': top3,
            'tum_sonuclar': {disease_classes[i]: float(output_data[i]) for i in range(len(disease_classes))}
        }

    except Exception as e:
        return {
            'durum': 'hata',
            'hastalik': None,
            'hastalik_tr': None,
            'saglikli': None,
            'confidence': None,
            'mesaj': f"Hastalık tespiti hatası: {str(e)}"
        }


def run_pipeline():
    """Ana pipeline fonksiyonu - 3 katmanı sırayla çalıştırır"""
    try:
        # Argümanları kontrol et
        if len(sys.argv) < 6:
            print(json.dumps({
                "basarili": False,
                "hata": "Eksik argümanlar. Kullanım: python predict_pipeline.py <yolo_model> <plant_model> <class_names> <image_path> <disease_models_dir>"
            }))
            return

        yolo_model_path = sys.argv[1]
        plant_model_path = sys.argv[2]
        class_names_path = sys.argv[3]
        image_path = sys.argv[4]
        disease_models_dir = sys.argv[5]

        # Dosya kontrolleri
        for fpath, fname in [
            (yolo_model_path, "YOLO model"),
            (plant_model_path, "Bitki sınıflandırma modeli"),
            (class_names_path, "Sınıf isimleri"),
            (image_path, "Görüntü")
        ]:
            if not os.path.exists(fpath):
                print(json.dumps({
                    "basarili": False,
                    "hata": f"{fname} dosyası bulunamadı: {fpath}"
                }))
                return

        if not os.path.isdir(disease_models_dir):
            print(json.dumps({
                "basarili": False,
                "hata": f"Hastalık modelleri klasörü bulunamadı: {disease_models_dir}"
            }))
            return

        # ═══ KATMAN 1: YOLO Yaprak Tespiti ═══
        katman1_sonuc, katman1_hata = katman1_yaprak_tespit(yolo_model_path, image_path)

        if katman1_hata:
            print(json.dumps({
                "basarili": False,
                "hata": katman1_hata,
                "katman": 1
            }))
            return

        # ═══ KATMAN 2: Bitki Türü Sınıflandırma ═══
        katman2_sonuc, katman2_hata = katman2_bitki_siniflandirma(
            plant_model_path,
            class_names_path,
            katman1_sonuc['crop']
        )

        if katman2_hata:
            print(json.dumps({
                "basarili": False,
                "hata": katman2_hata,
                "katman": 2
            }))
            return

        # Confidence kontrolü
        if katman2_sonuc['confidence'] < 0.50:
            print(json.dumps({
                "basarili": False,
                "hata": "Bitki türü yeterince güvenilir tespit edilemedi. Lütfen yaprağı daha net ve yakından çekin.",
                "katman": 2,
                "dusuk_confidence": True,
                "confidence": katman2_sonuc['confidence']
            }))
            return

        # ═══ KATMAN 3: Hastalık Tespiti ═══
        bitki_turu = katman2_sonuc['tur']  # örn: 'apple', 'tomato'
        katman3_sonuc = katman3_hastalik_tespit(
            disease_models_dir,
            bitki_turu,
            katman1_sonuc['crop']
        )

        # Sonucu JSON olarak döndür
        print(json.dumps({
            "basarili": True,
            "katman1_yaprak": {
                "tespit_edildi": True,
                "confidence": katman1_sonuc['confidence'],
                "bbox": katman1_sonuc['bbox'],
                "toplam_tespit": katman1_sonuc['toplam_tespit']
            },
            "katman2_bitki": katman2_sonuc,
            "katman3_hastalik": katman3_sonuc
        }))

        sys.exit(0)

    except Exception as e:
        print(json.dumps({
            "basarili": False,
            "hata": f"Pipeline hatası: {str(e)}"
        }))
        sys.exit(1)


if __name__ == "__main__":
    run_pipeline()
