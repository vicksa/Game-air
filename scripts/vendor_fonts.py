"""Vendor open-source Google Fonts; never needed at app runtime."""
import re, urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
root=Path(__file__).resolve().parents[1]/'public/fonts';root.mkdir(exist_ok=True)
url='https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600&display=swap'
css=urllib.request.urlopen(url).read().decode()
urls=re.findall(r'https://[^)]+',css)
def download(u):
    name=u.rsplit('/',1)[1];(root/name).write_bytes(urllib.request.urlopen(u).read());return u,name
with ThreadPoolExecutor(max_workers=5) as pool:
    for u,n in pool.map(download,urls):css=css.replace(u,'./'+n)
(root/'fonts.css').write_text(css)
for name,folder in [('BarlowCondensed','barlowcondensed'),('IBMPlexMono','ibmplexmono')]:
    (root/f'{name}-OFL.txt').write_bytes(urllib.request.urlopen(f'https://raw.githubusercontent.com/google/fonts/main/ofl/{folder}/OFL.txt').read())
