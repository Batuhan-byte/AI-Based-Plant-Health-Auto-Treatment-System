---
description: VerdantAI Mobil Uygulaması — Hooks ve Yeniden Kullanılabilir Servisler
globs: mobile_app/src/hooks/**/*.js
---
# Custom Hook Kuralları (src/hooks/)

Bu belge, `mobile_app/src/hooks/` dizinindeki custom React hook'larının yazım standartlarını ve mevcut hook'ların kullanım kılavuzunu içerir.

---

## Genel Hook Yazım Standartları

*   Her hook dosyası **tek bir sorumluluğa** sahip olmalıdır.
*   Hook adları `use` önekiyle başlamalıdır (`useWeather`, `useSwipeModal` gibi).
*   Hook'lar saf fonksiyon olmalıdır — side effect'ler `useEffect` / `useCallback` içinde yönetilir.
*   Her hook'un başında JSDoc formatında açıklayıcı yorum bulunmalıdır.
*   Hook'lar `export function` ile export edilir (default export kullanılmaz).

---

## Mevcut Hook'lar

### `useWeather.js`
**Amaç:** Kullanıcının anlık GPS konumuna göre hava durumu ve şehir/ilçe bilgisi sağlar.

```js
import { useWeather } from '../hooks/useWeather';
const { weather, city } = useWeather();
```

**Döndürdüğü değerler:**

| Değer | Tip | Açıklama |
|---|---|---|
| `weather` | `object \| null` | Hava verisi (temp, icon, videoUrl, description) |
| `city` | `string` | İl, İlçe formatında konum adı |

**Dahili Bağımlılıklar:** `expo-location`, `open-meteo.com` REST API, `../../assets/videos/*.mp4`

> [!NOTE]
> `WEATHER_VIDEOS` haritası bu hook içinde tanımlanmıştır. Dışarıdan erişilemez.

---

### `useSwipeModal.js`
**Amaç:** Bottom-sheet modalları için `PanResponder` + `Animated` tabanlı akıcı sürükleme jesti ve animasyon sağlar. Hem Teşhis Detayı hem de Bağış modali için kullanılır.

```js
import { useSwipeModal } from '../hooks/useSwipeModal';
const { swipePanResponder, closeModal, handleScrollEnd, animatedStyle } = useSwipeModal(onClose);
```

**Parametreler:**

| Parametre | Tip | Açıklama |
|---|---|---|
| `onClose` | `() => void` | Modal kapandığında çağrılacak callback |

**Döndürdüğü değerler:**

| Değer | Tip | Açıklama |
|---|---|---|
| `panY` | `Animated.Value` | Modal Y pozisyon animasyonu |
| `swipePanResponder` | `object` | `dragHandleWrapper`'a bağlanacak handlers |
| `closeModal()` | `() => void` | Programatik animasyonlu kapatma |
| `handleScrollEnd(e)` | `(e) => void` | ScrollView `onScrollEndDrag`'a bağlanır |
| `animatedStyle` | `object` | `Animated.View`'e uygulanacak transform |

**Animasyon Davranışı:**
- Sürükleme mesafesi > 120 birim **veya** hız > 1.5 → modal kapanır
- Bunun altında → `Animated.spring` ile yaylanarak geri döner
- `onScrollEndDrag` ile sayfanın en üstünde yukarı çekilince kapanır (contentOffset.y < -40)

> [!WARNING]
> `swipePanResponder.panHandlers` yalnızca `dragHandleWrapper` View'ine bağlanmalıdır.
> TextInput veya ScrollView içine bağlanırsa klavye ve kaydırma olayları engellenir!

---

## Yeni Hook Ekleme Kuralları

Yeni bir hook eklenirken:
1. `src/hooks/yeniHookAdi.js` dosyası oluşturulur
2. Bu kurala (`hooks.md`) yeni hook dokümantasyonu eklenir
3. İlgili ekran/bileşen kuralına (`dashboard.md` gibi) kullanım bilgisi eklenir
