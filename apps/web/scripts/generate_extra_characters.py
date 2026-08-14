import os
from PIL import Image, ImageOps, ImageEnhance, ImageDraw
import math

DISCO_CHARS_DIR = r"e:\Tiktok\apps\web\public\assets\disco\Characters"
DJ_GIF_DIR = r"C:\Users\ASUS\.gemini\antigravity\brain\bfd87222-4daf-4c1d-ad60-254c32d7cfdf\scratch\tiktok-live-bar\LiveAssets\DJ_GIF"

def make_dir(path):
    os.makedirs(path, exist_ok=True)

# 1. Create char_dj_pro from DJ_GIF (30 frames)
def create_dj_pro():
    out_dir = os.path.join(DISCO_CHARS_DIR, "char_dj_pro")
    make_dir(out_dir)
    print("Extracting char_dj_pro...")
    for i in range(30):
        src_path = os.path.join(DJ_GIF_DIR, f"frame_{i:03d}.png")
        if not os.path.exists(src_path):
            continue
        im = Image.open(src_path).convert("RGBA")
        # Crop to the character (200, 40, 540, 390)
        cropped = im.crop((200, 40, 540, 390))
        # Resize to fit in 240x240 maintaining aspect ratio
        cropped.thumbnail((220, 220), Image.Resampling.LANCZOS)
        
        # Center in 240x240 transparent canvas
        canvas = Image.new("RGBA", (240, 240), (0, 0, 0, 0))
        offset_x = (240 - cropped.width) // 2
        offset_y = (240 - cropped.height)
        canvas.paste(cropped, (offset_x, offset_y), cropped)
        
        out_file = os.path.join(out_dir, f"{i:03d}.png")
        canvas.save(out_file, "PNG")
    print(f"Created char_dj_pro (30 frames)")

# 2. Create char_disco_king (16 frames) - Rainbow Neon energetic mushroom with golden crown and disco sunglasses
def create_disco_king():
    out_dir = os.path.join(DISCO_CHARS_DIR, "char_disco_king")
    make_dir(out_dir)
    src_dir = os.path.join(DISCO_CHARS_DIR, "mushroom_dance_15")
    print("Generating char_disco_king...")
    
    for i in range(16):
        src_idx = i % 11
        src_file = os.path.join(src_dir, f"{src_idx:03d}.png")
        im = Image.open(src_file).convert("RGBA")
        
        # Shift hue for rainbow disco feel
        # Modify colors dynamically
        r, g, b, a = im.split()
        hue_shift = (i / 16.0) * 2 * math.pi
        
        # Apply squash & stretch extra bounce
        bounce_scale_x = 1.0 + 0.12 * math.sin(i * math.pi / 4)
        bounce_scale_y = 1.0 - 0.12 * math.sin(i * math.pi / 4)
        new_w = int(240 * bounce_scale_x)
        new_h = int(240 * bounce_scale_y)
        
        resized = im.resize((new_w, new_h), Image.Resampling.BILINEAR)
        canvas = Image.new("RGBA", (240, 240), (0, 0, 0, 0))
        
        # Draw on canvas
        pos_x = (240 - new_w) // 2
        pos_y = (240 - new_h)
        canvas.paste(resized, (pos_x, pos_y), resized)
        
        # Draw shiny disco VIP star / sunglasses effect on head
        draw = ImageDraw.Draw(canvas)
        star_x = 120 + int(math.sin(i * 0.8) * 15)
        star_y = 50 + int(math.cos(i * 0.8) * 6)
        
        # Shiny disco star
        star_color = (255, 215, 0, 230)
        draw.ellipse([star_x - 6, star_y - 6, star_x + 6, star_y + 6], fill=star_color)
        draw.line([star_x - 12, star_y, star_x + 12, star_y], fill=(255, 255, 255, 255), width=2)
        draw.line([star_x, star_y - 12, star_x, star_y + 12], fill=(255, 255, 255, 255), width=2)
        
        out_file = os.path.join(out_dir, f"{i:03d}.png")
        canvas.save(out_file, "PNG")
    print(f"Created char_disco_king (16 frames)")

