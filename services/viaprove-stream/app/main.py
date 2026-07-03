import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request, WebSocket
from pydantic import BaseModel, Field

from app.auth import issue_ws_token, verify_bearer, verify_ws_token
from app.config import Settings, load_settings
from app.session_manager import SessionManager
from app.transcriber import StreamTranscriber
from app.ws_handler import handle_stream_ws

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("viaprove-stream")

settings: Settings
sessions: SessionManager
transcriber: StreamTranscriber


@asynccontextmanager
async def lifespan(_: FastAPI):
    global settings, sessions, transcriber
    settings = load_settings()
    sessions = SessionManager(settings.session_dir, settings.max_concurrent)
    transcriber = StreamTranscriber(
        settings.model_size, settings.compute_type, settings.language
    )
    logger.info("viaprove-stream started port=%s", settings.port)
    yield


app = FastAPI(title="ViaProve Stream", version="1.0.0", lifespan=lifespan)


class CreateSessionRequest(BaseModel):
    user_id: str
    source: str = "recording"
    appointment_id: str | None = None
    language: str = "pt"
    metadata: dict[str, Any] = Field(default_factory=dict)


@app.get("/v1/stream/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "viaprove-stream"}


@app.post("/v1/stream/sessions")
def create_session(
    body: CreateSessionRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    verify_bearer(authorization, settings)
    try:
        session = sessions.create(
            user_id=body.user_id,
            source=body.source,
            appointment_id=body.appointment_id,
            language=body.language,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    token = issue_ws_token(session.session_id, session.user_id, session.source, settings)
    return {
        "session_id": session.session_id,
        "ws_url": "/v1/stream/ws",
        "ws_token": token,
        "expires_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    }


@app.get("/v1/stream/sessions/{session_id}")
def get_session(
    session_id: str,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    verify_bearer(authorization, settings)
    try:
        return sessions.to_artifact(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc


@app.delete("/v1/stream/sessions/{session_id}")
def delete_session(
    session_id: str,
    authorization: str | None = Header(default=None),
) -> dict[str, bool]:
    verify_bearer(authorization, settings)
    sessions.delete(session_id)
    return {"deleted": True}


@app.post("/v1/stream/sessions/{session_id}/chunks")
async def upload_chunk(
    session_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    verify_bearer(authorization, settings)
    chunk = await request.body()
    if not chunk:
        raise HTTPException(status_code=400, detail="Empty chunk")

    sessions.append_audio(session_id, chunk)
    audio_path = sessions._path(session_id) / "audio.webm"
    emitted: list[dict[str, Any]] = []
    for segment in transcriber.transcribe_webm_chunk(audio_path, offset_seconds=0.0):
        sessions.add_segment(session_id, segment)
        emitted.append(segment)
    return {"segments": emitted}


@app.websocket("/v1/stream/ws")
async def stream_ws(websocket: WebSocket) -> None:
    claims = await verify_ws_token(websocket, settings)
    session_id = str(claims.get("session_id", ""))
    if not session_id:
        await websocket.close(code=4400)
        return
    await handle_stream_ws(websocket, session_id, sessions, transcriber)
