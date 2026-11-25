"""Instala Montu y consulta el contexto de tu equipo con tu identidad personal."""
import argparse
import getpass
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

BASE = "https://montu.fun"
ASSETS = BASE + "/skills/montu-equipo"
CLIENTS = {
    "claude-code": Path.home() / ".claude/skills/montu-equipo",
    "codex": Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex") / "skills/montu-equipo",
}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def fetch(url, body=None, token=None):
    headers = {"Content-Type": "application/json"} if body is not None else {}
    if token:
        headers["Authorization"] = "Bearer " + token
    data = json.dumps(body).encode() if body is not None else None
    with build_opener(NoRedirect()).open(Request(url, data=data, headers=headers), timeout=90) as response:
        return response.read()


def token_path(client):
    root = Path(os.environ.get("XDG_CONFIG_HOME") or Path.home() / ".config")
    return root / "montu-equipo" / (client + ".token")


def save_private(path, content):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor, temporary = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as output:
            output.write(content)
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def install(client):
    dest = CLIENTS[client]
    skill = fetch(ASSETS + "/SKILL.md")
    if not skill.startswith(b"---\nname: montu-equipo\n"):
        raise ValueError("No se pudo verificar la skill descargada.")
    dest.mkdir(parents=True, exist_ok=True)
    save_private(dest / "SKILL.md", skill)
    if Path(__file__).resolve() != (dest / "montu.py").resolve():
        shutil.copyfile(__file__, dest / "montu.py")
    creds = token_path(client)
    if creds.exists():
        try:
            me = json.loads(fetch(BASE + "/api/assistants/me", token=creds.read_text()))
            print("Skill instalada. Cuenta conectada:", me["person"]["name"])
            return
        except HTTPError as error:
            if error.code != 401:
                raise
    print("En montu.fun, abre Tú → Tu agente y copia la línea de vinculación.")
    link = getpass.getpass("Pega la línea (entrada oculta): ")
    match = re.search(r"https://montu\.fun/a/([A-Za-z0-9]{8})(?![A-Za-z0-9])", link)
    if not match:
        raise ValueError("Se necesita el enlace de vinculación de montu.fun.")
    creds.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    joined = json.loads(fetch(BASE + "/api/assistants/join", {
        "code": match[1], "kind": client, "label": client,
    }))
    save_private(creds, joined["token"].encode())
    me = json.loads(fetch(BASE + "/api/assistants/me", token=creds.read_text()))
    print("Skill instalada. Cuenta conectada:", me["person"]["name"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="action", required=True)
    commands.add_parser("instalar").add_argument("cliente", choices=CLIENTS)
    for cmd in ["contexto", "pendientes", "decir", "responder", "traspaso"]:
        sub = commands.add_parser(cmd)
        if cmd == "traspaso":
            sub.add_argument("equipo")
            sub.add_argument("revision", type=int)
            sub.add_argument("texto", help="Resumen vigente. Vacío para retirarlo.")
        elif cmd in ("decir", "responder"):
            sub.add_argument("texto", help="Mensaje o id de la opción elegida")
    for kind in ('hilos', 'hilo', 'publicar', 'novedades'):
        sub = commands.add_parser(kind)
        sub.add_argument('equipo')
        if kind == 'hilos':
            sub.add_argument('--buscar', default='')
        elif kind in ('hilo', 'publicar'):
            ref = sub.add_mutually_exclusive_group(required=True)
            ref.add_argument('--referencia')
            ref.add_argument('--hilo')
        if kind == 'publicar':
            sub.add_argument('--titulo')
            sub.add_argument('--tipo', choices=['hallazgo','pregunta','decision','cierre'], default='hallazgo')
            sub.add_argument('--texto', required=True)
            sub.add_argument('--clave', help='Identificador estable para reintentos.')
        if kind in ('hilo','hilos'):
            sub.add_argument('--antes', type=int)
        if kind == 'novedades':
            sub.add_argument('--desde', type=int, default=0)
    args = parser.parse_args()
    if args.action == "instalar":
        return install(args.cliente)
    client = next((key for key, folder in CLIENTS.items() if folder.resolve() == Path(__file__).resolve().parent), None)
    if not client or not token_path(client).exists():
        raise ValueError("Ejecuta primero montu.py instalar para tu cliente y usa la copia instalada.")
    operations = {'hilos':'ronda_hilos','hilo':'ronda_hilo','publicar':'ronda_hilo_publicar','novedades':'ronda_hilos_novedades'}
    if args.action in operations:
        fields = {k:v for k,v in vars(args).items() if k != 'action' and v is not None}
        if args.action == 'publicar' and 'clave' not in fields:
            fields['clave'] = hashlib.sha256(json.dumps(fields, sort_keys=True).encode()).hexdigest()
        payload = {'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':operations[args.action],'arguments':fields}}
        response = json.loads(fetch(BASE+'/api/mcp', payload, token_path(client).read_text().strip()))
        result = response.get('result') or {}
        if result.get('isError') or not result.get('content'):
            raise ValueError((result.get('content') or [{'text':'Montu no pudo completar la consulta.'}])[0]['text'])
        return print(result['content'][0]['text'])
    routes = {"contexto": "context", "pendientes": "inbox", "traspaso": "handoff", "decir": "say", "responder": "answer"}
    body = None
    if args.action == "traspaso":
        body = {"equipo": args.equipo, "revision": args.revision, "texto": args.texto}
    elif args.action in ("decir", "responder"):
        body = {"text" if args.action == "decir" else "option": args.texto}
    raw = fetch(BASE + "/api/agent/" + routes[args.action], body, token_path(client).read_text())
    print(json.dumps(json.loads(raw), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except HTTPError as error:
        try:
            problem = json.loads(error.read()).get("error")
        except (ValueError, AttributeError):
            problem = None
        sys.exit(f"Montu HTTP {error.code}. {problem or 'Revisa tu conexión.'}")
    except (OSError, ValueError, URLError, EOFError) as error:
        sys.exit(str(error))
