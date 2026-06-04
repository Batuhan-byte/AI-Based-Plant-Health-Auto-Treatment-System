const fs = require('fs');
const { toDiagnosisResponse } = require('../dto/diagnosisDto');
const path = require('path');
const db = require('../config/db');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');

// Türkçe Tedavi Önerileri Kütüphanesi
const TREATMENT_RECOMMENDATIONS = {
    'Healthy': 'Bitkiniz oldukça sağlıklı görünüyor. Mevcut sulama ve bakım düzenini bozmadan devam edin. Düzenli olarak yaprak altlarını kontrol etmeyi unutmayın.',
    'Apple Scab': 'Elma Karalekesi teşhisi konuldu. Tedavi için:\n1. Enfekte olmuş yaprakları ve dalları budayarak bahçeden uzaklaştırın.\n2. İlkbaharda tomurcuklar açılmadan önce bakır içerikli fungusitler (mantar ilacı) uygulayın.\n3. Sulamayı sabah saatlerinde ve doğrudan köke yapın, yaprakları ıslatmaktan kaçının.',
    'Black Rot': 'Siyah Çürüklük teşhisi konuldu. Tedavi için:\n1. Bulaşık yaprak, sürgün ve meyve salkımlarını hemen budayıp yakın.\n2. Kimyasal mücadele için sistemik fungusitler kullanın.\n3. Bitki çevresindeki hava sirkülasyonunu artırmak için budamayı doğru yapın ve nemli ortamı azaltın.',
    'Cedar Apple Rust': 'Sedir-Elma Pası teşhisi konuldu. Tedavi için:\n1. Yakındaki sedir veya ardıç ağaçlarında oluşan pas urlarını temizleyin.\n2. Yapraklar yeni açılırken koruyucu fungusit uygulaması yapın.\n3. Dirençli bitki çeşitlerini tercih etmeye özen gösterin.',
    'Powdery Mildew': 'Külleme hastalığı tespit edildi. Tedavi için:\n1. Enfekte kısımları hemen budayarak temizleyin.\n2. Kükürt bazlı ilaçlar veya sistemik fungusitler kullanın.\n3. Bitkileri aşırı sık dikmeyin, aralarındaki hava akışını artırın. Sulamayı yapraktan değil kökten yapın.',
    'Cercospora Leaf Spot': 'Cercospora Yaprak Lekesi tespit edildi. Tedavi için:\n1. Bitki kalıntılarını temizleyin ve imha edin.\n2. Nem oranını düşürün, yaprak ıslaklık süresini azaltın.\n3. Kimyasal mücadelede bakırlı ilaçlar veya uygun koruyucu fungusitler kullanın.',
    'Common Rust': 'Pas Hastalığı tespit edildi. Tedavi için:\n1. Pas püstülleri olan yaprakları koparıp imha edin.\n2. Bitkiler arasında yeterli mesafe bırakarak havalandırmayı iyileştirin.\n3. Bakır veya kükürt içerikli fungusitler ile ilaçlama yapın.',
    'Northern Leaf Blight': 'Kuzey Yaprak Yanıklığı tespit edildi. Tedavi için:\n1. Hastalıklı bitki artıklarını tarladan uzaklaştırın.\n2. Gelecek sezon için ekim nöbeti (münavebe) uygulayın.\n3. Şiddetli durumlarda triazol veya strobilurin grubu fungusitler kullanın.',
    'Esca (Black Measles)': 'Esca (Siyah Kızamık) tespit edildi. Tedavi için:\n1. Budama aletlerini her kesimden sonra mutlaka dezenfekte edin.\n2. Budama yaralarını aşı macunu ile kapatın.\n3. Şiddetli enfekte olmuş yaşlı asmaları söküp yakın.',
    'Leaf Blight': 'Yaprak Yanıklığı tespit edildi. Tedavi için:\n1. Enfekte yaprakları budayarak bitkiden uzaklaştırın.\n2. Bakır içerikli mantar ilaçları ile koruyucu ilaçlama yapın.\n3. Yaprakları kuru tutmaya özen gösterin, damlama sulama kullanın.',
    'Bacterial Spot': 'Bakteriyel Leke hastalığı tespit edildi. Tedavi için:\n1. Bakteriyel bir hastalık olduğu için normal mantar ilaçları etki etmez, bakır bazlı bakterisitler kullanın.\n2. Tarım aletlerini sık sık sterilize edin.\n3. Hastalıklı bitki kalıntılarını tarlada bırakmayın.',
    'Early Blight': 'Erken Yanıklık tespit edildi. Tedavi için:\n1. Alt yaprakları budayarak toprakla temasını kesin.\n2. Düzenli olarak dengeli gübreleme yaparak bitki direncini artırın.\n3. Bakırlı ilaçlar veya chlorothalonil içerikli koruyucu ilaçlar uygulayın.',
    'Late Blight': 'Geç Yanıklık (Mildiyö) tespit edildi (ÇOK RİSKLİ!). Tedavi için:\n1. Nemli ve serin havalarda hızla yayılır; sulamayı kesinlikle damlama olarak yapın.\n2. Hastalıklı tüm bitki kısımlarını hemen toplayıp yakın (kompost yapmayın).\n3. Metalaxyl, mancozeb veya bakır içerikli sistemik ilaçlar ile acilen ilaçlama yapın.',
    'Septoria Leaf Spot': 'Septoria Yaprak Lekesi tespit edildi. Tedavi için:\n1. Topraktan bulaşmayı önlemek için malçlama yapın.\n2. Alt yapraklarda lekeler başladığı anda budama yapın.\n3. Bakırlı mantar ilaçları veya koruyucu fungusitler kullanın.',
    'Yellow Leaf Curl Virus': 'Sarı Yaprak Kıvırma Virüsü tespit edildi. Tedavi için:\n1. Virüsü yayan Beyaz Sinek (Bemisia tabaci) ile kimyasal veya biyolojik olarak acilen mücadele edin.\n2. Enfekte edilmiş bitkileri derhal söküp plastik torbalara koyarak tarladan uzaklaştırın.\n3. Seralarda sinek tülleri ve yapışkan sarı tuzaklar kullanın.'
};

