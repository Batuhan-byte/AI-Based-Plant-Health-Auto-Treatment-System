const fs = require('fs');
const path = require('path');
const http = require('http');
const logger = require('../utils/logger');

// ─── Model Dosya Yolları (Proje kök dizininden) ──────────
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');
const YOLO_MODEL_PATH = path.join(PROJECT_ROOT, 'ai_model', 'active_models', 'yolo_leaf_best.pt');
const PLANT_MODEL_PATH = path.join(PROJECT_ROOT, 'ai_model', 'active_models', 'plant_mobilenetv3large_best.keras');
const CLASS_NAMES_PATH = path.join(PROJECT_ROOT, 'ai_model', 'active_models', 'class_names.txt');
const DISEASE_MODELS_DIR = path.join(PROJECT_ROOT, 'ai_model', 'active_models', 'disease_models');
const PIPELINE_SCRIPT = path.join(__dirname, 'predict_pipeline.py');

// ─── Daemon Yapılandırması ─────────────────────────────────
const DAEMON_PORT = parseInt(process.env.AI_DAEMON_PORT, 10) || 5005;
const DAEMON_HOST = '127.0.0.1';
const DAEMON_HEALTH_URL = `http://${DAEMON_HOST}:${DAEMON_PORT}/health`;
const DAEMON_STARTUP_TIMEOUT_MS = 120000; // Model yükleme için 2 dakika limit
const DAEMON_HEALTH_POLL_INTERVAL_MS = 1000;

// Türkçe bitki isimleri haritası
const BITKI_TR = {
    apple: 'Elma', cherry: 'Kiraz', corn: 'Mısır', grape: 'Üzüm',
    peach: 'Şeftali', pepper_bell: 'Biber', bell_pepper: 'Biber', potato: 'Patates',
    squash: 'Kabak', strawberry: 'Çilek', tea: 'Çay', tomato: 'Domates'
};

// Türkçe hastalık isimleri haritası
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
    'Yellow Leaf Curl Virus': 'Sarı Yaprak Kıvırma Virüsü',
    'Leaf Scorch': 'Yaprak Yanıklığı'
};

let modelsReady = false;
let classNames = [];
let daemonProcess = null; // Python daemon child process referansı

/**
 * Model dosyalarının varlığını kontrol eder, sınıf isimlerini yükler
 * ve Python daemon sürecini başlatır.
 */
async function loadModel() {
    try {
        // Model dosyalarını kontrol et
        const requiredFiles = [
            { path: YOLO_MODEL_PATH, name: 'YOLO Model (yolo_leaf_best.pt)' },
            { path: PLANT_MODEL_PATH, name: 'Bitki Sınıflandırma (plant_mobilenetv3large_best.keras)' },
            { path: CLASS_NAMES_PATH, name: 'Sınıf İsimleri (class_names.txt)' },
            { path: PIPELINE_SCRIPT, name: 'Pipeline Script (predict_pipeline.py)' }
        ];

        for (const file of requiredFiles) {
            if (!fs.existsSync(file.path)) {
                logger.error(`${file.name} bulunamadı: ${file.path}`);
                return false;
            }
            const stats = fs.statSync(file.path);
            logger.info(`✅ ${file.name} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        }

        // Hastalık modelleri klasörünü kontrol et
        if (fs.existsSync(DISEASE_MODELS_DIR)) {
            const diseaseFiles = fs.readdirSync(DISEASE_MODELS_DIR).filter(f => f.endsWith('.keras'));
            logger.success(`Hastalık Modelleri: ${diseaseFiles.length} model bulundu`);
            diseaseFiles.forEach(f => {
                const bitkiAdi = f.replace('_disease_model.keras', '');
                const stats = fs.statSync(path.join(DISEASE_MODELS_DIR, f));
                logger.info(`   🔬 ${BITKI_TR[bitkiAdi] || bitkiAdi} hastalık modeli (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            });
        } else {
            logger.warn('⚠️ Hastalık modelleri klasörü bulunamadı:', DISEASE_MODELS_DIR);
        }

        // Sınıf isimlerini oku
        const rawNames = fs.readFileSync(CLASS_NAMES_PATH, 'utf-8');
        classNames = rawNames.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        logger.success(`${classNames.length} bitki türü başarıyla yüklendi: [${classNames.join(', ')}]`);

        // ═══ DAEMON BAŞLATMA ═══
        logger.info('🚀 AI Inference Daemon başlatılıyor...');
        const { spawn } = require('child_process');
        const pythonExecutable = process.env.PYTHON_PATH || 'python';

        daemonProcess = spawn(pythonExecutable, [
            PIPELINE_SCRIPT,
            '--server',
            YOLO_MODEL_PATH,
            PLANT_MODEL_PATH,
            CLASS_NAMES_PATH,
            DISEASE_MODELS_DIR,
            '--port', String(DAEMON_PORT)
        ], {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        // Daemon stderr loglarını yönlendir
        daemonProcess.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) logger.python(msg);
        });

        // Daemon stdout loglarını yönlendir (varsa)
        daemonProcess.stdout.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) logger.python(`[stdout] ${msg}`);
        });

        daemonProcess.on('error', (err) => {
            logger.error('Python daemon başlatma hatası', err);
            daemonProcess = null;
        });

        daemonProcess.on('exit', (code, signal) => {
            logger.warn(`⚠️ Python daemon sonlandı (code=${code}, signal=${signal})`);
            daemonProcess = null;
            modelsReady = false;
        });

        // Daemon'un hazır olmasını bekle (health check polling)
        const ready = await waitForDaemon();
        if (!ready) {
            logger.error('❌ AI Daemon başlatılamadı! Timeout süresi doldu.');
            shutdown();
            return false;
        }

        modelsReady = true;
        logger.success('🌿 3 Katmanlı AI Pipeline (Daemon Modu) başarıyla çalışıyor!');
        logger.info(`   🔗 Daemon bağlantısı: http://${DAEMON_HOST}:${DAEMON_PORT}\n`);

        return true;
    } catch (error) {
        logger.error('Model yükleme hatası', error);
        return false;
    }
}

