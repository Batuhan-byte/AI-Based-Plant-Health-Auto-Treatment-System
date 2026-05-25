const { Client } = require('pg');
const db = require('./db');
const logger = require('../utils/logger');

/**
 * Sunucu her başladığında çalışarak yerel PostgreSQL üzerinde veritabanı 
 * ve tabloların varlığını kontrol eder, yoksa otomatik oluşturur.
 * Veritabanı servisinin geç açılabilme ihtimaline karşı 5 kez yeniden deneme (retry) mekanizması içerir.
 */
async function initializeDatabase() {
    const dbName = process.env.DB_DATABASE || 'plant_health_db';
    const maxRetries = 5;
    const retryDelayMs = 3000;
    
    let clientConnected = false;
    let attempts = 0;

    logger.info('🔄 Yerel PostgreSQL bağlantısı ve veritabanı yapısı doğrulanıyor...');

    // 1. Aşama: Veritabanı bağlantı retry döngüsü
    while (attempts < maxRetries && !clientConnected) {
        attempts++;
        const defaultClient = new Client({
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: 'postgres', // Varsayılan sistem veritabanı
            connectionTimeoutMillis: 3000,
        });

        try {
            await defaultClient.connect();
            clientConnected = true;
            logger.success(`📡 PostgreSQL servisine başarıyla bağlanıldı (Deneme ${attempts}/${maxRetries}).`);
            
            // Veritabanı mevcut mu sorgula
            const checkDbRes = await defaultClient.query(
                `SELECT 1 FROM pg_database WHERE datname = $1`, 
                [dbName]
            );
            
            if (checkDbRes.rowCount === 0) {
                logger.warn(`📡 '${dbName}' veritabanı bulunamadı. Otomatik oluşturuluyor...`);
                // CREATE DATABASE sorgusunda parametrik bind ($1) desteklenmez. 
                await defaultClient.query(`CREATE DATABASE ${dbName}`);
                logger.success(`✅ '${dbName}' veritabanı oluşturuldu.`);
            } else {
                logger.info(`✅ '${dbName}' veritabanı zaten mevcut.`);
            }
            
            await defaultClient.end();
        } catch (error) {
            logger.warn(`⚠️ PostgreSQL bağlantı denemesi ${attempts}/${maxRetries} başarısız oldu: ${error.message}`);
            
            try { await defaultClient.end(); } catch (e) {}
            
            if (attempts < maxRetries) {
                logger.info(`⏳ ${retryDelayMs / 1000} saniye sonra tekrar denenecek...`);
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            } else {
                logger.error('❌ PostgreSQL servisine bağlanılamadı. Maksimum deneme sınırına ulaşıldı.');
                logger.warn('💡 Sunucu çevrimdışı modda (offline-mode) başlatılıyor. AI analizleri çalışacak ancak geçmiş kaydedilmeyecek.');
                db.isDbConnected = false;
                return false;
            }
        }
    }

    // 2. Aşama: Asıl veritabanına bağlanarak 'diagnoses' tablosunu oluştur
    try {
        logger.info('🔄 Tablo yapısı doğrulanıyor...');
        
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS diagnoses (
                id SERIAL PRIMARY KEY,
                yaprak_guven NUMERIC,
                bitki_adi VARCHAR(100),
                bitki_adi_tr VARCHAR(100),
                bitki_guven NUMERIC,
                hastalik_durum VARCHAR(50),
                hastalik_adi VARCHAR(150),
                hastalik_adi_tr VARCHAR(150),
                hastalik_guven NUMERIC,
                resim_yolu VARCHAR(255),
                tedavi_onerisi TEXT,
                tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        await db.query(createTableQuery);
        logger.success('✅ Veritabanı tablosu hazır! (diagnoses)');
        db.isDbConnected = true;
        return true;
    } catch (error) {
        logger.error('❌ Tablo oluşturma hatası:', error);
        db.isDbConnected = false;
        return false;
    }
}

module.exports = initializeDatabase;
