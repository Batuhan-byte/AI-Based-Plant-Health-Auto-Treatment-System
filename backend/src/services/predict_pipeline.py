"""
3 Katmanlı AI Pipeline - Bitki Analiz Sistemi (Temiz Sürüm)
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

# ─── Desteklenen hastalık modeli olan bitkiler ─────────────
DESTEKLENEN_BITKILER = ['apple', 'bell_pepper', 'cherry', 'corn', 'grape', 'peach', 'potato', 'strawberry', 'tomato']


def katman1_yaprak_tespit(yolo_model_path, image_path):
    """
    Katman 1: YOLO ile yaprak tespiti
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
    """
    try:
        with open(class_names_path, 'r', encoding='utf-8') as f:
            class_names = [line.strip() for line in f if line.strip()]

        model = keras.models.load_model(plant_model_path)

        if cropped_image.mode != 'RGB':
            cropped_image = cropped_image.convert('RGB')

        img_resized = cropped_image.resize((224, 224), Image.LANCZOS)
        input_data = np.array(img_resized, dtype=np.float32)
        input_data = np.expand_dims(input_data, axis=0)

        predictions = model.predict(input_data, verbose=0)
        output_data = predictions[0]

        best_idx = int(np.argmax(output_data))
        best_conf = float(output_data[best_idx])

        if best_idx < len(class_names):
            class_name = class_names[best_idx]
        else:
            class_name = f"bilinmeyen_{best_idx}"

        top3_indices = np.argsort(output_data)[::-1][:3]
        top3 = []
        for idx in top3_indices:
            idx = int(idx)
            name = class_names[idx] if idx < len(class_names) else f"bilinmeyen_{idx}"
            top3.append({
                'tur': name,
                'confidence': float(output_data[idx])
            })

        return {
            'tur': class_name,
            'confidence': best_conf,
            'sinif_index': best_idx,
            'top3': top3
        }, None

    except Exception as e:
        return None, f"Bitki sınıflandırma hatası: {str(e)}"


def katman3_hastalik_tespit(disease_models_dir, bitki_turu, cropped_image):
    """
    Katman 3: Bitki türüne özel hastalık tespiti (Keras)
    """
    try:
        # Normalize bitki_turu: replace space with underscore
        bitki_turu = bitki_turu.replace(" ", "_")

        if bitki_turu not in DESTEKLENEN_BITKILER:
            return {
                'durum': 'model_yok',
                'hastalik': None,
                'saglikli': None,
                'confidence': None,
                'mesaj': f"'{bitki_turu}' için henüz hastalık modeli bulunmuyor."
            }

        model_path = os.path.join(disease_models_dir, f"{bitki_turu}_disease_model.keras")
        class_path = os.path.join(disease_models_dir, f"{bitki_turu}_disease_classes.txt")

        if not os.path.exists(model_path) or not os.path.exists(class_path):
            return {
                'durum': 'model_yok',
                'hastalik': None,
                'saglikli': None,
                'confidence': None,
                'mesaj': f"Model veya sınıf dosyası bulunamadı."
            }

        with open(class_path, 'r', encoding='utf-8') as f:
            disease_classes = [line.strip() for line in f if line.strip()]

        model = keras.models.load_model(model_path)

        if cropped_image.mode != 'RGB':
            cropped_image = cropped_image.convert('RGB')

        img_resized = cropped_image.resize((224, 224), Image.LANCZOS)
        input_data = np.array(img_resized, dtype=np.float32)
        input_data = np.expand_dims(input_data, axis=0)

        predictions = model.predict(input_data, verbose=0)
        output_data = predictions[0]

        best_idx = int(np.argmax(output_data))
        best_conf = float(output_data[best_idx])

        if best_idx < len(disease_classes):
            disease_name = disease_classes[best_idx]
        else:
            disease_name = f"bilinmeyen_{best_idx}"

        saglikli = disease_name.lower() == 'healthy'
        dusuk_confidence = best_conf < 0.70

        top3_indices = np.argsort(output_data)[::-1][:3]
        top3 = []
        for idx in top3_indices:
            idx = int(idx)
            name = disease_classes[idx] if idx < len(disease_classes) else f"bilinmeyen_{idx}"
            top3.append({
                'hastalik': name,
                'confidence': float(output_data[idx])
            })

        return {
            'durum': 'tespit_edildi',
            'hastalik': disease_name,
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
            'saglikli': None,
            'confidence': None,
            'mesaj': f"Hastalık tespiti hatası: {str(e)}"
        }


def run_pipeline():
    """Ana pipeline fonksiyonu - CLI Modu"""
    try:
        if len(sys.argv) < 6:
            print(json.dumps({
                "basarili": False,
                "hata": "Eksik argümanlar."
            }))
            return

        yolo_model_path = sys.argv[1]
        plant_model_path = sys.argv[2]
        class_names_path = sys.argv[3]
        image_path = sys.argv[4]
        disease_models_dir = sys.argv[5]

        for fpath in [yolo_model_path, plant_model_path, class_names_path, image_path]:
            if not os.path.exists(fpath):
                print(json.dumps({
                    "basarili": False,
                    "hata": f"Dosya bulunamadı: {fpath}"
                }))
                return

        katman1_sonuc, katman1_hata = katman1_yaprak_tespit(yolo_model_path, image_path)
        if katman1_hata:
            print(json.dumps({"basarili": False, "hata": katman1_hata, "katman": 1}))
            return

        katman2_sonuc, katman2_hata = katman2_bitki_siniflandirma(plant_model_path, class_names_path, katman1_sonuc['crop'])
        if katman2_hata:
            print(json.dumps({"basarili": False, "hata": katman2_hata, "katman": 2}))
            return

        if katman2_sonuc['confidence'] < 0.50:
            print(json.dumps({
                "basarili": False,
                "hata": "Bitki türü yeterince güvenilir tespit edilemedi.",
                "katman": 2,
                "confidence": katman2_sonuc['confidence']
            }))
            return

        bitki_turu = katman2_sonuc['tur']
        katman3_sonuc = katman3_hastalik_tespit(disease_models_dir, bitki_turu, katman1_sonuc['crop'])

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
        print(json.dumps({"basarili": False, "hata": str(e)}))
        sys.exit(1)


# ═══════════════════════════════════════════════════════════════════
#  DAEMON (HTTP SUNUCU) MODU
# ═══════════════════════════════════════════════════════════════════

_yolo_model = None
_plant_model = None
_class_names = None
_disease_models = {}
_disease_classes = {}


def load_all_models(yolo_model_path, plant_model_path, class_names_path, disease_models_dir):
    global _yolo_model, _plant_model, _class_names
    global _disease_models, _disease_classes

    sys.stderr.write("[Daemon] YOLO modeli yükleniyor...\n")
    _yolo_model = YOLO(yolo_model_path)

    sys.stderr.write("[Daemon] Bitki sınıflandırma modeli yükleniyor...\n")
    _plant_model = keras.models.load_model(plant_model_path)

    with open(class_names_path, 'r', encoding='utf-8') as f:
        _class_names = [line.strip() for line in f if line.strip()]

    for bitki in DESTEKLENEN_BITKILER:
        model_path = os.path.join(disease_models_dir, f"{bitki}_disease_model.keras")
        class_path = os.path.join(disease_models_dir, f"{bitki}_disease_classes.txt")

        if os.path.exists(model_path) and os.path.exists(class_path):
            sys.stderr.write(f"[Daemon] {bitki} hastalık modeli yükleniyor...\n")
            _disease_models[bitki] = keras.models.load_model(model_path)
            with open(class_path, 'r', encoding='utf-8') as f:
                _disease_classes[bitki] = [line.strip() for line in f if line.strip()]

    # Warm-up
    dummy = np.zeros((1, 224, 224, 3), dtype=np.float32)
    _plant_model.predict(dummy, verbose=0)
    sys.stderr.write("[Daemon] Warm-up tamamlandı.\n")


def katman1_yaprak_tespit_inmemory(pil_image):
    global _yolo_model
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            tmp_path = tmp.name
            pil_image.save(tmp, format='JPEG')

        img_w, img_h = pil_image.size
        results = _yolo_model.predict(source=tmp_path, conf=0.55, verbose=False)

        if not results or len(results) == 0:
            return None, "YOLO sonuç döndürmedi."

        boxes = results[0].boxes
        if boxes is None or len(boxes) == 0:
            return None, "Fotoğrafta yaprak tespit edilemedi."

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
            return None, "Yeterli büyüklükte yaprak tespit edilemedi."

        best_box = max(valid_boxes, key=lambda b: b['conf'])
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
        return None, str(e)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


def katman2_bitki_siniflandirma_inmemory(cropped_image):
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

        top3_indices = np.argsort(output_data)[::-1][:3]
        top3 = []
        for idx in top3_indices:
            idx = int(idx)
            name = _class_names[idx] if idx < len(_class_names) else f"bilinmeyen_{idx}"
            top3.append({
                'tur': name,
                'confidence': float(output_data[idx])
            })

        return {
            'tur': class_name,
            'confidence': best_conf,
            'sinif_index': best_idx,
            'top3': top3
        }, None
    except Exception as e:
        return None, str(e)


def katman3_hastalik_tespit_inmemory(bitki_turu, cropped_image):
    global _disease_models, _disease_classes
    try:
        # Normalize bitki_turu: replace space with underscore
        bitki_turu = bitki_turu.replace(" ", "_")

        if bitki_turu not in DESTEKLENEN_BITKILER or bitki_turu not in _disease_models:
            return {
                'durum': 'model_yok',
                'hastalik': None,
                'saglikli': None,
                'confidence': None,
                'mesaj': f"Hastalık modeli bulunmuyor."
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

        best_idx = int(np.argmax(output_data))
        best_conf = float(output_data[best_idx])

        if best_idx < len(disease_classes):
            disease_name = disease_classes[best_idx]
        else:
            disease_name = f"bilinmeyen_{best_idx}"

        saglikli = disease_name.lower() == 'healthy'
        dusuk_confidence = best_conf < 0.70

        top3_indices = np.argsort(output_data)[::-1][:3]
        top3 = []
        for idx in top3_indices:
            idx = int(idx)
            name = disease_classes[idx] if idx < len(disease_classes) else f"bilinmeyen_{idx}"
            top3.append({
                'hastalik': name,
                'confidence': float(output_data[idx])
            })

        return {
            'durum': 'tespit_edildi',
            'hastalik': disease_name,
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
            'saglikli': None,
            'confidence': None,
            'mesaj': str(e)
        }


def run_pipeline_inmemory(image_bytes):
    try:
        pil_image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        katman1_sonuc, katman1_hata = katman1_yaprak_tespit_inmemory(pil_image)
        if katman1_hata:
            return {"basarili": False, "hata": katman1_hata, "katman": 1}

        katman2_sonuc, katman2_hata = katman2_bitki_siniflandirma_inmemory(katman1_sonuc['crop'])
        if katman2_hata:
            return {"basarili": False, "hata": katman2_hata, "katman": 2}

        if katman2_sonuc['confidence'] < 0.50:
            return {
                "basarili": False,
                "hata": "Bitki türü yeterince güvenilir tespit edilemedi.",
                "katman": 2,
                "confidence": katman2_sonuc['confidence']
            }

        bitki_turu = katman2_sonuc['tur']
        katman3_sonuc = katman3_hastalik_tespit_inmemory(bitki_turu, katman1_sonuc['crop'])

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
        return {"basarili": False, "hata": str(e)}


class InferenceHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/predict':
            self._json_yanit(404, {"basarili": False, "hata": "Endpoint bulunamadı"})
            return

        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self._json_yanit(400, {"basarili": False, "hata": "Boş istek gövdesi"})
                return

            image_bytes = self.rfile.read(content_length)
            sonuc = run_pipeline_inmemory(image_bytes)
            self._json_yanit(200, sonuc)
        except Exception as e:
            self._json_yanit(500, {"basarili": False, "hata": str(e)})

    def do_GET(self):
        if self.path == '/health':
            self._json_yanit(200, {"status": "ready"})
        else:
            self._json_yanit(404, {"basarili": False, "hata": "Endpoint bulunamadı"})

    def _json_yanit(self, status_code, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass


def run_server(port, yolo_path, plant_path, class_path, disease_dir):
    load_all_models(yolo_path, plant_path, class_path, disease_dir)

    server_address = ('127.0.0.1', port)
    httpd = http.server.HTTPServer(server_address, InferenceHandler)

    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()

    sys.stderr.write(f"\n🌿 Bitki Analiz Daemon Sunucusu HAZIR (Adres: http://127.0.0.1:{port})\n")

    try:
        server_thread.join()
    except KeyboardInterrupt:
        httpd.shutdown()


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == '--server':
        if len(sys.argv) < 6:
            sys.exit(1)

        yolo_path = sys.argv[2]
        plant_path = sys.argv[3]
        class_path = sys.argv[4]
        disease_dir = sys.argv[5]

        port = 5005
        if '--port' in sys.argv:
            port_idx = sys.argv.index('--port')
            if port_idx + 1 < len(sys.argv):
                port = int(sys.argv[port_idx + 1])

        run_server(port, yolo_path, plant_path, class_path, disease_dir)
    else:
        run_pipeline()
