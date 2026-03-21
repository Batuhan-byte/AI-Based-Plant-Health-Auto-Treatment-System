"""
augment_dataset.py — Domain Shift Çözümü: Sentetik Veri Üretici

Stüdyo fotoğraflarındaki objelerin arka planlarını değiştirip
gerçek hayat senaryolarını simüle eden augment edilmiş veri seti üretir.

Kullanım:
    python augment_dataset.py --input datasets/train --output datasets/augmented --backgrounds backgrounds/

Gereksinimler:
    pip install rembg pillow numpy albumentations
"""

import os
import sys
import random
import argparse
from pathlib import Path

from PIL import Image, ImageFilter
import numpy as np

try:
    from rembg import remove as rembg_remove
except ImportError:
    print("HATA: rembg kurulu değil. Lütfen çalıştırın: pip install rembg[cpu]")
    sys.exit(1)

try:
    import albumentations as A
except ImportError:
    print("UYARI: albumentations kurulu değil. Sadece arka plan değişimi yapılacak.")
    A = None


def remove_bg(img):
    """Objeyi arka plandan ayır, RGBA döndür."""
    import io
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    result = rembg_remove(buf.getvalue())
    return Image.open(io.BytesIO(result)).convert('RGBA')


def paste_on_background(foreground_rgba, bg_img, target_size=(224, 224)):
    """Ön plan objesini rastgele bir arka plana yapıştır."""
    bg = bg_img.copy().resize(target_size)
    fg = foreground_rgba.resize(target_size)

    # Arka plan ve ön planı birleştir
    bg = bg.convert('RGBA')
    composite = Image.alpha_composite(bg, fg)
    return composite.convert('RGB')


def apply_augmentations(img_np):
    """Agresif data augmentation uygula."""
    if A is None:
        return img_np

    transform = A.Compose([
        # Gaussian Noise (Kumlanma)
        A.GaussNoise(p=0.5),
        # Gaussian Blur (Bulanıklık)
        A.GaussianBlur(blur_limit=(3, 7), p=0.3),
        # Color Jitter (Renk Değişimi)
        A.ColorJitter(
            brightness=(0.6, 1.4),
            contrast=(0.6, 1.4),
            saturation=(0.5, 1.5),
            hue=(-0.1, 0.1),
            p=0.7
        ),
        # Random Erasing / Cutout
        A.CoarseDropout(
            max_holes=3,
            max_height=30,
            max_width=30,
            fill_value=128,
            p=0.4
        ),
        # Yatay ve dikey çevirme
        A.HorizontalFlip(p=0.5),
        A.VerticalFlip(p=0.2),
        # Rastgele döndürme
        A.Rotate(limit=15, p=0.3),
    ])

    augmented = transform(image=img_np)
    return augmented['image']


def load_backgrounds(bg_dir):
    """Arka plan fotoğraflarını yükle."""
    bg_images = []
    if bg_dir and os.path.exists(bg_dir):
        for f in os.listdir(bg_dir):
            if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                try:
                    bg_images.append(Image.open(os.path.join(bg_dir, f)).convert('RGB'))
                except:
                    continue
    
    if not bg_images:
        # Arka plan klasörü yoksa rastgele renkli arka planlar üret
        print("⚠️  Arka plan klasörü bulunamadı! Rastgele katı renkler kullanılacak.")
        for _ in range(20):
            r, g, b = random.randint(0, 255), random.randint(0, 255), random.randint(0, 255)
            bg = Image.new('RGB', (224, 224), (r, g, b))
            bg_images.append(bg)
    
    return bg_images


def process_dataset(input_dir, output_dir, bg_dir, augments_per_image=3):
    """Ana işlem: tüm veri setini augment et."""
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    
    backgrounds = load_backgrounds(bg_dir)
    print(f"📦 {len(backgrounds)} arka plan yüklendi.")
    
    total_created = 0
    
    # Her sınıf klasörünü gez (train/Apple___healthy, train/Tomato___Late_blight vb.)
    for class_dir in sorted(input_path.iterdir()):
        if not class_dir.is_dir():
            continue
        
        class_name = class_dir.name
        out_class_dir = output_path / class_name
        out_class_dir.mkdir(parents=True, exist_ok=True)
        
        image_files = [f for f in class_dir.iterdir() 
                      if f.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp')]
        
        print(f"\n🌿 {class_name}: {len(image_files)} görüntü işleniyor...")
        
        for idx, img_file in enumerate(image_files):
            try:
                img = Image.open(img_file).convert('RGB')
                
                # 1. Orijinali de kaydet (opsiyonel)
                orig_out = out_class_dir / f"{img_file.stem}_orig{img_file.suffix}"
                img.save(orig_out)
                total_created += 1
                
                # 2. Arka planı kaldır
                fg_rgba = remove_bg(img)
                
                # 3. Her biri için farklı arka plan + augmentation
                for aug_idx in range(augments_per_image):
                    bg = random.choice(backgrounds)
                    composite = paste_on_background(fg_rgba, bg)
                    
                    # Augmentation uygula
                    composite_np = np.array(composite)
                    augmented_np = apply_augmentations(composite_np)
                    augmented_img = Image.fromarray(augmented_np)
                    
                    out_name = f"{img_file.stem}_aug{aug_idx}{img_file.suffix}"
                    augmented_img.save(out_class_dir / out_name)
                    total_created += 1
                
                if (idx + 1) % 10 == 0:
                    print(f"   ✅ {idx + 1}/{len(image_files)} tamamlandı")
                    
            except Exception as e:
                print(f"   ⚠️  {img_file.name} atlandı: {e}")
                continue
    
    print(f"\n🎉 Toplam {total_created} görüntü oluşturuldu → {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Domain Shift Çözümü: Sentetik Veri Üretici")
    parser.add_argument('--input', required=True, help='Orijinal veri seti klasörü (ör: datasets/train)')
    parser.add_argument('--output', required=True, help='Çıktı klasörü (ör: datasets/augmented)')
    parser.add_argument('--backgrounds', default=None, help='Arka plan fotoğrafları klasörü')
    parser.add_argument('--copies', type=int, default=3, help='Her fotoğraf için kaç augment kopya üretilecek')
    
    args = parser.parse_args()
    process_dataset(args.input, args.output, args.backgrounds, args.copies)
