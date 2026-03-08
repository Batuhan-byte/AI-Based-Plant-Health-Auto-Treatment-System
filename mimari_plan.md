# Mimari ve Uygulama Planı

Bu proje, internet bağlantısına ihtiyaç duymadan (Edge AI) bitki hastalıklarını saptayan ve teşhis sonucuna göre hastalıklara özel dinamik kimyasal/ekolojik tedavi önerisi sunan, çapraz platform bir mobil uygulama oluşturmayı hedefler.

## Mimari Kararlar ve Teknoloji Yığını

### 1. Arayüz & Mobil Ortam Katmanı (Frontend)
- **Platform:** Çapraz platform iOS ve Android geliştirme için **React Native** teknolojisi.
- **Kullanıcı Deneyimi (UX):** Teknolojik okuryazarlığı düşük kullanıcılar ve kırsal saha şartları göz önünde bulundurularak; büyük butonlu, karmaşadan uzak ve okunabilir arayüz elemanları.
- **Asenkron Yapı:** Fotoğraf analizi ve yapay zeka çıkarımlarının uygulama arayüzünü kilitlememesi (thread blocking) için async/await mimarisi ile arka planda çalıştırılması.

### 2. Yapay Zeka & Görüntü İşleme (Model Katmanı)
- **Kullanılacak Ağ:** Evrişimli Sinir Ağları (CNN), kısıtlı donanımlar (Edge Computing) için hızlandırılmış boyutlardaki **MobileNet V3**.
- **Eğitim:** Transfer Learning kullanılarak pre-trained (ImageNet) ağırlıkların bitkisel hastalıklara özel lokal veri setleriyle ince ayarının (fine-tuning) yapılması.
- **Mobil Dağıtım (Edge AI):** Modelin cihaz üzerinde çevrimdışı çalışabilmesi için optimize edilmiş **TensorFlow Lite (TFLite)** formatına dönüştürülmesi ve React Native içinden köprüler (native modules) ile çağrılması.

### 3. Veritabanı & Backend Katmanı
- **Çevrimdışı Çalışma (Local DB):** Sahada internet olmadığı anlarda bile anlık tedavi önerebilmek için offline SQLite veya MMKV veritabanı.
- **Uzak Sunucu / Bulut Yedeği (Backend):** Hastalık kayıtlarının, reçetelerin ve çiftçi özelindeki verilerin senkronizasyonu için bulut destekli backend sistemi (**Node.js** tabanlı **Firebase** veya **PostgreSQL** mimarili REST API). Cihaz değiştirse bile kullanıcı verilerine ulaşabilecek ve toplanan veriler modelin tekrar eğitimi amacıyla kullanılacaktır.

### 4. Matematiksel Karar Algoritması
- Resmin modeldeki çıktısı üzerinden en yüksek olasılığın güvenlik sınırını (> %50) geçip geçmediğini denetleyen mantıksal motor.
- Tanınan bitki hastalığı ile reçeteyi eşleyen S deterministik kümesi mantığı.

## Önerilen Temel Kod Dizin Yapısı

```text
/AI-Based-Plant-...
├── ai_model/                # Model eğitimi ve PyTorch/TensorFlow scriptleri
│   ├── datasets/            # Çiğ ve etiketlenmiş yaprak lezyon verileri
│   ├── notebooks/           # Eğitim ve test raporlarının bulunduğu Jupyter dosyaları
│   └── tflite_export/       # Mobile aktarılacak hazır pre-trained .tflite modelleri
│
├── mobile_app/              # React Native Proje Dizini
│   ├── android/             # Native Android dosyaları
│   ├── ios/                 # Native iOS dosyaları
│   └── src/                 
│       ├── assets/          # İkonlar, offline veriler ve .tflite model dosyası
│       ├── components/      # Tekrar kullanılabilir arayüz bileşenleri
│       ├── screens/         # Ekranlar (Ana Ekran, Kamera, Teşhis, Reçete Detayı)
│       ├── services/        # Backend API, veritabanı ve AI inference servisleri
│       ├── utils/           # Yardımcı fonksiyonlar (Kamera izinleri, crop vb.)
│       └── store/           # Durum yönetimi
│
└── backend/                 # PostgreSQL veya Firebase backend API projesi
```

## Doğrulama ve Test Planı

### Otomatize Testler (Yapay Zeka)
- **Hata Matrisi (Confusion Matrix):** Tüm test sonuçlarının çıkartılıp Yanlış Negatif (Hastalığı olan ama yapay zekanın Sağlıklı dediği vakalar) riskini gösteren istatistiki doğrulama.
- **Accuracy Analizi:** Farklı ışık açıları ve gölgeli test verileri ile test başarım skorlarının gözlemlenmesi.

### Manuel / Entegrasyon Testleri (Zirai ve Edge Computing)
- **İnternetsiz (Çevrimdışı) İşlem Kontrolü:** Uygulama Uçak Modunda iken kameranın açılıp açılmadığı ve yapay zekanın internet olmadan fotoğrafı lokal tahminleyip tahminleyemediği.
- **Senkronizasyon Testi:** İnternet bağlantısı sağlandığında, çevrimdışı yapılan test geçmişinin güvenli bir şekilde sunucuya aktarılıp aktarılamadığı.
