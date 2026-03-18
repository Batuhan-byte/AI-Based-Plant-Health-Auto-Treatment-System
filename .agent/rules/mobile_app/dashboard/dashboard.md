---
description: Dashboard (Ana Sayfa) Tasarım ve Geliştirme Kuralları
globs: mobile_app/src/screens/MyPlantsScreen.js
---
# Dashboard (Ana Sayfa) Tasarım Kuralları

Bu belge, uygulamanın kalbi olan "My Antigravtye Botanics" (Ana Ekran / Dashboard) sayfasının mimari ve tasarım kurallarını içerir. Bu dosyada yer alan yönergeler, uygulamanın kök tasarım dokümanı olan `ui-design.md` dosyasındaki *Hybrid Botanical Clean UI* felsefesine dayanarak üretilmiş özelleştirilmiş bir **Alt-Kural (Sub-Rulebook)** setidir.

## 1. Sayfa Başlığı ve Karşılama (Header)

*   Sayfanın en üstünde kullanıcıyı karşılayan ana başlık (`My Antigravtye Botanics`) hizalanır.
*   **Tipografi:** `fontSize: 24`, `fontWeight: 'bold'`, ve derli toplu durması için `letterSpacing: -0.5` kullanılır.
*   **İkonografik Zenginlik:** Sağ üst alanda her zaman kullanıcı erişimi için iki ikon bulunur:
    1.  Karanlık/Aydınlık Tema Tetikleyicisi (`weather-night` / `weather-sunny`)
    2.  Bildirim Zili (`bell-ring-outline`). Eğer varsa yeni bildirimi simgelemek adına zıt renkli (`colors.accent` yeşili) bir köşe noktası (Badge) bu zilin üzerinde olmalıdır.

## 2. Dinamik Hava Durumu Galerisi (Weather Carousel)

Dashboard'un en görünür parçası olan Kaydırmalı Bilgi Kartları (Carousel), matematiksel UX kuralları içerir:

### A. Fiziksel Genişlik ve Kilitleme Motoru (Paging Geometrisi)
*   **Premium Kenar Boşlukları:** Kartlar ekranı uçtan uca tamamen kaplamaz. Ferah bir his yaratmak için kenarlardan boşluk verilir. Hesaplama sabittir: Genişlik olarak ekranın tamamından `40` birim düşülür (`CARD_WIDTH = screenWidth - 40`).
*   **Sekme Boşluğu (GAP):** Kartlar arası görsel mesafe tam olarak `16` birimdir.
*   **Zank Diye Kilitleme (Snap Effect):** Yatay olarak sayfa sayfa (PagingEnabled) kayarken, her bir kartın tam ortaya kusursuzca oturması için kaydırma genişlik matrisi `SCROLL_WIDTH = CARD_WIDTH + GAP` formülüyle sistem motoruna (`onScroll` ve `ScrollView width`) aktarılır.

### B. Video Arka Plan ve Z-Index Mimarisi
*   Arka plana internet URL'si tabanlı statik veya gecikmeli fotoğraf basılmaz! Uygulama hafızasına yerleşik `.mp4` formatındaki lüks hava durumu videoları (`expo-av` kütüphanesiyle) örtülür.
*   Videolar sessiz (`isMuted: true`) ve sonsuz pürüzsüz döngü (`isLooping: true`) modunda rendering'e sokulur.
*   **Z-Index Yönetimi Sıkı Kurallara Bağlıdır:**
    *   *Katman 0:* Zeminde Video Katmanı.
    *   *Katman 1:* Ortada `backgroundColor: 'rgba(0,0,0,0.3)'` oranında siyah şeffaf karartma örtüsü.
    *   *Katman 2:* En üstte `zIndex: 2` hiyerarşisiyle beyazlatılmış canlı hava durumu derecesi ve tipografileri.

### C. Android Gölge Siyahlığı Kuralı (Kritik Hata Çözümü)
*   Android'in `elevation` gölge hesabı, `borderRadius` ile çakıştığında köşelerde siyah çamur hatası (dark corner artifact) yaratır.
*   Bu hatayı sonsuza dek engellemek için, ana kartlarda (`styles.card`) **kesinlikle `overflow: 'hidden'` veya Android'e has `elevation` eklentileri (Örn: `elevation: 6`) BULUNMAZ.** Android'de gölgelendirme `elevation: 0` yapılarak sıfırlanır.
*   Yalnızca iOS kullanıcıları için belli belirsiz fışkıran çok hafif bir kavis gölgesi (`shadowOpacity: 0.06`, `shadowRadius: 10`) bırakılır. Geri kalan platformlarda objeler arka plan renginin oluşturduğu zıtlıkla ayrışır.
*   Video dışkılarının köşeden taşmasını engellemek için videoların sadece kendisine özel kavis (`borderRadius: 24`) verilir.

## 3. Hızlı Aksiyon Menüleri (Botanic Action Icons)

Kullanıcının sulama, vizyona sokma veya analiz yapma gibi işlemleri için konumlandırılan yuvarlak aksiyon butonları:
*   Yatay hizada mükemmel dağıtım için her biri `%23` genişlik alan `justifyContent: 'space-between'` ile kontrol edilir.
*   **Geometri:** Tam daire şekline sahiptirler (Genişlik: 60, Yükseklik: 60, `borderRadius: 30`).
*   **Pastel Renk Kodu Senkronizasyonu:** Bu balonların arkaplan renkleri ve içindeki simgelerin kontrast renkleri doğrudan `colors.js` modülündeki `iconWaterBg`, `iconWaterColor` gibi tema bazlı pastoral doğa dizilimlerinden zorunlu olarak beslenmelidir.
*   **Açıklama Etiketleri:** İkonların hemen altına konulan rehber metinler en fazla çift satıra çıkabilir (`numberOfLines={2}`), boyutları `fontSize: 12`, yapıları sıkı (`lineHeight: 16`, `fontWeight: '600'`) dır.

## 4. Kullanıcı Geçmiş Serisi (Recent Garden Log)

Sistemin en altında kullanıcının bitkisi ile ilgili loglarının işlendiği modern liste kutuları yer alır:
*   Alt başlık (Sub-header / "Recent Garden Log") kısmı `fontSize: 20` ve koyu. Yanındaki yönlendirici "See all" tuşu `colors.accent` kullanılarak `fontSize: 14` boyutundadır.
*   **Log Satır Kutusu:** Satır etrafında kocaman sivri köşeler yer almaz. Kartlar beyazdır (Veya Dark Mode grisi), köşe kavisi `borderRadius: 20` değerindedir ve derinlik için tüy kadar hafif bir ayar (`shadowOpacity: 0.04`) kullanılır.
*   **İkon Kutusu:** Log'un başlığını belirten en soldaki ikon çerçevesi `50x50` birim boyutlarında, iç yapısı nispeten köşeli bir kavis (`borderRadius: 14`) barındırır.
*   **Metin Düzeni:** Fiyatlandırma veya kritik kredi durumu listenin sağında `fontSize: 16`, `fontWeight: 'bold'` olarak kesin biçimde öne çıkmalıdır. Alt açıklamalar (Subtitle) daima muted (Kısık gri) ve `13px` ebatlarındadır.
