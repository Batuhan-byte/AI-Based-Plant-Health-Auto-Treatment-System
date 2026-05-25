const fs = require('fs');
const path = require('path');

// Log dizinini ve dosyasını ayarla
const LOGS_DIR = path.join(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'app.log');

// Log dizini yoksa oluştur
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Konsol için ANSI renk kodları
const COLORS = {
    reset: '\x1b[0m',
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warn: '\x1b[33m',    // Yellow
    error: '\x1b[31m',   // Red
    magenta: '\x1b[35m'  // Magenta (Python Daemon için özel)
};

/**
 * Zaman damgası üretir (TR formatına uygun)
 */
function getTimestamp() {
    const now = new Date();
    return now.toLocaleString('tr-TR', { hour12: false });
}

/**
 * Log satırını dosyaya asenkron yazar (arka planda)
 */
function writeToFile(level, message) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] ${message}\n`;
    
    // Hataları engellemek için sessizce append et
    fs.appendFile(LOG_FILE, logLine, { encoding: 'utf8' }, (err) => {
        if (err) {
            process.stderr.write(`❌ Log dosyasına yazılamadı: ${err.message}\n`);
        }
    });
}

const logger = {
    info: (msg, ...args) => {
        const message = args.length ? `${msg} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}` : msg;
        console.log(`${COLORS.info}[BILGI] [${getTimestamp()}]${COLORS.reset} ${message}`);
        writeToFile('INFO', message);
    },
    
    success: (msg, ...args) => {
        const message = args.length ? `${msg} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}` : msg;
        console.log(`${COLORS.success}[BASARI] [${getTimestamp()}]${COLORS.reset} ${message}`);
        writeToFile('SUCCESS', message);
    },
    
    warn: (msg, ...args) => {
        const message = args.length ? `${msg} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}` : msg;
        console.warn(`${COLORS.warn}[UYARI] [${getTimestamp()}]${COLORS.reset} ${message}`);
        writeToFile('WARN', message);
    },
    
    error: (msg, errorObj = null) => {
        let message = msg;
        if (errorObj) {
            message += ` | Hata: ${errorObj.message || errorObj}`;
            if (errorObj.stack) {
                // Stack trace'i sadece log dosyasına detaylı yaz, konsola kısa yaz
                writeToFile('ERROR_STACK', errorObj.stack);
            }
        }
        console.error(`${COLORS.error}[HATA] [${getTimestamp()}]${COLORS.reset} ${message}`);
        writeToFile('ERROR', message);
    },

    python: (msg) => {
        // Python Daemon çıktısı için özel format
        console.log(`${COLORS.magenta}[PYTHON] [${getTimestamp()}]${COLORS.reset} ${msg}`);
        writeToFile('PYTHON', msg);
    }
};

module.exports = logger;
