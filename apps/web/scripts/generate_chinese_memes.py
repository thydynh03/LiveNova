import os
from PIL import Image, ImageDraw, ImageOps
import math

DISCO_CHARS_DIR = r"e:\Tiktok\apps\web\public\assets\disco\Characters"

def make_dir(path):
    os.makedirs(path, exist_ok=True)

# 1. char_panda_cry: Panda Crying Meme dancing / twerking
def create_panda_cry():
    out_dir = os.path.join(DISCO_CHARS_DIR, "char_panda_cry")
    make_dir(out_dir)
    src_dir = os.path.join(DISCO_CHARS_DIR, "mushroom_dance_15")
    print("Generating char_panda_cry...")
    
    for i in range(16):
        src_idx = i % 11
        src_file = os.path.join(src_dir, f"{src_idx:03d}.png")
        im = Image.open(src_file).convert("RGBA")
        
        # Canvas
        canvas = Image.new("RGBA", (240, 240), (0, 0, 0, 0))
        canvas.paste(im, (0, 0), im)
        
        draw = ImageDraw.Draw(canvas)
        head_cx = 120 + int(math.sin(i * math.pi / 4) * 6)
        head_cy = 72 + int(math.cos(i * math.pi / 4) * 4)
        
        # Draw Panda Head (Round white with black ears)
        # Left ear
        draw.ellipse([head_cx - 46, head_cy - 46, head_cx - 18, head_cy - 18], fill=(20, 20, 20, 255), outline=(0, 0, 0, 255), width=2)
        # Right ear
        draw.ellipse([head_cx + 18, head_cy - 46, head_cx + 46, head_cy - 18], fill=(20, 20, 20, 255), outline=(0, 0, 0, 255), width=2)
        # Head circle
        draw.ellipse([head_cx - 40, head_cy - 36, head_cx + 40, head_cy + 36], fill=(255, 255, 255, 255), outline=(0, 0, 0, 255), width=3)
        
        # Panda crying eyes (slanted sad brows + teardrops)
        # Left eye patch
        draw.ellipse([head_cx - 28, head_cy - 14, head_cx - 8, head_cy + 6], fill=(30, 30, 30, 255))
        draw.arc([head_cx - 26, head_cy - 10, head_cx - 10, head_cy + 2], 0, 180, fill=(255, 255, 255, 255), width=2)
        # Right eye patch
        draw.ellipse([head_cx + 8, head_cy - 14, head_cx + 28, head_cy + 6], fill=(30, 30, 30, 255))
        draw.arc([head_cx + 10, head_cy - 10, head_cx + 26, head_cy + 2], 0, 180, fill=(255, 255, 255, 255), width=2)
        
        # Sad eyebrows
        draw.line([head_cx - 28, head_cy - 16, head_cx - 10, head_cy - 20], fill=(0, 0, 0, 255), width=3)
        draw.line([head_cx + 28, head_cy - 16, head_cx + 10, head_cy - 20], fill=(0, 0, 0, 255), width=3)
        
        # Nose & crying mouth (hands covering mouth or streaming tears)
        draw.polygon([(head_cx - 4, head_cy + 8), (head_cx + 4, head_cy + 8), (head_cx, head_cy + 13)], fill=(0, 0, 0, 255))
        draw.arc([head_cx - 12, head_cy + 14, head_cx + 12, head_cy + 28], 180, 360, fill=(0, 0, 0, 255), width=3)
        
        # Huge streaming blue waterfalls of tears
        tear_offset = (i * 8) % 30
        # Left tears
        draw.line([head_cx - 18, head_cy + 4, head_cx - 22, head_cy + 45 + tear_offset], fill=(0, 160, 255, 240), width=6)
        draw.line([head_cx - 15, head_cy + 6, head_cx - 17, head_cy + 35 + tear_offset], fill=(100, 210, 255, 255), width=3)
        # Right tears
        draw.line([head_cx + 18, head_cy + 4, head_cx + 22, head_cy + 45 + tear_offset], fill=(0, 160, 255, 240), width=6)
        draw.line([head_cx + 15, head_cy + 6, head_cx + 17, head_cy + 35 + tear_offset], fill=(100, 210, 255, 255), width=3)
        
        out_file = os.path.join(out_dir, f"{i:03d}.png")
        canvas.save(out_file, "PNG")
    print("Created char_panda_cry (16 frames)")

