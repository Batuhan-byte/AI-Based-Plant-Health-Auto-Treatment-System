const fs = require('fs');
const https = require('https');
const path = require('path');

const dir = path.join(__dirname, 'assets', 'videos');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// Güvenilir, açık kaynaklı MP4 hava durumu repo dosyaları
const urls = {
    sunny: 'https://raw.githubusercontent.com/mawaqit/mobile-assets/main/weather-videos/clear.mp4',
    cloudy: 'https://raw.githubusercontent.com/mawaqit/mobile-assets/main/weather-videos/cloudsv2.mp4',
    rain: 'https://raw.githubusercontent.com/mawaqit/mobile-assets/main/weather-videos/light_rain.mp4',
    storm: 'https://raw.githubusercontent.com/mawaqit/mobile-assets/main/weather-videos/thunderstorm.mp4',
    
    // Diğerleri 404 hata atmasına karşı Pixabay CDN açık linkleri
    snow: 'https://cdn.pixabay.com/video/2019/11/04/28731-371520638_tiny.mp4', // Karlı orman
    fog: 'https://cdn.pixabay.com/video/2020/06/03/40939-428612502_tiny.mp4', // Sisli orman
    default: 'https://cdn.pixabay.com/video/2020/05/17/40049-424536214_tiny.mp4' // Güneşli bulutlar
};

async function download() {
    for (const [key, rawUrl] of Object.entries(urls)) {
        const dest = path.join(dir, `${key}.mp4`);
        if (!fs.existsSync(dest)) {
            console.log(`Downloading ${key}...`);
            await new Promise((resolve) => {
                https.get(rawUrl, (res) => {
                    if (res.statusCode === 200 || res.statusCode === 302) { // Pixabay redirect atar
                        if(res.statusCode === 302) {
                            https.get(res.headers.location, (redirectRes) => {
                                const file = fs.createWriteStream(dest);
                                redirectRes.pipe(file);
                                file.on('finish', () => { file.close(); resolve(); });
                            });
                        } else {
                            const file = fs.createWriteStream(dest);
                            res.pipe(file);
                            file.on('finish', () => { file.close(); resolve(); });
                        }
                    } else {
                        console.log(`Hata ${key}:`, res.statusCode);
                        // Hata alırsan varsayılan URL'ye dön
                        https.get(urls.default, (fb) => {
                             const file = fs.createWriteStream(dest);
                             fb.pipe(file);
                             file.on('finish', () => { file.close(); resolve(); });
                        });
                    }
                }).on('error', err => { console.log(err); resolve(); });
            });
        }
    }
    console.log("Tüm hava durumu videoları başarıyla assets/videos klasörüne indirildi!");
}

download();
