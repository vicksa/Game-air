"""Original pixel artwork. Requires Pillow only when regenerating, not to play."""
from PIL import Image, ImageDraw
import random, json
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'public/assets'; root.mkdir(parents=True,exist_ok=True)
random.seed(91)
colors={'ninja':('#18264b','#405584','#ed5357'),'guard':('#483954','#826480','#ffc66b'),'archer':('#164752','#338c91','#e5bb78'),'boss':('#502d5f','#a45982','#ffab62')}
states={'idle':4,'run':6,'jump':2,'attack':5,'defend':2,'hurt':2,'death':4}
metadata={}
for kind,(dark,light,accent) in colors.items():
    sheet=Image.new('RGBA',(48*6,48*7))
    for row,(state,count) in enumerate(states.items()):
        for f in range(6):
            n=f%count; tile=Image.new('RGBA',(48,48)); d=ImageDraw.Draw(tile)
            bob=(n%2) if state in ('idle','run') else 0
            y=10+bob
            # flowing scarf, long and instantly readable
            d.polygon([(22,y+12),(9,y+11),(2,y+6+n%3),(6,y+15),(20,y+17)],fill=accent)
            d.rectangle((19,y+13,29,y+26),fill=dark);d.rectangle((19,y+14,23,y+25),fill=light)
            d.rectangle((18,y+2,30,y+13),fill=dark);d.rectangle((17,y+5,31,y+9),fill=light)
            d.rectangle((23,y+6,31,y+8),fill='#f5d4b6');d.point((28,y+7),fill='#111828')
            d.rectangle((18,y+3,31,y+4),fill=accent)
            shift=[0,3,5,0,-3,-5][n%6] if state=='run' else 0
            d.line([(22,y+25),(20-shift,y+34),(15-shift,y+34)],fill=dark,width=5)
            d.line([(27,y+25),(29+shift,y+34),(34+shift,y+34)],fill=light,width=5)
            d.line([(21,y+16),(17,y+23)],fill=light,width=4)
            d.line([(29,y+16),(33,y+22)],fill=dark,width=4)
            if state=='jump':
                d.rectangle((14,y+31,35,y+37),fill=(0,0,0,0)); d.line([(22,y+25),(16,y+28),(13,y+25)],fill=dark,width=4);d.line([(27,y+25),(34,y+28)],fill=light,width=4)
            if state=='attack':
                d.line([(28,y+16),(36,y+14)],fill=light,width=4)
                d.line([(33,y+18),(44,y+4+n*4)],fill='#fff2c2',width=2)
                if n in (1,2,3):d.arc((24,0,47,35),270,80,fill='#8df5ee',width=3)
            if state=='defend':d.arc((12,3,41,44),240,120,fill='#7ae5d6',width=2)
            if kind=='guard':
                d.rectangle((14,y+13,19,y+19),fill=accent);d.rectangle((29,y+13,34,y+19),fill=accent)
                d.rectangle((22,y+17,28,y+23),fill='#b79c78')
            if kind=='archer':
                d.polygon([(13,y+4),(24,y-5),(36,y+4)],fill='#d3ab71');d.line((13,y+4,36,y+4),fill='#ffe0a0',width=2)
                d.arc((30,y+11,45,y+32),270,90,fill='#d7b479',width=2);d.line((37,y+11,37,y+32),fill='#dbe5cc')
            if kind=='boss':
                d.polygon([(16,y+5),(12,y-4),(21,y+1),(28,y+1),(36,y-4),(33,y+8)],fill=accent)
                d.rectangle((14,y+13,21,y+21),fill=light);d.rectangle((29,y+13,36,y+21),fill=light)
                d.rectangle((22,y+18,29,y+24),fill=accent)
            if state=='hurt':
                alpha=tile.getchannel('A');tile=Image.blend(tile,Image.new('RGBA',(48,48),'#ffb5a0'),.45);tile.putalpha(alpha)
            if state=='death':tile=tile.rotate(-n*25,resample=Image.Resampling.NEAREST)
            sheet.alpha_composite(tile,(f*48,row*48))
    sheet.save(root/f'{kind}.png')
    metadata[kind]={s:{'frames':[r*6+i for i in range(c)],'fps':10 if s=='run' else 8,'loop':s in ('idle','run','defend')} for r,(s,c) in enumerate(states.items())}
(root/'atlas.json').write_text(json.dumps({'frameWidth':48,'frameHeight':48,'origin':[.5,1],'animations':metadata},indent=2))
# Layered city silhouettes, authored deterministically at native resolution.
for layer in range(3):
    im=Image.new('RGBA',(640,360));d=ImageDraw.Draw(im)
    col=['#171d3b','#22294b','#303653'][layer]
    x=-20
    while x<660:
        w=random.randint(25,70); top=random.randint(125+layer*35,220+layer*25)
        d.rectangle((x,top,x+w,360),fill=col)
        d.polygon([(x-8,top+5),(x+w//2,top-15),(x+w+8,top+5)],fill=col)
        for wy in range(top+14,350,15):
            for wx in range(x+6,x+w-3,11):
                if random.random()<.3:d.rectangle((wx,wy,wx+3,wy+5),fill=['#3b4361','#80604d','#b88053'][layer])
        x+=w+random.randint(6,15)
    im.save(root/f'city-{layer}.png')
im=Image.new('RGBA',(64,32));d=ImageDraw.Draw(im)
d.rectangle((0,0,63,31),fill='#20253b');d.rectangle((0,0,63,4),fill='#79909b');d.line((0,5,63,5),fill='#b9d2cc')
for x in range(0,64,16):d.line((x,7,x,31),fill='#343c51');d.line((0,18,63,18),fill='#343c51')
im.save(root/'platform.png')
im=Image.new('RGBA',(32,20));d=ImageDraw.Draw(im)
for x in (0,10,20):d.polygon([(x,19),(x+5,1),(x+11,19)],fill='#b8ced2');d.line((x+5,2,x+10,18),fill='#f17d78')
im.save(root/'spikes.png')
print('Generated 4 animated characters, 3 city layers, platform, spikes and atlas.')
