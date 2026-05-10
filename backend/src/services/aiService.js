const fs = require('fs');
const path = require('path');

// ─── Model Dosya Yolları (Proje kök dizininden) ──────────
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');
const YOLO_MODEL_PATH = path.join(PROJECT_ROOT, 'ai_model', 'active_models', 'yolo_leaf_best.pt');
const PLANT_MODEL_PATH = path.join(PROJECT_ROOT, 'ai_model', 'active_models', 'plant_mobilenetv3large_best.h5');
const CLASS_NAMES_PATH = path.join(PROJECT_ROOT, 'ai_model', 'active_models', 'class_names.txt');
const DISEASE_MODELS_DIR = path.join(PROJECT_ROOT, 'ai_model', 'active_models', 'disease_models');
const PIPELINE_SCRIPT = path.join(__dirname, 'predict_pipeline.py');

// Türkçe bitki isimleri haritası
const BITKI_TR = {
    apple: 'Elma', cherry: 'Kiraz', corn: 'Mısır', grape: 'Üzüm',
    peach: 'Şeftali', pepper_bell: 'Biber', potato: 'Patates',
    squash: 'Kabak', strawberry: 'Çilek', tea: 'Çay', tomato: 'Domates'
};

// Hastalık Türkçe isimleri
const HASTALIK_TR = {
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
    'Yellow Leaf Curl Virus': 'Sarı Yaprak Kıvırma Virüsü'
};

let modelsReady = false;
let classNames = [];

/**
 * Model dosyalarının varlığını kontrol eder ve sınıf isimlerini yükler.
 */
async function loadModel() {
    try {
        // Model dosyalarını kontrol et
        const requiredFiles = [
            { path: YOLO_MODEL_PATH, name: 'YOLO Model (yolo_leaf_best.pt)' },
            { path: PLANT_MODEL_PATH, name: 'Bitki Sınıflandırma (plant_mobilenetv3large_best.h5)' },
            { path: CLASS_NAMES_PATH, name: 'Sınıf İsimleri (class_names.txt)' },
            { path: PIPELINE_SCRIPT, name: 'Pipeline Script (predict_pipeline.py)' }
        ];

        for (const file of requiredFiles) {
            if (!fs.existsSync(file.path)) {
                console.error(`❌ ${file.name} bulunamadı: ${file.path}`);
                return false;
            }
            const stats = fs.statSync(file.path);
            console.log(`✅ ${file.name} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        }

        // Hastalık modelleri klasörünü kontrol et
        if (fs.existsSync(DISEASE_MODELS_DIR)) {
            const diseaseFiles = fs.readdirSync(DISEASE_MODELS_DIR).filter(f => f.endsWith('.keras'));
            console.log(`✅ Hastalık Modelleri: ${diseaseFiles.length} model bulundu`);
            diseaseFiles.forEach(f => {
                const bitkiAdi = f.replace('_disease_model.keras', '');
                const stats = fs.statSync(path.join(DISEASE_MODELS_DIR, f));
                console.log(`   🔬 ${BITKI_TR[bitkiAdi] || bitkiAdi} hastalık modeli (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            });
        } else {
            console.warn('⚠️ Hastalık modelleri klasörü bulunamadı:', DISEASE_MODELS_DIR);
        }

        // Sınıf isimlerini oku
        const rawNames = fs.readFileSync(CLASS_NAMES_PATH, 'utf-8');
        classNames = rawNames.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        console.log(`✅ ${classNames.length} bitki türü yüklendi: [${classNames.join(', ')}]`);

        modelsReady = true;
        console.log('\n🌿 3 Katmanlı AI Pipeline hazır!');
        console.log('   Katman 1: YOLO Yaprak Tespiti');
        console.log('   Katman 2: MobileNet Bitki Türü Sınıflandırma');
        console.log('   Katman 3: Hastalık Tespiti (Aktif ✅)\n');

        return true;
    } catch (error) {
        console.error('❌ Model yükleme hatası:', error);
        return false;
    }
}

/**
 * 3 Katmanlı AI Pipeline ile görüntü analizi.
 * Python predict_pipeline.py scriptini çalıştırır.
 * @param {Buffer} imageBuffer - JPEG/PNG ham görüntü verisi
 * @returns {Promise<Object>} Pipeline sonucu
 */