/**
 * POST /api/diagnose
 * Fotoğrafı alır, 3 katmanlı AI pipeline'a gönderir, diske resim kaydeder ve DB'ye yazar.
 * Veritabanı kesintisi durumunda Graceful Degradation uygulayarak analiz sonucunu kesintisiz döndürür.
 */
async function diagnose(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({
                basarili: false,
                hata: 'Lütfen bir fotoğraf yükleyin. Form alanı: "image"'
            });
        }

        logger.info(`📸 Fotoğraf alındı: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);
        
        // --- DEBUG: Her gelen orijinal resmi uploads klasörüne geçici olarak kaydet ---
        const debugFilename = `debug_${Date.now()}.jpg`;
        const debugSavePath = path.join(__dirname, '..', '..', 'uploads', debugFilename);
        try {
            await fs.promises.writeFile(debugSavePath, req.file.buffer);
            logger.info(`🔍 DEBUG: Gelen ham görsel uploads klasörüne kaydedildi: ${debugFilename}`);
        } catch (debugErr) {
            logger.error('🔍 DEBUG: Kaydetme hatası', debugErr);
        }
        // ---------------------------------------------------------------------------------

        logger.info('🔄 3 Katmanlı AI Pipeline başlatılıyor...');

        // AI Pipeline'ı çağır (Python Daemon'a HTTP isteği yapar)
        const result = await aiService.predict(req.file.buffer);

        if (!result.basarili) {
            logger.warn(`⚠️ AI Çıkarım Pipeline Başarısız: ${result.hata}`);
            return res.json(result);
        }

        logger.success('✅ Pipeline başarıyla tamamlandı!');
        
        // ─── Veritabanı ve Görsel Kaydetme İşlemleri ───────────────────────
        let filename = null;
        let dbSaved = false;
        let dbId = null;
        let tedaviOnerisi = 'Bitki veya hastalık tam tespit edilemediği için tedavi önerisi oluşturulamadı.';
        
        filename = `img_${Date.now()}_${result.katman2_bitki.tur || 'plant'}.jpg`;
        const savePath = path.join(__dirname, '..', '..', 'uploads', filename);

        try {
            // 1. Görseli diske yaz (uploads klasörüne - Asenkron I/O)
            if (result.katman1_yaprak && result.katman1_yaprak.crop_base64) {
                const cropBuffer = Buffer.from(result.katman1_yaprak.crop_base64, 'base64');
                await fs.promises.writeFile(savePath, cropBuffer);
                logger.info(`💾 YOLO Yaprak Kesimi (In-Memory Base64) uploads klasörüne kaydedildi: ${filename}`);
            } else {
                await fs.promises.writeFile(savePath, req.file.buffer);
                logger.info(`💾 Orijinal görüntü diske kaydedildi (YOLO crop bulunamadı): ${filename}`);
            }

            // 2. Tedavi Önerisini belirle
            if (result.katman3_hastalik.durum === 'tespit_edildi') {
                if (result.katman3_hastalik.saglikli) {
                    tedaviOnerisi = TREATMENT_RECOMMENDATIONS['Healthy'];
                } else {
                    tedaviOnerisi = TREATMENT_RECOMMENDATIONS[result.katman3_hastalik.hastalik] || 
                                    TREATMENT_RECOMMENDATIONS[result.katman3_hastalik.hastalik_tr] || 
                                    'Bu hastalık için özel bir tedavi önerisi bulunamadı. Lütfen tarım uzmanına danışın.';
                }
            } else if (result.katman3_hastalik.durum === 'saglikli') {
                tedaviOnerisi = TREATMENT_RECOMMENDATIONS['Healthy'];
            }

            // 3. PostgreSQL veritabanına kaydet (Graceful Degradation ile)
            try {
                if (db.isDbConnected === false) {
                    throw new Error('Veritabanı bağlantısı aktif değil (Offline Mode).');
                }

                const insertQuery = `
                    INSERT INTO diagnoses (
                        yaprak_guven, bitki_adi, bitki_adi_tr, bitki_guven,
                        hastalik_durum, hastalik_adi, hastalik_adi_tr, hastalik_guven,
                        resim_yolu, tedavi_onerisi
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING id;
                `;

                const insertParams = [
                    result.katman1_yaprak.confidence,
                    result.katman2_bitki.tur,
                    result.katman2_bitki.tur_tr,
                    result.katman2_bitki.confidence,
                    result.katman3_hastalik.durum,
                    result.katman3_hastalik.hastalik,
                    result.katman3_hastalik.hastalik_tr,
                    result.katman3_hastalik.confidence,
                    filename,
                    tedaviOnerisi
                ];

                const dbResult = await db.query(insertQuery, insertParams);
                dbId = dbResult.rows[0].id;
                dbSaved = true;
                logger.success(`📝 Teşhis veritabanına başarıyla kaydedildi. Kayıt ID: ${dbId}`);
            } catch (dbError) {
                // HATA TOLERANSI (Fail-Safe): Veritabanı hatasında resmi silmiyoruz. 
                // İstemciye tahmin sonucunu başarıyla dönüyoruz, veritabanı kaydının başarısız olduğunu işaretliyoruz.
                logger.warn(`⚠️ Veritabanı bağlantısı yok veya kayıt başarısız oldu. Teşhis çevrimdışı modda (offline-mode) tamamlanıyor. Hata: ${dbError.message}`);
                dbId = null;
                dbSaved = false;
            }

        } catch (fileError) {
            logger.error('❌ Resim yazma veya işleme hatası (Disk I/O)', fileError);
        }

        // Response nesnesini DTO yardımıyla biçimlendirerek kararlı API çıktısı ver
        const responsePayload = toDiagnosisResponse(result, dbId, filename, tedaviOnerisi);
        return res.json(responsePayload);

    } catch (error) {
        logger.error('Ana teşhis akış hatası', error);
        return res.status(500).json({
            basarili: false,
            hata: 'Fotoğraf analiz edilirken beklenmeyen bir hata oluştu.',
            detay: error.message
        });
    }
}

/**
 * GET /api/history
 * Veritabanından kaydedilmiş tüm teşhis geçmişini tarihe göre yeniden eskiye getirir.
 */
async function getHistory(req, res) {
    try {
        if (db.isDbConnected === false) {
            return res.status(503).json({
                basarili: false,
                hata: 'Veritabanı şu anda çevrimdışı. Teşhis geçmişi görüntülenemiyor.'
            });
        }

        const queryText = 'SELECT * FROM diagnoses ORDER BY tarih DESC';
        const dbResult = await db.query(queryText);
        
        return res.json({
            basarili: true,
            toplam: dbResult.rowCount,
            gecmis: dbResult.rows
        });
    } catch (error) {
        logger.error('Teşhis geçmişi alınamadı', error);
        return res.status(500).json({
            basarili: false,
            hata: 'Teşhis geçmişi alınırken bir veritabanı hatası oluştu.',
            detay: error.message
        });
    }
}

/**
 * DELETE /api/history/:id
 * Teşhis kaydını veritabanından siler ve ilişkili resmi diskten temizler.
 */
async function deleteHistory(req, res) {
    const { id } = req.params;
    try {
        if (db.isDbConnected === false) {
            return res.status(503).json({
                basarili: false,
                hata: 'Veritabanı şu anda çevrimdışı. Kayıt silme işlemi gerçekleştirilemiyor.'
            });
        }

        // 1. Önce görsel dosya adını al
        const findQuery = 'SELECT resim_yolu FROM diagnoses WHERE id = $1';
        const findRes = await db.query(findQuery, [id]);
        
        if (findRes.rowCount === 0) {
            return res.status(404).json({
                basarili: false,
                hata: 'Silinmek istenen kayıt bulunamadı.',
                talep_edilen_id: id
            });
        }
        
        const filename = findRes.rows[0].resim_yolu;
        
        // 2. Veritabanından sil
        const deleteQuery = 'DELETE FROM diagnoses WHERE id = $1';
        await db.query(deleteQuery, [id]);
        logger.success(`❌ Teşhis kaydı veritabanından silindi. ID: ${id}`);
        
        // 3. Görseli diskten temizle (Asenkron I/O)
        if (filename) {
            const filePath = path.join(__dirname, '..', '..', 'uploads', filename);
            try {
                await fs.promises.access(filePath);
                await fs.promises.unlink(filePath);
                logger.success(`🗑️ Teşhis resmi diskten silindi: ${filename}`);
            } catch (fileErr) {
                logger.warn(`⚠️ Dosya silinemedi veya zaten yok: ${filename} | Hata: ${fileErr.message}`);
            }
        }
        
        return res.json({
            basarili: true,
            mesaj: 'Teşhis kaydı ve ilişkili görsel başarıyla silindi.',
            silinen_id: id
        });
    } catch (error) {
        logger.error(`Teşhis kaydı silinirken hata oluştu (ID: ${id})`, error);
        return res.status(500).json({
            basarili: false,
            hata: 'Kayıt silinirken bir hata oluştu.',
            detay: error.message
        });
    }
}

/**
 * GET /api/labels
 * Desteklenen bitki türlerini döndürür.
 */
function getLabels(req, res) {
    try {
        const labels = aiService.getLabels();
        return res.json({
            basarili: true,
            toplamTur: labels.length,
            bitkiTurleri: labels,
            not: 'Hastalık tespiti aktif: apple, cherry, corn, grape, potato, tomato'
        });
    } catch (error) {
        logger.error('Bitki listesi alınırken hata oluştu', error);
        return res.status(500).json({
            basarili: false,
            hata: 'Bitki listesi alınamadı.'
        });
    }
}

module.exports = {
    diagnose,
    getHistory,
    deleteHistory,
    getLabels
};
