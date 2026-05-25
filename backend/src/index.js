require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const aiService = require('./services/aiService');
const diagnoseRoutes = require('./routes/diagnoseRoutes');
const initializeDatabase = require('./config/dbInit');
const db = require('./config/db');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────────────────
app.use(cors());                         // Tüm origin'lerden erişime izin ver
app.use(express.json({ limit: '15mb' })); // JSON body parser (Base64 görseller için yüksek limit)

// ─── Statik Görsel Klasörü Entegrasyonu ──────────────────
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    logger.info("📁 'uploads' klasörü oluşturuldu.");
}
app.use('/uploads', express.static(uploadsDir));

// ─── Routes ─────────────────────────────────────────────
app.use('/api', diagnoseRoutes);

// ─── Zenginleştirilmiş Sağlık Kontrolü (Fail-Safe Destekli) ────
app.get('/api/health', (req, res) => {
    res.json({
        durum: 'çalışıyor',
        sunucu: 'VerdantAI Backend',
        veritabani: db.isDbConnected ? 'online' : 'offline',
        ai_daemon: aiService.modelsReady ? 'online' : 'offline',
        zaman: new Date().toISOString()
    });
});

// ─── Hata Yakalama Middleware ────────────────────────────
app.use((err, req, res, next) => {
    logger.error('Sunucu Hatası', err);
    
    // Multer dosya boyutu hatası
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            basarili: false,
            hata: 'Dosya boyutu çok büyük. Maksimum 10 MB yükleyebilirsiniz.'
        });
    }

    res.status(500).json({
        basarili: false,
        hata: err.message || 'Beklenmeyen bir sunucu hatası oluştu.'
    });
});

// ─── Sunucuyu Başlat ────────────────────────────────────
async function startServer() {
    logger.info('\n🌱 VerdantAI Backend başlatılıyor...\n');

    // 1. Veritabanını kontrol et ve otomatik kur (Fail-safe: hata durumunda sunucuyu çökertmez)
    await initializeDatabase();

    // 2. AI Modelini önceden belleğe yükle (HTTP Daemon başlatılır)
    const modelLoaded = await aiService.loadModel();
    if (!modelLoaded) {
        logger.error('❌ AI Daemon yüklenemedi! Sunucu kısıtlı modda (offline/no-ai) başlatılıyor.');
    }

    // 3. Express sunucusunu başlat
    app.listen(PORT, '0.0.0.0', () => {
        logger.success(`🚀 Sunucu http://localhost:${PORT} adresinde başarıyla çalışıyor`);
        logger.info(`📡 API Endpoint'leri:`);
        logger.info(`   POST /api/diagnose  → Fotoğraf yükle ve teşhis al`);
        logger.info(`   GET  /api/history   → Tüm geçmiş teşhisleri getir`);
        logger.info(`   DELETE /api/history/:id → Belirli teşhis kaydını sil`);
        logger.info(`   GET  /api/labels    → Desteklenen bitki/hastalık listesi`);
        logger.info(`   GET  /api/health    → Sunucu ve servis sağlık durumunu kontrol et\n`);
    });
}

startServer();

// ─── Graceful Shutdown (Güvenli Kapatma) ──────────────────
// Sunucu kapandığında Python AI Daemon sürecini de temiz kapatır.
// Bu mekanizma zombi Python süreçlerinin OS'ta kalmasını önler.

function gracefulShutdown(signal) {
    logger.info(`\n🛑 ${signal} sinyali alındı, sunucu kapatılıyor...`);
    
    // AI Daemon'u kapat
    if (typeof aiService.shutdown === 'function') {
        aiService.shutdown();
    }

    // Express sunucusuna yeni istek kabul etmeyi durdur
    process.exit(0);
}

// Unix sinyalleri
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Windows: Ctrl+C veya pencere kapatma
process.on('exit', () => {
    if (typeof aiService.shutdown === 'function') {
        aiService.shutdown();
    }
});

// Yakalanmamış hatalarda da daemon'u temizle
process.on('uncaughtException', (err) => {
    logger.error('Yakalanmamış Hata', err);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
    logger.error('İşlenmeyen Promise Reddi', new Error(String(reason)));
    gracefulShutdown('unhandledRejection');
});
