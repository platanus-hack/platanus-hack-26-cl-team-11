"""Rebuild the five standalone pages with python3 design/motion/src/build.py."""
import base64
import os
import subprocess
import tempfile
from pathlib import Path

SRC = Path(__file__).resolve().parent
OUT = SRC.parent
DESIGN = OUT.parent


def asset(path, mime):
    data = base64.b64encode((DESIGN / path).read_bytes()).decode("ascii")
    return f"data:{mime};base64,{data}"


LOGO = asset("logo/ronda-mark.svg", "image/svg+xml")
ICONS = {
    "play": '<path d="m8 5 11 7-11 7z"/>',
    "pause": '<path d="M8 5v14m8-14v14"/>',
    "replay": '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
    "chat": '<path d="M21 11a8 8 0 0 1-8 8H9l-5 3v-6a8 8 0 0 1 7-13h2a8 8 0 0 1 8 8Z"/>',
    "calendar": '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v5m10-5v5M3 11h18"/>',
    "lock": '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
    "check": '<path d="m4 12 5 5L20 6"/>',
    "moon": '<path d="M20.5 14.5A9 9 0 0 1 9.5 3.5a9 9 0 1 0 11 11Z"/>',
    "users": '<circle cx="9" cy="8" r="3"/><path d="M3 19v-2a6 6 0 0 1 12 0v2m1-14a3 3 0 0 1 0 6m2 2a5 5 0 0 1 3 5"/>',
}


def icon(name):
    return f'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</svg>'


def face(name, small=False):
    uri = asset("faces/" + name.lower() + ".png", "image/png")
    size = " rd-face--tiny" if small else ""
    return f'<img class="rd-face{size}" src="{uri}" alt="">'


def person(name, status, big=False):
    return f'<div class="identity">{face(name, not big)}<div class="rd-person"><span class="rd-person__name">{name}</span><span class="rd-person__status">{status}</span></div></div>'


def gradient():
    stops = "".join(f'<stop offset="{offset}%" style="stop-color:var(--rd-g{i})"/>' for i, offset in enumerate([0, 30, 55, 76, 100], 1))
    return f'<defs><linearGradient id="rd-live" x1="0" x2="1" y1="0" y2="0">{stops}</linearGradient></defs>'


def wire(path, viewbox):
    return f'''<svg class="wire" viewBox="{viewbox}" preserveAspectRatio="none" aria-hidden="true">{gradient()}
      <path id="route" class="rd-edge" d="{path}" vector-effect="non-scaling-stroke"/>
      <g id="lit" fill="none"><path d="{path}" class="rd-edge--glow" vector-effect="non-scaling-stroke"/><path d="{path}" class="rd-edge--live" vector-effect="non-scaling-stroke"/></g>
    </svg>'''


def packet(start, end, reverse=False, label=""):
    direction = ' data-reverse' if reverse else ''
    content = f'<span class="packet-label rd-chip rd-glass">{label}</span>' if label else ''
    return f'<div aria-hidden="true" class="packet" data-flight="{start},{end}"{direction}><i></i>{content}</div>'


def bridge(start, end, reverse=False):
    return f'<div class="bridge" aria-hidden="true"><div class="route-box">{wire("M0 24 C22 2 42 46 68 24", "0 0 68 48")}{packet(start, end, reverse)}</div></div>'


def chat():
    return f'''<div class="network">
      <div class="orbit">{wire("M16 70 C34 5 66 5 84 70", "0 0 100 100")}
        {packet(1800, 4500, label="¿Cómo va la demo?")}
        {packet(6500, 9300, True, "El calendario ya funciona.")}
      </div>
      <div class="peer first">{person("Mati", "Agente personal", True)}
        <p class="bubble rd-glass" data-at="0" data-transit="1800,4500">¿Cómo va la demo?</p></div>
      <div class="peer second">{person("Ian", "Agente personal", True)}
        <p class="bubble rd-glass" data-at="5200" data-transit="6500,9300">El calendario ya funciona.</p></div>
    </div>'''


