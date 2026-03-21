require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const aiService = require('./services/aiService');
const diagnoseRoutes = require('./routes/diagnoseRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────────────────
app.use(cors());                         // Tüm origin'lerden erişime izin ver
app.use(express.json({ limit: '15mb' })); // JSON body parser (Base64 görseller için yüksek limit)

// ─── Routes ─────────────────────────────────────────────
app.use('/api', diagnoseRoutes);

// ─── Sağlık Kontrolü ────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        durum: 'çalışıyor',
        sunucu: 'PlantHealth Backend',
        zaman: new Date().toISOString()
    });
});

// ─── Hata Yakalama Middleware ────────────────────────────
app.use((err, req, res, next) => {
    console.error('❌ Sunucu Hatası:', err.message);
    
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
    console.log('\n🌱 PlantHealth Backend başlatılıyor...\n');

    // 1. AI Modelini önceden belleğe yükle
    const modelLoaded = await aiService.loadModel();
    if (!modelLoaded) {
        console.error('❌ Model yüklenemedi! Sunucu başlatılıyor ama tahmin yapılamaz.');
    }

    // 2. Express sunucusunu başlat
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🚀 Sunucu http://localhost:${PORT} adresinde çalışıyor`);
        console.log(`📡 API Endpoint'leri:`);
        console.log(`   POST /api/diagnose  → Fotoğraf yükle ve teşhis al`);
        console.log(`   GET  /api/labels    → Desteklenen bitki/hastalık listesi`);
        console.log(`   GET  /api/health    → Sunucu sağlık kontrolü\n`);
    });
}

startServer();
