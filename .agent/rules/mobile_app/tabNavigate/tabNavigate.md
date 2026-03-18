---
description: Alt Menü (Bottom Tab Navigation) Tasarım Kuralları
globs: mobile_app/src/navigation/**/*.js
---
# TabNavigator (Alt Menü) Tasarım ve Geliştirme Kuralları

Bu belge, "My Antigravtye Botanics" isimli uygulamanın alt sekme menüsünün (Bottom Tab Bar) tasarım prensiplerini içerir. Expo ve Tailwind arasındaki derleme sorunlarından tamamen kaçınmak amacıyla, bu menü bileşeni zorunlu olarak **StyleSheet** kullanılarak (saf React Native stili ile) yönetilir.

## 1. Genel Yapı (Floating Pill Shape)

Alt menü, ekranın en altına yapışık olmak yerine ekranın hafif üzerinde süzülen (floating) hap şeklinde (pill shape) bir tasarıma sahiptir:
*   **Arka Plan Rengi:** `#FFFFFF` (Tam beyaz arka plan)
*   **Pozisyonlandırma:** `position: 'absolute'`, `bottom: 25`, `left: 20`, `right: 20`
*   **Köşe Yuvarlatma:** `borderRadius: 40`
*   **Yükseklik:** `height: 75`
*   **Gölge (Shadow):** Hafif ve zarif bir gri/siyah gölge (`shadowOpacity: 0.1`, `elevation: 10`) kullanılmalıdır.
*   **İkonlar:** Menü altındaki kısa yol yazıları iptal edilmiştir (`tabBarShowLabel: false`). Sadece merkezî ikonlar bulunur.

## 2. İkon Renkleri ve Etkileşimler (Icons & Colors)

Menü içerisinde en fazla 5 adet sekme (tab) yerleşimi yapılır. Dört standart ikon, bir de merkeze oturan aksiyon butonu mevcuttur.

*   **Aktif (Seçili) İkon Rengi:** `#648754` (Zeytin Yeşili - Temanın birincil ana rengi)
*   **Pasif (Seçilmemiş) İkon Rengi:** `#CFCFCF` (Açık Gri - Dengeleyici nötr renk)
*   **Görsel Büyüklük:** Çoğu ikon için varsayılan büyüklük ortalama `28-30px` arasındadır. İkon setinden **MaterialCommunityIcons** ağırlıklı olarak tercih edilmiştir.

### Sekme Dağılımı ve İkon İsimleri:
1.  **Ana Sayfa (MyPlants):** `home-variant`
2.  **İstatistikler (Stats):** `chart-bar`
3.  **Taram/Kamera / Action (Center):** Merkez Buton
4.  **Loglar / Dokümanlar:** `file-document-outline`
5.  **Profil / Kullanıcı:** `account-outline`

## 3. Merkez Aksiyon Butonu (Center Sprout Action)

Ortadaki (3. sıradaki) menü ikonu, diğerlerinden farklı ve daha dikkat çekici (Call to Action) olarak tasarlanmıştır. `Tab.Screen` bileşeni özellikleri içinde özel bir `tabBarButton` bileşeni (`CustomTabBarButton`) kullanılarak inşa edilir:

*   **Yukarı Kaydırma:** Buton genel tab bardan hafifçe yukarı taşar. (`top: -15` pozisyonlandırması yapılır).
*   **Kürenin Boyutları:** `width: 66`, `height: 66`, tam oval yuvarlatma (`borderRadius: 33`).
*   **Kürenin Rengi:** `#648754` (Solid zeytin yeşili arka plan).
*   **Küre Gölgesi (Shadow):** Yukarı taşıp dikkat çekebilmesi için zeytin yeşiline uygun (`shadowColor: '#648754'`, `shadowOpacity: 0.3`, `elevation: 8`) kendi gölgeleme yapısına sahiptir.
*   **İkon:** İçerisindeki ikon, dış rengi beyaz (`#FFFFFF`) olacak şekilde büyük ebatlı olan `MaterialCommunityIcons` -> `sprout` simgesidir.

## 4. Kod Düzeni (Rule of Implementation)

Bu dosyaya yeni bir özellik veya sekme eklerken:
- `tabBarShowLabel: true` yapılmayacaktır. Tasarım minimalist ikon odaklıdır.
- Menü eklentileri (örneğin ek bildirim baloncukları / badge) eklenecekse, bu durum React Navigation'ın standart `options={{ tabBarBadge: 3 }}` gibi özellikleriyle ele alınmalı ancak renkleri `#648754` veya uygulama temasına uygun kiremit/uyarı kırmızısı (`#E74C3C`) olmalıdır.
- Tailwind / `className` yapısı bu navigasyon içerisinde gölgeleri ve esneklik kurallarını bozabileceği veya tam yansıtmayacağı için kesinlikle karıştırılmamalı, doğrudan en alttaki `const styles = StyleSheet.create({})` düzenlenerek ilerlenmelidir.
