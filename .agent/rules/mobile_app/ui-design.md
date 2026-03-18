---
description: Mobil Uygulama Genel Arayüz ve Tasarım Kuralları
globs: mobile_app/src/**/*.js
---
# Plant Health Mobil Uygulaması Arayüz Tasarım Kuralları (Ana Kaynak)

Bu belge, uygulamanın **"Hybrid Botanical Clean UI"** (Modern temiz beyaz arayüz ile pastel/botanik doğa tonlarının birleşimi) tasarım prensiplerini içerir. UYARI: Uygulamanın geliştirilecek diğer *tüm sayfaları, buton yapıları ve renk kodları* eksiksiz biçimde bu dosyadan beslenecektir.

> [!WARNING]
> NativeWind (Tailwind) veya farklı harici stil motorları Beta Expo sürümleriyle çakışma yarattığından, proje genelinde arayüz yapılandırılırken görsel bozulmaların önüne geçmek adına UI tasarımlarında **sadece React Native'in kendi `StyleSheet.create({})`** yapısı kullanılacaktır.

## 1. Temel Felsefe (Clean + Botanic)

Tasarımın omurgasını iki unsur oluşturur:
1.  **Zemin ve Yapı (Modern & Clean):** Ekran arkaplanları ve içerik kartları son derece sade, ferah, saf beyaz ve en açık gri tonlardadır.
2.  **Etkileşim ve Aksiyon (Botanic):** Menüler, butonlar, ikonlar ve durum bildirimleri, temanın doğasını (bitki sağlığı) yansıtan toprak, yaprak ve pastel yeryüzü tonlarındadır.

## 2. Renk Paleti (Color Palette)

Aşağıdaki renkler UI inşasında kullanılacak yegâne standart renk kodlarıdır:

### Zemin ve Metin Renkleri (Modern Foundation)
*   **Ana Arka Plan (Background):** `#F5F5F7` (Çok Açık Modern Gri/Krem - Sayfaların ana gövdesi, ferahlık veren zemin).
*   **Kart Arka Planı (Card Surface):** `#FFFFFF` (Saf Beyaz - Arka plandan sıyrılarak üstte okunaklı duracak tüm kutular ve panolar için).
*   **Birincil Siyah Metin (Text Main):** `#1A1A1D` (Koyu Füme/Siyah - Okunabilirliği yüksek ana başlıklar ve standart yazılar).
*   **İkincil / Kısık Metin (Text Muted):** `#8E8E93` (Orta Gri - Tarih, açıklama metni, pasif alt yazılar).
*   **Pasif İkon Grisi:** `#C7C7CC` (Listelerdeki veya menülerdeki kapalı/aktif olmayan alanlar).

### Butonlar ve Vurgu Renkleri (Botanic Accents)
*   **Ana Botanik Vurgu (Primary Accent):** `#648754` (Koyu/Orta Zeytin Yeşili - Aktif menü butonları, Ana filiz ikonu, bildirim noktaları, tıklandığında beliren aktif "See all" gibi yazılar için ana aksiyon rengimiz budur).
*   **İkon Arka Planı 1 (Şeftali / Toprak):** `#EEDCCB` (Sulama, ödemeler gibi konulara atanabilecek ikon kutu arkası pastel).
*   **İkon Arka Planı 2 (Nane / Açık Yeşil):** `#E1EAD8` (Detay, analiz, genel sağlığa dair ikon kutu arkası pastel).
*   **İkon Arka Planı 3 (Mercan / Somon):** `#EFCFC3` (Premium alışveriş, yeni bitki ekleme).
*   **İkon Arka Planı 4 (Açık Mavi / Buz):** `#DCE9E9` (Duraklatma, soğutma veya hava durumu ile alakalı konularda).

## 3. Tipografi ve Metin Düzeni (Typography)

*   **Ana Başlıklar (H1):** `fontSize: 24`, `fontWeight: 'bold'`, `color: '#1A1A1D'`, `letterSpacing: -0.5`
*   **Orta Başlıklar (H2):** `fontSize: 20`, `fontWeight: 'bold'`, `color: '#1A1A1D'`
*   **Genel Liste Başlığı:** `fontSize: 16`, `fontWeight: 'bold'`, `color: '#1A1A1D'`
*   **Liste Açıklaması (Subtitle):** `fontSize: 13`, `fontWeight: '500'`, `color: '#8E8E93'`
*   **Hızlı Aksiyon Butonu Alt Etiketi:** `fontSize: 12`, `fontWeight: '600'`, `color: '#1A1A1D'`, ortalı.

## 4. Bileşen Geometrisi (Border Radius Rules)

Tasarımımızda hiçbir zaman tam sivri ve keskin dikdörtgenler bulunmaz. Sistem genelinde aşağıdaki köşe esneklikleri baz alınacaktır:

*   **Büyük Öncelikli Kartlar (Örn: Botanist Pass):** `borderRadius: 24`
*   **Hızlı Aksiyon (Küçük Yuvarlak) Butonları:** `width: 60`, `height: 60`, yarı çap `borderRadius: 30` (Tam Daire)
*   **Log / Standart Liste Satırı (List Item):** `borderRadius: 20`
*   **Liste İçi Küçük İkon Kutusu:** `width: 50`, `height: 50`, ufak kalın kare formu `borderRadius: 14`
*   **Tabana Yaslı Alt Menü (Docked Tab Bar):** Sadece üst köşeler kavisli `borderTopLeftRadius: 20`, `borderTopRightRadius: 20` (Havada uçan (floating) tasarım Android edge-to-edge hatalarından dolayı iptal edilmiştir. Bar ekranın bittiği yere güvenle raptiye edilir). Sadece Merkez-Aksiyon Butonu barın içinden `-25px` yukarı taşarak 3D bir hissiyat yaratır.

## 5. Gölgelendirme Prensipleri (Shadow System)

Zemin açık (krem, beyaz) olduğu için 3D derinlik vizyonu gölgelerle verilir. Asla simsiyah ve mat / keskin gölge atılmamalıdır:

*   **Ağır Kart Gölgesi (Örn: Premium Pass):**
    ```javascript
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 15, elevation: 5
    ```
*   **Hafif Obje Gölgesi (Örn: Log / List Items):**
    ```javascript
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1
    ```
*   **Renkli Obje Gölgesi (Örn: Zeytin Yeşili Buton):** Özel olarak kendi renginde ince bir shadow atılır:
    ```javascript
    shadowColor: '#648754', shadowOpacity: 0.3, elevation: 8
    ```

## 6. Layout ve Padding (Sayfa Düzeni)

*   **SafeAreaView:** Telefon cihaz çentiklerini, saati ve şarj barını koruyan kök kapsayıcı daima `flex: 1`, `backgroundColor: '#F5F5F7'` olmak zorundadır. Android Çentik (Notch) koruması için `paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0` kuralı esastır.
*   **Boyut (ScrollView) Padding Ayarları:** Alt menü ekranın dışına çıkarak süzülen (floating) yapıda DEĞİLDİR, doğal bir şekilde (native) ekran zemininde başlar. Liste ve ScrollView elemanlarının içerik genel padding'i standart `20` birimdir. Fakat listenin sonuna gelindiğinde menü ile listenin son elemanı arasına nefes payı açmak için `paddingBottom: 40` (veya daha fazlası) verilmesi her zaman Premium hissiyatını güçlendirir.

---
*(Not: AI destekli tüm yeni kod türetim süreçlerinde önce bu dosyaya bakılarak komponent ve sayfalar tasarlanmalı ve "Hybrid Botanical Clean UI" stil zinciri asla koparılmamalıdır!)*
