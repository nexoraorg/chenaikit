import sys
from pathlib import Path

ml_root = str(Path(__file__).resolve().parent.parent)
if ml_root not in sys.path:
    sys.path.insert(0, ml_root)