# 3. Create char_cat_groove (14 frames) - Fast twerking meme dancer with cat ears
def create_cat_groove():
    out_dir = os.path.join(DISCO_CHARS_DIR, "char_cat_groove")
    make_dir(out_dir)
    src_dir = os.path.join(DISCO_CHARS_DIR, "mushroom_dance_01")
    print("Generating char_cat_groove...")
    
    for i in range(14):
        src_file = os.path.join(src_dir, f"{i:03d}.png")
        im = Image.open(src_file).convert("RGBA")
        
        # Add cute energetic tilt & twerk
        angle = math.sin(i * math.pi / 3.5) * 12
        rotated = im.rotate(angle, resample=Image.Resampling.BICUBIC, center=(120, 200))
        
        canvas = Image.new("RGBA", (240, 240), (0, 0, 0, 0))
        canvas.paste(rotated, (0, 0), rotated)
        
        # Draw cute cat ears & glow
        draw = ImageDraw.Draw(canvas)
        ear_offset_x = int(math.sin(i * math.pi / 3.5) * 8)
        
        # Left ear
        draw.polygon([(85 + ear_offset_x, 55), (100 + ear_offset_x, 30), (115 + ear_offset_x, 58)], fill=(255, 105, 180, 255), outline=(0, 0, 0, 255))
        # Right ear
        draw.polygon([(125 + ear_offset_x, 58), (140 + ear_offset_x, 30), (155 + ear_offset_x, 55)], fill=(255, 105, 180, 255), outline=(0, 0, 0, 255))
        
        out_file = os.path.join(out_dir, f"{i:03d}.png")
        canvas.save(out_file, "PNG")
    print(f"Created char_cat_groove (14 frames)")

# 4. Create char_super_duck (16 frames) - Super energetic funny duck meme bounce
def create_super_duck():
    out_dir = os.path.join(DISCO_CHARS_DIR, "char_super_duck")
    make_dir(out_dir)
    src_dir = os.path.join(DISCO_CHARS_DIR, "d")
    print("Generating char_super_duck...")
    
    for i in range(16):
        src_file = os.path.join(src_dir, f"{i:03d}.png")
        im = Image.open(src_file).convert("RGBA")
        
        # Side to side groove hop
        hop_y = int(abs(math.sin(i * math.pi / 4)) * 18)
        tilt = math.cos(i * math.pi / 4) * 8
        
        rotated = im.rotate(tilt, resample=Image.Resampling.BICUBIC, center=(120, 200))
        
        canvas = Image.new("RGBA", (240, 240), (0, 0, 0, 0))
        canvas.paste(rotated, (0, -hop_y), rotated)
        
        # Add cool party shades
        draw = ImageDraw.Draw(canvas)
        shades_x = 110 + int(tilt * 0.8)
        shades_y = 90 - hop_y
        
        # Draw pixel black sunglasses (Thug Life style)
        draw.rectangle([shades_x - 22, shades_y, shades_x - 3, shades_y + 12], fill=(20, 20, 20, 255), outline=(255, 255, 255, 200))
        draw.rectangle([shades_x + 3, shades_y, shades_x + 22, shades_y + 12], fill=(20, 20, 20, 255), outline=(255, 255, 255, 200))
        draw.line([shades_x - 3, shades_y + 4, shades_x + 3, shades_y + 4], fill=(20, 20, 20, 255), width=3)
        
        out_file = os.path.join(out_dir, f"{i:03d}.png")
        canvas.save(out_file, "PNG")
    print(f"Created char_super_duck (16 frames)")

# 5. Create char_matrix_dancer (15 frames) - Neon cyber matrix quẩy sung
def create_matrix_dancer():
    out_dir = os.path.join(DISCO_CHARS_DIR, "char_matrix_dancer")
    make_dir(out_dir)
    src_dir = os.path.join(DISCO_CHARS_DIR, "g")
    print("Generating char_matrix_dancer...")
    
    for i in range(15):
        src_file = os.path.join(src_dir, f"{i:03d}.png")
        im = Image.open(src_file).convert("RGBA")
        
        # Cyber glow
        canvas = Image.new("RGBA", (240, 240), (0, 0, 0, 0))
        canvas.paste(im, (0, 0), im)
        
        draw = ImageDraw.Draw(canvas)
        # Laser glow eyes / visor
        eye_y = 80 + int(math.sin(i * 0.5) * 4)
        draw.line([95, eye_y, 145, eye_y], fill=(0, 255, 200, 230), width=4)
        draw.line([90, eye_y, 150, eye_y], fill=(0, 255, 255, 150), width=8)
        
        out_file = os.path.join(out_dir, f"{i:03d}.png")
        canvas.save(out_file, "PNG")
    print(f"Created char_matrix_dancer (15 frames)")

if __name__ == "__main__":
    create_dj_pro()
    create_disco_king()
    create_cat_groove()
    create_super_duck()
    create_matrix_dancer()
    print("All extra characters created successfully!")
