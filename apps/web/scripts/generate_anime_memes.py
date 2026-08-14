import os
from PIL import Image, ImageDraw, ImageOps
import math

DISCO_CHARS_DIR = r"e:\Tiktok\apps\web\public\assets\disco\Characters"

def make_dir(path):
    os.makedirs(path, exist_ok=True)

# 1. char_anya_heh: Anya Forger with "Heh" smirk (16 frames)
def create_anya_heh():
    out_dir = os.path.join(DISCO_CHARS_DIR, "char_anya_heh")
    make_dir(out_dir)
    src_dir = os.path.join(DISCO_CHARS_DIR, "mushroom_dance_01")
    print("Generating char_anya_heh...")
    
    for i in range(16):
        src_idx = i % 14
        src_file = os.path.join(src_dir, f"{src_idx:03d}.png")
        im = Image.open(src_file).convert("RGBA")
        
        canvas = Image.new("RGBA", (240, 240), (0, 0, 0, 0))
        canvas.paste(im, (0, 0), im)
        
        draw = ImageDraw.Draw(canvas)
        head_cx = 120 + int(math.sin(i * math.pi / 4) * 6)
        head_cy = 70 + int(math.cos(i * math.pi / 4) * 4)
        
        # Anya Pink Hair
        # Back hair
        draw.ellipse([head_cx - 42, head_cy - 40, head_cx + 42, head_cy + 40], fill=(255, 175, 190, 255))
        # Face skin
        draw.ellipse([head_cx - 32, head_cy - 28, head_cx + 32, head_cy + 30], fill=(255, 235, 225, 255), outline=(0, 0, 0, 255), width=2)
        # Front bangs
        draw.polygon([(head_cx - 34, head_cy - 20), (head_cx - 15, head_cy - 8), (head_cx, head_cy - 18), (head_cx + 15, head_cy - 8), (head_cx + 34, head_cy - 20), (head_cx + 25, head_cy - 38), (head_cx - 25, head_cy - 38)], fill=(255, 170, 185, 255), outline=(0, 0, 0, 255), width=2)
        
        # Iconic black hair cones/horns with gold accents
        # Left horn
        draw.polygon([(head_cx - 36, head_cy - 25), (head_cx - 48, head_cy - 48), (head_cx - 24, head_cy - 38)], fill=(25, 25, 25, 255), outline=(255, 215, 0, 255), width=2)
        # Right horn
        draw.polygon([(head_cx + 36, head_cy - 25), (head_cx + 48, head_cy - 48), (head_cx + 24, head_cy - 38)], fill=(25, 25, 25, 255), outline=(255, 215, 0, 255), width=2)
        
        # Iconic "Heh" smug eyes & mouth
        # Left slanted smug eye
        draw.line([head_cx - 22, head_cy - 4, head_cx - 8, head_cy - 2], fill=(0, 0, 0, 255), width=3)
        draw.arc([head_cx - 20, head_cy - 8, head_cx - 10, head_cy + 2], 0, 180, fill=(0, 0, 0, 255), width=2)
        # Right slanted smug eye
        draw.line([head_cx + 8, head_cy - 2, head_cx + 22, head_cy - 4], fill=(0, 0, 0, 255), width=3)
        draw.arc([head_cx + 10, head_cy - 8, head_cx + 20, head_cy + 2], 0, 180, fill=(0, 0, 0, 255), width=2)
        
        # Blush cheeks
        draw.ellipse([head_cx - 26, head_cy + 4, head_cx - 14, head_cy + 12], fill=(255, 150, 170, 200))
        draw.ellipse([head_cx + 14, head_cy + 4, head_cx + 26, head_cy + 12], fill=(255, 150, 170, 200))
        
        # Anya smirk "Heh" (curved smug triangle mouth)
        draw.polygon([(head_cx - 8, head_cy + 14), (head_cx + 12, head_cy + 12), (head_cx + 4, head_cy + 20)], fill=(255, 120, 140, 255), outline=(0, 0, 0, 255), width=2)
        
        out_file = os.path.join(out_dir, f"{i:03d}.png")
        canvas.save(out_file, "PNG")
    print("Created char_anya_heh (16 frames)")

