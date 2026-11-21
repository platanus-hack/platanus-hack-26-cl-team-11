#!/usr/bin/env python3
"""Compone el «corte Ronda» de las Vita Faces para design/caras/sabores.html.

Mismas piezas que vita-front (public/vita-faces), con tres cambios: un solo fondo de vidrio
en vez de seis pasteles, solo expresiones y ropa de todos los días, y nada de deporte
(gorra de natación, antiparras, medalla, toalla, silbato).

Uso:  python3 design/caras/componer.py --parts <vita-front>/public/vita-faces
Deja: design/caras/vita-ronda.webp         atlas de 64 caras, 8 x 8 de 128 px
      design/caras/vita-ronda-equipo.webp  las cinco del equipo, 5 x 1 de 256 px
"""
import argparse
import os

from PIL import Image

SCALE, ORIGIN_Y = 1.32, 0.74
GLASS_CENTER, GLASS_EDGE = (255, 255, 255), (221, 224, 237)

HEADS = ['white', 'cream', 'yellow']
FACES = ['smile', 'open', 'happy', 'warm', 'content', 'serene', 'wink', 'smirk', 'focused', 'determined']
TOPS = ['grey', 'charcoal', 'navy', 'offwhite', 'olive', 'sage', 'camel', 'skyblue']
HAIRS = ['short', 'swept', 'bob', 'fringe', 'long', 'ponytail', 'bun']
HAIR_COLORS = ['black', 'darkbrown', 'brown', 'sand']
HATS = ['cap', 'beanie', 'bucket', 'flatcap', 'beret']
HAT_COLORS = ['grey', 'charcoal', 'navy', 'olive', 'camel', 'offwhite']
GLASSES = ['round', 'oval', 'rect', 'thick', 'cateye']
ACCESSORIES = ['collar', 'scarf', 'headphones']

TEAM = [
    {'head': 'cream', 'face': 'smirk', 'top': 'charcoal', 'hair': 'short', 'hairColor': 'black'},
    {'head': 'white', 'face': 'happy', 'top': 'navy', 'hair': 'swept', 'hairColor': 'brown'},
    {'head': 'yellow', 'face': 'focused', 'top': 'olive', 'hair': 'fringe', 'hairColor': 'black', 'glasses': 'round'},
    {'head': 'white', 'face': 'warm', 'top': 'camel', 'hair': 'swept', 'hairColor': 'black'},
    {'head': 'cream', 'face': 'smile', 'top': 'navy', 'hair': 'short', 'hairColor': 'brown', 'accessory': 'collar'},
]


def rng(seed):
    state = 0x811C9DC5
    for letter in seed:
        state = ((state ^ ord(letter)) * 0x01000193) & 0xFFFFFFFF
    state = state or 0x9E3779B9

    def step():
        nonlocal state
        state ^= (state << 13) & 0xFFFFFFFF
        state ^= state >> 17
        state ^= (state << 5) & 0xFFFFFFFF
        return state / 0x100000000

    return step


def recipe(seed):
    rand = rng(seed)
    pick = lambda options: options[int(rand() * len(options))]
    face = {'head': pick(HEADS), 'face': pick(FACES), 'top': pick(TOPS)}
    hair, hair_color = pick(HAIRS), pick(HAIR_COLORS)
    if rand() < 0.9:
        face['hair'], face['hairColor'] = hair, hair_color
    hat, hat_color = pick(HATS), pick(HAT_COLORS)
    if rand() < 0.1:
        face['hat'], face['hatColor'] = hat, hat_color
    glasses = pick(GLASSES)
    if rand() < 0.28:
        face['glasses'] = glasses
    accessory = pick(ACCESSORIES)
    if rand() < 0.16:
        face['accessory'] = accessory
    return face


def layers(face):
    names = ['head_' + face['head'], 'features_' + face['face']]
    if not face.get('hat') and face.get('hair'):
        names.append('hair_%s__%s' % (face['hair'], face['hairColor']))
    names.append('top_' + face['top'])
    if face.get('accessory') and face['accessory'] != 'headphones':
        names.append('acc_' + face['accessory'])
    if face.get('hat'):
        names.append('hat_%s__%s' % (face['hat'], face['hatColor']))
    if face.get('glasses'):
        names.append('glasses_' + face['glasses'])
    if face.get('accessory') == 'headphones':
        names.append('acc_headphones')
    return names


def glass(size):
    tile = Image.new('RGBA', (size, size))
    pixels = tile.load()
    cx, cy, reach = size * 0.36, size * 0.27, size * 0.86
    for y in range(size):
        for x in range(size):
            t = min(1.0, (((x - cx) ** 2 + (y - cy) ** 2) ** 0.5) / reach)
            t = t * t * (3 - 2 * t)
            pixels[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(GLASS_CENTER, GLASS_EDGE)) + (255,)
    return tile


def compose(parts, face, size, background):
    big = round(size * SCALE)
    left, top = round(size * 0.5 - big * 0.5), round(size * ORIGIN_Y - big * ORIGIN_Y)
    tile = background.copy()
    for name in layers(face):
        part = Image.open(os.path.join(parts, name + '.webp')).convert('RGBA').resize((big, big), Image.LANCZOS)
        tile.alpha_composite(part.crop((-left, -top, -left + size, -top + size)))
    return tile


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--parts', required=True)
    args = parser.parse_args()
    here = os.path.dirname(os.path.abspath(__file__))

    cell = 128
    background = glass(cell)
    atlas = Image.new('RGBA', (cell * 8, cell * 8))
    for index in range(64):
        atlas.alpha_composite(compose(args.parts, recipe('ronda-%d' % index), cell, background), ((index % 8) * cell, (index // 8) * cell))
    atlas.convert('RGB').save(os.path.join(here, 'vita-ronda.webp'), quality=90, method=6)

    cell = 256
    background = glass(cell)
    team = Image.new('RGBA', (cell * len(TEAM), cell))
    for index, face in enumerate(TEAM):
        team.alpha_composite(compose(args.parts, face, cell, background), (index * cell, 0))
    team.convert('RGB').save(os.path.join(here, 'vita-ronda-equipo.webp'), quality=92, method=6)


if __name__ == '__main__':
    main()
