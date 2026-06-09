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

    // 2. Aşama: Asıl veritabanına bağlanarak ilişkisel tabloları oluştur
    try {
        logger.info('🔄 Tablo yapısı doğrulanıyor...');
        
        // Göç (Migration) Kontrolü: Eski tek tabloluk yapı varsa temizle
        const checkTableRes = await db.query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'users'
            );`
        );
        
        const usersExists = checkTableRes.rows[0].exists;
        if (!usersExists) {
            logger.warn('🔄 Eski veri tabanı şeması tespit edildi. İlişkisel tablo yapısına geçiş yapılıyor (Migration)...');
            await db.query('DROP TABLE IF EXISTS diagnoses CASCADE;');
            await db.query('DROP TABLE IF EXISTS diseases CASCADE;');
            await db.query('DROP TABLE IF EXISTS plants CASCADE;');
            await db.query('DROP TABLE IF EXISTS users CASCADE;');
        }

        // 1. Kullanıcılar Tablosu
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                uuid VARCHAR(100) UNIQUE NOT NULL,
                name VARCHAR(100) NULL,
                email VARCHAR(100) UNIQUE NULL,
                password_hash VARCHAR(255) NULL,
                user_type VARCHAR(20) DEFAULT 'guest',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Bitkiler Tablosu
        await db.query(`
            CREATE TABLE IF NOT EXISTS plants (
                id SERIAL PRIMARY KEY,
                key VARCHAR(50) UNIQUE NOT NULL,
                name_tr VARCHAR(100) NOT NULL,
                name_en VARCHAR(100) NOT NULL
            );
        `);

        // 3. Hastalıklar Tablosu
        await db.query(`
            CREATE TABLE IF NOT EXISTS diseases (
                id SERIAL PRIMARY KEY,
                plant_id INT REFERENCES plants(id) ON DELETE CASCADE,
                key VARCHAR(100) NOT NULL,
                name_tr VARCHAR(150) NOT NULL,
                name_en VARCHAR(150) NOT NULL,
                treatment_recommendation TEXT NOT NULL,
                UNIQUE (plant_id, key)
            );
        `);

        // 4. Teşhisler Tablosu
        await db.query(`
            CREATE TABLE IF NOT EXISTS diagnoses (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                yaprak_guven NUMERIC,
                plant_id INT REFERENCES plants(id),
                bitki_guven NUMERIC,
                disease_id INT REFERENCES diseases(id),
                hastalik_guven NUMERIC,
                hastalik_durum VARCHAR(50),
                resim_yolu VARCHAR(255),
                tedavi_onerisi TEXT,
                tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Migration: Eğer tablo önceden oluşturulduysa ve 'tedavi_onerisi' kolonu yoksa otomatik ekle
        await db.query(`
            ALTER TABLE diagnoses 
            ADD COLUMN IF NOT EXISTS tedavi_onerisi TEXT;
        `);

        logger.success('✅ İlişkisel veritabanı tabloları hazır!');
        
        // Seed verilerini ekle
        await seedDatabase();

        db.isDbConnected = true;
        return true;
    } catch (error) {
        logger.error('❌ Tablo oluşturma veya göç hatası:', error);
        db.isDbConnected = false;
        return false;
    }
}

/**
 * Plants ve Diseases tablolarını başlangıç verileriyle doldurur.
 */
