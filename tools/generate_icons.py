import os
from PIL import Image

SOURCE_IMAGE = "/home/ashutosh-mishra/.gemini/antigravity/brain/9e078d79-643b-48a8-abc2-a5081f3754d0/vidyaroop_app_icon_1765004386967.png"
PROJECT_ROOT = "/home/ashutosh-mishra/Desktop/Apps/CourseWeb"

ICON_CONFIGS = [
    # PWA Icons
    {"path": "public/icons/icon-72x72.png", "size": (72, 72)},
    {"path": "public/icons/icon-96x96.png", "size": (96, 96)},
    {"path": "public/icons/icon-128x128.png", "size": (128, 128)},
    {"path": "public/icons/icon-144x144.png", "size": (144, 144)},
    {"path": "public/icons/icon-152x152.png", "size": (152, 152)},
    {"path": "public/icons/icon-192x192.png", "size": (192, 192)},
    {"path": "public/icons/icon-384x384.png", "size": (384, 384)},
    {"path": "public/icons/icon-512x512.png", "size": (512, 512)},
    # Favicon
    {"path": "public/img/icons/icon-48x48.png", "size": (48, 48)},
]

FAVICON_ICO_PATH = "public/favicon.ico"

def main():
    if not os.path.exists(SOURCE_IMAGE):
        print(f"Error: Source image not found at {SOURCE_IMAGE}")
        return

    try:
        img = Image.open(SOURCE_IMAGE)
        # Ensure it's RGBA (though it likely is)
        img = img.convert("RGBA")
        
        print(f"Loaded source image: {img.size}")

        for config in ICON_CONFIGS:
            out_path = os.path.join(PROJECT_ROOT, config["path"])
            size = config["size"]
            
            # Resize with LANCZOS for quality
            resized_img = img.resize(size, Image.Resampling.LANCZOS)
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            
            resized_img.save(out_path)
            print(f"Generated {out_path} ({size})")

        # Handle favicon.ico
        ico_path = os.path.join(PROJECT_ROOT, FAVICON_ICO_PATH)
        img.resize((32, 32), Image.Resampling.LANCZOS).save(ico_path, format='ICO', sizes=[(32, 32)])
        print(f"Generated {ico_path}")

        print("All icons updated successfully.")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    main()
