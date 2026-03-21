const tf = require('@tensorflow/tfjs');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Model ve etiket dosyalarının yolları
const MODEL_DIR = path.join(__dirname, '..', 'model');
const LABELS_PATH = path.join(MODEL_DIR, 'etiketler.txt');
const TFLITE_PATH = path.join(MODEL_DIR, 'bitki_modeli.tflite');

// Türkçe bitki ve hastalık isimleri haritası
const BITKI_TR = {
    apple: 'Elma', cherry: 'Kiraz', corn: 'Mısır', grape: 'Üzüm',
    peach: 'Şeftali', pepper_bell: 'Biber', potato: 'Patates',
    squash: 'Kabak', strawberry: 'Çilek', tea: 'Çay', tomato: 'Domates'
};

const HASTALIK_TR = {
    healthy: 'Sağlıklı',
    black_rot: 'Siyah Çürüklük',
    cedar_apple_rust: 'Sedir-Elma Pası',
    scab: 'Karaleke',
    powdery_mildew: 'Külleme',
    cercospora_leaf_spot: 'Cercospora Yaprak Lekesi',
    common_rust: 'Pas Hastalığı',
    northern_leaf_blight: 'Kuzey Yaprak Yanıklığı',
    esca_black_measles: 'Esca (Siyah Kızamık)',
    leaf_blight: 'Yaprak Yanıklığı',
    bacterial_spot: 'Bakteriyel Leke',
    early_blight: 'Erken Yanıklık',
    late_blight: 'Geç Yanıklık',
    leaf_scorch: 'Yaprak Yanığı',
    algal_leaf: 'Alg Yaprak Hastalığı',
    anthracnose: 'Antrakoz',
    bird_eye_spot: 'Kuş Gözü Lekesi',
    brown_blight: 'Kahverengi Yanıklık',
    red_leaf_spot: 'Kırmızı Yaprak Lekesi',
    leaf_mold: 'Yaprak Küfü',
    mosaic_virus: 'Mozaik Virüsü',
    septoria_leaf_spot: 'Septoria Yaprak Lekesi',
    target_spot: 'Hedef Lekesi',
    yellow_leaf_curl_virus: 'Sarı Yaprak Kıvırma Virüsü'
};

let model = null;
let labels = [];

/**
 * TFLite modelini TensorFlow.js GraphModel olarak yükler.
 * NOT: tfjs-node, .tflite dosyasını doğrudan yükleyemez.
 * Bu nedenle modelin önceden SavedModel veya tfjs formatına dönüştürülmesi 
 * veya tflite-interpreter kullanılması gerekir.
 * 
 * Eğer tflite dosyası varsa, onu Node.js'de çalıştırmak için
 * @tensorflow/tfjs-tflite veya tflite-runtime-node kullanılır.
 * 
 * Burada en güvenilir yaklaşım: tflite dosyasını doğrudan 
 * TFLite Interpreter ile çalıştırma.
 */
