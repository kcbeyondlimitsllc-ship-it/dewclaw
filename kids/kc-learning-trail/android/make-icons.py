#!/usr/bin/env python3
"""Launcher icons for the Android app, made from the game's own icons.
   python3 make-icons.py ../www/icons/icon-512.png ../www/icons/maskable-512.png"""
import sys, os
from PIL import Image
icon, mask = Image.open(sys.argv[1]).convert("RGBA"), Image.open(sys.argv[2]).convert("RGBA")
res = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app/src/main/res")
for name, px in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    d = os.path.join(res, "mipmap-" + name); os.makedirs(d, exist_ok=True)
    icon.resize((px, px), Image.LANCZOS).save(os.path.join(d, "ic_launcher.png"))
    # adaptive icon foreground: 108dp canvas, the maskable art fills it (its safe zone is the centre)
    fg = int(px * 108 / 48)
    mask.resize((fg, fg), Image.LANCZOS).save(os.path.join(d, "ic_launcher_foreground.png"))
d = os.path.join(res, "mipmap-anydpi-v26"); os.makedirs(d, exist_ok=True)
bg = "#%02x%02x%02x" % mask.getpixel((4, 4))[:3]
open(os.path.join(d, "ic_launcher.xml"), "w").write(
    '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
    '    <background android:drawable="@color/ic_launcher_background" />\n'
    '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n</adaptive-icon>\n')
open(os.path.join(res, "values/ic_launcher_background.xml"), "w").write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">%s</color>\n</resources>\n' % bg)
print("icons written, background", bg)
