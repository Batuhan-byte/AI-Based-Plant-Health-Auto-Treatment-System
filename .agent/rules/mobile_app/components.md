---
description: VerdantAI Mobil Uygulaması — Bileşen Mimarisi ve Bileşen Yazım Kuralları
globs: mobile_app/src/components/**/*.js
---
# Bileşen (Component) Yazım Kuralları (src/components/)

Bu belge, `mobile_app/src/components/` dizinindeki tekrar kullanılabilir React Native bileşenlerinin mimari standartlarını tanımlar.

---

## Klasör Yapısı

Bileşenler, ait oldukları ekrana göre alt klasörlere ayrılır:

```
src/components/
└── myplants/                        ← VerdantAI Dashboard bileşenleri
    ├── ActionIcon.js
    ├── PlantItem.js
    ├── DiagnosisDetailModal.js
    └── DonationModal.js
```

Yeni bir ekran için bileşenler eklenecekse ilgili ekranın adında yeni bir alt klasör açılır. (Örn: `src/components/camera/`)

---

## Genel Bileşen Yazım Standartları

*   Her bileşen dosyası **tek bir bileşen** içerir ve o bileşeni `export default` ile dışa aktarır.
*   Bileşenler **pure/presentational** olmalıdır — mümkün olduğunca state içermemelidir. State gerekliyse hook'lara taşınmalıdır.
*   Her bileşenin başına JSDoc formatında açıklama ve `@param` açıklamaları yazılmalıdır.
*   Bileşenler `styles` ve `colors` prop'ları üzerinden tema alır — **kendi içinde `StyleSheet.create` yapmamalıdır.** Tüm stiller merkezi olarak ilgili `styles/*.js` dosyasından gelir.

---

## `myplants/` Bileşenleri

### `ActionIcon.js`
Dashboard'daki 4 yuvarlak hızlı aksiyon butonundan birini render eder.

```jsx
<ActionIcon
    icon="tree"
    color="#2ECC71"
    bg="rgba(46, 204, 113, 0.1)"
    label={"Fidan\nBağışı"}
    styles={styles}
    onPress={() => setDonationVisible(true)}
/>
```

| Prop | Tip | Açıklama |
|---|---|---|
| `icon` | `string` | MaterialCommunityIcons adı |
| `color` | `string` | İkon rengi |
| `bg` | `string` | Daire arka plan rengi |
| `label` | `string` | Buton altı metin (maks 2 satır) |
| `styles` | `object` | getDynamicStyles(colors) çıktısı |
| `onPress` | `() => void` | Dokunma callback'i |

---

### `PlantItem.js`
Kayıtlı bitkiler listesindeki her bir satır kartını render eder. "Stacked Photo" efekti içerir.

```jsx
<PlantItem
    name="Domates"
    status="Sağlıklı (Bakım gerekmiyor)"
    imageUrl="http://..."
    needs={[]}
    styles={styles}
    colors={colors}
    onPress={() => { setSelectedItem(item); setModalVisible(true); }}
/>
```

| Prop | Tip | Açıklama |
|---|---|---|
| `name` | `string` | Bitki türü adı (Türkçe) |
| `status` | `string` | Sağlık durumu açıklaması |
| `imageUrl` | `string` | Tam URL |
| `needs` | `string[]` | `'water'`, `'fertilizer'` veya `[]` |
| `styles` | `object` | getDynamicStyles(colors) çıktısı |
| `colors` | `object` | Colors.dark veya Colors.light |
| `onPress` | `() => void` | Kart tıklandığında çağrılır |

---

### `DiagnosisDetailModal.js`
Seçili teşhis kaydının detaylarını bottom-sheet modal olarak gösterir.
`useSwipeModal` hook'unu kullanır; sürükleyerek kapatma desteklenir.

```jsx
<DiagnosisDetailModal
    visible={modalVisible}
    selectedItem={selectedItem}
    onClose={() => { setModalVisible(false); setSelectedItem(null); }}
    onDelete={handleDelete}
    styles={styles}
    colors={colors}
/>
```

| Prop | Tip | Açıklama |
|---|---|---|
| `visible` | `boolean` | Modal görünürlüğü |
| `selectedItem` | `object \| null` | Teşhis kaydı nesnesi |
| `onClose` | `() => void` | Kapatma callback'i |
| `onDelete` | `(id: number) => void` | Silme callback'i |
| `styles` | `object` | getDynamicStyles(colors) çıktısı |
| `colors` | `object` | Colors.dark veya Colors.light |

---

### `DonationModal.js`
Fidan bağışı formu, dinamik fiyatlandırma ve dijital sertifika ekranını içeren bottom-sheet modal.
Kendi form state'lerini **kendi içinde** yönetir.
`useSwipeModal` hook'unu kullanır; sürükleyerek kapatma desteklenir.

```jsx
<DonationModal
    visible={donationVisible}
    onClose={() => setDonationVisible(false)}
    styles={styles}
    colors={colors}
/>
```

| Prop | Tip | Açıklama |
|---|---|---|
| `visible` | `boolean` | Modal görünürlüğü |
| `onClose` | `() => void` | Kapatma callback'i |
| `styles` | `object` | getDynamicStyles(colors) çıktısı |
| `colors` | `object` | Colors.dark veya Colors.light |

> [!NOTE]
> Fidan birim fiyatı **50 TL** sabit olarak `DonationModal.js` içinde tanımlıdır.
> Fiyat değiştirilmek istenirse yalnızca bu dosyada `50` sabiti güncellenir.
