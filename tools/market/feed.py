"""Public live feed of the 26-cl market over the site's own cable socket (stdlib only)."""
import base64
import json
import os
import socket
import ssl
import struct
import threading
import time

HOST = "hack.platan.us"
EVENT = "26-cl"
AGENT = "PlatanusMarketMonitor/1.0"


class Socket:
    def __init__(self, timeout=20):
        raw = socket.create_connection((HOST, 443), timeout=timeout)
        self.sock = ssl.create_default_context().wrap_socket(raw, server_hostname=HOST)
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall((
            f"GET /cable HTTP/1.1\r\nHost: {HOST}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n"
            f"Sec-WebSocket-Protocol: actioncable-v1-json\r\nOrigin: https://{HOST}\r\n"
            f"User-Agent: {AGENT}\r\n\r\n").encode())
        self.buffer = b""
        head = b""
        while b"\r\n\r\n" not in head:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise ConnectionError("handshake closed")
            head += chunk
        head, self.buffer = head.split(b"\r\n\r\n", 1)
        if b" 101 " not in head.split(b"\r\n", 1)[0]:
            raise ConnectionError("handshake refused")

    def take(self, size):
        while len(self.buffer) < size:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise ConnectionError("socket closed")
            self.buffer += chunk
        data, self.buffer = self.buffer[:size], self.buffer[size:]
        return data

    def send(self, payload, opcode=1):
        data = payload if isinstance(payload, bytes) else payload.encode()
        mask = os.urandom(4)
        size = len(data)
        head = bytes([0x80 | opcode])
        if size < 126:
            head += bytes([0x80 | size])
        elif size < 65536:
            head += bytes([0x80 | 126]) + struct.pack(">H", size)
        else:
            head += bytes([0x80 | 127]) + struct.pack(">Q", size)
        self.sock.sendall(head + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def read(self):
        message = b""
        while True:
            first, second = self.take(2)
            opcode, size = first & 0x0F, second & 0x7F
            if size == 126:
                size = struct.unpack(">H", self.take(2))[0]
            elif size == 127:
                size = struct.unpack(">Q", self.take(8))[0]
            data = self.take(size)
            if opcode == 8:
                raise ConnectionError("server closed the socket")
            if opcode == 9:
                self.send(data, 10)
                continue
            if opcode == 10:
                continue
            message += data
            if first & 0x80:
                return message.decode()

    def close(self):
        try:
            self.sock.close()
        except OSError:
            pass


class Feed(threading.Thread):
    """Calls `on_message(dict)` for every market broadcast; `alive()` tells if the socket is healthy."""

    def __init__(self, on_message):
        super().__init__(daemon=True)
        self.on_message = on_message
        self.last = 0.0
        self.connected = False

    def alive(self, within=12):
        return self.connected and time.time() - self.last < within

    def run(self):
        identifier = json.dumps({"channel": "MarketChannel", "event": EVENT})
        delay = 1
        while True:
            link = None
            try:
                link = Socket()
                while True:
                    frame = json.loads(link.read())
                    self.last = time.time()
                    kind = frame.get("type")
                    if kind == "welcome":
                        link.send(json.dumps({"command": "subscribe", "identifier": identifier}))
                    elif kind == "confirm_subscription":
                        self.connected = True
                        delay = 1
                    elif kind == "reject_subscription":
                        raise ConnectionError("subscription rejected")
                    elif kind is None and "message" in frame:
                        self.on_message(frame["message"])
            except Exception as exc:
                self.connected = False
                print("Feed reconnect:", type(exc).__name__, exc, flush=True)
            finally:
                if link:
                    link.close()
            time.sleep(delay)
            delay = min(30, delay * 2)


if __name__ == "__main__":
    def show(message):
        text = json.dumps(message)
        print(round(time.time(), 3), len(text), text[:1200], flush=True)

    feed = Feed(show)
    feed.start()
    while True:
        time.sleep(1)
