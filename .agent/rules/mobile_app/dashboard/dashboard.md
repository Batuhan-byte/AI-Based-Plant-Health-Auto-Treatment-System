---
description: Dashboard (Ana Sayfa) Tasarım ve Geliştirme Kuralları
globs: |
  mobile_app/src/screens/MyPlantsScreen.js
  mobile_app/src/components/myplants/**/*.js
  mobile_app/src/hooks/useWeather.js
  mobile_app/src/hooks/useSwipeModal.js
  mobile_app/src/styles/myPlantsStyles.js
---
# Dashboard (VerdantAI Ana Ekranı) Tasarım & Mimari Kuralları

Bu belge, uygulamanın kalbi olan **VerdantAI Dashboard** (MyPlantsScreen) ekranının mimari ve tasarım kurallarını içerir. Bu dosyada yer alan yönergeler, kök tasarım dokümanı olan `ui-design.md` dosyasındaki *Hybrid Botanical Clean UI* felsefesine dayanarak üretilmiş özelleştirilmiş bir **Alt-Kural (Sub-Rulebook)** setidir.

---

## 📁 Dosya Mimarisi (Bölünmüş Yapı)

Bu ekran, bakım kolaylığı için birden fazla dosyaya ayrılmıştır. Her dosya **tek bir sorumluluğa** sahiptir:

```
mobile_app/src/
├── screens/
│   └── MyPlantsScreen.js          ← Ana ekran iskeleti (~230 satır)
│                                     Sadece state, veri çekme ve layout.
│                                     Hiçbir karmaşık mantık içermez.
├── components/
│   └── myplants/
│       ├── ActionIcon.js           ← Yuvarlak hızlı aksiyon butonu
│       ├── PlantItem.js            ← Bitki listesi satır kartı
│       ├── DiagnosisDetailModal.js ← Teşhis detayı bottom-sheet modali
│       └── DonationModal.js        ← Fidan bağışı bottom-sheet modali
├── hooks/
│   ├── useWeather.js               ← GPS + Open-Meteo hava durumu hook'u
│   └── useSwipeModal.js            ← PanResponder + Animated modal hook'u
└── styles/
    └── myPlantsStyles.js           ← getDynamicStyles (tüm stiller)
```

> [!IMPORTANT]
> **Bu yapıya kesinlikle uyulmalıdır!** Yeni özellik eklerken doğru dosyaya ekleme yapılmalıdır. Örneğin; stil eklenecekse `myPlantsStyles.js`'e, modal mantığı eklenecekse ilgili modal dosyasına gidilmelidir. `MyPlantsScreen.js` içine mantık/stil karıştırılmamalıdır.

---

## 1. Sayfa Başlığı ve Karşılama (Header)

*   Sayfanın en üstünde **VerdantAI** markası, yaprak ikonu ile birlikte yer alır.
*   **Tipografi:** `fontSize: 28`, `fontWeight: '800'`, `letterSpacing: -0.8`
*   **"AI" kısmı** `#2ECC71` (yeşil) renkte ve `textShadowRadius: 8` ile parıldayan glow efektiyle ayrışır.
*   **Sağ üstte iki ikon:**
    1. Karanlık/Aydınlık tema tetikleyicisi (`weather-night` / `weather-sunny`)
    2. Bildirim zili (`bell-ring-outline`) + `colors.accent` renginde köşe badge'i

---

## 2. Dinamik Hava Durumu Galerisi (Weather Carousel)

> [!NOTE]
> Tüm hava durumu mantığı **`useWeather` hook'una** taşınmıştır. Ana ekran yalnızca `const { weather, city } = useWeather();` çağırır.

### A. Fiziksel Genişlik ve Kilitleme Motoru (Paging Geometrisi)
*   **Sabitler `myPlantsStyles.js`'de tanımlıdır ve oradan export edilir:**
    ```js
    export const CARD_WIDTH = screenWidth - 40;
    export const GAP = 16;
    export const SCROLL_WIDTH = CARD_WIDTH + GAP;
    ```
