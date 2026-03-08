# Proje İş-Zaman Çizelgesi ve Görev Listesi (16 Haftalık Çevik Plan)

- [ ] **Aşama 1: Proje Başlangıcı ve Altyapı Hazırlığı (Hafta 1-2)**
  - [ ] Gereksinim analizlerinin tamamlanması ve uygulamanın kullanılacağı donanım alt limitlerinin belirlenmesi.
  - [ ] UI/UX tasarımlarının oluşturulması (Teknoloji okuryazarlığı düşük kullanıcılar için erişilebilir ve geniş arayüzler).
  - [ ] Yerel bitki hastalıkları veri setlerinin toplanması ve temizlenmesi.
  - [x] **React Native** cross-platform projesinin (CLI veya Expo) iskeletinin oluşturulması.

- [ ] **Aşama 2: Yapay Zeka Modelinin Geliştirilmesi ve Eğitimi (Hafta 3-6)**
  - [ ] Transfer Learning kullanılarak pre-trained MobileNet V3 ağırlıklarının çekilmesi.
  - [ ] Bitki yaprakları için görüntü ön işleme algoritmalarının veri setine uygulanması.
  - [ ] Model eğitim mimarisi ve optimizasyonlarının gerçekleştirilmesi.
  - [ ] Test aşamasında Yanlış Negatif (False Negative) değerlerini minimuma indirecek kayıp metriklerinin optimizasyonu.
  - [ ] Eğitilen modelin akıllı telefon belleklerinde uç bilişim (Edge) ile çalışabilecek donanım hızlandırma formatına (`TFLite`) dönüştürülmesi.

- [ ] **Aşama 3: Veritabanı (Backend) ve Reçete Eşleşme Sisteminin Kurulması (Hafta 7-8)**
  - [ ] Olası tedavi yöntemleri, dozajları ve yönergelerinden oluşan kimyasal/ekolojik yönerge veri setinin oluşturulması.
  - [ ] Uzak sunucu (**Firebase** veya **PostgreSQL** mimarili REST API) kurulumunun yapılması ve şema tasarımları.
  - [ ] Sahada çevrimdışı (offline first) kayıt alımı için yerel cihaz veritabanı (Local DB) tasarlanması ve senkronizasyon mantığının kurulması.
  - [ ] Hastalık, Bitki, Reçete matematiğini sağlayan $S$ deterministik karar motorunun koda dökülmesi.

- [ ] **Aşama 4: Edge AI ve Mobil Uygulama Entegrasyonu (Hafta 9-12)**
  - [ ] React Native üzerinde kamera modülü ile TFLite model inference süreçlerinin entegrasyonu.
  - [ ] UI tıkanmalarını (thread blocking) önlemek adına model çıkarım (inference) sürecinin arka planda (Worker Thread) çalıştırılması.
  - [ ] Yapay zeka servisinden (AI inference) dönen sonucun, reçete servisi/backend ile birleştirilip ekrana sunulması.
  - [ ] Analizin saniyeler içinde tamamlanabilecek seviyede optimize edilmesi.

- [ ] **Aşama 5: Test, Çevrimdışı Optimizasyon ve Canlıya Alım (Hafta 13-16)**
  - [ ] "Uçak Modunda" internet olmadan modelin çalışıp çalışmadığının tarlada test edilmesi (Edge Computing Testi).
  - [ ] Cihaz internet verisine kavuştuğunda çevrimdışı kayıtların başarıyla Backend'e senkronize olup olmadığının test edilmesi.
  - [ ] Pil tüketimi, cihaz ısınması ve bellek/RAM sızıntı testleri.
  - [ ] Çiftçi UX testleri doğrultusunda arayüz revizyonları (Kullanıcı kabul testleri).
  - [ ] Uygulamanın Play Store Android ve App Store iOS için derlenip hazırlanması.

- [ ] **Aşama 6: Gelecek Vizyon IoT İçin Mimari Hazırlık**
  - [ ] Nesnelerin İnterneti (IoT) sensörlerinden gelen sıcaklık/nem/toprak verilerini arka uçta (Backend) entegre edecek servis portlarının ayrılması (Proaktif Erken Uyarı modülü).
