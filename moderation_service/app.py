import os
import sys
from pathlib import Path

LOCAL_DEPS = Path(__file__).resolve().parent / ".pydeps"
if LOCAL_DEPS.exists():
    sys.path.insert(0, str(LOCAL_DEPS))

from fastapi import FastAPI, HTTPException
from huggingface_hub import InferenceClient
from pydantic import BaseModel


def load_env_file(path):
    env_path = Path(path)
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        if not line or line.lstrip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


load_env_file(".env.dev")

MODEL = os.getenv("MODERATION_HF_MODEL", "unitary/toxic-bert")
HF_TOKEN = os.getenv("HF_TOKEN")
BLOCK_THRESHOLD = 0.7
STRICT_THRESHOLD = 0.5
BLOCK_REASON = "Please rephrase this before posting."
UNSAFE_LABELS = {"toxic", "severe_toxic", "obscene", "threat", "insult", "identity_hate"}
STRICT_LABELS = {"threat", "identity_hate"}

app = FastAPI(title="Stubby Moderation Service")


class ModerationRequest(BaseModel):
    text: str = ""


def normalize_label(label):
    return str(label or "").strip().lower().replace(" ", "_")


def serialize_result(item):
    if isinstance(item, dict):
        return {
            "label": normalize_label(item.get("label")),
            "score": float(item.get("score") or 0),
        }

    return {
        "label": normalize_label(getattr(item, "label", "")),
        "score": float(getattr(item, "score", 0) or 0),
    }


def should_block(labels):
    for item in labels:
        label = item["label"]
        score = item["score"]
        if label in STRICT_LABELS and score >= STRICT_THRESHOLD:
            return True
        if label in UNSAFE_LABELS and score >= BLOCK_THRESHOLD:
            return True
    return False


def moderate_text(text):
    clean_text = str(text or "").strip()
    if not clean_text:
        return {"action": "allow", "labels": [], "max_score": 0}

    client = InferenceClient(token=HF_TOKEN or None, timeout=5)
    try:
        raw_result = client.text_classification(clean_text, model=MODEL)
    except Exception as error:
        raise HTTPException(status_code=503, detail="Content moderation is unavailable") from error
    labels = [serialize_result(item) for item in raw_result]
    max_score = max((item["score"] for item in labels), default=0)

    if should_block(labels):
        return {
            "action": "block",
            "reason": BLOCK_REASON,
            "labels": labels,
            "max_score": max_score,
        }

    return {"action": "allow", "labels": labels, "max_score": max_score}


@app.post("/moderate")
def moderate(payload: ModerationRequest):
    return moderate_text(payload.text)