*   `MyPlantsScreen.js` bu sabitleri `import { SCROLL_WIDTH, GAP } from '../styles/myPlantsStyles'` ile alır.

### B. Video Arka Plan ve Z-Index Mimarisi
*   Hava durumuna göre yerel `.mp4` video asset'leri kullanılır — `WEATHER_VIDEOS` haritası `useWeather.js` içinde tanımlıdır.
*   Katman sırası: Video → Siyah overlay (`rgba(0,0,0,0.3)`) → Metin içeriği (`zIndex: 2`)

### C. Android Gölge Siyahlığı Kuralı
*   Ana kartlarda (`styles.card`) **`overflow: 'hidden'` veya `elevation` BULUNMAZ.**
*   Video taşmasını önlemek için videolara özel `borderRadius: 24` verilir.

---

## 3. Hızlı Aksiyon Menüleri (Botanic Action Icons)

*   `ActionIcon` bileşeni (`components/myplants/ActionIcon.js`) kullanılır.
*   4 adet aksiyon: Fidan Bağışı 🌲, Akıllı Sulama 💧, Bitki Rehberi 📖, AI Botanist 🤖
*   Geometri: `60x60` tam daire (`borderRadius: 30`)
*   Her butona ait renk ve bg değerleri `MyPlantsScreen.js` içinde inline verilir.

---

## 4. Kullanıcı Geçmiş Serisi (Kayıtlı Bitkilerim)

*   `PlantItem` bileşeni (`components/myplants/PlantItem.js`) kullanılır.
*   Veritabanından geçmiş `useFocusEffect` + `useCallback` ile çekilir.
*   En fazla **5 kayıt** gösterilir; "Tümünü Gör" butonu `Logs` ekranına yönlendirir.

---

## 5. Modallar (Bottom-Sheet)

### Teşhis Detayı — `DiagnosisDetailModal.js`
*   Props: `visible`, `selectedItem`, `onClose`, `onDelete`, `styles`, `colors`
*   `useSwipeModal` hook'u ile sürükleyerek kapatma desteklenir.

### Fidan Bağışı — `DonationModal.js`
*   Props: `visible`, `onClose`, `styles`, `colors`
*   Kendi iç state'lerini yönetir (form alanları, `saplingCount`, `donationSuccess`)
*   `useSwipeModal` hook'u ile sürükleyerek kapatma desteklenir.
*   Birim fiyat **50 TL / fidan** — sabit.

---

## 6. useSwipeModal Hook Kuralları

`hooks/useSwipeModal.js` bileşeni şu değerleri döndürür:

| Değer | Açıklama |
|---|---|
| `panY` | Animated.Value — modal pozisyonu |
| `swipePanResponder` | PanResponder — drag handle'a bağlanır |
| `closeModal()` | Animasyonlu kapanma + `onClose` callback |
| `handleScrollEnd(e)` | ScrollView'ın `onScrollEndDrag`'ına bağlanır |
| `animatedStyle` | Animated.View'e uygulanacak transform |

> [!WARNING]
> `swipePanResponder` sadece `dragHandleWrapper` View'ine uygulanmalıdır (`{...swipePanResponder.panHandlers}`). Modal içindeki ScrollView veya TextInput'lara uygulanmamalıdır; aksi hâlde form tıklamaları ile çakışma yaşanır.

---

## 7. Stil Kuralları

*   **Tüm stiller** `styles/myPlantsStyles.js` içindeki `getDynamicStyles(colors)` fonksiyonundadır.
*   Bileşenler `styles` prop'u ile bu stili alır. Bileşen içinde inline `StyleSheet.create` **yapılmaz**.
*   `colors` her zaman `Colors.dark` veya `Colors.light` (src/theme/colors.js) nesnesidir.
