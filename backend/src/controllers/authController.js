const db = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Yeni Kullanıcı Kaydı (Register)
 */
async function register(req, res) {
    const { name, email, password } = req.body;
    try {
        if (!name || !email || !password) {
            return res.status(400).json({ basarili: false, hata: 'Lütfen isim, e-posta ve şifre alanlarını doldurun.' });
        }

        // E-posta benzersiz mi kontrol et
        const checkEmail = await db.query('SELECT 1 FROM users WHERE email = $1', [email]);
        if (checkEmail.rowCount > 0) {
            return res.status(400).json({ basarili: false, hata: 'Bu e-posta adresi zaten kullanımda.' });
        }

        const uuid = crypto.randomUUID();
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const insertQuery = `
            INSERT INTO users (uuid, name, email, password_hash, user_type)
            VALUES ($1, $2, $3, $4, 'registered')
            RETURNING id, uuid, name, email, user_type;
        `;

        const dbRes = await db.query(insertQuery, [uuid, name, email, passwordHash]);
        logger.success(`👤 Yeni kullanıcı kaydedildi: ${email}`);
        
        return res.status(201).json({
            basarili: true,
            user: dbRes.rows[0]
        });
    } catch (error) {
        logger.error('Kayıt Hatası:', error);
        return res.status(500).json({ basarili: false, hata: 'Kayıt işlemi sırasında bir hata oluştu.' });
    }
}

/**
 * Kullanıcı Girişi (Login)
 */
async function login(req, res) {
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({ basarili: false, hata: 'Lütfen e-posta ve şifre alanlarını doldurun.' });
        }

        const dbRes = await db.query('SELECT * FROM users WHERE email = $1 AND user_type = \'registered\'', [email]);
        if (dbRes.rowCount === 0) {
            return res.status(401).json({ basarili: false, hata: 'Hatalı e-posta veya şifre.' });
        }

        const user = dbRes.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ basarili: false, hata: 'Hatalı e-posta veya şifre.' });
        }

        logger.success(`👤 Kullanıcı giriş yaptı: ${email}`);

        return res.json({
            basarili: true,
            user: {
                id: user.id,
                uuid: user.uuid,
                name: user.name,
                email: user.email,
                user_type: user.user_type
            }
        });
    } catch (error) {
        logger.error('Giriş Hatası:', error);
        return res.status(500).json({ basarili: false, hata: 'Giriş işlemi sırasında bir hata oluştu.' });
    }
}

/**
 * Misafir Girişi (Guest Login / Auto-Registration)
 */
async function guest(req, res) {
    const { deviceUuid } = req.body;
    try {
        if (!deviceUuid) {
            return res.status(400).json({ basarili: false, hata: 'Cihaz UUID kodu gerekli.' });
        }

        // Mevcut misafiri bul
        let dbRes = await db.query('SELECT * FROM users WHERE uuid = $1', [deviceUuid]);
        
        if (dbRes.rowCount > 0) {
            const user = dbRes.rows[0];
            logger.info(`👤 Mevcut misafir girişi: ${deviceUuid}`);
            return res.json({
                basarili: true,
                user: {
                    id: user.id,
                    uuid: user.uuid,
                    name: user.name || 'Misafir',
                    email: user.email,
                    user_type: user.user_type
                }
            });
        }

        // Yeni misafir kaydı aç
        const insertQuery = `
            INSERT INTO users (uuid, name, user_type)
            VALUES ($1, 'Misafir', 'guest')
            RETURNING id, uuid, name, email, user_type;
        `;
        dbRes = await db.query(insertQuery, [deviceUuid]);
        logger.success(`👤 Yeni misafir kaydedildi: ${deviceUuid}`);

        return res.status(201).json({
            basarili: true,
            user: dbRes.rows[0]
        });
    } catch (error) {
        logger.error('Misafir Giriş Hatası:', error);
        return res.status(500).json({ basarili: false, hata: 'Misafir oturumu başlatılamadı.' });
    }
}

/**
 * Hesabı Yükselt (Guest -> Registered)
 */
async function upgrade(req, res) {
    const { deviceUuid, name, email, password } = req.body;
    try {
        if (!deviceUuid || !name || !email || !password) {
            return res.status(400).json({ basarili: false, hata: 'Eksik parametreler.' });
        }

        // Misafir kullanıcı mevcut mu?
        const checkGuest = await db.query('SELECT * FROM users WHERE uuid = $1', [deviceUuid]);
        if (checkGuest.rowCount === 0) {
            return res.status(404).json({ basarili: false, hata: 'Yükseltilecek misafir oturumu bulunamadı.' });
        }

        // E-posta çakışması kontrolü
        const checkEmail = await db.query('SELECT 1 FROM users WHERE email = $1 AND uuid != $2', [email, deviceUuid]);
        if (checkEmail.rowCount > 0) {
            return res.status(400).json({ basarili: false, hata: 'Bu e-posta adresi başka bir kayıtlı kullanıcıya ait.' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const updateQuery = `
            UPDATE users
            SET name = $1, email = $2, password_hash = $3, user_type = 'registered'
            WHERE uuid = $4
            RETURNING id, uuid, name, email, user_type;
        `;

        const dbRes = await db.query(updateQuery, [name, email, passwordHash, deviceUuid]);
        logger.success(`👤 Hesap yükseltildi (Misafir -> Kayıtlı): ${email}`);

        return res.json({
            basarili: true,
            user: dbRes.rows[0]
        });
    } catch (error) {
        logger.error('Hesap Yükseltme Hatası:', error);
        return res.status(500).json({ basarili: false, hata: 'Hesap yükseltme işlemi sırasında bir hata oluştu.' });
    }
}

module.exports = {
    register,
    login,
    guest,
    upgrade
};
