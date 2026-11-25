"""Transport for the signed-in Slack and Gmail connectors; never starts a model turn."""

import json
import os
import queue
import signal
import subprocess
import threading
import time
from pathlib import Path

ROOT = Path.home() / ".local/share/montu-hilos"
CODEX = "/opt/homebrew/bin/codex"


class Bridge:
    def __init__(self):
        args = [CODEX, "app-server"]
        self.p = subprocess.Popen(
            args,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            start_new_session=True,
            cwd=ROOT,
        )
        self.q = queue.Queue()
        self.seq = 0

        def reader():
            for line in self.p.stdout:
                try:
                    self.q.put(json.loads(line))
                except ValueError:
                    pass
            self.q.put(None)

        threading.Thread(target=reader, daemon=True).start()
        try:
            self.req(
                "initialize",
                {
                    "clientInfo": {"name": "montu_personal", "version": "1.0"},
                    "capabilities": {"experimentalApi": True},
                },
            )
            self.send({"method": "initialized"})
            thread = self.req(
                "thread/start",
                {
                    "cwd": str(ROOT),
                    "ephemeral": True,
                    "approvalPolicy": "never",
                    "sandbox": "read-only",
                },
            )
            self.thread = thread["thread"]["id"]
        except BaseException:
            self.close()
            raise

    def send(self, d):
        self.p.stdin.write(json.dumps(d) + "\n")
        self.p.stdin.flush()

    def req(self, method, params, seconds=100):
        self.seq += 1
        self.send(dict(id=self.seq, method=method, params=params))
        deadline = time.monotonic() + seconds
        while True:
            row = self.q.get(timeout=max(0.01, deadline - time.monotonic()))
            if row is None:
                raise RuntimeError("Codex cerró la conexión")
            if row.get("method") and "id" in row:
                self.send(
                    {
                        "id": row["id"],
                        "error": {
                            "code": -32601,
                            "message": "Unattended read-only client",
                        },
                    }
                )
                continue
            if row.get("id") != self.seq:
                continue
            if "error" in row:
                raise RuntimeError(str(row["error"].get("code")))
            return row["result"]

    def call(self, server, tool, args):
        r = self.req(
            "mcpServer/tool/call",
            {
                "threadId": self.thread,
                "server": server,
                "tool": tool,
                "arguments": args,
            },
        )
        if r.get("isError"):
            raise RuntimeError("Consulta MCP rechazada")
        return r.get("structuredContent") or [
            x["text"] for x in r.get("content", []) if x.get("type") == "text"
        ]

    def close(self):
        if self.p.poll() is None:
            try:
                self.p.stdin.close()
                self.p.wait(timeout=3)
            except subprocess.TimeoutExpired:
                os.killpg(self.p.pid, signal.SIGTERM)