# 2. char_panda_smug: Panda "Nụ cười đã tắt" chin-rest meme
def create_panda_smug():
    out_dir = os.path.join(DISCO_CHARS_DIR, "char_panda_smug")
    make_dir(out_dir)
    src_dir = os.path.join(DISCO_CHARS_DIR, "mushroom_dance_01")
    print("Generating char_panda_smug...")
    
    for i in range(14):
        src_file = os.path.join(src_dir, f"{i:03d}.png")
        im = Image.open(src_file).convert("RGBA")
        
        canvas = Image.new("RGBA", (240, 240), (0, 0, 0, 0))
        canvas.paste(im, (0, 0), im)
        
        draw = ImageDraw.Draw(canvas)
        head_cx = 120 + int(math.sin(i * math.pi / 3.5) * 5)
        head_cy = 70 + int(math.cos(i * math.pi / 3.5) * 4)
        
        # Panda Head
        # Ears
        draw.ellipse([head_cx - 45, head_cy - 45, head_cx - 18, head_cy - 18], fill=(20, 20, 20, 255), outline=(0, 0, 0, 255), width=2)
        draw.ellipse([head_cx + 18, head_cy - 45, head_cx + 45, head_cy - 18], fill=(20, 20, 20, 255), outline=(0, 0, 0, 255), width=2)
        # Head
        draw.ellipse([head_cx - 38, head_cy - 35, head_cx + 38, head_cy + 35], fill=(255, 255, 255, 255), outline=(0, 0, 0, 255), width=3)
        
        # Smug/Serious side-eye expression
        # Left eye
        draw.ellipse([head_cx - 24, head_cy - 10, head_cx - 8, head_cy + 4], fill=(30, 30, 30, 255))
        draw.ellipse([head_cx - 20, head_cy - 8, head_cx - 14, head_cy - 2], fill=(255, 255, 255, 255))
        # Right eye
        draw.ellipse([head_cx + 8, head_cy - 10, head_cx + 24, head_cy + 4], fill=(30, 30, 30, 255))
        draw.ellipse([head_cx + 12, head_cy - 8, head_cx + 18, head_cy - 2], fill=(255, 255, 255, 255))
        
        # Wavy skeptical mouth
        draw.arc([head_cx - 16, head_cy + 10, head_cx + 8, head_cy + 22], 180, 360, fill=(0, 0, 0, 255), width=3)
        draw.arc([head_cx - 4, head_cy + 10, head_cx + 18, head_cy + 22], 0, 180, fill=(0, 0, 0, 255), width=3)
        
        # Hand holding chin
        hand_x = head_cx - 12
        hand_y = head_cy + 28
        draw.ellipse([hand_x - 12, hand_y - 6, hand_x + 12, hand_y + 8], fill=(255, 255, 255, 255), outline=(0, 0, 0, 255), width=2)
        draw.line([hand_x - 6, hand_y - 2, hand_x - 6, hand_y + 4], fill=(0, 0, 0, 255), width=2)
        draw.line([hand_x, hand_y - 4, hand_x, hand_y + 4], fill=(0, 0, 0, 255), width=2)
        draw.line([hand_x + 6, hand_y - 2, hand_x + 6, hand_y + 4], fill=(0, 0, 0, 255), width=2)
        
        out_file = os.path.join(out_dir, f"{i:03d}.png")
        canvas.save(out_file, "PNG")
    print("Created char_panda_smug (14 frames)")

