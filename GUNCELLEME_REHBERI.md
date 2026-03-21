# 🚀 AI Bitki Sağlığı Sistemi - Güncelleme ve Kurulum Rehberi

Bu dosya, projeyi kendi branch'ine çeken ekip üyeleri (Arif vb.) için güncel kodların sorunsuz çalışması adına yapılması gerekenleri içerir.

## 📦 1. Backend (Sunucu) Kurulumu

Backend tarafında yapılan son güncellemeler (Resim işleme, center crop ve rembg desteği) için yeni kütüphaneler eklenmiştir.

### 🐍 Python Bağımlılıkları (Kritik)
Modelin çalışması ve arka plan silme (remove background) işlemleri için Python ortamınızda şu kütüphaneler yüklü olmalıdır:

```bash
pip install tensorflow pillow numpy rembg
```

### 🟩 Node.js Bağımlılıkları
`backend` klasörüne gidin ve paketleri yükleyin:

```bash
cd backend
npm install
```
*Yeni eklenen paketler:* `dotenv`, `sharp`, `multer`, `pg`, `@tensorflow/tfjs`.

### ⚙️ .env Yapılandırması
`backend` klasörü içinde bir `.env` dosyası oluşturun ve Python yolunu belirtin:

```env
PYTHON_PATH=python  # Windows için 'python', Mac/Linux veya Venv için tam yol
```

---

## 📱 2. Mobile App (Mobil Uygulama) Kurulumu

Mobil uygulamada yeni UI bileşenleri, hava durumu videoları ve gelişmiş resim işleme mantığı eklenmiştir.

### 📦 Paket Kurulumu
`mobile_app` klasörüne gidin ve tüm bağımlılıkları yükleyin:

```bash
cd mobile_app
npm install
```
*Kritik paketler:* `expo-camera`, `expo-image-manipulator`, `expo-av`, `expo-location`, `nativewind`.

### 🌐 IP Adresi Güncelleme (Cihaz Testi İçin)
Fiziksel cihazda (Expo Go) test yapacaksanız, `mobile_app/src/screens/CameraScreen.js` dosyasındaki `32. satırı` kendi yerel IP'nizle güncelleyin:

```javascript
const API_BASE = 'http://192.168.1.XX:3000'; // Bilgisayarınızın WiFi IP'si
```

---

## 🛠️ 3. Özet ve Dikkat Edilmesi Gerekenler

- **Model Dosyaları:** `backend/src/model` içinde `.tflite` ve `etiketler.txt` dosyalarının olduğundan emin olun.
- **Python Hatası:** Sunucu "Python betiği hatası" veriyorsa `rembg` kütüphanesinin yüklü olup olmadığını terminalden kontrol edin.
- **UI:** Uygulama artık `ThemeContext` üzerinden Koyu/Açık mod destekliyor.

---

*Bol şanslar!* 🌿
