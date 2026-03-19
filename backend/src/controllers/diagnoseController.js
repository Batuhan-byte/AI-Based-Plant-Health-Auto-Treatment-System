const aiService = require('../services/aiService');

/**
 * POST /api/diagnose
 * Fotoğrafı alır, AI modeline gönderir ve teşhis sonucunu döndürür.
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

        console.log(`📸 Fotoğraf alındı: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);

        // AI Servisini çağır
        const result = await aiService.predict(req.file.buffer);

        console.log(`🌿 Tahmin: ${result.tahmin.bitki} - ${result.tahmin.hastalik} (%${(result.tahmin.guvenOrani * 100).toFixed(1)})`);

        return res.json(result);
    } catch (error) {
        console.error('❌ Teşhis hatası:', error);
        return res.status(500).json({
            basarili: false,
            hata: 'Fotoğraf analiz edilirken bir hata oluştu.',
            detay: error.message
        });
    }
}

/**
 * GET /api/labels
 * Desteklenen tüm bitki ve hastalık etiketlerini döndürür.
 */
function getLabels(req, res) {
    try {
        const labels = aiService.getLabels();
        return res.json({
            basarili: true,
            toplamEtiket: labels.length,
            etiketler: labels
        });
    } catch (error) {
        console.error('❌ Etiket listesi hatası:', error);
        return res.status(500).json({
            basarili: false,
            hata: 'Etiket listesi alınamadı.'
        });
    }
}

module.exports = {
    diagnose,
    getLabels
};
