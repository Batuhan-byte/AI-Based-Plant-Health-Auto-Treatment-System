const aiService = require('../services/aiService');

/**
 * POST /api/diagnose
 * Fotoğrafı alır, 3 katmanlı AI pipeline'a gönderir ve sonucu döndürür.
 * 
 * Pipeline:
 *   Katman 1: YOLO → Yaprak tespiti & crop
 *   Katman 2: MobileNet → Bitki türü sınıflandırma
 *   Katman 3: Hastalık tespiti (Aktif)
 */
async function diagnose(req, res) {
    try {
        // Dosyanın yüklenip yüklenmediğini kontrol et
        if (!req.file) {
            return res.status(400).json({
                basarili: false,
                hata: 'Lütfen bir fotoğraf yükleyin. Form alanı: "image"'
            });
        }

        console.log(`\n📸 Fotoğraf alındı: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);
        console.log('🔄 3 Katmanlı AI Pipeline başlatılıyor...');

        // AI Pipeline'ı çağır
        const result = await aiService.predict(req.file.buffer);

        if (!result.basarili) {
            console.log(`⚠️ Pipeline Başarısız: ${result.hata}`);
            return res.json(result);
        }

        console.log(`✅ Pipeline Tamamlandı:`);
        console.log(`   🍃 Yaprak: Tespit edildi (%${result.katman1_yaprak.confidence})`);
        console.log(`   🌿 Bitki: ${result.katman2_bitki.tur_tr} (%${result.katman2_bitki.confidence})`);
        if (result.katman3_hastalik.durum === 'tespit_edildi') {
            const emoji = result.katman3_hastalik.saglikli ? '✅' : '🔴';
            console.log(`   🔬 Hastalık: ${emoji} ${result.katman3_hastalik.hastalik_tr} (%${result.katman3_hastalik.confidence})\n`);
        } else {
            console.log(`   🔬 Hastalık: ${result.katman3_hastalik.durum} - ${result.katman3_hastalik.mesaj || ''}\n`);
        }

        return res.json(result);
    } catch (error) {
        console.error('❌ Pipeline hatası:', error);
        return res.status(500).json({
            basarili: false,
            hata: 'Fotoğraf analiz edilirken bir hata oluştu.',
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
        console.error('❌ Bitki listesi hatası:', error);
        return res.status(500).json({
            basarili: false,
            hata: 'Bitki listesi alınamadı.'
        });
    }
}

module.exports = {
    diagnose,
    getLabels
};
