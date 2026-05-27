import sys
from pathlib import Path

LOCAL_DEPS = Path(__file__).resolve().parent / ".pydeps"
if LOCAL_DEPS.exists():
    sys.path.insert(0, str(LOCAL_DEPS))

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import uvicorn

uvicorn.run("moderation_service.app:app", host="127.0.0.1", port=8001)
