"""
serve.py - the demo server, with caching turned off.

`python -m http.server` sends no cache directives, so a browser is free to keep
serving ES modules it fetched ten minutes and three edits ago. That produces the
worst class of bug in a no-build project: the code on disk is correct, the tests
pass, and the reviewer is looking at something else entirely while being told
they are wrong.

The real site solves this with `must-revalidate` in netlify.toml. This is the
same idea, blunter, because a demo server has no bandwidth to protect:

    Cache-Control: no-store   ->  do not keep a copy at all

Usage:
    python serve.py [port]        # default 8080
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class NoCacheHandler(SimpleHTTPRequestHandler):
    """Identical to the stdlib handler, minus the stale-file footgun."""

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    # The stdlib guesses text/plain for .mjs, and a module served as text/plain
    # is refused outright by the browser. Cheaper to be explicit than to debug.
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
    }


if __name__ == "__main__":
    handler = partial(NoCacheHandler, directory=".")
    print(f"Drip Golf demo -> http://127.0.0.1:{PORT}  (caching disabled)")
    try:
        # THREADING, not plain HTTPServer -- which is exactly what the stdlib's
        # own `python -m http.server` uses, and for a good reason. A browser
        # holds keep-alive connections open; a single-threaded server sits
        # blocked on one of them and every later request hangs until it times
        # out. The page just spins, which looks like the app is broken.
        ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()
    except KeyboardInterrupt:
        print("\nbye")
