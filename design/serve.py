"""Sirve design/ en local sin caché, para que el navegador siempre cargue lo último.
Uso: python3 design/serve.py [puerto]   (por defecto 4188)"""
import http.server, os, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()
    def log_message(self, *args):
        pass

os.chdir(os.path.dirname(os.path.abspath(__file__)))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 4188
http.server.ThreadingHTTPServer(("", port), NoCache).serve_forever()
