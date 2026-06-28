from PIL import Image
import os
import glob

# Ensure we process all pngs in images/title
for img_path in glob.glob('images/title/*.png'):
    try:
        img = Image.open(img_path).convert("RGBA")
        datas = img.getdata()

        newData = []
        for item in datas:
            # item is (R, G, B, A)
            # If pixel is close to white, make it transparent
            # If pixel is close to black, make it white (for mask)
            # Let's check brightness
            brightness = sum(item[:3])/3
            if brightness > 200: # White background
                newData.append((255, 255, 255, 0))
            else:
                newData.append((255, 255, 255, int(255 - brightness))) # Anti-aliasing preserved as alpha

        img.putdata(newData)
        # Crop the image to bounding box of the non-transparent pixels
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
        
        img.save(img_path, "PNG")
        print(f"Processed {img_path}")
    except Exception as e:
        print(f"Error processing {img_path}: {e}")