/**
 * Daemon'un hazır olmasını health endpoint üzerinden bekler.
 */
function waitForDaemon() {
    return new Promise((resolve) => {
        const startTime = Date.now();

        const poll = () => {
            if (!daemonProcess) {
                return resolve(false);
            }

            const req = http.get(DAEMON_HEALTH_URL, (res) => {
                let body = '';
                res.on('data', (chunk) => { body += chunk; });
                res.on('end', () => {
                    try {
                        const data = JSON.parse(body);
                        if (data.status === 'ready') {
                            return resolve(true);
                        }
                    } catch (e) { /* ignore parse errors */ }
                    setTimeout(poll, DAEMON_HEALTH_POLL_INTERVAL_MS);
                });
            });

            req.on('error', () => {
                if (Date.now() - startTime > DAEMON_STARTUP_TIMEOUT_MS) {
                    return resolve(false);
                }
                setTimeout(poll, DAEMON_HEALTH_POLL_INTERVAL_MS);
            });

            req.end();
        };

        poll();
    });
}

/**
 * AI Daemon'ı yeniden başlatır (Self-Healing)
 */
async function restartDaemon() {
    logger.warn('🔄 AI Daemon çökmesi tespit edildi. Kendi kendini iyileştirme (Self-Healing) başlatılıyor...');
    shutdown();
    // Sürecin temiz kapandığından emin olmak için kısa bir bekleme
    await new Promise(resolve => setTimeout(resolve, 1500));
    return await loadModel();
}

/**
 * 3 Katmanlı AI Pipeline ile görüntü analizi.
 * Python daemon'a HTTP POST ile görüntü gönderir. Bağlantı hatası durumunda Self-Healing tetikler.
 * @param {Buffer} imageBuffer - JPEG/PNG ham görüntü verisi
 * @param {boolean} isRetry - İstek otomatik tekrarlanıyorsa sonsuz döngüyü önler
 * @returns {Promise<Object>} Pipeline sonucu
 */
async function predict(imageBuffer, isRetry = false) {
    if (!modelsReady || !daemonProcess) {
        if (!isRetry) {
            const restarted = await restartDaemon();
            if (restarted) {
                return predict(imageBuffer, true);
            }
        }
        throw new Error('AI Daemon çalışmıyor ve kendi kendini iyileştirme mekanizması ile yeniden başlatılamadı.');
    }

    try {
        return await performPredictRequest(imageBuffer);
    } catch (err) {
        // Çökme veya bağlantı kesilmesi durumlarını yakala
        const isConnectionError = ['ECONNREFUSED', 'EPIPE', 'ECONNRESET', 'ETIMEDOUT'].includes(err.code) || err.message.includes('socket');
        
        if (isConnectionError && !isRetry) {
            logger.error(`⚠️ AI Daemon ile iletişim kurulamadı (${err.code || err.message}). Otomatik kurtarma başlatılıyor...`);
            
            const restarted = await restartDaemon();
            if (restarted) {
                logger.success('✅ AI Daemon başarıyla kurtarıldı! Teşhis isteği yeniden gönderiliyor...');
                try {
                    return await predict(imageBuffer, true);
                } catch (retryErr) {
                    logger.error('❌ Kurtarma sonrasında da istek başarısız oldu:', retryErr);
                    return {
                        basarili: false,
                        hata: 'AI Daemon kurtarıldı fakat analiz yine de gerçekleştirilemedi: ' + retryErr.message
                    };
                }
            } else {
                logger.error('❌ AI Daemon otomatik kurtarma başarısız oldu.');
                return {
                    basarili: false,
                    hata: 'AI Daemon bağlantısı kesildi ve otomatik kurtarma mekanizması başarısız oldu.'
                };
            }
        }
        
        logger.error('Çıkarım (Inference) Hatası:', err);
        return {
            basarili: false,
            hata: 'Tahmin işlemi sırasında bir hata oluştu: ' + err.message
        };
    }
}