# 2. char_bocchi_panic: Bocchi with pink hair & panic wobble (16 frames)
def create_bocchi_panic():
    out_dir = os.path.join(DISCO_CHARS_DIR, "char_bocchi_panic")
    make_dir(out_dir)
    src_dir = os.path.join(DISCO_CHARS_DIR, "c")
    print("Generating char_bocchi_panic...")
    
    for i in range(16):
        src_idx = i % 8
        src_file = os.path.join(src_dir, f"{src_idx:03d}.png")
        im = Image.open(src_file).convert("RGBA")
        
        # Panic jitter
        jitter_x = int(math.sin(i * 3.5) * 6)
        jitter_y = int(math.cos(i * 4.0) * 5)
        
        canvas = Image.new("RGBA", (240, 240), (0, 0, 0, 0))
        canvas.paste(im, (jitter_x, jitter_y), im)
        
        draw = ImageDraw.Draw(canvas)
        head_cx = 120 + jitter_x
        head_cy = 68 + jitter_y
        
        # Bocchi Pink Hair & Yellow/Blue hair cubes
        draw.ellipse([head_cx - 40, head_cy - 40, head_cx + 40, head_cy + 40], fill=(255, 160, 185, 255))
        # Long hair sides
        draw.polygon([(head_cx - 36, head_cy), (head_cx - 44, head_cy + 55), (head_cx - 24, head_cy + 45)], fill=(255, 150, 180, 255))
        draw.polygon([(head_cx + 36, head_cy), (head_cx + 44, head_cy + 55), (head_cx + 24, head_cy + 45)], fill=(255, 150, 180, 255))
        
        # Face
        draw.ellipse([head_cx - 30, head_cy - 25, head_cx + 30, head_cy + 28], fill=(255, 240, 230, 255), outline=(0, 0, 0, 255), width=2)
        # Hair cubes (blue & yellow)
        draw.rectangle([head_cx - 38, head_cy - 32, head_cx - 24, head_cy - 18], fill=(0, 180, 255, 255), outline=(0, 0, 0, 255), width=2)
        draw.rectangle([head_cx - 26, head_cy - 38, head_cx - 12, head_cy - 24], fill=(255, 220, 0, 255), outline=(0, 0, 0, 255), width=2)
        
        # Spiral panic eyes / empty panic face
        spiral_phase = (i * 0.8) % (math.pi * 2)
        draw.ellipse([head_cx - 22, head_cy - 8, head_cx - 8, head_cy + 6], fill=(255, 255, 255, 255), outline=(0, 0, 0, 255), width=2)
        draw.ellipse([head_cx + 8, head_cy - 8, head_cx + 22, head_cy + 6], fill=(255, 255, 255, 255), outline=(0, 0, 0, 255), width=2)
        draw.arc([head_cx - 20, head_cy - 6, head_cx - 10, head_cy + 4], 0, 270, fill=(0, 0, 0, 255), width=2)
        draw.arc([head_cx + 10, head_cy - 6, head_cx + 20, head_cy + 4], 90, 360, fill=(0, 0, 0, 255), width=2)
        
        # Squiggly mouth (wobbling)
        m_wobble = int(math.sin(i * 3) * 4)
        draw.line([head_cx - 14, head_cy + 16 + m_wobble, head_cx - 6, head_cy + 12 - m_wobble], fill=(0, 0, 0, 255), width=2)
        draw.line([head_cx - 6, head_cy + 12 - m_wobble, head_cx + 6, head_cy + 16 + m_wobble], fill=(0, 0, 0, 255), width=2)
        draw.line([head_cx + 6, head_cy + 16 + m_wobble, head_cx + 14, head_cy + 12 - m_wobble], fill=(0, 0, 0, 255), width=2)
        
        # Sweat drops
        draw.polygon([(head_cx + 28, head_cy - 12), (head_cx + 34, head_cy - 4), (head_cx + 24, head_cy - 4)], fill=(120, 220, 255, 240))
        
        out_file = os.path.join(out_dir, f"{i:03d}.png")
        canvas.save(out_file, "PNG")
    print("Created char_bocchi_panic (16 frames)")

