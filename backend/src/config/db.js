const { Pool } = require('pg');

// Çevre değişkenlerini kullanarak PostgreSQL bağlantı havuzunu (Pool) oluştur
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_DATABASE || 'plant_health_db',
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL Bağlantı Havuzu Hatası:', err.message);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