async function loadModel() {
    try {
        // Etiketleri yükle
        const labelsRaw = fs.readFileSync(LABELS_PATH, 'utf-8');
        labels = labelsRaw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        console.log(`✅ ${labels.length} etiket başarıyla yüklendi.`);

        // TFLite dosyasını Buffer olarak oku
        const modelBuffer = fs.readFileSync(TFLITE_PATH);
        model = { buffer: modelBuffer, type: 'tflite' };
        
        console.log(`✅ TFLite modeli belleğe yüklendi (${(modelBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
        return true;
    } catch (error) {
        console.error('❌ Model yükleme hatası:', error);
        return false;
    }
}

/**
 * Görüntüyü 224x224 boyutuna resize eder ve piksel verilerini 
 * 0-255 aralığında (normalize etmeden) Float32 formatına dönüştürür.
 * (Modelin içindeki entegre preprocessing katmanına uygun olarak)
 */
async function preprocessImage(imageBuffer) {
    // Sharp ile 224x224'e resize et ve raw RGB pikselleri al
    const { data, info } = await sharp(imageBuffer)
        .resize(224, 224, { fit: 'cover' })
        .removeAlpha()       // Alpha kanalını kaldır (sadece RGB)
        .raw()               // Raw pixel verileri
        .toBuffer({ resolveWithObject: true });

    // Float32Array'e dönüştür ve doğrudan 0-255 pixel değerlerini at
    // DİKKAT: Model içinde preprocess olduğundan /255 işlemi yapılmaz!
    const float32Data = new Float32Array(224 * 224 * 3);
    for (let i = 0; i < data.length; i++) {
        float32Data[i] = data[i]; // Direkt ham (0-255) değeri al
    }

    // TensorFlow.js tensor'üne çevir [1, 224, 224, 3] (batch=1)
    const tensor = tf.tensor4d(float32Data, [1, 224, 224, 3]);

    return tensor;
}

/**
 * Etiket string'ini Türkçe bitki adı ve hastalık adına ayırır.
 * Örn: "tomato_early_blight" → { bitki: "Domates", hastalik: "Erken Yanıklık" }
 */
function parseLabel(label) {
    const parts = label.split('_');
    let bitkiKey = parts[0];
    let hastalikKey = '';

    // pepper_bell gibi iki kelimelik bitki isimlerini yakala
    if (parts[0] === 'pepper' && parts[1] === 'bell') {
        bitkiKey = 'pepper_bell';
        hastalikKey = parts.slice(2).join('_');
    } else {
        hastalikKey = parts.slice(1).join('_');
    }

    return {
        bitki: BITKI_TR[bitkiKey] || bitkiKey,
        hastalik: HASTALIK_TR[hastalikKey] || hastalikKey,
        saglikli: hastalikKey === 'healthy'
    };
}

/**
 * Görüntüden tahmin yapar.
 * @param {Buffer} imageBuffer - JPEG/PNG ham görüntü verisi
 * @returns {{ basarili, tahmin, topEnSonuclar }}
 */
async function predict(imageBuffer) {
    if (!model) {
        throw new Error('Model henüz yüklenmedi. Lütfen sunucuyu yeniden başlatın.');
    }

    // NOT: Node.js üzerinden saf .tflite desteklenmediği için, oluşturduğumuz predict.py dosyasını Python ile çalıştırıyoruz.
    return new Promise((resolve, reject) => {
        // Görüntüyü geçici bir dosyaya kaydet
        const fs = require('fs');
        const path = require('path');
        const tempImagePath = path.join(__dirname, '..', '..', 'tmp_predict.jpg');
        const scriptPath = path.join(__dirname, 'predict.py');
        
        fs.writeFileSync(tempImagePath, imageBuffer);

        const { spawn } = require('child_process');
        
        // Python çalıştırılabilir yolunu belirle: 
        // 1. Önce .env dosyasındaki PYTHON_PATH (Varsa)
        // 2. Yoksa sistemdeki 'python' komutu
        const pythonExecutable = process.env.PYTHON_PATH || 'python';
        
        // Komut: <python> predict.py <model_yolu> <resim_yolu> <etiket_yolu>
        const pythonProcess = spawn(pythonExecutable, [
            scriptPath,
            TFLITE_PATH,
            tempImagePath,
            LABELS_PATH
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
            // İşi biten geçici resmi sil
            if (fs.existsSync(tempImagePath)) {
                fs.unlinkSync(tempImagePath);
            }

            if (code !== 0) {
                console.error("Python Hatası:", errorData);
                return resolve({
                    basarili: false,
                    hata: "Python betiği hatası. Lütfen terminalden Python kütüphanelerinin (tensorflow, pillow, numpy) kurulu olduğundan emin olun."
                });
            }

            try {
                // Python'dan JSON olarak dönen veriyi parse et
                const parsedResult = JSON.parse(resultData);
                if (!parsedResult.basarili) {
                    return resolve({ basarili: false, hata: parsedResult.hata });
                }

                // Python 5 sonuç dönecek, bunlar topEnSonuclar
                const top5 = parsedResult.sonuclar;
                const bestMatch = top5[0];
                const bestLabel = bestMatch.etiket;
                const parsed = parseLabel(bestLabel);

                // Kural: Confidence 0.50'nin altındaysa sonuç gösterme, tekrar çekilmesini iste
                if (bestMatch.oran < 0.50) {
                    return resolve({
                        basarili: false,
                        hata: "Emin değilim. Lütfen yaprağı tam merkeze alarak (arka plan sade olacak şekilde) net bir fotoğraf çekin."
                    });
                }

                resolve({
                    basarili: true,
                    tahmin: {
                        etiket: bestLabel,
                        bitki: parsed.bitki,
                        hastalik: parsed.hastalik,
                        saglikli: parsed.saglikli,
                        guvenOrani: parseFloat((bestMatch.oran * 100).toFixed(1))
                    },
                    topEnSonuclar: top5.map(item => ({
                        etiket: item.etiket,
                        ...parseLabel(item.etiket),
                        oran: parseFloat((item.oran * 100).toFixed(1))
                    }))
                });

            } catch (err) {
                console.error("JSON Parse Hatası (Python çıktısı):", resultData);
                resolve({ basarili: false, hata: "Python çıktısı anlaşılamadı." });
            }
        });
    });
}

/**
 * Yüklü etiketlerin listesini döndürür
 */
function getLabels() {
    return labels.map((label, index) => ({
        index,
        etiket: label,
        ...parseLabel(label)
    }));
}

module.exports = {
    loadModel,
    predict,
    getLabels
};