# 3. char_yaoming_laugh: Iconic Yao Ming laughing meme head on dancing body
def create_yaoming_laugh():
    out_dir = os.path.join(DISCO_CHARS_DIR, "char_yaoming_laugh")
    make_dir(out_dir)
    src_dir = os.path.join(DISCO_CHARS_DIR, "b")
    print("Generating char_yaoming_laugh...")
    
    for i in range(12):
        src_file = os.path.join(src_dir, f"{i:03d}.png")
        im = Image.open(src_file).convert("RGBA")
        
        canvas = Image.new("RGBA", (240, 240), (0, 0, 0, 0))
        canvas.paste(im, (0, 0), im)
        
        draw = ImageDraw.Draw(canvas)
        head_cx = 120 + int(math.sin(i * math.pi / 3) * 6)
        head_cy = 68 + int(math.cos(i * math.pi / 3) * 5)
        
        # Yao Ming meme head
        # Hair
        draw.polygon([(head_cx - 32, head_cy - 26), (head_cx - 20, head_cy - 42), (head_cx + 20, head_cy - 42), (head_cx + 32, head_cy - 26), (head_cx + 28, head_cy - 18), (head_cx - 28, head_cy - 18)], fill=(15, 15, 15, 255))
        # Face contour
        draw.polygon([(head_cx - 28, head_cy - 20), (head_cx + 28, head_cy - 20), (head_cx + 22, head_cy + 25), (head_cx + 10, head_cy + 38), (head_cx - 10, head_cy + 38), (head_cx - 22, head_cy + 25)], fill=(255, 255, 255, 255), outline=(0, 0, 0, 255), width=3)
        
        # Squeezed laughing eyes (crows feet lines)
        draw.line([head_cx - 22, head_cy - 8, head_cx - 8, head_cy - 6], fill=(0, 0, 0, 255), width=3)
        draw.line([head_cx - 24, head_cy - 4, head_cx - 10, head_cy - 6], fill=(0, 0, 0, 255), width=2)
        draw.line([head_cx + 8, head_cy - 6, head_cx + 22, head_cy - 8], fill=(0, 0, 0, 255), width=3)
        draw.line([head_cx + 10, head_cy - 6, head_cx + 24, head_cy - 4], fill=(0, 0, 0, 255), width=2)
        
        # Wrinkled nose
        draw.arc([head_cx - 6, head_cy - 2, head_cx + 6, head_cy + 10], 0, 180, fill=(0, 0, 0, 255), width=2)
        
        # Giant open laughing mouth with visible teeth
        draw.polygon([(head_cx - 18, head_cy + 14), (head_cx + 18, head_cy + 14), (head_cx + 14, head_cy + 28), (head_cx - 14, head_cy + 28)], fill=(30, 30, 30, 255), outline=(0, 0, 0, 255), width=2)
        # Teeth
        draw.rectangle([head_cx - 14, head_cy + 14, head_cx + 14, head_cy + 20], fill=(255, 255, 255, 255))
        draw.line([head_cx - 14, head_cy + 20, head_cx + 14, head_cy + 20], fill=(0, 0, 0, 255), width=2)
        for t in [-8, -3, 3, 8]:
            draw.line([head_cx + t, head_cy + 14, head_cx + t, head_cy + 20], fill=(0, 0, 0, 255), width=1)
            
        out_file = os.path.join(out_dir, f"{i:03d}.png")
        canvas.save(out_file, "PNG")
    print("Created char_yaoming_laugh (12 frames)")

