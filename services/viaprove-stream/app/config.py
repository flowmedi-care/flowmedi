import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    api_key: str
    jwt_secret: str
    model_size: str
    compute_type: str
    max_concurrent: int
    session_dir: str
    language: str
    vad_threshold: float
    host: str
    port: int


def load_settings() -> Settings:
    api_key = os.environ.get("TRANSCRIBE_API_KEY", "").strip()
    jwt_secret = os.environ.get("STREAM_JWT_SECRET", "").strip()
    if not api_key:
        raise RuntimeError("TRANSCRIBE_API_KEY is required")
    if not jwt_secret:
        raise RuntimeError("STREAM_JWT_SECRET is required")

    return Settings(
        api_key=api_key,
        jwt_secret=jwt_secret,
        model_size=os.environ.get("STREAM_MODEL_SIZE", "small"),
        compute_type=os.environ.get("STREAM_COMPUTE_TYPE", "int8"),
        max_concurrent=int(os.environ.get("STREAM_MAX_CONCURRENT", "1")),
        session_dir=os.environ.get("STREAM_SESSION_DIR", "/var/lib/viaprove/stream-sessions"),
        language=os.environ.get("STREAM_LANGUAGE", "pt"),
        vad_threshold=float(os.environ.get("STREAM_VAD_THRESHOLD", "0.5")),
        host=os.environ.get("STREAM_HOST", "0.0.0.0"),
        port=int(os.environ.get("STREAM_PORT", "8001")),
    )
