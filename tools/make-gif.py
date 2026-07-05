"""Creates demo GIF by resizing all 5 screenshots and stringing them together."""
from PIL import Image
import os

shots_dir = os.path.join(os.path.dirname(__file__), '..', 'screenshots')
out_path  = os.path.join(shots_dir, 'demo.gif')

files = [
    ('01-first-player.png', 250),   # centiseconds (2.5s)
    ('02-your-turn.png',    250),
    ('03-success.png',      300),
    ('04-waiting.png',      250),
    ('05-reveal.png',       400),   # longest — chain reveal
]

W, H = 390, 844
frames = []
durations = []

for fname, duration_cs in files:
    path = os.path.join(shots_dir, fname)
    img = Image.open(path).convert('RGBA')
    # Fit into W×H preserving ratio, pad with background color
    img.thumbnail((W, H), Image.LANCZOS)
    canvas = Image.new('RGBA', (W, H), (13, 17, 23, 255))
    offset = ((W - img.width) // 2, (H - img.height) // 2)
    canvas.paste(img, offset)
    frames.append(canvas.convert('P', palette=Image.ADAPTIVE, colors=256))
    durations.append(duration_cs * 10)  # convert cs → ms
    print(f'  added {fname}')

frames[0].save(
    out_path,
    save_all=True,
    append_images=frames[1:],
    duration=durations,
    loop=0,
    optimize=True,
)
print(f'\nSaved demo.gif ({os.path.getsize(out_path):,} bytes)')
