const { Client } = require('pg');
const { pool } = require('./db');

/**
 * Sunucu her başladığında çalışarak yerel PostgreSQL üzerinde veritabanı 
 * ve tabloların varlığını kontrol eder, yoksa otomatik oluşturur.
 */
async function initializeDatabase() {
    console.log('🔄 Yerel PostgreSQL kontrol ediliyor...');

    const dbName = process.env.DB_DATABASE || 'plant_health_db';

    // 1. Aşama: Varsayılan 'postgres' veritabanına bağlanıp, asıl DB'mizin varlığını kontrol et
    const defaultClient = new Client({
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: 'postgres', // Varsayılan sistem veritabanı
    });

    try {
        await defaultClient.connect();
        
        // Veritabanı mevcut mu sorgula
        const checkDbRes = await defaultClient.query(
            `SELECT 1 FROM pg_database WHERE datname = $1`, 
            [dbName]
        );
        
        if (checkDbRes.rowCount === 0) {
            console.log(`📡 '${dbName}' veritabanı bulunamadı. Otomatik oluşturuluyor...`);
            // CREATE DATABASE sorgusunda parametrik bind ($1) desteklenmez. 
            // Kendi konfigürasyonumuz olduğu için güvenlidir.
            await defaultClient.query(`CREATE DATABASE ${dbName}`);
            console.log(`✅ '${dbName}' veritabanı oluşturuldu.`);
        } else {
            console.log(`✅ '${dbName}' veritabanı zaten mevcut.`);
        }
    } catch (error) {
        console.error('❌ Veritabanı kontrolü başarısız oldu:', error.message);
        console.log('💡 Lütfen PostgreSQL servisinin çalıştığından ve şifrenin .env dosyasında doğru olduğundan emin olun.\n');
        return false;
    } finally {
        try {
            await defaultClient.end();
        } catch (e) {
            // Sessizce geç
        }
    }

    // 2. Aşama: Asıl veritabanına bağlanarak 'diagnoses' tablosunu oluştur
    try {
        console.log('🔄 Tablo yapısı doğrulanıyor...');
        
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

        await pool.query(createTableQuery);
        console.log('✅ Veritabanı tablosu hazır! (diagnoses)');
        return true;
    } catch (error) {
        console.error('❌ Tablo oluşturma hatası:', error.message);
        return false;
    }
}

module.exports = initializeDatabase;
