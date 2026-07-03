import json
import shutil
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any


@dataclass
class StreamSession:
    session_id: str
    user_id: str
    source: str
    appointment_id: str | None
    language: str
    status: str = "active"
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    segments: list[dict[str, Any]] = field(default_factory=list)
    full_text_parts: list[str] = field(default_factory=list)
    duration_seconds: float = 0.0
    mime_type: str | None = None


class SessionManager:
    def __init__(self, session_dir: str, max_concurrent: int) -> None:
        self.session_dir = Path(session_dir)
        self.session_dir.mkdir(parents=True, exist_ok=True)
        self.max_concurrent = max_concurrent
        self._sessions: dict[str, StreamSession] = {}
        self._lock = Lock()

    def active_count(self) -> int:
        with self._lock:
            return sum(1 for s in self._sessions.values() if s.status == "active")

    def create(self, user_id: str, source: str, appointment_id: str | None, language: str) -> StreamSession:
        with self._lock:
            if self.active_count() >= self.max_concurrent:
                raise RuntimeError("MAX_CONCURRENT_STREAMS reached")

            session_id = str(uuid.uuid4())
            session = StreamSession(
                session_id=session_id,
                user_id=user_id,
                source=source,
                appointment_id=appointment_id,
                language=language,
            )
            self._sessions[session_id] = session
            path = self._path(session_id)
            path.mkdir(parents=True, exist_ok=True)
            self._write_meta(session)
            return session

    def get(self, session_id: str) -> StreamSession | None:
        with self._lock:
            if session_id in self._sessions:
                return self._sessions[session_id]
        return self._load(session_id)

    def append_audio(self, session_id: str, chunk: bytes) -> Path:
        session = self.get(session_id)
        if not session:
            raise KeyError("session not found")
        if session.status != "active":
            raise RuntimeError("session not active")

        audio_path = self._path(session_id) / "audio.webm"
        with open(audio_path, "ab") as f:
            f.write(chunk)
        return audio_path

    def add_segment(self, session_id: str, segment: dict[str, Any]) -> None:
        session = self.get(session_id)
        if not session:
            raise KeyError("session not found")
        with self._lock:
            session.segments.append(segment)
            if segment.get("is_final") and segment.get("text"):
                session.full_text_parts.append(str(segment["text"]))
            session.duration_seconds = max(
                session.duration_seconds, float(segment.get("end", 0.0))
            )
            self._write_segments(session)

    def complete(self, session_id: str) -> StreamSession:
        session = self.get(session_id)
        if not session:
            raise KeyError("session not found")
        with self._lock:
            session.status = "completed"
            self._write_meta(session)
            return session

    def fail(self, session_id: str, message: str) -> None:
        session = self.get(session_id)
        if not session:
            return
        with self._lock:
            session.status = "failed"
            self._write_meta(session, error=message)

    def delete(self, session_id: str) -> None:
        with self._lock:
            self._sessions.pop(session_id, None)
        path = self._path(session_id)
        if path.exists():
            shutil.rmtree(path, ignore_errors=True)

    def to_artifact(self, session_id: str) -> dict[str, Any]:
        session = self.get(session_id)
        if not session:
            raise KeyError("session not found")
        full_text = " ".join(session.full_text_parts).strip()
        return {
            "status": session.status,
            "full_text": full_text,
            "duration_seconds": session.duration_seconds,
            "segments": session.segments,
        }

    def _path(self, session_id: str) -> Path:
        return self.session_dir / session_id

    def _write_meta(self, session: StreamSession, error: str | None = None) -> None:
        meta = {
            "session_id": session.session_id,
            "user_id": session.user_id,
            "source": session.source,
            "appointment_id": session.appointment_id,
            "language": session.language,
            "status": session.status,
            "created_at": session.created_at,
            "error": error,
        }
        (self._path(session.session_id) / "meta.json").write_text(
            json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def _write_segments(self, session: StreamSession) -> None:
        (self._path(session.session_id) / "segments.json").write_text(
            json.dumps(session.segments, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def _load(self, session_id: str) -> StreamSession | None:
        path = self._path(session_id)
        meta_path = path / "meta.json"
        if not meta_path.exists():
            return None
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        segments_path = path / "segments.json"
        segments = (
            json.loads(segments_path.read_text(encoding="utf-8"))
            if segments_path.exists()
            else []
        )
        session = StreamSession(
            session_id=session_id,
            user_id=meta.get("user_id", ""),
            source=meta.get("source", "recording"),
            appointment_id=meta.get("appointment_id"),
            language=meta.get("language", "pt"),
            status=meta.get("status", "completed"),
            segments=segments,
            full_text_parts=[s.get("text", "") for s in segments if s.get("is_final")],
        )
        with self._lock:
            self._sessions[session_id] = session
        return session
