"""Allows `python -m pdfsuite` as well as the `pdfsuitepy` console script."""

import sys

from .cli import main

if __name__ == "__main__":
    sys.exit(main())