async function predict(imageBuffer) {
    if (!modelsReady) {
        throw new Error('Modeller henüz yüklenmedi. Lütfen sunucuyu yeniden başlatın.');
    }

    return new Promise((resolve, reject) => {
        // Görüntüyü geçici dosyaya kaydet
        const tempImagePath = path.join(__dirname, '..', '..', 'tmp_predict.jpg');
        fs.writeFileSync(tempImagePath, imageBuffer);

        const { spawn } = require('child_process');

        // Python yolu
        const pythonExecutable = process.env.PYTHON_PATH || 'python';
        console.log(`🔍 Python: ${pythonExecutable}`);
        console.log(`🚀 Pipeline başlatılıyor...`);

        // Komut: python predict_pipeline.py <yolo> <plant_model> <class_names> <image> <disease_dir>
        const pythonProcess = spawn(pythonExecutable, [
            PIPELINE_SCRIPT,
            YOLO_MODEL_PATH,
            PLANT_MODEL_PATH,
            CLASS_NAMES_PATH,
            tempImagePath,
            DISEASE_MODELS_DIR
        ]);

        let resultData = '';
        let errorData = '';

        pythonProcess.stdout.on('data', (data) => {
            resultData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorData += data.toString();
        });

        pythonProcess.on('close', (code) => {
            // Geçici resmi temizle
            if (fs.existsSync(tempImagePath)) {
                fs.unlinkSync(tempImagePath);
            }

            // stderr'deki debug loglarını göster (ama hata değil)
            if (errorData && errorData.includes('[Katman3 Debug]')) {
                console.log('🔬 Katman 3 Debug:', errorData.trim());
            }

            if (code !== 0) {
                console.error("Python Hatası (stderr):", errorData);
                return resolve({
                    basarili: false,
                    hata: "Python pipeline hatası. " + errorData.substring(0, 200),
                    detay: "Lütfen Python ortamında ultralytics, tensorflow/tf_keras, pillow, numpy kurulu olduğundan emin olun."
                });
            }

            try {
                const parsedResult = JSON.parse(resultData);

                if (!parsedResult.basarili) {
                    return resolve({
                        basarili: false,
                        hata: parsedResult.hata,
                        katman: parsedResult.katman || null,
                        dusuk_confidence: parsedResult.dusuk_confidence || false
                    });
                }

                // Pipeline sonuçlarını formatla
                const k1 = parsedResult.katman1_yaprak;
                const k2 = parsedResult.katman2_bitki;
                const k3 = parsedResult.katman3_hastalik;

                console.log(`  📍 Katman 1: Yaprak bulundu (güven: %${(k1.confidence * 100).toFixed(1)})`);
                console.log(`  🌿 Katman 2: ${k2.tur_tr} (güven: %${(k2.confidence * 100).toFixed(1)})`);

                // Katman 3 log
                if (k3.durum === 'tespit_edildi') {
                    const emoji = k3.saglikli ? '✅' : '🔴';
                    console.log(`  🔬 Katman 3: ${emoji} ${k3.hastalik_tr} (güven: %${(k3.confidence * 100).toFixed(1)})`);
                    if (k3.dusuk_confidence) {
                        console.log(`  ⚠️ Katman 3: Düşük güven oranı!`);
                    }
                } else {
                    console.log(`  🔬 Katman 3: ${k3.durum} - ${k3.mesaj || ''}`);
                }

                resolve({
                    basarili: true,
                    tahmin: {
                        bitki: k2.tur_tr,
                        bitki_key: k2.tur,
                        hastalik: k3.hastalik_tr || null,
                        saglikli: k3.saglikli,
                        hastalik_durumu: k3.durum // 'tespit_edildi' | 'model_yok' | 'hata'
                    },
                    katman1_yaprak: {
                        tespit_edildi: k1.tespit_edildi,
                        confidence: parseFloat((k1.confidence * 100).toFixed(1)),
                        bbox: k1.bbox,
                        toplam_tespit: k1.toplam_tespit
                    },
                    katman2_bitki: {
                        tur: k2.tur,
                        tur_tr: k2.tur_tr,
                        confidence: parseFloat((k2.confidence * 100).toFixed(1)),
                        top3: (k2.top3 || []).map(t => ({
                            tur: t.tur,
                            tur_tr: t.tur_tr,
                            confidence: parseFloat((t.confidence * 100).toFixed(1))
                        }))
                    },
                    katman3_hastalik: {
                        durum: k3.durum,
                        hastalik: k3.hastalik || null,
                        hastalik_tr: k3.hastalik_tr || null,
                        saglikli: k3.saglikli,
                        confidence: k3.confidence ? parseFloat((k3.confidence * 100).toFixed(1)) : null,
                        dusuk_confidence: k3.dusuk_confidence || false,
                        mesaj: k3.mesaj || null,
                        top3: (k3.top3 || []).map(t => ({
                            hastalik: t.hastalik,
                            hastalik_tr: t.hastalik_tr,
                            confidence: parseFloat((t.confidence * 100).toFixed(1))
                        }))
                    }
                });

            } catch (err) {
                console.error("JSON Parse Hatası:", resultData);
                resolve({ basarili: false, hata: "Python çıktısı anlaşılamadı." });
            }
        });
    });
}

/**
 * Desteklenen bitki türlerini döndürür
 */
function getLabels() {
    return classNames.map((name, index) => ({
        index,
        key: name,
        isim: BITKI_TR[name] || name.capitalize?.() || name
    }));
}

module.exports = {
    loadModel,
    predict,
    getLabels
};
