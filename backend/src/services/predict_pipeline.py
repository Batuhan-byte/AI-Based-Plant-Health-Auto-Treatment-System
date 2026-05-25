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
import io
import time
import tempfile
import http.server
import threading
import base64

# Kritik: Tüm bilgi ve uyarı mesajlarını kapat (stdout/stderr kirletmesin)
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'  # oneDNN CPU optimizasyon uyarılarını gizler
os.environ['YOLO_VERBOSE'] = 'False'
os.environ['TF_USE_LEGACY_KERAS'] = '1'

import warnings
warnings.filterwarnings('ignore')

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
    - 224x224 RGB, pixel değerleri 0-255 (float32) olarak verilir.
    - Model içinde Rescaling(1/127.5, offset=-1) katmanı bulunduğundan
      DIŞARIDA herhangi bir normalize/preprocess_input YAPILMAZ.
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

        # RGB dönüşümü kontrolü
        if cropped_image.mode != 'RGB':
            cropped_image = cropped_image.convert('RGB')

        # Görüntüyü 224x224'e resize et
        img_resized = cropped_image.resize((224, 224), Image.LANCZOS)

        # Ham 0-255 float32 array — model içindeki Rescaling katmanı normalize eder
        # DIŞ preprocess_input KULLANILMAZ (çift normalizasyon hatası oluşur)
        input_data = np.array(img_resized, dtype=np.float32)  # [224, 224, 3], değerler 0-255
        input_data = np.expand_dims(input_data, axis=0)        # [1, 224, 224, 3]

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

    Preprocessing kuralları:
    1. Görüntü mutlaka RGB olacak.
    2. Input boyutu 224x224 olacak.
    3. Pixel değerleri 0-255 aralığında, float32 olarak verilecek.
       Model içinde Rescaling(scale=1/127.5, offset=-1) katmanı bulunduğundan
       DIŞARIDA normalize, /255 veya preprocess_input YAPILMAZ.
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

        # 3. Ham 0-255 float32 array — model içindeki Rescaling katmanı normalize eder
        #    DIŞ preprocess / /255 / normalize KULLANILMAZ
        input_data = np.array(img_resized, dtype=np.float32)  # değerler 0-255
        input_data = np.expand_dims(input_data, axis=0)        # [1, 224, 224, 3]

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


# ═══════════════════════════════════════════════════════════════════
#  DAEMON (HTTP SUNUCU) MODU
# ═══════════════════════════════════════════════════════════════════

# ─── Global Model Holders (Daemon Modu) ─────────────────
_yolo_model = None
_plant_model = None
_class_names = None
_disease_models = {}   # { 'apple': model, 'tomato': model, ... }
_disease_classes = {}  # { 'apple': ['Healthy', ...], ... }
_model_paths = {}      # Sunucu başlatılırken doldurulur


def load_all_models(yolo_model_path, plant_model_path, class_names_path, disease_models_dir):
    """
    Tüm AI modellerini global belleğe yükler.
    Sunucu başlatılırken bir kez çağrılır — sonraki isteklerde tekrar yükleme yapılmaz.
    """
    global _yolo_model, _plant_model, _class_names
    global _disease_models, _disease_classes, _model_paths

    _model_paths = {
        'yolo': yolo_model_path,
        'plant': plant_model_path,
        'class_names': class_names_path,
        'disease_dir': disease_models_dir,
    }

    # ── YOLO modeli ──────────────────────────────────────
    sys.stderr.write("[Daemon] YOLO modeli yükleniyor...\n")
    t0 = time.time()
    _yolo_model = YOLO(yolo_model_path)
    sys.stderr.write(f"[Daemon] YOLO yüklendi ({time.time() - t0:.2f}s)\n")

    # ── Bitki sınıflandırma modeli (Keras) ───────────────
    sys.stderr.write("[Daemon] Bitki sınıflandırma modeli yükleniyor...\n")
    t0 = time.time()
    _plant_model = keras.models.load_model(plant_model_path)
    sys.stderr.write(f"[Daemon] Bitki modeli yüklendi ({time.time() - t0:.2f}s)\n")

    # ── Sınıf isimleri ───────────────────────────────────
    with open(class_names_path, 'r', encoding='utf-8') as f:
        _class_names = [line.strip() for line in f if line.strip()]
    sys.stderr.write(f"[Daemon] {len(_class_names)} bitki sınıfı okundu\n")

    # ── Hastalık modelleri ────────────────────────────────
    for bitki in DESTEKLENEN_BITKILER:
        model_path = os.path.join(disease_models_dir, f"{bitki}_disease_model.keras")
        class_path = os.path.join(disease_models_dir, f"{bitki}_disease_classes.txt")

        if not os.path.exists(model_path) or not os.path.exists(class_path):
            sys.stderr.write(f"[Daemon] UYARI: {bitki} hastalık modeli bulunamadı, atlanıyor\n")
            continue

        sys.stderr.write(f"[Daemon] {bitki} hastalık modeli yükleniyor...\n")
        t0 = time.time()
        _disease_models[bitki] = keras.models.load_model(model_path)
        with open(class_path, 'r', encoding='utf-8') as f:
            _disease_classes[bitki] = [line.strip() for line in f if line.strip()]
        sys.stderr.write(f"[Daemon] {bitki} hastalık modeli yüklendi ({time.time() - t0:.2f}s)\n")

    # ── Warm-up inference (ilk istek gecikmesini önler) ──
    sys.stderr.write("[Daemon] Warm-up inference yapılıyor...\n")
    t0 = time.time()
    dummy = np.zeros((1, 224, 224, 3), dtype=np.float32)
    _plant_model.predict(dummy, verbose=0)
    sys.stderr.write(f"[Daemon] Warm-up tamamlandı ({time.time() - t0:.2f}s)\n")


