#!/usr/bin/env python3
"""Deja un sabor de design/caras/sabores.html en el formato de imágenes que usa el producto.

El globo, las tarjetas de herramienta y el frontend leen siete archivos de design/faces/:
mati.png, ian.png, lian.png, roberto.png y andres.png (320 px, recortadas en círculo) y
atlas/faces.png con su gemelo atlas/faces-blur.png (64 caras, 8 x 8 de 128 px).

Uso:  python3 design/caras/aplicar.py --sabor vidrio --parts <vita-front>/public/vita-faces --out <carpeta>
      python3 design/caras/aplicar.py --sabor tinta --out <carpeta>
      python3 design/caras/aplicar.py --sabor aura --out <carpeta>

Escribe en --out, nunca en design/faces/. Aplicar un sabor es copiar esos siete archivos a
design/faces/ en un commit propio, después de que Mati lo apruebe.
"""
import argparse
import os
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFilter

import componer

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
TEAM_FILES = ['mati', 'ian', 'lian', 'roberto', 'andres']
CELL, TEAM_CELL, BLUR = 128, 320, 5
HERE = os.path.dirname(os.path.abspath(__file__))


def capture(flavor, layer, width, height):
    target = os.path.join(tempfile.mkdtemp(), layer + '.png')
    url = 'file://' + os.path.join(HERE, 'atlas.html') + '?sabor=' + flavor + '&capa=' + layer
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
                    '--allow-file-access-from-files', '--window-size=%d,%d' % (width, height), '--virtual-time-budget=3000',
                    '--screenshot=' + target, url], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return Image.open(target).convert('RGB').crop((0, 0, width, height))


def sheets(flavor, parts):
    if flavor != 'vidrio':
        return capture(flavor, 'atlas', CELL * 8, CELL * 8), capture(flavor, 'equipo', TEAM_CELL * len(TEAM_FILES), TEAM_CELL)
    background = componer.glass(CELL)
    atlas = Image.new('RGBA', (CELL * 8, CELL * 8))
    for index in range(64):
        atlas.alpha_composite(componer.compose(parts, componer.recipe('ronda-%d' % index), CELL, background), ((index % 8) * CELL, (index // 8) * CELL))
    background = componer.glass(TEAM_CELL)
    team = Image.new('RGBA', (TEAM_CELL * len(TEAM_FILES), TEAM_CELL))
    for slot, face in enumerate(componer.TEAM):
        team.alpha_composite(componer.compose(parts, face, TEAM_CELL, background), (slot * TEAM_CELL, 0))
    return atlas.convert('RGB'), team.convert('RGB')


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
    parser.add_argument('--sabor', required=True, choices=['vidrio', 'tinta', 'aura'])
    parser.add_argument('--parts')
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    if args.sabor == 'vidrio' and not args.parts:
        parser.error('--sabor vidrio necesita --parts')
    if os.path.abspath(args.out) == os.path.abspath(os.path.join(HERE, '..', 'faces')):
        parser.error('--out no puede ser design/faces/: copia los archivos a mano después de la aprobación')

    atlas, team = sheets(args.sabor, args.parts)
    os.makedirs(os.path.join(args.out, 'atlas'), exist_ok=True)
    atlas.save(os.path.join(args.out, 'atlas', 'faces.png'), optimize=True)
    blurred(atlas).save(os.path.join(args.out, 'atlas', 'faces-blur.png'), optimize=True)
    for slot, name in enumerate(TEAM_FILES):
        circle(team.crop((slot * TEAM_CELL, 0, (slot + 1) * TEAM_CELL, TEAM_CELL))).save(os.path.join(args.out, name + '.png'), optimize=True)
    print('Listo: %s en %s' % (args.sabor, args.out))


if __name__ == '__main__':
    main()