# 4. char_hoe_fighter: Thanh niên tóc ngố cầm cuốc cuốc đất / quẩy
def create_hoe_fighter():
    out_dir = os.path.join(DISCO_CHARS_DIR, "char_hoe_fighter")
    make_dir(out_dir)
    src_dir = os.path.join(DISCO_CHARS_DIR, "mushroom_dance_15")
    print("Generating char_hoe_fighter...")
    
    for i in range(11):
        src_file = os.path.join(src_dir, f"{i:03d}.png")
        im = Image.open(src_file).convert("RGBA")
        
        canvas = Image.new("RGBA", (240, 240), (0, 0, 0, 0))
        canvas.paste(im, (0, 0), im)
        
        draw = ImageDraw.Draw(canvas)
        
        # Hoe swinging animation in hand
        swing_angle = (i / 11.0) * math.pi * 2
        hoe_pivot_x = 160 + int(math.sin(swing_angle) * 12)
        hoe_pivot_y = 130 + int(math.cos(swing_angle) * 8)
        
        handle_len = 70
        hoe_angle = math.sin(swing_angle) * 0.7 - 0.4
        handle_top_x = hoe_pivot_x + int(math.sin(hoe_angle) * handle_len)
        handle_top_y = hoe_pivot_y - int(math.cos(hoe_angle) * handle_len)
        
        # Wooden Handle
        draw.line([hoe_pivot_x, hoe_pivot_y, handle_top_x, handle_top_y], fill=(160, 100, 45, 255), width=5)
        
        # Iron Hoe Head
        blade_len = 26
        blade_x = handle_top_x + int(math.cos(hoe_angle) * blade_len)
        blade_y = handle_top_y + int(math.sin(hoe_angle) * blade_len)
        draw.line([handle_top_x - 4, handle_top_y, blade_x, blade_y], fill=(100, 110, 120, 255), width=8)
        draw.line([blade_x - 3, blade_y - 3, blade_x + 3, blade_y + 3], fill=(210, 220, 230, 255), width=3)
        
        out_file = os.path.join(out_dir, f"{i:03d}.png")
        canvas.save(out_file, "PNG")
    print("Created char_hoe_fighter (11 frames)")

# 5. char_slipper_slap: Cute white circle dude slapping slipper (cầm dép tông)
def create_slipper_slap():
    out_dir = os.path.join(DISCO_CHARS_DIR, "char_slipper_slap")
    make_dir(out_dir)
    src_dir = os.path.join(DISCO_CHARS_DIR, "e")
    print("Generating char_slipper_slap...")
    
    for i in range(16):
        src_idx = i % 8
        src_file = os.path.join(src_dir, f"{src_idx:03d}.png")
        im = Image.open(src_file).convert("RGBA")
        
        canvas = Image.new("RGBA", (240, 240), (0, 0, 0, 0))
        canvas.paste(im, (0, 0), im)
        
        draw = ImageDraw.Draw(canvas)
        
        # Waving hand holding a yellow flip-flop (dép tông vàng)
        wave_cycle = math.sin(i * math.pi / 4)
        hand_x = 65 + int(wave_cycle * 15)
        hand_y = 95 - int(abs(wave_cycle) * 20)
        
        # Arm line
        draw.line([100, 120, hand_x, hand_y], fill=(255, 255, 255, 255), width=8)
        draw.line([100, 120, hand_x, hand_y], fill=(0, 0, 0, 255), width=2)
        
        # Slipper sole (yellow)
        slipper_angle = wave_cycle * 0.8
        sl_w, sl_h = 32, 16
        # Draw rotated ellipse for slipper
        draw.ellipse([hand_x - 16, hand_y - 10, hand_x + 16, hand_y + 10], fill=(255, 215, 0, 255), outline=(0, 0, 0, 255), width=2)
        # Slipper strap (blue)
        draw.line([hand_x - 6, hand_y, hand_x + 6, hand_y], fill=(0, 180, 255, 255), width=4)
        draw.line([hand_x, hand_y, hand_x, hand_y - 6], fill=(0, 180, 255, 255), width=3)
        
        out_file = os.path.join(out_dir, f"{i:03d}.png")
        canvas.save(out_file, "PNG")
    print("Created char_slipper_slap (16 frames)")

if __name__ == "__main__":
    create_panda_cry()
    create_panda_smug()
    create_yaoming_laugh()
    create_hoe_fighter()
    create_slipper_slap()
    print("All Chinese meme characters created successfully!")