/**
 * Daemon'a ham HTTP isteği gönderir
 */
function performPredictRequest(imageBuffer) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: DAEMON_HOST,
            port: DAEMON_PORT,
            path: '/predict',
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Length': imageBuffer.length
            }
        };

        const startTime = Date.now();

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                const elapsed = Date.now() - startTime;
                logger.info(`⚡ Daemon yanıt süresi: ${elapsed}ms`);

                try {
                    const parsedResult = JSON.parse(body);

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

                    // Türkçe Çevirileri Yap (Node.js tarafında)
                    const getPlantTr = (key) => {
                        if (!key) return 'Bilinmeyen Bitki';
                        const normalized = key.replace(' ', '_');
                        return BITKI_TR[normalized] || key.charAt(0).toUpperCase() + key.slice(1);
                    };
                    const getDiseaseTr = (key) => {
                        if (!key) return 'Sağlıklı';
                        return HASTALIK_TR[key] || key;
                    };

                    k2.tur_tr = getPlantTr(k2.tur);
                    (k2.top3 || []).forEach(t => { t.tur_tr = getPlantTr(t.tur); });

                    k3.hastalik_tr = getDiseaseTr(k3.hastalik);
                    (k3.top3 || []).forEach(t => { t.hastalik_tr = getDiseaseTr(t.hastalik); });

                    logger.success(`  📍 Katman 1: Yaprak bulundu (güven: %${(k1.confidence * 100).toFixed(1)})`);
                    logger.success(`  🌿 Katman 2: ${k2.tur_tr} (güven: %${(k2.confidence * 100).toFixed(1)})`);

                    if (k3.durum === 'tespit_edildi') {
                        const emoji = k3.saglikli ? '✅' : '🔴';
                        logger.success(`  🔬 Katman 3: ${emoji} ${k3.hastalik_tr} (güven: %${(k3.confidence * 100).toFixed(1)})`);
                        if (k3.dusuk_confidence) {
                            logger.warn(`  ⚠️ Katman 3: Düşük güven oranı!`);
                        }
                    } else {
                        logger.info(`  🔬 Katman 3: ${k3.durum} - ${k3.mesaj || ''}`);
                    }

                    resolve({
                        basarili: true,
                        tahmin: {
                            bitki: k2.tur_tr,
                            bitki_key: k2.tur,
                            hastalik: k3.hastalik_tr || null,
                            saglikli: k3.saglikli,
                            hastalik_durumu: k3.durum
                        },
                        katman1_yaprak: {
                            tespit_edildi: k1.tespit_edildi,
                            confidence: parseFloat((k1.confidence * 100).toFixed(1)),
                            bbox: k1.bbox,
                            toplam_tespit: k1.toplam_tespit,
                            crop_base64: k1.crop_base64
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
                        },
                        sure_ms: elapsed
                    });
                } catch (err) {
                    logger.error('JSON Parse Hatası:', err);
                    resolve({ basarili: false, hata: 'Daemon çıktısı anlaşılamadı.' });
                }
            });
        });

        req.on('error', (err) => {
            reject(err); // reject so the outer try-catch can trigger self-healing retry
        });

        req.setTimeout(60000, () => {
            req.destroy();
            reject(new Error('Daemon yanıt zaman aşımı (60s).'));
        });

        // Görüntüyü raw bytes olarak gönder
        req.write(imageBuffer);
        req.end();
    });
}

/**
 * Desteklenen bitki türlerini döndürür
 */
function getLabels() {
    return classNames.map((name, index) => ({
        index,
        key: name,
        isim: BITKI_TR[name] || name.charAt(0).toUpperCase() + name.slice(1)
    }));
}

/**
 * Python daemon sürecini temiz bir şekilde kapatır.
 */
function shutdown() {
    if (daemonProcess) {
        logger.info('🛑 AI Daemon durduruluyor...');
        daemonProcess.kill('SIGTERM');
        
        // 5 saniye içinde kapanmazsa zorla öldür
        const forceKillTimer = setTimeout(() => {
            if (daemonProcess) {
                logger.warn('⚠️ Daemon SIGTERM\'e yanıt vermedi, SIGKILL gönderiliyor...');
                daemonProcess.kill('SIGKILL');
            }
        }, 5000);
        
        daemonProcess.on('exit', () => {
            clearTimeout(forceKillTimer);
            logger.success('✅ AI Daemon başarıyla kapatıldı.');
            daemonProcess = null;
            modelsReady = false;
        });
    }
}

module.exports = {
    loadModel,
    predict,
    getLabels,
    shutdown,
    get modelsReady() { return modelsReady; }
};
