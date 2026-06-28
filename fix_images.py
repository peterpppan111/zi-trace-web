import urllib.request
import urllib.parse
import re
import os
import ssl
from PIL import Image

ssl._create_default_https_context = ssl._create_unverified_context

chars = ['古', '文', '字', '成', '語']
pinyin = ['gu', 'wen', 'zi', 'cheng', 'yu']

os.makedirs('images/title', exist_ok=True)

for i, char in enumerate(chars):
    url = "https://xiaoxue.iis.sinica.edu.tw/yanbian/PageResult/PageResult"
    data = urllib.parse.urlencode({'EudcFontChar': char, 'ImageSize': '128'}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        html = urllib.request.urlopen(req).read().decode('utf-8')
        match = re.search(r'src="(/ImageText2/ShowImage\.ashx\?text=[^"]+font=[^"]*%e7%94%b2%e9%aa%a8%e6%96%87[^"]+size=128[^"]+)"', html, re.IGNORECASE)
        
        if not match:
            match = re.search(r'src="(/ImageText2/ShowImage\.ashx\?text=[^"]+size=128[^"]+)"', html, re.IGNORECASE)

        if match:
            img_url = "https://xiaoxue.iis.sinica.edu.tw" + match.group(1).replace('&amp;', '&')
            print(f"Fetching {char}: {img_url}")
            img_data = urllib.request.urlopen(urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})).read()
            tmp_path = f'images/title/{pinyin[i]}_tmp.png'
            with open(tmp_path, 'wb') as f:
                f.write(img_data)
            
            # Open and crop
            img = Image.open(tmp_path).convert("RGBA")
            # If the image has white background instead of transparent, let's fix it by using the luminance as alpha
            datas = img.getdata()
            newData = []
            for item in datas:
                # Calculate brightness
                brightness = sum(item[:3])/3
                # If it has alpha and alpha is 0, keep it 0
                if item[3] == 0:
                    newData.append((0, 0, 0, 0))
                else:
                    # If it's a white background image (no alpha), dark text means we want alpha = 255 - brightness
                    alpha = int(255 - brightness)
                    newData.append((0, 0, 0, alpha))
            img.putdata(newData)
            bbox = img.getbbox()
            if bbox:
                img = img.crop(bbox)
            
            img.save(f'images/title/{pinyin[i]}.png', "PNG")
            os.remove(tmp_path)
            print(f"Processed {char}")
    except Exception as e:
        print(f"Error fetching {char}: {e}")
