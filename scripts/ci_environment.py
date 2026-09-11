#!/usr/bin/env python3
"""Public entry point; implementation and validation live under tests/."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tests.support.ci_environment import main

if __name__ == '__main__':
    sys.exit(main())
