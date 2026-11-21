#!/usr/bin/env python3
"""Saca las imágenes quietas de las caras de Ronda (design/faces/caras.js) en el formato del producto.

La cara viva la monta design/faces/caras.js. Lo que no la monta (el globo, el universo, una lámina)
lee siete imágenes de design/faces/: mati.png, ian.png, lian.png, roberto.png y andres.png
(320 px, recortadas en círculo) y atlas/faces.png con su gemelo atlas/faces-blur.png
(64 caras, 8 x 8 de 128 px).

Uso:  python3 design/caras/aplicar.py --out <carpeta> [--t 8]

Captura design/caras/atlas.html con Chrome y corta las láminas. Escribe en --out, nunca directo en
design/faces/: se miran primero y después se copian esos siete archivos a design/faces/ en un commit
propio. Hay que volver a correrlo cada vez que cambie el dibujo de las caras.
"""
import argparse
import os
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFilter

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
TEAM_FILES = ['mati', 'ian', 'lian', 'roberto', 'andres']
CELL, TEAM_CELL, BLUR = 128, 320, 5
HERE = os.path.dirname(os.path.abspath(__file__))


def capture(layer, instant, width, height):
    target = os.path.join(tempfile.mkdtemp(), layer + '.png')
    url = 'file://%s?capa=%s&t=%s' % (os.path.join(HERE, 'atlas.html'), layer, instant)
    subprocess.run([CHROME, '--headless=new', '--hide-scrollbars', '--force-device-scale-factor=1',
                    '--allow-file-access-from-files', '--window-size=%d,%d' % (width, height), '--virtual-time-budget=3000',
                    '--screenshot=' + target, url], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return Image.open(target).convert('RGB').crop((0, 0, width, height))


def blurred(atlas):
    twin = Image.new('RGB', atlas.size)
    for index in range(64):
        box = ((index % 8) * CELL, (index // 8) * CELL, (index % 8) * CELL + CELL, (index // 8) * CELL + CELL)
        twin.paste(atlas.crop(box).filter(ImageFilter.GaussianBlur(BLUR)), box[:2])
    return twin


def circle(tile):
    scale = 4
    mask = Image.new('L', (tile.width * scale, tile.height * scale), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, mask.width - 1, mask.height - 1), fill=255)
    face = tile.convert('RGBA')
    face.putalpha(mask.resize(tile.size, Image.LANCZOS))
    return face


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', required=True)
    parser.add_argument('--t', default='8')
    args = parser.parse_args()
    if os.path.abspath(args.out) == os.path.abspath(os.path.join(HERE, '..', 'faces')):
        parser.error('--out no puede ser design/faces/: escribe en otra carpeta, mira las imágenes y después cópialas')

    atlas = capture('atlas', args.t, CELL * 8, CELL * 8)
    team = capture('equipo', args.t, TEAM_CELL * len(TEAM_FILES), TEAM_CELL)
    os.makedirs(os.path.join(args.out, 'atlas'), exist_ok=True)
    atlas.save(os.path.join(args.out, 'atlas', 'faces.png'), optimize=True)
    blurred(atlas).save(os.path.join(args.out, 'atlas', 'faces-blur.png'), optimize=True)
    for slot, name in enumerate(TEAM_FILES):
        circle(team.crop((slot * TEAM_CELL, 0, (slot + 1) * TEAM_CELL, TEAM_CELL))).save(os.path.join(args.out, name + '.png'), optimize=True)
    print('Listo: caras en ' + args.out)


if __name__ == '__main__':
    main()
