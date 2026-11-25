"""Puente MCP de solo lectura entre Montu y los dos agentes locales del operador."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import sys
from urllib.error import HTTPError
from urllib.parse import urlencode

from montu import BASE, fetch, token_path


def local_key(path, prefix):
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        pass
    else:
        with os.fdopen(fd, "w") as handle:
            handle.write(prefix + secrets.token_urlsafe(32))
    key = path.read_text().strip()
    if not key.startswith(prefix) or len(key) < 35:
        raise ValueError("Credencial local incompleta. Revisa " + str(path))
    return key


def admin_path(client):
    return token_path(client).with_name(client + ".admin.token")


def binding(email):
    params = [("cuenta", email.strip().lower())]
    for client in ("claude-code", "codex"):
        for field, path, prefix in (("p", token_path(client), "rda_"), ("a", admin_path(client), "mta_")):
            digest = hashlib.sha256(local_key(path, prefix).encode()).hexdigest()
            params.append((field, digest))
    return BASE + "/admin#" + urlencode(params)


def serve(client):
    key = admin_path(client).read_text().strip()
    for line in sys.stdin:
        try:
            message = json.loads(line)
        except ValueError:
            continue
        if not isinstance(message, dict) or "id" not in message:
            continue
        try:
            raw = fetch(BASE + "/api/operator/mcp", message, key)
            result = json.loads(raw)
        except (HTTPError, OSError, ValueError) as err:
            code = getattr(err, "code", None)
            problem = "Vincula tu instalación con Montu." if code in (401, 403) else "Montu no respondió."
            result = {"jsonrpc": "2.0", "id": message["id"], "error": {"code": -32000, "message": problem}}
        print(json.dumps(result, ensure_ascii=False), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="action", required=True)
    commands.add_parser("vincular").add_argument("email", help="Correo de operador asociado a Google en Montu")
    commands.add_parser("servir").add_argument("cliente", choices=["claude-code", "codex"])
    args = parser.parse_args()
    if args.action == "vincular":
        print(binding(args.email))
    else:
        serve(args.cliente)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError) as error:
        sys.exit(str(error))
