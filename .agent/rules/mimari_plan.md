# Mimari ve Uygulama Planı

Bu proje, internet bağlantısına ihtiyaç duymadan (Edge AI) bitki hastalıklarını saptayan ve teşhis sonucuna göre hastalıklara özel dinamik kimyasal/ekolojik tedavi önerisi sunan, çapraz platform bir mobil uygulama oluşturmayı hedefler.

## Mimari Kararlar ve Teknoloji Yığını

### 1. Arayüz & Mobil Ortam Katmanı (Frontend)
- **Platform:** Çapraz platform iOS ve Android geliştirme için **React Native (Expo)** teknolojisi.
- **Tasarım Felsefesi (Hybrid Botanical Clean UI):** Teknolojik okuryazarlığı düşük kullanıcılar ve kırsal saha şartları göz önünde bulundurularak; büyük butonlu, 24-36px kavisli köşelere sahip, pastel botanik tonların hakim olduğu, modern ve okunabilir arayüz elemanları.
- **Asenkron Yapı:** Fotoğraf analizi ve yapay zeka çıkarımlarının uygulama arayüzünü kilitlememesi (thread blocking) için async/await mimarisi ile arka planda çalıştırılması.
- **Tema Desteği:** Merkezi bir `Colors.js` ve `ThemeContext.js` üzerinden yönetilen, tam uyumlu **Dark Mode (Karanlık Tema)** desteği.

### 2. Özelleştirilmiş Dashboard Mimarisi
- **Dinamik Hava Durumu Motoru:** `expo-location` ve `Open-Meteo API` entegrasyonu ile kullanıcının anlık konumuna göre (Şehir, İlçe bazlı) canlı hava durumu takibi.
- **Yerel Video Asset Sistemi:** Hava durumu durumuna göre (Güneşli, Yağmurlu, Sisli vb.) internet bağımlılığını azaltmak ve premium his yaratmak için uygulama içine gömülü (Local) **.mp4 video** arka planları (`expo-av`).
- **Bitki Kayıt ve Takip Sistemi:** Kullanıcının çektiği bitkileri "Stacked Photo" efektiyle listeleyen, bitki ihtiyaçlarını (Su, Gübre, Bakım) dinamik ikonlarla gösteren dashboard modülü.

### 3. Yapay Zeka & Görüntü İşleme (Model Katmanı)
- **Kullanılacak Ağ:** Evrişimli Sinir Ağları (CNN), kısıtlı donanımlar (Edge Computing) için hızlandırılmış boyutlardaki **MobileNet V3**.
- **Eğitim:** Transfer Learning kullanılarak pre-trained (ImageNet) ağırlıkların bitkisel hastalıklara özel lokal veri setleriyle ince ayarının (fine-tuning) yapılması.
- **Mobil Dağıtım (Edge AI):** Modelin cihaz üzerinde çevrimdışı çalışabilmesi için optimize edilmiş **TensorFlow Lite (TFLite)** formatına dönüştürülmesi ve React Native içinden köprüler (native modules) ile çağrılması.

### 4. Veritabanı & Backend Katmanı
- **Çevrimdışı Çalışma (Local DB):** Sahada internet olmadığı anlarda bile anlık tedavi önerebilmek için offline SQLite veya MMKV veritabanı.
- **Uzak Sunucu / Bulut Yedeği (Backend):** Hastalık kayıtlarının, reçetelerin ve çiftçi özelindeki verilerin senkronizasyonu için bulut destekli backend sistemi (**Node.js** tabanlı **Firebase** veya **PostgreSQL** mimarili REST API).

## Önerilen Temel Kod Dizin Yapısı

```text
/AI-Based-Plant-...
├── .agent/rules/            # Uygulama tasarım ve geliştirme kuralları (.md)
├── mobile_app/              # React Native Proje Dizini
│   ├── assets/              # İkonlar, .tflite modelleri ve yerel videolar (MP4)
│   ├── src/                 
│   │   ├── components/      # Tekrar kullanılabilir arayüz bileşenleri
│   │   ├── navigation/      # TabNavigator ve StackNavigator yapılandırması
│   │   ├── screens/         # Ekranlar (Dashboard, Kamera, Topluluk, Profil vb.)
│   │   ├── theme/           # Colors.js ve ThemeContext.js (Mod yönetimi)
│   │   ├── services/        # Backend API, Konum ve Hava Durumu servisleri
│   │   └── utils/           # Yardımcı fonksiyonlar
```

## Doğrulama ve Test Planı

- **Otomatize Testler:** Hata Matrisi (Confusion Matrix) ve Accuracy analizi ile model doğrulaması.
- **UX Testleri:** Cihaz üzerinde `pagingEnabled` carousel akış testi ve Android/iOS köşe siyahlığı (shadow artifacts) kontrolü.
- **İnternetsiz İşlem Kontrolü:** Uygulama offline iken video asset yüklemeleri ve lokal AI tahminleme başarımı.
