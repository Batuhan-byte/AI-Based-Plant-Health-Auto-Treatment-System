const fs = require('fs');
const { toDiagnosisResponse } = require('../dto/diagnosisDto');
const path = require('path');
const db = require('../config/db');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');

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

        const userUuid = req.headers['x-user-uuid'] || 'default_guest_uuid';
        logger.info(`📸 Fotoğraf alındı: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB) | Kullanıcı UUID: ${userUuid}`);
        
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

            // 2. PostgreSQL veritabanına ilişkisel olarak kaydet (Graceful Degradation ile)
            try {
                if (db.isDbConnected === false) {
                    throw new Error('Veritabanı bağlantısı aktif değil (Offline Mode).');
                }

                // 2.1. Kullanıcıyı bul (Yoksa misafir olarak otomatik oluştur)
                let userRes = await db.query('SELECT id FROM users WHERE uuid = $1', [userUuid]);
                let userId;
                if (userRes.rowCount === 0) {
                    const guestRes = await db.query(
                        "INSERT INTO users (uuid, name, user_type) VALUES ($1, 'Misafir', 'guest') RETURNING id",
                        [userUuid]
                    );
                    userId = guestRes.rows[0].id;
                } else {
                    userId = userRes.rows[0].id;
                }

                // 2.2. Bitkiyi bul
                const plantKey = result.katman2_bitki.tur.replace(" ", "_");
                const plantRes = await db.query('SELECT id, name_tr FROM plants WHERE key = $1', [plantKey]);
                if (plantRes.rowCount === 0) {
                    throw new Error(`Bitki veri tabanında tanımlı değil: ${plantKey}`);
                }
                const plantId = plantRes.rows[0].id;

                // 2.3. Hastalığı ve Tedaviyi bul
                let diseaseId = null;
                const diseaseKey = result.katman3_hastalik.hastalik; // Örn: 'Leaf Scorch', 'Healthy'
                
                if (result.katman3_hastalik.durum === 'tespit_edildi' && diseaseKey) {
                    const diseaseRes = await db.query(
                        'SELECT id, name_tr, treatment_recommendation FROM diseases WHERE plant_id = $1 AND key = $2',
                        [plantId, diseaseKey]
                    );
                    if (diseaseRes.rowCount > 0) {
                        diseaseId = diseaseRes.rows[0].id;
                        tedaviOnerisi = diseaseRes.rows[0].treatment_recommendation;
                    }
                } else if (result.katman3_hastalik.durum === 'saglikli') {
                    const diseaseRes = await db.query(
                        'SELECT id, name_tr, treatment_recommendation FROM diseases WHERE plant_id = $1 AND key = \'Healthy\'',
                        [plantId]
                    );
                    if (diseaseRes.rowCount > 0) {
                        diseaseId = diseaseRes.rows[0].id;
                        tedaviOnerisi = diseaseRes.rows[0].treatment_recommendation;
                    }
                }

                // 2.4. Teşhis kaydını ekle
                const insertQuery = `
                    INSERT INTO diagnoses (
                        user_id, yaprak_guven, plant_id, bitki_guven,
                        disease_id, hastalik_guven, hastalik_durum,
                        resim_yolu, tedavi_onerisi
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    RETURNING id;
                `;

                const insertParams = [
                    userId,
                    result.katman1_yaprak.confidence,
                    plantId,
                    result.katman2_bitki.confidence,
                    diseaseId,
                    result.katman3_hastalik.confidence,
                    result.katman3_hastalik.durum,
                    filename,
                    tedaviOnerisi
                ];

                const dbResult = await db.query(insertQuery, insertParams);
                dbId = dbResult.rows[0].id;
                dbSaved = true;
                logger.success(`📝 Teşhis veritabanına başarıyla kaydedildi. Kayıt ID: ${dbId}`);
            } catch (dbError) {
                logger.warn(`⚠️ Veritabanı bağlantısı yok veya kayıt başarısız oldu. Teşhis çevrimdışı modda (offline-mode) tamamlanıyor. Hata: ${dbError.message}`);
                dbId = null;
                dbSaved = false;
                
                // Offline durumunda statik yedek metin ataması
                tedaviOnerisi = result.katman3_hastalik.durum === 'saglikli' 
                    ? 'Bitkiniz sağlıklı görünüyor. Mevcut bakım düzenine devam edin.'
                    : 'Çevrimdışı modda detaylı tedavi önerisi verilemiyor. Lütfen veri tabanını kontrol edin.';
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
 * Veritabanından belirli bir kullanıcıya ait kaydedilmiş teşhis geçmişini döndürür.
 */
async function getHistory(req, res) {
    const { uuid } = req.query;
    try {
        if (db.isDbConnected === false) {
            return res.status(503).json({
                basarili: false,
                hata: 'Veritabanı şu anda çevrimdışı. Teşhis geçmişi görüntülenemiyor.'
            });
        }

        if (!uuid) {
            return res.status(400).json({
                basarili: false,
                hata: 'Geçmişi sorgulamak için kullanıcı UUID kodu (uuid) parametre olarak gönderilmelidir.'
            });
        }

        const queryText = `
            SELECT d.id, d.yaprak_guven, d.bitki_guven, d.hastalik_guven, 
                   d.hastalik_durum, d.resim_yolu, d.tarih, d.tedavi_onerisi,
                   p.key AS bitki_adi, p.name_tr AS bitki_adi_tr,
                   dis.key AS hastalik_adi, dis.name_tr AS hastalik_adi_tr
            FROM diagnoses d
            JOIN users u ON d.user_id = u.id
            JOIN plants p ON d.plant_id = p.id
            LEFT JOIN diseases dis ON d.disease_id = dis.id
            WHERE u.uuid = $1
            ORDER BY d.tarih DESC;
        `;
        const dbResult = await db.query(queryText, [uuid]);
        
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
 * DELETE /api/history
 * Kullanıcıya ait tüm teşhis geçmişini ve ilişkili resimleri siler.
 */
async function deleteAllHistory(req, res) {
    const { uuid } = req.query;
    try {
        if (db.isDbConnected === false) {
            return res.status(503).json({
                basarili: false,
                hata: 'Veritabanı şu anda çevrimdışı. Kayıt silme işlemi gerçekleştirilemiyor.'
            });
        }

        if (!uuid) {
            return res.status(400).json({
                basarili: false,
                hata: 'Geçmişi silmek için kullanıcı UUID kodu (uuid) parametre olarak gönderilmelidir.'
            });
        }

        // 1. Kullanıcıyı bul
        const userRes = await db.query('SELECT id FROM users WHERE uuid = $1', [uuid]);
        if (userRes.rowCount === 0) {
            return res.status(404).json({
                basarili: false,
                hata: 'Kullanıcı bulunamadı.'
            });
        }
        const userId = userRes.rows[0].id;

        // 2. Tüm teşhis resim yollarını al
        const findQuery = 'SELECT resim_yolu FROM diagnoses WHERE user_id = $1';
        const findRes = await db.query(findQuery, [userId]);
        const files = findRes.rows.map(r => r.resim_yolu).filter(Boolean);

        // 3. Veritabanından tüm kayıtları sil
        const deleteQuery = 'DELETE FROM diagnoses WHERE user_id = $1';
        await db.query(deleteQuery, [userId]);
        logger.success(`❌ Tüm teşhis kayıtları veritabanından silindi. Kullanıcı ID: ${userId}`);

        // 4. Görselleri diskten temizle
        for (const filename of files) {
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
            mesaj: 'Tüm teşhis kayıtları ve ilişkili görseller başarıyla temizlendi.'
        });
    } catch (error) {
        logger.error(`Kullanıcı geçmişi temizlenirken hata oluştu (UUID: ${uuid})`, error);
        return res.status(500).json({
            basarili: false,
            hata: 'Tüm kayıtlar silinirken bir hata oluştu.',
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
            not: 'Hastalık tespiti aktif: apple, bell pepper, cherry, corn, grape, peach, potato, strawberry, tomato'
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
    deleteAllHistory,
    getLabels
};