async function seedDatabase() {
    try {
        const plantsCountRes = await db.query('SELECT COUNT(*) FROM plants');
        const count = parseInt(plantsCountRes.rows[0].count, 10);
        if (count > 0) {
            logger.info('✅ Veri tabanı seed işlemi zaten yapılmış.');
            return;
        }

        logger.info('🌱 Veri tabanı başlangıç verileri (Seed) yükleniyor...');

        // 1. Bitkileri Ekle
        const plantsData = [
            { key: 'apple', tr: 'Elma', en: 'Apple' },
            { key: 'cherry', tr: 'Kiraz', en: 'Cherry' },
            { key: 'corn', tr: 'Mısır', en: 'Corn' },
            { key: 'grape', tr: 'Üzüm', en: 'Grape' },
            { key: 'peach', tr: 'Şeftali', en: 'Peach' },
            { key: 'potato', tr: 'Patates', en: 'Potato' },
            { key: 'strawberry', tr: 'Çilek', en: 'Strawberry' },
            { key: 'tomato', tr: 'Domates', en: 'Tomato' },
            { key: 'bell_pepper', tr: 'Biber', en: 'Bell Pepper' }
        ];

        const plantIds = {};
        for (const p of plantsData) {
            const res = await db.query(
                `INSERT INTO plants (key, name_tr, name_en) VALUES ($1, $2, $3) RETURNING id`,
                [p.key, p.tr, p.en]
            );
            plantIds[p.key] = res.rows[0].id;
        }
        logger.success(`✅ ${plantsData.length} bitki türü eklendi.`);

        // 2. Tedavi Önerileri
        const treatments = {
            'Healthy': 'Bitkiniz oldukça sağlıklı görünüyor. Mevcut sulama ve bakım düzenini bozmadan devam edin. Düzenli olarak yaprak altlarını kontrol etmeyi unutmayın.',
            'Apple Scab': 'Elma Karalekesi teşhisi konuldu. Tedavi için:\n1. Enfekte olmuş yaprakları ve dalları budayarak bahçeden uzaklaştırın.\n2. İlkbaharda tomurcuklar açılmadan önce bakır içerikli fungusitler (mantar ilacı) uygulayın.\n3. Sulamayı sabah saatlerinde ve doğrudan köke yapın, yaprakları ıslatmaktan kaçının.',
            'Black Rot': 'Siyah Çürüklük teşhisi konuldu. Tedavi için:\n1. Bulaşık yaprak, sürgün ve meyve salkımlarını hemen budayıp yakın.\n2. Kimyasal mücadele için sistemik fungusitler kullanın.\n3. Bitki çevresindeki hava sirkülasyonunu artırmak için budamayı doğru yapın ve nemli ortamı azaltın.',
            'Cedar Apple Rust': 'Sedir-Elma Pası teşhisi konuldu. Tedavi için:\n1. Yakındaki sedir veya ardıç ağaçlarında oluşan pas urlarını temizleyin.\n2. Yapraklar yeni açılırken koruyucu fungusit uygulaması yapın.\n3. Dirençli bitki çeşitlerini tercih etmeye özen gösterin.',
            'Powdery Mildew': 'Külleme hastalığı tespit edildi. Tedavi için:\n1. Enfekte kısımları hemen budayarak temizleyin.\n2. Kükürt bazlı ilaçlar veya sistemik fungusitler kullanın.\n3. Bitkileri aşırı sık dikmeyin, aralarındaki hava akışını artırın. Sulamayı yapraktan değil kökten yapın.',
            'Cercospora Leaf Spot': 'Cercospora Yaprak Lekesi tespit edildi. Tedavi için:\n1. Bitki kalıntılarını temizleyin ve imha edin.\n2. Nem oranını düşürün, yaprak ıslaklık süresini azaltın.\n3. Kimyasal mücadelede bakırlı ilaçlar veya uygun koruyucu fungusitler kullanın.',
            'Common Rust': 'Pas Hastalığı tespit edildi. Tedavi için:\n1. Pas püstülleri olan yaprakları koparıp imha edin.\n2. Bitkiler arasında yeterli mesafe bırakarak havalandırmayı iyileştirin.\n3. Bakır veya kükürt içerikli fungusitler ile ilaçlama yapın.',
            'Northern Leaf Blight': 'Kuzey Yaprak Yanıklığı tespit edildi. Tedavi için:\n1. Hastalıklı bitki artıklarını tarladan uzaklaştırın.\n2. Gelecek sezon için ekim nöbeti (münavebe) uygulayın.\n3. Şiddetli durumlarda triazol veya strobilurin grubu fungusitler kullanın.',
            'Esca (Black Measles)': 'Esca (Siyah Kızamık) tespit edildi. Tedavi için:\n1. Budama aletlerini her kesimden sonra mutlaka dezenfekte edin.\n2. Budama yaralarını aşı macunu ile kapatın.\n3. Şiddetli enfekte olmuş yaşlı asmaları söküp yakın.',
            'Leaf Blight': 'Yaprak Yanıklığı tespit edildi. Tedavi için:\n1. Enfekte yaprakları budayarak bitkiden uzaklaştırın.\n2. Bakır içerikli mantar ilaçları ile koruyucu ilaçlama yapın.\n3. Yaprakları kuru tutmaya özen gösterin, damlama sulama kullanın.',
            'Bacterial Spot': 'Bakteriyel Leke hastalığı tespit edildi. Tedavi için:\n1. Bakteriyel bir hastalık olduğu için normal mantar ilaçları etki etmez, bakır bazlı bakterisitler kullanın.\n2. Tarım aletlerini sık sık sterilize edin.\n3. Hastalıklı bitki kalıntılarını tarlada bırakmayın.',
            'Early Blight': 'Erken Yanıklık tespit edildi. Tedavi için:\n1. Alt yaprakları budayarak toprakla temasını kesin.\n2. Düzenli olarak dengeli gübreleme yaparak bitki direncini artırın.\n3. Bakırlı ilaçlar veya chlorothalonil içerikli koruyucu ilaçlar uygulayın.',
            'Late Blight': 'Geç Yanıklık (Mildiyö) tespit edildi (ÇOK RİSKLİ!). Tedavi için:\n1. Nemli ve serin havalarda hızla yayılır; sulamayı kesinlikle damlama olarak yapın.\n2. Hastalıklı tüm bitki kısımlarını hemen toplayıp yakın (kompost yapmayın).\n3. Metalaxyl, mancozeb veya bakır içerikli sistemik ilaçlar ile acilen ilaçlama yapın.',
            'Septoria Leaf Spot': 'Septoria Yaprak Lekesi tespit edildi. Tedavi için:\n1. Topraktan bulaşmayı önlemek için malçlama yapın.\n2. Alt yapraklarda lekeler başladığı anda budama yapın.\n3. Bakırlı mantar ilaçları veya koruyucu fungusitler kullanın.',
            'Yellow Leaf Curl Virus': 'Sarı Yaprak Kıvırma Virüsü tespit edildi. Tedavi için:\n1. Virüsü yayan Beyaz Sinek (Bemisia tabaci) ile kimyasal veya biyolojik olarak acilen mücadele edin.\n2. Enfekte edilmiş bitkileri derhal söküp plastik torbalara koyarak tarladan uzaklaştırın.\n3. Seralarda sinek tülleri ve yapışkan sarı tuzaklar kullanın.',
            'Leaf Scorch': 'Yaprak Yanıklığı (Yaprak Yanığı) tespit edildi. Tedavi için:\n1. Enfekte olmuş çilek yapraklarını derhal temizleyin ve bahçeden uzaklaştırın.\n2. Damlama sulama tercih ederek yaprakların ıslak kalma süresini en aza indirin.\n3. Hastalık yayılımını önlemek amacıyla ilkbahar döneminde bakırlı koruyucu fungusitler kullanın.'
        };

        const diseaseNamesTr = {
            'Healthy': 'Sağlıklı',
            'Apple Scab': 'Elma Karalekesi',
            'Black Rot': 'Siyah Çürüklük',
            'Cedar Apple Rust': 'Sedir-Elma Pası',
            'Powdery Mildew': 'Külleme',
            'Cercospora Leaf Spot': 'Cercospora Yaprak Lekesi',
            'Common Rust': 'Pas Hastalığı',
            'Northern Leaf Blight': 'Kuzey Yaprak Yanıklığı',
            'Esca (Black Measles)': 'Esca (Siyah Kızamık)',
            'Leaf Blight': 'Yaprak Yanıklığı',
            'Bacterial Spot': 'Bakteriyel Leke',
            'Early Blight': 'Erken Yanıklık',
            'Late Blight': 'Geç Yanıklık',
            'Septoria Leaf Spot': 'Septoria Yaprak Lekesi',
            'Yellow Leaf Curl Virus': 'Sarı Yaprak Kıvırma Virüsü',
            'Leaf Scorch': 'Yaprak Yanıklığı'
        };

        // 3. Hastalık İlişkilerini Ekle
        const plantDiseases = {
            apple: ['Healthy', 'Apple Scab', 'Black Rot', 'Cedar Apple Rust'],
            cherry: ['Healthy', 'Powdery Mildew'],
            corn: ['Healthy', 'Cercospora Leaf Spot', 'Common Rust', 'Northern Leaf Blight'],
            grape: ['Healthy', 'Black Rot', 'Powdery Mildew', 'Esca (Black Measles)', 'Leaf Blight'],
            peach: ['Healthy', 'Bacterial Spot'],
            potato: ['Healthy', 'Early Blight', 'Late Blight'],
            strawberry: ['Healthy', 'Leaf Scorch'],
            tomato: ['Healthy', 'Bacterial Spot', 'Early Blight', 'Late Blight', 'Septoria Leaf Spot', 'Yellow Leaf Curl Virus'],
            bell_pepper: ['Healthy', 'Bacterial Spot']
        };

        let diseasesCount = 0;
        for (const [plantKey, dList] of Object.entries(plantDiseases)) {
            const plantId = plantIds[plantKey];
            if (!plantId) continue;

            for (const dKey of dList) {
                const trName = diseaseNamesTr[dKey] || dKey;
                const recommendation = treatments[dKey] || 'Sağlıklı bakım düzenine devam edin.';
                await db.query(
                    `INSERT INTO diseases (plant_id, key, name_tr, name_en, treatment_recommendation) 
                     VALUES ($1, $2, $3, $4, $5)`,
                    [plantId, dKey, trName, dKey, recommendation]
                );
                diseasesCount++;
            }
        }
        logger.success(`✅ ${diseasesCount} hastalık ve tedavi önerisi ilişkisel olarak eklendi.`);
    } catch (err) {
        logger.error('❌ Veri tabanı seed hatası:', err);
    }
}

module.exports = initializeDatabase;