def calendars():
    hours = ["09:30", "10:00", "10:30", "11:00", "11:30"]
    slots = []
    for i, hour in enumerate(hours):
        slots.append(f'<div class="axis">{hour}</div>')
        for col, busy in enumerate(([True, False, False, True, True], [False, True, False, True, False])):
            if i == 2:
                content = f'<span class="free" data-at="{4400 + col * 480}">Libre</span>'
            elif busy[i]:
                content = f'<span class="busy" data-at="{0 if col == 0 else 1150 + i * 150}">Ocupado</span>'
            else:
                content = ""
            slots.append(f'<div class="slot">{content}</div>')
    return f'''<div class="calendar rd-card rd-glass">
      <div class="card-top"><span class="label-icon rd-label">{icon("calendar")}Disponibilidad</span><span class="rd-note">Viernes 20 nov.</span></div>
      <div class="timetable"><div></div>{person("Mati", "Agenda")}{person("Ian", "Agenda")}{"".join(slots)}</div>
      <div class="result-slot"><div class="calendar-result" data-at="7400"><span class="rd-label">Horario propuesto</span><p class="rd-title">Ambos pueden de 10:30 a 11:00.</p></div></div>
    </div>'''


def health():
    trace = "M2 37H17V48H29V30H38V15H54V38H71V52H89V33H103V23H115V41H128V54H148V34H162V19H178V32H190V47H207V28H221V39H238V16H251V29H269V36H280"
    return f'''<div class="exchange health">
      <article class="private rd-glass rd-card">{person("Mati", "Vista privada")}
        <div class="medical"><span class="rd-label label-icon">{icon("moon")}Sueño de anoche</span>
          <div class="rd-stat">6<span class="rd-stat__unit">h</span>42<span class="rd-stat__unit">min</span></div>
          <svg class="chart" viewBox="0 0 282 65" preserveAspectRatio="none" role="img" aria-label="Registro sintético de sueño">
            <path d="M0 16H282 M0 33H282 M0 50H282" class="gridlines"/><path class="trace-under" d="{trace}"/><path class="trace" pathLength="1" data-draw="400,3600" d="{trace}"/>
          </svg><div class="ticks"><span>00:10</span><span>06:52</span></div>
        <div class="card-foot rd-label">{icon("lock")}No sale de tu agente.</div></div></article>
      <div class="bridge"><div class="route-box">{wire("M0 24 C22 2 42 46 68 24", "0 0 68 48")}{packet(4400, 5700, True)}{packet(6700, 8300)}</div></div>
      <article class="recipient rd-card rd-glass">{person("Ian", "Agente que consulta")}
        <div class="exchange-text"><p class="rd-label" data-at="3450">¿Cuánto durmió?</p><p class="rd-title" data-at="8230">Ese dato es privado.</p></div>
      </article></div>'''


def permission():
    return f'''<div class="exchange consent">
      <article class="private rd-card rd-glass">
        <div class="card-top">{person("Mati", "Tu agente por WhatsApp")}</div>
        <p class="prompt">¿Le comparto esta frase al agente de Ian?</p>
        <div data-thread>Hoy prefiero una tarea liviana.</div>
        <div class="approval" data-at="2200"><span class="rd-button simulated" data-press="4900"><span>Compartir esta vez</span><span>Compartido esta vez</span></span>
        <span class="tap" data-tap="4900" aria-hidden="true"></span></div>
        <span class="card-foot rd-label" data-at="5440">{icon("check")}Permiso de un solo uso</span>
      </article>
      {bridge(6230, 8260)}
      <article class="recipient rd-card rd-glass">{person("Ian", "Agente destinatario")}
        <div class="exchange-text" data-at="8240"><p class="rd-title">Hoy prefiero una tarea liviana.</p><span class="label-icon rd-label">{icon("lock")}Solo para actuar</span></div>
      </article></div>'''