# 3. char_gojo_sensei: Gojo Satoru with blindfold & glowing Domain Expansion (16 frames)
def create_gojo_sensei():
    out_dir = os.path.join(DISCO_CHARS_DIR, "char_gojo_sensei")
    make_dir(out_dir)
    src_dir = os.path.join(DISCO_CHARS_DIR, "char_matrix_dancer")
    print("Generating char_gojo_sensei...")
    
    for i in range(16):
        src_idx = i % 15
        src_file = os.path.join(src_dir, f"{src_idx:03d}.png")
        im = Image.open(src_file).convert("RGBA")
        
        canvas = Image.new("RGBA", (240, 240), (0, 0, 0, 0))
        canvas.paste(im, (0, 0), im)
        
        draw = ImageDraw.Draw(canvas)
        head_cx = 120 + int(math.sin(i * math.pi / 4) * 4)
        head_cy = 65 + int(math.cos(i * math.pi / 4) * 3)
        
        # Spiky White Hair
        hair_pts = [
            (head_cx - 40, head_cy - 10),
            (head_cx - 46, head_cy - 35),
            (head_cx - 32, head_cy - 48),
            (head_cx - 18, head_cy - 58),
            (head_cx, head_cy - 62),
            (head_cx + 18, head_cy - 58),
            (head_cx + 32, head_cy - 48),
            (head_cx + 46, head_cy - 35),
            (head_cx + 40, head_cy - 10),
            (head_cx + 25, head_cy + 20),
            (head_cx - 25, head_cy + 20),
        ]
        draw.polygon(hair_pts, fill=(245, 248, 255, 255), outline=(200, 215, 235, 255), width=2)
        
        # Face skin
        draw.polygon([(head_cx - 26, head_cy - 15), (head_cx + 26, head_cy - 15), (head_cx + 20, head_cy + 25), (head_cx, head_cy + 38), (head_cx - 20, head_cy + 25)], fill=(255, 240, 235, 255), outline=(0, 0, 0, 255), width=2)
        
        # Black blindfold / sleek dark mask
        draw.polygon([(head_cx - 28, head_cy - 12), (head_cx + 28, head_cy - 12), (head_cx + 26, head_cy + 10), (head_cx - 26, head_cy + 10)], fill=(20, 20, 30, 255), outline=(60, 60, 80, 255), width=2)
        
        # Glowing Six Eyes blue aura / laser spark
        sparkle = int(abs(math.sin(i * 0.8)) * 12)
        draw.ellipse([head_cx - 16 - sparkle//2, head_cy - 2 - sparkle//2, head_cx - 8 + sparkle//2, head_cy + 4 + sparkle//2], fill=(0, 220, 255, 200))
        draw.ellipse([head_cx + 8 - sparkle//2, head_cy - 2 - sparkle//2, head_cx + 16 + sparkle//2, head_cy + 4 + sparkle//2], fill=(0, 220, 255, 200))
        
        # Confident handsome smile
        draw.line([head_cx - 10, head_cy + 22, head_cx + 6, head_cy + 24], fill=(0, 0, 0, 255), width=2)
        draw.line([head_cx + 6, head_cy + 24, head_cx + 14, head_cy + 18], fill=(0, 0, 0, 255), width=2)
        
        # Domain Expansion magic orb in hand
        orb_x = 175 + int(math.sin(i * 0.5) * 8)
        orb_y = 120 + int(math.cos(i * 0.5) * 8)
        draw.ellipse([orb_x - 14, orb_y - 14, orb_x + 14, orb_y + 14], fill=(0, 180, 255, 180), outline=(255, 255, 255, 240), width=2)
        draw.ellipse([orb_x - 6, orb_y - 6, orb_x + 6, orb_y + 6], fill=(200, 240, 255, 255))
        
        out_file = os.path.join(out_dir, f"{i:03d}.png")
        canvas.save(out_file, "PNG")
    print("Created char_gojo_sensei (16 frames)")

# 4. char_umaru_chan: Chibi Umaru with orange hamster hood (14 frames)
def create_umaru_chan():
    out_dir = os.path.join(DISCO_CHARS_DIR, "char_umaru_chan")
    make_dir(out_dir)
    src_dir = os.path.join(DISCO_CHARS_DIR, "mushroom_dance_15")
    print("Generating char_umaru_chan...")
    
    for i in range(14):
        src_idx = i % 11
        src_file = os.path.join(src_dir, f"{src_idx:03d}.png")
        im = Image.open(src_file).convert("RGBA")
        
        canvas = Image.new("RGBA", (240, 240), (0, 0, 0, 0))
        canvas.paste(im, (0, 0), im)
        
        draw = ImageDraw.Draw(canvas)
        head_cx = 120 + int(math.sin(i * math.pi / 3.5) * 6)
        head_cy = 72 + int(math.cos(i * math.pi / 3.5) * 4)
        
        # Umaru Orange Hamster Hood
        draw.ellipse([head_cx - 48, head_cy - 48, head_cx + 48, head_cy + 42], fill=(255, 140, 30, 255), outline=(0, 0, 0, 255), width=2)
        # Hamster Ears (Round brown ears on top of hood)
        draw.ellipse([head_cx - 42, head_cy - 52, head_cx - 22, head_cy - 32], fill=(180, 80, 20, 255), outline=(0, 0, 0, 255), width=2)
        draw.ellipse([head_cx + 22, head_cy - 52, head_cx + 42, head_cy - 32], fill=(180, 80, 20, 255), outline=(0, 0, 0, 255), width=2)
        
        # Face Opening
        draw.ellipse([head_cx - 34, head_cy - 28, head_cx + 34, head_cy + 30], fill=(255, 240, 230, 255), outline=(0, 0, 0, 255), width=2)
        
        # Blonde bangs
        draw.polygon([(head_cx - 30, head_cy - 20), (head_cx - 15, head_cy - 10), (head_cx, head_cy - 18), (head_cx + 15, head_cy - 10), (head_cx + 30, head_cy - 20), (head_cx + 20, head_cy - 32), (head_cx - 20, head_cy - 32)], fill=(255, 215, 110, 255), outline=(0, 0, 0, 255), width=2)
        
        # Big sparkling cute anime eyes
        draw.ellipse([head_cx - 24, head_cy - 8, head_cx - 8, head_cy + 10], fill=(130, 60, 20, 255))
        draw.ellipse([head_cx - 20, head_cy - 6, head_cx - 12, head_cy], fill=(255, 255, 255, 255))
        draw.ellipse([head_cx + 8, head_cy - 8, head_cx + 24, head_cy + 10], fill=(130, 60, 20, 255))
        draw.ellipse([head_cx + 12, head_cy - 6, head_cx + 20, head_cy], fill=(255, 255, 255, 255))
        
        # Cheerful open cat mouth
        draw.arc([head_cx - 10, head_cy + 12, head_cx + 10, head_cy + 24], 0, 180, fill=(255, 80, 80, 255), width=3)
        draw.line([head_cx - 10, head_cy + 18, head_cx + 10, head_cy + 18], fill=(0, 0, 0, 255), width=2)
        
        # Blush
        draw.ellipse([head_cx - 28, head_cy + 8, head_cx - 16, head_cy + 16], fill=(255, 160, 180, 200))
        draw.ellipse([head_cx + 16, head_cy + 8, head_cx + 28, head_cy + 16], fill=(255, 160, 180, 200))
        
        out_file = os.path.join(out_dir, f"{i:03d}.png")
        canvas.save(out_file, "PNG")
    print("Created char_umaru_chan (14 frames)")

# 5. char_tanjiro_derp: Tanjiro shocked/derp face with Hanafuda earrings (14 frames)
def create_tanjiro_derp():
    out_dir = os.path.join(DISCO_CHARS_DIR, "char_tanjiro_derp")
    make_dir(out_dir)
    src_dir = os.path.join(DISCO_CHARS_DIR, "d")
    print("Generating char_tanjiro_derp...")
    
    for i in range(14):
        src_file = os.path.join(src_dir, f"{i:03d}.png")
        im = Image.open(src_file).convert("RGBA")
        
        canvas = Image.new("RGBA", (240, 240), (0, 0, 0, 0))
        canvas.paste(im, (0, 0), im)
        
        draw = ImageDraw.Draw(canvas)
        head_cx = 120 + int(math.sin(i * math.pi / 3.5) * 5)
        head_cy = 70 + int(math.cos(i * math.pi / 3.5) * 4)
        
        # Spiky Burgundy Hair
        draw.polygon([
            (head_cx - 38, head_cy - 15),
            (head_cx - 42, head_cy - 40),
            (head_cx - 26, head_cy - 52),
            (head_cx - 8, head_cy - 56),
            (head_cx + 12, head_cy - 54),
            (head_cx + 34, head_cy - 44),
            (head_cx + 42, head_cy - 20),
            (head_cx + 26, head_cy + 15),
            (head_cx - 26, head_cy + 15),
        ], fill=(120, 20, 30, 255), outline=(60, 10, 15, 255), width=2)
        
        # Face skin
        draw.ellipse([head_cx - 28, head_cy - 22, head_cx + 28, head_cy + 28], fill=(255, 235, 220, 255), outline=(0, 0, 0, 255), width=2)
        
        # Forehead Scar (Flame shape)
        draw.polygon([(head_cx - 22, head_cy - 18), (head_cx - 12, head_cy - 24), (head_cx - 16, head_cy - 12)], fill=(180, 40, 40, 255))
        
        # Derp shocked dots eyes
        draw.ellipse([head_cx - 18, head_cy - 6, head_cx - 8, head_cy + 4], fill=(0, 0, 0, 255))
        draw.ellipse([head_cx - 14, head_cy - 4, head_cx - 12, head_cy - 2], fill=(255, 255, 255, 255))
        draw.ellipse([head_cx + 8, head_cy - 6, head_cx + 18, head_cy + 4], fill=(0, 0, 0, 255))
        draw.ellipse([head_cx + 12, head_cy - 4, head_cx + 14, head_cy - 2], fill=(255, 255, 255, 255))
        
        # Funny O-shaped mouth
        draw.ellipse([head_cx - 6, head_cy + 12, head_cx + 6, head_cy + 22], fill=(60, 20, 20, 255), outline=(0, 0, 0, 255), width=2)
        
        # Hanafuda Earrings (Rectangle with red sun)
        ear_sway = int(math.sin(i * 0.8) * 4)
        draw.rectangle([head_cx - 36 + ear_sway, head_cy + 8, head_cx - 26 + ear_sway, head_cy + 28], fill=(255, 255, 255, 255), outline=(0, 0, 0, 255), width=1)
        draw.ellipse([head_cx - 34 + ear_sway, head_cy + 10, head_cx - 28 + ear_sway, head_cy + 16], fill=(255, 50, 50, 255))
        
        out_file = os.path.join(out_dir, f"{i:03d}.png")
        canvas.save(out_file, "PNG")
    print("Created char_tanjiro_derp (14 frames)")

# 6. char_zoro_lost: Zoro with green hair & 3 katanas (16 frames)
def create_zoro_lost():
    out_dir = os.path.join(DISCO_CHARS_DIR, "char_zoro_lost")
    make_dir(out_dir)
    src_dir = os.path.join(DISCO_CHARS_DIR, "char_matrix_dancer")
    print("Generating char_zoro_lost...")
    
    for i in range(16):
        src_idx = i % 15
        src_file = os.path.join(src_dir, f"{src_idx:03d}.png")
        im = Image.open(src_file).convert("RGBA")
        
        canvas = Image.new("RGBA", (240, 240), (0, 0, 0, 0))
        canvas.paste(im, (0, 0), im)
        
        draw = ImageDraw.Draw(canvas)
        head_cx = 120 + int(math.sin(i * math.pi / 4) * 5)
        head_cy = 65 + int(math.cos(i * math.pi / 4) * 4)
        
        # Marimo Green Spiky Hair
        draw.polygon([
            (head_cx - 34, head_cy - 12),
            (head_cx - 38, head_cy - 36),
            (head_cx - 24, head_cy - 48),
            (head_cx, head_cy - 52),
            (head_cx + 24, head_cy - 48),
            (head_cx + 38, head_cy - 36),
            (head_cx + 34, head_cy - 12),
            (head_cx + 22, head_cy + 18),
            (head_cx - 22, head_cy + 18),
        ], fill=(40, 180, 60, 255), outline=(20, 100, 30, 255), width=2)
        
        # Face skin
        draw.polygon([(head_cx - 24, head_cy - 12), (head_cx + 24, head_cy - 12), (head_cx + 18, head_cy + 26), (head_cx, head_cy + 36), (head_cx - 18, head_cy + 26)], fill=(255, 230, 210, 255), outline=(0, 0, 0, 255), width=2)
        
        # Eye scar on left eye
        draw.line([head_cx - 16, head_cy - 10, head_cx - 12, head_cy + 6], fill=(160, 60, 60, 255), width=3)
        draw.line([head_cx - 20, head_cy - 2, head_cx - 8, head_cy - 2], fill=(0, 0, 0, 255), width=2)
        
        # Right sharp determined eye
        draw.line([head_cx + 8, head_cy - 2, head_cx + 20, head_cy - 2], fill=(0, 0, 0, 255), width=3)
        draw.ellipse([head_cx + 12, head_cy - 2, head_cx + 16, head_cy + 4], fill=(0, 0, 0, 255))
        
        # Katana in mouth
        draw.rectangle([head_cx - 45, head_cy + 18, head_cx + 45, head_cy + 24], fill=(220, 225, 235, 255), outline=(0, 0, 0, 255), width=1)
        # Katana hilt
        draw.rectangle([head_cx - 55, head_cy + 16, head_cx - 45, head_cy + 26], fill=(255, 215, 0, 255), outline=(0, 0, 0, 255), width=2)
        
        # 3 Gold Earrings on Left Ear
        for e in [0, 4, 8]:
            draw.ellipse([head_cx - 28, head_cy + e, head_cx - 24, head_cy + e + 4], fill=(255, 215, 0, 255))
            
        out_file = os.path.join(out_dir, f"{i:03d}.png")
        canvas.save(out_file, "PNG")
    print("Created char_zoro_lost (16 frames)")

if __name__ == "__main__":
    create_anya_heh()
    create_bocchi_panic()
    create_gojo_sensei()
    create_umaru_chan()
    create_tanjiro_derp()
    create_zoro_lost()
    print("All anime meme characters created successfully!")
