"""Open Mati's organizer dashboard or read aggregate counters from this Mac."""
import argparse
import json
import subprocess
import webbrowser
from pathlib import Path
from urllib.request import Request, urlopen

BASE = 'https://duelos-platanus-26.vercel.app'
KEY_FILE = Path.home() / '.local/state/platanus-market-26/organizador.key'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('open', 'stats'), nargs='?', default='open')
    args = parser.parse_args()
    key = KEY_FILE.read_text().strip()
    if args.command == 'open':
        subprocess.run(['pbcopy'], input=key, text=True, check=True)
        webbrowser.open(BASE + '/organizador')
        print('Panel abierto. Pega la clave en el campo Organizador.')
    else:
        req = Request(BASE + '/api/owner', headers={'Authorization': 'Bearer ' + key, 'Accept': 'application/json'})
        with urlopen(req, timeout=20) as response:
            print(json.dumps(json.load(response)['stats'], indent=2))

if __name__ == '__main__':
    main()