def help_scene():
    def invite(name, role, prompt, at, yes):
        return f'''<article class="invitation rd-card rd-glass" data-at="{at}">
          {person(name, role)}<p class="prompt">{prompt}</p>
          <span class="answer rd-chip" data-at="{yes}">{icon("check")}Acepto</span></article>'''
    return f'''<div class="match">
      <div class="invites">{invite("Mati", "Busca ayuda", "¿Te presento a alguien para ensayar tu pitch?", 0, 4100)}
        {invite("Ian", "Puede ayudar", "¿Te sumas a un ensayo de pitch?", 2050, 7000)}</div>
      <div class="intro" data-at="8650"><div class="rd-card rd-glass intro-card">
        <div class="duo">{face("Mati", True)}{face("Ian", True)}</div>
        <div><span class="rd-label">Presentación entre Mati e Ian</span><p class="rd-title">Ya pueden coordinar el ensayo.</p></div>
      </div></div></div>'''


SCENES = [
    ("chat", "Chat entre agentes", "Una pregunta,", "una respuesta.", "Conversación", "chat", chat, 12000),
    ("calendars", "Comparar calendarios", "Dos agendas,", "media hora libre.", "Calendarios", "calendar", calendars, 11000),
    ("health", "Consultar salud", "Tu descanso,", "en privado.", "Salud", "moon", health, 12000),
    ("permission", "Pedir permiso", "Tú eliges", "qué compartir.", "Permisos", "lock", permission, 12000),
    ("help", "Encontrar ayuda", "Alguien con quien", "ensayar.", "Ayuda entre pares", "users", help_scene, 12000),
]


def bundle():
    skill = DESIGN.parent / ".agents/skills/stageshow"
    modules = skill / "node_modules"
    with tempfile.TemporaryDirectory() as temp:
        output = Path(temp) / "scene.js"
        subprocess.run([str(modules / ".bin/esbuild"), str(SRC / "player.jsx"),
                        "--bundle", "--jsx=automatic", "--minify", '--define:process.env.NODE_ENV="production"',
                        "--legal-comments=inline", "--outfile=" + str(output)],
                       env={**os.environ, "NODE_PATH": str(modules)}, check=True)
        return output.read_text(), output.with_suffix(".css").read_text()


def build():
    js, kit_css = bundle()
    license_text = (DESIGN.parent / ".agents/skills/stageshow/LICENSE").read_text()
    css = "\n".join(p.read_text() for p in [DESIGN / "tokens.css", DESIGN / "ronda.css", SRC / "scenes.css"])
    css = kit_css + "\n" + css
    for slug, title, first, second, label, symbol, scene, duration in SCENES:
        page = f'''<!doctype html>
<!-- Generated from design/motion/src. Embedded Stageshow kit license:
{license_text}
-->
<html lang="es-CL"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · Ronda</title><link rel="icon" type="image/svg+xml" href="{LOGO}"><style>{css}</style></head>
<body class="rd-page"><div aria-hidden="true" class="rd-aura"><i></i><i></i><i></i><i></i></div>
<div class="rd-page__inner shell">
<header class="rd-bar"><div class="rd-brand"><img class="rd-mark" src="{LOGO}" alt="">Ronda</div><span class="rd-note">Demo · Datos simulados</span></header>
<main><div class="heading"><div class="rd-label label-icon">{icon(symbol)}{label}</div><h1 class="rd-hero">{first}<br><span class="rd-gradient-text">{second}</span></h1></div>
<div class="art" id="example" aria-label="{title}"></div><template id="illustration">{scene()}</template></main>
<footer class="rd-player" data-duration="{duration}" data-scene="{slug}" aria-label="Reproducción de la escena">
<button id="toggle" class="rd-button"><span id="playIcon">{icon("play")}</span><span id="pauseIcon">{icon("pause")}</span><span id="toggleText">Reproducir</span></button>
<button class="rd-button rd-button--quiet restart" id="restart" aria-label="Repetir desde el inicio" title="Repetir desde el inicio">{icon("replay")}</button>
<div class="rd-player__position" aria-hidden="true"><span></span></div><span class="rd-player__time"></span></footer></div>
<script>{js}</script></body></html>
'''
        (OUT / (slug + ".html")).write_text(page)


if __name__ == "__main__":
    build()
