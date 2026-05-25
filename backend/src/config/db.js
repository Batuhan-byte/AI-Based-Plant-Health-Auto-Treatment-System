const { Pool } = require('pg');
const logger = require('../utils/logger');

// Global veritabanı bağlantı durumu
let isDbConnected = false;

// Çevre değişkenlerini kullanarak PostgreSQL bağlantı havuzunu (Pool) oluştur
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_DATABASE || 'plant_health_db',
    connectionTimeoutMillis: 5000, // Bağlantı zaman aşımı (5s)
    idleTimeoutMillis: 30000,      // Boştaki bağlantı zaman aşımı (30s)
});

// Havuz genelindeki bağlantı hatalarını dinle
pool.on('error', (err) => {
    logger.error('PostgreSQL Bağlantı Havuzu Hatası', err);
    isDbConnected = false;
});

/**
 * Veritabanı bağlantısını test eder
 */
async function checkConnection() {
    let client;
    try {
        client = await pool.connect();
        isDbConnected = true;
        client.release();
        return true;
    } catch (err) {
        isDbConnected = false;
        if (client) {
            try { client.release(); } catch (e) {}
        }
        return false;
    }
}

/**
 * Güvenli ve loglanan veritabanı sorgusu
 */
async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        
        // Uzun süren sorguları uyar, normal sorguları info olarak geç
        const sqlSnippet = text.trim().replace(/\s+/g, ' ').substring(0, 100);
        if (duration > 1000) {
            logger.warn(`🐌 Yavaş SQL Sorgusu (${duration}ms): ${sqlSnippet}`);
        } else {
            logger.info(`💾 SQL Sorgusu yürütüldü: ${sqlSnippet} | Süre: ${duration}ms | Satır: ${res.rowCount}`);
        }
        
        isDbConnected = true;
        return res;
    } catch (error) {
        logger.error(`SQL Sorgu Hatası (Sorgu: ${text.trim().substring(0, 150)})`, error);
        isDbConnected = false;
        throw error;
    }
}

module.exports = {
    query,
    pool,
    checkConnection,
    get isDbConnected() { return isDbConnected; },
    set isDbConnected(val) { isDbConnected = val; }
};

