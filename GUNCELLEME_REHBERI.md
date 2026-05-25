# 🚀 AI Bitki Sağlığı Sistemi - Güncelleme ve Kurulum Rehberi

Bu dosya, projeyi kendi branch'ine çeken ekip üyeleri (Arif vb.) için güncel kodların sorunsuz çalışması adına yapılması gerekenleri içerir.

## 📦 1. Backend (Sunucu) Kurulumu

**DİKKAT YENİ MİMARİ:** Eski tek katmanlı AI yapısı tamamen kaldırılarak **3 Katmanlı Pipeline Mimarisine** (YOLO -> Keras MobileNet -> Hastalık) geçilmiştir. Ayrıca TFLite (FlexOps) hatalarını önlemek için tür sınıflandırmada direkt `.h5` Keras modeli kullanılmaktadır.

### 🐍 Python Bağımlılıkları (Kritik)
Modelin çalışması için Python ortamınızda şu kütüphaneler yüklü olmalıdır:

```bash
pip install ultralytics tensorflow tf_keras pillow numpy
```

### 🟩 Node.js Bağımlılıkları
`backend` klasörüne gidin ve paketleri yükleyin:

```bash
cd backend
npm install
```
*Not: Yeni mimari ile birlikte `@tensorflow/tfjs` ve `sharp` gibi gereksiz yük oluşturan Node.js paketleri kaldırılmış, tüm AI işlemleri saf Python `predict_pipeline.py` tarafına taşınmıştır.*

### ⚙️ .env Yapılandırması
`backend` klasörü içinde bir `.env` dosyası oluşturun ve Python yolunu belirtin:

```env
PYTHON_PATH=C:\v\venv\Scripts\python.exe  # Kendi sanal ortam (venv) veya global Python yolunuz
```

---

## 📱 2. Mobile App (Mobil Uygulama) Kurulumu

Mobil uygulamada yeni UI bileşenleri, hava durumu videoları ve gelişmiş 3 aşamalı (Katman 1-2-3) analiz akışı eklenmiştir.

### 📦 Paket Kurulumu
`mobile_app` klasörüne gidin ve tüm bağımlılıkları yükleyin:

```bash
cd mobile_app
npm install
```
*Kritik paketler:* `expo-camera`, `expo-image-manipulator`, `expo-av`, `expo-location`, `nativewind`.

### 🌐 IP Adresi Güncelleme (Artık Otomatik!)
Fiziksel cihazda (Expo Go) test yaparken IP adresi artık `expo-constants` kullanılarak **otomatik olarak tespit edilmektedir.** 

`mobile_app/src/config.js` dosyasında şu yapı kullanılmaktadır:
```javascript
const hostUri = Constants.expoConfig?.hostUri;
const ip = hostUri ? hostUri.split(':').shift() : '192.168.1.157';
export const API_BASE = `http://${ip}:3000`;
```
Bu sayede her seferinde IP adresi değiştirmenize gerek kalmaz, tüm ekranlar otomatik olarak yerel sunucunuza bağlanır.

---

## 🛠️ 3. Özet ve Dikkat Edilmesi Gerekenler

- **Model Dosyaları:** Ana proje dizininde `ai_model/active_models/` klasörü içinde `yolo_leaf_best.pt` (Katman 1), `plant_mobilenetv3large_best.h5` (Katman 2) ve `class_names.txt` dosyalarının olduğundan emin olun. TFLite dosyaları artık kullanılmamaktadır.
- **Python Hatası:** Sunucu yanıt vermiyorsa `ultralytics` veya `tf_keras` kütüphanesinin yüklü olup olmadığını terminalden kontrol edin.
- **Hastalık Tespiti (Katman 3):** Şu anda pipeline içerisinde yerleşik (placeholder) olarak beklemededir. Gelecekte yeni bir Keras modeli eklendiğinde doğrudan entegre edilecektir.

---

## 🐞 4. Sık Karşılaşılan Hatalar ve Çözümleri

### ❌ `TypeError: fetch failed` (Mobile App Start)
Eğer `npm start` aşamasında veya Metro Bundler başladığında bu hatayı alıyorsanız, sebebi **Node.js 22+** sürümlerindeki yerleşik `fetch` mekanizmasının Expo API'lerine DNS/SSL üzerinden bağlanamamasıdır.

**Çözüm:** Projeyi **offline** (çevrimdışı paketleme) modunda başlatın. Bu mod yerel geliştirme için yeterlidir:
```bash
npx expo start --offline
# VEYA
npm start -- --offline
```

---

*Bol şanslar!* 🌿
