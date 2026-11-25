"""Mirror explicit Montu thread messages for one opted-in team using existing Slack/Gmail connections."""

import fcntl
import hashlib
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
from pathlib import Path
from bridge import Bridge, ROOT

os.umask(0o077)
PORTAL = "https://montu.fun"
HELPER = Path.home() / ".codex/skills/montu-equipo/montu.py"


def montu(action, *args):
    return json.loads(
        subprocess.check_output(
            [sys.executable, str(HELPER), action, *map(str, args)], timeout=110
        )
    )


def parse_messages(raw):
    """Only Slack's outer envelopes carry IDs; message bodies are prefixed with >."""
    blocks = re.split(r"(?m)(?=^=== Message from |^From: )", raw)
    rows = []
    for b in blocks:
        ts = re.search(r"(?m)^Message TS: (\d+\.\d+)\s*$", b)
        who = re.search(r"^(?:=== Message from |From: )(.+?)\s+\(([UW][A-Z0-9]+)\)", b)
        if not ts or not who:
            continue
        lines = [
            line[2:]
            for line in b.splitlines()
            if line.startswith("> ")
            and not line.startswith(
                ("> *Enviado usando*", "> *Sent using*", "> Thread: ")
            )
        ]
        name = who[1].split(" <")[0]
        if lines:
            rows.append((ts[1], who[2], name, "\n".join(lines)))
    return rows


def decode(raw):
    if isinstance(raw, list) and len(raw) == 1 and isinstance(raw[0], str):
        try:
            return json.loads(raw[0])
        except ValueError:
            return raw[0]
    return raw


