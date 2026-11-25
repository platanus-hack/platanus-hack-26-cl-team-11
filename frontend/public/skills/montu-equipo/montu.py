"""Instala Montu y consulta el contexto de tu equipo con tu identidad personal."""
import argparse
import getpass
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
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as output:
        try:
            output.write(content)
            output.flush()
            os.replace(output.name, path)
        finally:
            Path(output.name).unlink(missing_ok=True)


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
    args = parser.parse_args()
    if args.action == "instalar":
        return install(args.cliente)
    client = next((key for key, folder in CLIENTS.items() if folder.resolve() == Path(__file__).resolve().parent), None)
    if not client or not token_path(client).exists():
        raise ValueError("Ejecuta primero montu.py instalar para tu cliente y usa la copia instalada.")
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
