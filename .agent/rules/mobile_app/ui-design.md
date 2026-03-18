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

## 2. Renk Paleti (Color Palette - Dark/Light Theme Support)

**DİKKAT:** Uygulamaya *Dark Mod (Karanlık Tema)* desteği eklendiği için artık hiçbir CSS / StyleSheet içerisinde doğrudan `#HEX` renk kodu yazılamaz! Tüm renkler dinamik olarak `useColorScheme` kullanılarak `src/theme/colors.js` dosyasındaki değerlerden beslenmelidir.

### Örnek Kullanım:
```javascript
import { useColorScheme } from 'react-native';
import { Colors } from '../theme/colors';

// Komponent içerisinde:
const isDark = useColorScheme() === 'dark';
const colors = isDark ? Colors.dark : Colors.light;

// backgroundColor: colors.background // gibi kullanılmalıdır.
```

### Zemin ve Metin Renkleri (Modern Foundation)
*   **Ana Arka Plan (Background):** `colors.background` (Aydınlıkta: `#F5F5F7`, Karanlıkta: Deep Dark `#121212`)
*   **Kart Arka Planı (Card Surface):** `colors.card` (Aydınlıkta: `#FFFFFF`, Karanlıkta: `#1C1C1E`)
*   **Birincil Siyah Metin (Text Main):** `colors.textMain` (Aydınlıkta Koyu Füme, Karanlıkta Saf Beyaz)
*   **İkincil / Kısık Metin (Text Muted):** `colors.textMuted` (İki modda da soft gri)
*   **Pasif İkon Grisi:** `colors.navInactive`

### Butonlar ve Vurgu Renkleri (Botanic Accents)
*   **Ana Botanik Vurgu (Primary Accent):** `colors.accent` (Koyu/Orta Zeytin Yeşili - Tüm modlarda aktif ikon ve vurgular)
*   **İkon Arka Planları (Pastel Earth Tones):** Sulama (`iconWaterBg`), Analiz (`iconAnalyzeBg`), Yeni Bitki (`iconNewBg`) ve Duraklatma (`iconPauseBg`) renkleri karanlık modda daha kontrastlı hale gelmek için yine `colors` objesinden çekilmelidir.

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
*   **Tabana Yaslı Alt Menü (Docked Tab Bar):** Sadece üst köşeler kavisli `borderTopLeftRadius: 20`, `borderTopRightRadius: 20` olarak tasarlanır, havada uçan yapıdan kaçınılır. **iOS Özelleştirmesi:** Apple'ın en alt sürükleme çizgisindeki devasa boşluğu engellemek için iOS'ta `height` ve özel `paddingBottom` ile manuel ince (slim) sınırlar çizilir. Ortasındaki Merkez-Aksiyon Butonu ince hatlı barın içinden `-20px` yukarı taşarak 3D bir hissiyat yaratır ve üzerinde `camera-outline` gibi içi boş ince lüks ikonlar barındırır.

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

## 7. Temalar Arası Geçiş Animasyonları (Theme Transitions)

Karanlık ve aydınlık temalar arasında (kullanıcı veya sistem tetiklemeli) geçiş yapılırken JS Frame döngüsünü tıkayan (kasma hissi veren) state ve opacity gecikmeleri (Örn: Animated kütüphanesi) yerine **mutlaka** GPU ivmeli, saf native `LayoutAnimation` modülü (sadece opacity değişimi izlenerek) kullanılacaktır.

```javascript
// Doğru ve kasmayan Crossfade geçiş örneği:
const customAnimation = {
    duration: 400,
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};
LayoutAnimation.configureNext(customAnimation);
// Ardından state güncellenir
```

---
*(Not: AI destekli tüm yeni kod türetim süreçlerinde önce bu dosyaya bakılarak komponent ve sayfalar tasarlanmalı ve "Hybrid Botanical Clean UI" stil zinciri asla koparılmamalıdır!)*