class Relay:
    def __init__(self, config, bridge):
        self.c = config
        self.b = bridge
        self.db = sqlite3.connect(ROOT / "relay.sqlite", isolation_level=None)
        self.db.executescript("""CREATE TABLE IF NOT EXISTS ledger(k TEXT PRIMARY KEY, v TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS roots(topic TEXT,channel TEXT,ts TEXT NOT NULL,PRIMARY KEY(topic,channel));""")

        routing = json.dumps(
            [config[k] for k in ("team", "channel", "general", "mail_thread")]
        )
        if self.get("routing") not in (None, routing):
            raise ValueError("El registro corresponde a otro equipo o destino.")
        self.set("routing", routing)

    def get(self, key):
        row = self.db.execute("SELECT v FROM ledger WHERE k=?", (key,)).fetchone()
        return row[0] if row else None

    def set(self, key, value):
        self.db.execute(
            "INSERT INTO ledger VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v",
            (key, str(value)),
        )

    def call(self, tool, **kwargs):
        return decode(self.b.call("codex_apps", tool, kwargs))

    def history(self, ch, parent=None, oldest=None):
        args = dict(channel_id=ch, limit=100, response_format="detailed")
        if oldest:
            args["oldest"] = oldest
        tool = "slack.slack_read_channel"
        if parent:
            tool = "slack.slack_read_thread"
            args["message_ts"] = parent
        seen = set()
        while True:
            result = self.call(tool, **args)
            if not isinstance(result, dict) or "messages" not in result:
                raise RuntimeError("Respuesta de Slack sin historial")
            rows = parse_messages(result["messages"])
            if "Message TS:" in result["messages"] and not rows:
                raise RuntimeError("Formato Slack no reconocido")
            yield from rows
            match = re.search(
                r"cursor[^\x60]*\x60([^\x60]+)\x60",
                result.get("pagination_info", ""),
                re.I,
            )
            if not match:
                break
            if match[1] in seen:
                raise RuntimeError("Cursor repetido en Slack")
            seen.add(match[1])
            args["cursor"] = match[1]

    def send(self, ch, body, key, parent=None):
        saved = self.get(key)
        if saved and not saved.startswith("pending:"):
            return saved
        marker = "Montu · " + hashlib.sha256(key.encode()).hexdigest()[:16]
        if saved:
            for ts, uid, _, text in self.history(ch, parent, saved[8:]):
                if uid == self.c["slack_sender"] and marker in text:
                    self.set(key, ts)
                    return ts
            # Unknown delivery cannot be replayed automatically: reconcile first.
            raise RuntimeError("Entrega Slack incierta; revisar " + marker)
        self.set(key, "pending:" + str(int(time.time()) - 120))
        args = dict(channel_id=ch, message=body + "\n" + marker, unfurl_app_links=False)
        if parent:
            args["thread_ts"] = parent
        result = self.call("slack.slack_send_message", **args)
        ts = (
            (
                result.get("message_context", {}).get("message_ts")
                or result.get("message_ts")
                or result.get("ts")
            )
            if isinstance(result, dict)
            else None
        )
        if not ts:
            found = re.search(r"/archives/[A-Z0-9]+/p(\d{10})(\d{6})", str(result))
            if found:
                ts = found[1] + "." + found[2]
        if not ts:
            raise RuntimeError("Slack aceptó sin ID confirmado; pendiente de lectura")
        self.set(key, ts)
        return ts

    def milestone(self, e):
        key = "mail:" + e["hilo"] + ":" + str(e["id"])
        mark = "Montu-" + hashlib.sha256(key.encode()).hexdigest()[:16]
        if self.get(key) == "ok":
            return
        if self.get(key):
            found = self.call(
                "gmail.search_email_ids", query='in:sent "' + mark + '"', max_results=2
            )
            if found.get("message_ids"):
                email = self.call(
                    "gmail.read_email",
                    message_id=found["message_ids"][0],
                    format="metadata",
                    metadata_headers=["Cc"],
                )
                if email.get("thread_id") == self.c["mail_thread"]:
                    self.set(key, "ok")
                    return
            raise RuntimeError("Entrega Gmail incierta; revisar " + mark)
        self.set(key, "pending")
        body = f"{e['titulo']}\n\n{e['agente']} de {e['persona']} compartió este avance en el hilo de Vita.\n\n{e['texto']}\n\nHilo: {PORTAL}{e['enlace']}\nTambién en #montu.\n{mark}"
        if str(e["id"]) == str(self.c.get("launch_event", "")):
            body = self.c["welcome"] + "\n\n" + body
        result = self.call(
            "gmail.send_email",
            to=self.c["to"],
            cc=self.c["cc"],
            subject=self.c["subject"],
            reply_message_id=self.c["mail_parent"],
            payload={"mime_type": "text/plain", "body": {"content": body}},
            response_fields=["id", "thread_id"],
        )
        if (
            not isinstance(result, dict)
            or not result.get("id")
            or result.get("thread_id") != self.c["mail_thread"]
        ):
            raise RuntimeError("Verificar hilo Gmail antes de reenviar")
        self.set(key, "ok")

    def import_replies(self):
        for topic, ch, parent in self.db.execute(
            "SELECT topic,channel,ts FROM roots"
        ).fetchall():
            position = "inbound:" + ch + ":" + parent
            since = self.get(position) or parent
            for ts, uid, name, text in sorted(self.history(ch, parent, since)):
                if ts <= since or ts == parent:
                    continue
                # Account + delivery marker identify our mirrored messages; never treat human words as commands.
                if uid == self.c["slack_sender"] and re.search(
                    r"Montu · [a-f0-9]{16}\b", text
                ):
                    self.set(position, ts)
                    continue
                key = "slack-" + ch + "-" + ts
                link = (
                    self.c["slack_base"]
                    + "/archives/"
                    + ch
                    + "/p"
                    + ts.replace(".", "")
                )
                chunks = [text[i : i + 1450] for i in range(0, len(text), 1450)]
                for index, chunk in enumerate(chunks):
                    part = f" ({index + 1}/{len(chunks)})" if len(chunks) > 1 else ""
                    note = (
                        "Desde Slack, "
                        + name[:100]
                        + part
                        + ":\n"
                        + chunk
                        + "\n"
                        + link
                    )
                    stable_key = key if index == 0 else key + "-" + str(index)
                    event = montu(
                        "publicar",
                        self.c["team"],
                        "--hilo",
                        topic,
                        "--texto",
                        note,
                        "--clave",
                        stable_key,
                    )
                    self.set("origin:" + str(event["id"]), ch)
                self.set(position, ts)

    def export(self):
        while True:
            data = montu(
                "novedades", self.c["team"], "--desde", self.get("position") or "0"
            )["mensajes"]
            if not data:
                break
            for e in data:
                topic = e["hilo"]
                source = self.get("origin:" + str(e["id"]))
                first = self.get("first:" + topic)
                if not first:
                    self.set("first:" + topic, e["id"])
                    first = str(e["id"])
                for ch in [self.c["channel"], self.c["general"]]:
                    if source == ch:
                        continue
                    row = self.db.execute(
                        "SELECT ts FROM roots WHERE topic=? AND channel=?", (topic, ch)
                    ).fetchone()
                    parent = row[0] if row else None
                    body = (
                        f"{e['agente']} de {e['persona']} · {e['tipo']}\n{e['texto']}"
                    )
                    if not parent:
                        body = e["titulo"] + "\n" + e["referencia"] + "\n" + body
                    # Slack markup must not turn agent text into mentions.
                    body = (
                        body.replace("&", "&amp;")
                        .replace("<", "&lt;")
                        .replace(">", "&gt;")
                    )
                    ts = self.send(
                        ch,
                        body + "\n" + PORTAL + e["enlace"],
                        "out:" + ch + ":" + str(e["id"]),
                        parent,
                    )
                    if not parent:
                        self.db.execute(
                            "INSERT OR IGNORE INTO roots VALUES(?,?,?)", (topic, ch, ts)
                        )
                if e["tipo"] in ("decision", "cierre") or str(e["id"]) == first:
                    self.milestone(e)
                self.set("position", e["id"])
            if len(data) < 60:
                break

    def run(self):
        self.import_replies()
        self.export()


if __name__ == "__main__":
    with (ROOT / "relay.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            sys.exit(0)
        bridge = Bridge()
        try:
            Relay(json.loads((ROOT / "relay-config.json").read_text()), bridge).run()
            print(time.strftime("%Y-%m-%d %H:%M:%S"), "ok", flush=True)
        finally:
            bridge.close()
