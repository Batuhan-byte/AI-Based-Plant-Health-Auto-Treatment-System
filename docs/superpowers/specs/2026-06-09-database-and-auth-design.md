# Tasarım Dokümanı: İlişkisel Veri Tabanı ve Kimlik Doğrulama Entegrasyonu

Bu doküman, bitirme projesi kapsamında veri tabanının ilişkisel (relational) yapıya kavuşturulması, şifre güvenliğinin sağlanması ve mobil uygulamaya Giriş/Kayıt/Misafir döngülerinin eklenmesi süreçlerini tanımlar.

---

## 1. Veri Tabanı Mimarisi (PostgreSQL)

Mevcut tek tabloluk `diagnoses` yapısı normalizasyon kurallarına uygun olarak 4 ilişkisel tabloya bölünmüştür.

### Veri Tabanı Tablo Yapıları (DDL)

```sql
-- 1. Kullanıcılar Tablosu
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(100) NULL,
    email VARCHAR(100) UNIQUE NULL,
    password_hash VARCHAR(255) NULL,
    user_type VARCHAR(20) DEFAULT 'guest', -- 'guest' or 'registered'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bitki Türleri Tablosu
CREATE TABLE IF NOT EXISTS plants (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,
    name_tr VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL
);

-- 3. Hastalıklar ve Tedaviler Tablosu
CREATE TABLE IF NOT EXISTS diseases (
    id SERIAL PRIMARY KEY,
    plant_id INT REFERENCES plants(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    name_tr VARCHAR(150) NOT NULL,
    name_en VARCHAR(150) NOT NULL,
    treatment_recommendation TEXT NOT NULL,
    UNIQUE (plant_id, key)
);

-- 4. Teşhisler Tablosu (Geçmiş)
CREATE TABLE IF NOT EXISTS diagnoses (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    yaprak_guven NUMERIC,
    plant_id INT REFERENCES plants(id),
    bitki_guven NUMERIC,
    disease_id INT REFERENCES diseases(id),
    hastalik_guven NUMERIC,
    hastalik_durum VARCHAR(50),
    resim_yolu VARCHAR(255),
    tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Otomatik Veri Yükleme (Database Seeding)

Uygulama başladığında `dbInit.js` dosyasında `plants` ve `diseases` tabloları kontrol edilecek ve eğer boşlarsa aşağıdaki veriler otomatik olarak yerleştirilecektir (Seeding):
- 9 adet bitki türü (`apple`, `cherry`, `corn`, `grape`, `peach`, `potato`, `strawberry`, `tomato`, `bell_pepper`).
- Her bitkiye ait `Healthy` (Sağlıklı) kaydı ve diğer tüm hastalık tanımları ile Türkçe tedavi önerisi açıklamaları.

---

## 2. API ve Backend Kontratları

### A. Auth Servisleri

#### 1. Kayıt Ol (`POST /api/auth/register`)
- **İstek Gövdesi:**
  ```json
  {
    "name": "Batuhan",
    "email": "batuhan@example.com",
    "password": "securepassword123"
  }
  ```
- **Yanıt Gövdesi (201):**
  ```json
  {
    "basarili": true,
    "user": {
      "id": 5,
      "uuid": "d3b07384-d113-4ec6-a573-04e4a7732a39",
      "name": "Batuhan",
      "email": "batuhan@example.com",
      "user_type": "registered"
    }
  }
  ```

#### 2. Giriş Yap (`POST /api/auth/login`)
- **İstek Gövdesi:**
  ```json
  {
    "email": "batuhan@example.com",
    "password": "securepassword123"
  }
  ```
- **Yanıt Gövdesi (200):**
  ```json
  {
    "basarili": true,
    "user": {
      "id": 5,
      "uuid": "d3b07384-d113-4ec6-a573-04e4a7732a39",
      "name": "Batuhan",
      "email": "batuhan@example.com",
      "user_type": "registered"
    }
  }
  ```

#### 3. Misafir Girişi (`POST /api/auth/guest`)
- **İstek Gövdesi:**
  ```json
  {
    "deviceUuid": "c3938ba1-8b27-4632-9df3-10826477e923"
  }
  ```
- **Yanıt Gövdesi (200):**
  ```json
  {
    "basarili": true,
    "user": {
      "id": 12,
      "uuid": "c3938ba1-8b27-4632-9df3-10826477e923",
      "name": "Misafir",
      "email": null,
      "user_type": "guest"
    }
  }
  ```

#### 4. Hesabı Yükselt (`POST /api/auth/upgrade`)
- **İstek Gövdesi:**
  ```json
  {
    "deviceUuid": "c3938ba1-8b27-4632-9df3-10826477e923",
    "name": "Batuhan",
    "email": "batuhan@example.com",
    "password": "newsecurepassword123"
  }
  ```
- **Yanıt Gövdesi (200):**
  ```json
  {
    "basarili": true,
    "user": {
      "id": 12,
      "uuid": "c3938ba1-8b27-4632-9df3-10826477e923",
      "name": "Batuhan",
      "email": "batuhan@example.com",
      "user_type": "registered"
    }
  }
  ```

---

### B. Güncellenen Servisler

#### 1. Teşhis Analizi (`POST /api/diagnose`)
- İstek başlığına (Header) `X-User-UUID` parametresi eklenir.
- Gelen UUID ile veri tabanındaki `user_id` bulunur.
- Python AI Pipeline'dan gelen ham anahtarlar (`plant_key` ve `disease_key`) veri tabanından `plant_id` ve `disease_id` ile eşleştirilerek `diagnoses` tablosuna ilişkisel olarak yazılır.

#### 2. Teşhis Geçmişi (`GET /api/history`)
- İstek: `/api/history?uuid=KULLANICI_UUID`
- Arka planda `diagnoses`, `users`, `plants` ve `diseases` tabloları SQL `JOIN` sorgusuyla birleştirilerek, mobil uygulamanın mevcut veri formatı bozulmadan tüm Türkçe metinler, doğruluk oranları ve tedavi önerileri ile birlikte liste halinde dönülür.

---

## 3. Python AI Pipeline Temizliği (`predict_pipeline.py`)

Python dosyası içerisindeki veri tabanını ilgilendiren Türkçe çeviri sözlükleri (`BITKI_TR` ve `HASTALIK_TR`) temizlenecektir. Yapay zeka katmanı sadece ham model etiket çıktılarını (İngilizce anahtarları) Node.js sunucusuna dönecektir. Çeviriler ve tedavi metinleri tamamen PostgreSQL veri tabanından Node.js tarafında çözümlenecektir.

---

## 4. Mobil Uygulama Akışları ve Arayüzü

### A. Giriş & Kayıt Ekranı (`LoginScreen.js`)
- Mobil uygulama açıldığında eğer aktif bir kullanıcı veya misafir session'ı yoksa bu ekran gelir.
- Giriş sekmesinde "Beni Hatırla" seçeneği işaretlenirse, girilen `email` ve `password` yerel hafızaya (`AsyncStorage`) kaydedilir ve bir sonraki açılışta bu alanlar otomatik doldurulmuş olarak gösterilir.
- "Misafir Olarak Devam Et" seçilirse cihaz için rastgele bir UUID üretilir ve backend'e misafir kaydı için istek atılır.

### B. Misafirlikten Kayıtlı Üyeliğe Geçiş
- MenuScreen (Ayarlar/Profil) ekranında misafir kullanıcıya özel hesap yükseltme banner'ı gösterilir.
- Kullanıcı formu doldurup kaydolduğunda arka planda `/api/auth/upgrade` isteği tetiklenir, misafir kaydı normal hesaba dönüştürülür ve kullanıcının geçmiş teşhisleri korunmuş olur.
