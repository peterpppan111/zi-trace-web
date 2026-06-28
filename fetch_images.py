import urllib.request
import urllib.parse
import re
import os
import ssl

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
        # Find the first image with font containing 甲骨文
        # URL encoded 甲骨文 is %e7%94%b2%e9%aa%a8%e6%96%87
        match = re.search(r'src="(/ImageText2/ShowImage\.ashx\?text=[^"]+font=[^"]*%e7%94%b2%e9%aa%a8%e6%96%87[^"]+size=128[^"]+)"', html, re.IGNORECASE)
        
        if not match:
            # Fallback to the first image if no oracle bone found
            match = re.search(r'src="(/ImageText2/ShowImage\.ashx\?text=[^"]+size=128[^"]+)"', html, re.IGNORECASE)

        if match:
            img_url = "https://xiaoxue.iis.sinica.edu.tw" + match.group(1).replace('&amp;', '&')
            print(f"Fetching {char}: {img_url}")
            img_data = urllib.request.urlopen(urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})).read()
            with open(f'images/title/{pinyin[i]}.png', 'wb') as f:
                f.write(img_data)
        else:
            print(f"No image found for {char}")
    except Exception as e:
        print(f"Error fetching {char}: {e}")