# ─── In-Memory Katman Fonksiyonları ─────────────────────

def katman1_yaprak_tespit_inmemory(pil_image):
    """
    Katman 1 (Daemon modu): Bellekteki YOLO modeliyle yaprak tespiti.
    YOLO predict() dosya yolu gerektirdiğinden geçici dosya kullanılır.
    """
    global _yolo_model
    tmp_path = None
    try:
        # PIL görüntüsünü geçici dosyaya kaydet (YOLO predict için gerekli)
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            tmp_path = tmp.name
            pil_image.save(tmp, format='JPEG')

        img_w, img_h = pil_image.size

        # YOLO inference (model zaten bellekte)
        results = _yolo_model.predict(
            source=tmp_path,
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

        best_box = max(valid_boxes, key=lambda b: b['conf'])

        # %15 padding ekle
        pad_x = best_box['w'] * 0.15
        pad_y = best_box['h'] * 0.15

        crop_x1 = max(0, best_box['x1'] - pad_x)
        crop_y1 = max(0, best_box['y1'] - pad_y)
        crop_x2 = min(img_w, best_box['x2'] + pad_x)
        crop_y2 = min(img_h, best_box['y2'] + pad_y)

        cropped = pil_image.crop((int(crop_x1), int(crop_y1), int(crop_x2), int(crop_y2)))

        return {
            'crop': cropped,
            'confidence': best_box['conf'],
            'bbox': [int(crop_x1), int(crop_y1), int(crop_x2), int(crop_y2)],
            'toplam_tespit': len(valid_boxes)
        }, None

    except Exception as e:
        return None, f"YOLO yaprak tespiti hatası: {str(e)}"
    finally:
        # Geçici dosyayı temizle
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


def katman2_bitki_siniflandirma_inmemory(cropped_image):
    """
    Katman 2 (Daemon modu): Bellekteki Keras modeliyle bitki türü sınıflandırma.
    Debug görüntüsü kaydetmez — tamamen in-memory çalışır.
    """
    global _plant_model, _class_names
    try:
        if cropped_image.mode != 'RGB':
            cropped_image = cropped_image.convert('RGB')

        img_resized = cropped_image.resize((224, 224), Image.LANCZOS)

        input_data = np.array(img_resized, dtype=np.float32)
        input_data = np.expand_dims(input_data, axis=0)

        predictions = _plant_model.predict(input_data, verbose=0)
        output_data = predictions[0]

        best_idx = int(np.argmax(output_data))
        best_conf = float(output_data[best_idx])

        if best_idx < len(_class_names):
            class_name = _class_names[best_idx]
        else:
            class_name = f"bilinmeyen_{best_idx}"

        tur_tr = BITKI_TR.get(class_name, class_name.capitalize())

        top3_indices = np.argsort(output_data)[::-1][:3]
        top3 = []
        for idx in top3_indices:
            idx = int(idx)
            name = _class_names[idx] if idx < len(_class_names) else f"bilinmeyen_{idx}"
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


def katman3_hastalik_tespit_inmemory(bitki_turu, cropped_image):
    """
    Katman 3 (Daemon modu): Bellekteki hastalık modeliyle tespit.
    """
    global _disease_models, _disease_classes
    try:
        if bitki_turu not in DESTEKLENEN_BITKILER:
            return {
                'durum': 'model_yok',
                'hastalik': None,
                'hastalik_tr': None,
                'saglikli': None,
                'confidence': None,
                'mesaj': f"'{bitki_turu}' için henüz hastalık modeli bulunmuyor."
            }

        if bitki_turu not in _disease_models:
            return {
                'durum': 'model_yok',
                'hastalik': None,
                'hastalik_tr': None,
                'saglikli': None,
                'confidence': None,
                'mesaj': f"'{bitki_turu}' hastalık modeli yüklenememiş."
            }

        model = _disease_models[bitki_turu]
        disease_classes = _disease_classes[bitki_turu]

        if cropped_image.mode != 'RGB':
            cropped_image = cropped_image.convert('RGB')

        img_resized = cropped_image.resize((224, 224), Image.LANCZOS)

        input_data = np.array(img_resized, dtype=np.float32)
        input_data = np.expand_dims(input_data, axis=0)

        predictions = model.predict(input_data, verbose=0)
        output_data = predictions[0]

        sys.stderr.write(f"[Katman3 Daemon] {bitki_turu} raw_predictions: {output_data.tolist()}\n")

        best_idx = int(np.argmax(output_data))
        best_conf = float(output_data[best_idx])

        if best_idx < len(disease_classes):
            disease_name = disease_classes[best_idx]
        else:
            disease_name = f"bilinmeyen_{best_idx}"

        saglikli = disease_name.lower() == 'healthy'
        hastalik_tr = HASTALIK_TR.get(disease_name, disease_name)
        dusuk_confidence = best_conf < 0.70

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


def run_pipeline_inmemory(image_bytes):
    """
    Daemon modu pipeline — ham görüntü byte'larını alır,
    bellekteki modellerle 3 katmanlı analiz yapar, sonucu dict olarak döndürür.
    """
    try:
        # Byte'lardan PIL görüntüsü oluştur
        pil_image = Image.open(io.BytesIO(image_bytes)).convert('RGB')

        # ═══ KATMAN 1: YOLO Yaprak Tespiti ═══
        katman1_sonuc, katman1_hata = katman1_yaprak_tespit_inmemory(pil_image)

        if katman1_hata:
            return {
                "basarili": False,
                "hata": katman1_hata,
                "katman": 1
            }

        # ═══ KATMAN 2: Bitki Türü Sınıflandırma ═══
        katman2_sonuc, katman2_hata = katman2_bitki_siniflandirma_inmemory(
            katman1_sonuc['crop']
        )

        if katman2_hata:
            return {
                "basarili": False,
                "hata": katman2_hata,
                "katman": 2
            }

        if katman2_sonuc['confidence'] < 0.50:
            return {
                "basarili": False,
                "hata": "Bitki türü yeterince güvenilir tespit edilemedi. Lütfen yaprağı daha net ve yakından çekin.",
                "katman": 2,
                "dusuk_confidence": True,
                "confidence": katman2_sonuc['confidence']
            }

        # ═══ KATMAN 3: Hastalık Tespiti ═══
        bitki_turu = katman2_sonuc['tur']
        katman3_sonuc = katman3_hastalik_tespit_inmemory(
            bitki_turu,
            katman1_sonuc['crop']
        )

        # Görsel kırpma verisini (crop) bellekte base64 formatına çevir
        buffered = io.BytesIO()
        katman1_sonuc['crop'].save(buffered, format="JPEG")
        crop_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')

        return {
            "basarili": True,
            "katman1_yaprak": {
                "tespit_edildi": True,
                "confidence": katman1_sonuc['confidence'],
                "bbox": katman1_sonuc['bbox'],
                "toplam_tespit": katman1_sonuc['toplam_tespit'],
                "crop_base64": crop_base64
            },
            "katman2_bitki": katman2_sonuc,
            "katman3_hastalik": katman3_sonuc
        }

    except Exception as e:
        return {
            "basarili": False,
            "hata": f"Pipeline hatası: {str(e)}"
        }


# ─── HTTP Sunucu ────────────────────────────────────────

class InferenceHandler(http.server.BaseHTTPRequestHandler):
    """Daemon modu HTTP istek işleyicisi"""

    def do_POST(self):
        """POST /predict — ham görüntü byte'ları alır, JSON sonuç döndürür"""
        if self.path != '/predict':
            self._json_yanit(404, {"basarili": False, "hata": f"Bilinmeyen endpoint: {self.path}"})
            return

        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self._json_yanit(400, {"basarili": False, "hata": "Boş istek gövdesi — görüntü verisi gerekli."})
                return

            image_bytes = self.rfile.read(content_length)

            t0 = time.time()
            sonuc = run_pipeline_inmemory(image_bytes)
            sure = time.time() - t0

            sonuc['islem_suresi_sn'] = round(sure, 3)
            sys.stderr.write(f"[Daemon] /predict tamamlandı — {sure:.3f}s\n")

            self._json_yanit(200, sonuc)

        except Exception as e:
            self._json_yanit(500, {"basarili": False, "hata": f"Sunucu hatası: {str(e)}"})

    def do_GET(self):
        """GET /health — hazırlık kontrolü"""
        if self.path == '/health':
            self._json_yanit(200, {"status": "ready"})
        else:
            self._json_yanit(404, {"basarili": False, "hata": f"Bilinmeyen endpoint: {self.path}"})

    def _json_yanit(self, status_code, data):
        """JSON yanıt gönder"""
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        """Varsayılan HTTP loglarını bastır (stderr'i kirletmesin)"""
        pass


def run_server(port, yolo_path, plant_path, class_path, disease_dir):
    """
    Daemon HTTP sunucusunu başlatır.
    1. Tüm modelleri belleğe yükler
    2. HTTPServer'ı başlatır
    3. serve_forever() ile istekleri dinler
    """
    # Modelleri yükle
    load_all_models(yolo_path, plant_path, class_path, disease_dir)

    # Sunucuyu başlat
    server_address = ('127.0.0.1', port)
    httpd = http.server.HTTPServer(server_address, InferenceHandler)

    # Thread ile çalıştır (temiz kapatma için)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()

    sys.stderr.write(f"\n{'='*60}\n")
    sys.stderr.write(f"  🌿 Bitki Analiz Daemon Sunucusu HAZIR\n")
    sys.stderr.write(f"  📡 Adres: http://127.0.0.1:{port}\n")
    sys.stderr.write(f"  🔬 Endpoint: POST /predict (raw image bytes)\n")
    sys.stderr.write(f"  💚 Sağlık: GET /health\n")
    sys.stderr.write(f"  ❌ Durdurmak için Ctrl+C\n")
    sys.stderr.write(f"{'='*60}\n\n")

    try:
        # Ana thread'i canlı tut
        server_thread.join()
    except KeyboardInterrupt:
        sys.stderr.write("\n[Daemon] Kapatılıyor...\n")
        httpd.shutdown()
        sys.stderr.write("[Daemon] Sunucu durduruldu.\n")


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == '--server':
        # ─── Daemon Modu ────────────────────────────────────
        # Kullanım: python predict_pipeline.py --server <yolo_model> <plant_model> <class_names> <disease_models_dir> [--port 5005]
        if len(sys.argv) < 6:
            sys.stderr.write(
                "Kullanım: python predict_pipeline.py --server "
                "<yolo_model> <plant_model> <class_names> <disease_models_dir> [--port 5005]\n"
            )
            sys.exit(1)

        yolo_path = sys.argv[2]
        plant_path = sys.argv[3]
        class_path = sys.argv[4]
        disease_dir = sys.argv[5]

        # Opsiyonel port argümanı
        port = 5005
        if '--port' in sys.argv:
            port_idx = sys.argv.index('--port')
            if port_idx + 1 < len(sys.argv):
                try:
                    port = int(sys.argv[port_idx + 1])
                except ValueError:
                    sys.stderr.write(f"Geçersiz port numarası: {sys.argv[port_idx + 1]}\n")
                    sys.exit(1)

        # Dosya kontrolleri
        for fpath, fname in [
            (yolo_path, "YOLO model"),
            (plant_path, "Bitki sınıflandırma modeli"),
            (class_path, "Sınıf isimleri dosyası"),
        ]:
            if not os.path.exists(fpath):
                sys.stderr.write(f"HATA: {fname} bulunamadı: {fpath}\n")
                sys.exit(1)

        if not os.path.isdir(disease_dir):
            sys.stderr.write(f"HATA: Hastalık modelleri klasörü bulunamadı: {disease_dir}\n")
            sys.exit(1)

        run_server(port, yolo_path, plant_path, class_path, disease_dir)
    else:
        # ─── Klasik CLI Modu ────────────────────────────────
        run_pipeline()
