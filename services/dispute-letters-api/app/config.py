from pathlib import Path
import os
import tempfile

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("DISPUTE_DATA_DIR", tempfile.gettempdir())) / "dispute-letters"
REPORTS_DIR = DATA_DIR / "reports"
LETTERS_DIR = DATA_DIR / "letters"
BUREAU_ADDRESSES_PATH = PROJECT_ROOT / "data" / "bureau-addresses.json"

REPORTS_DIR.mkdir(parents=True, exist_ok=True)
LETTERS_DIR.mkdir(parents=True, exist_ok=True)
