import json
import logging
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

from app.session_manager import SessionManager
from app.transcriber import StreamTranscriber

logger = logging.getLogger(__name__)


async def handle_stream_ws(
    websocket: WebSocket,
    session_id: str,
    sessions: SessionManager,
    transcriber: StreamTranscriber,
) -> None:
    await websocket.accept()
    session = sessions.get(session_id)
    if not session:
        await websocket.send_json({"type": "error", "code": "not_found", "message": "Session not found"})
        await websocket.close()
        return

    chunk_count = 0
    last_transcribed_size = 0
    mime_type = "audio/webm"

    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break

            if "text" in message and message["text"] is not None:
                payload = json.loads(message["text"])
                msg_type = payload.get("type")

                if msg_type == "start":
                    mime_type = payload.get("mime", mime_type)
                    session.mime_type = mime_type
                    await websocket.send_json({"type": "ready", "session_id": session_id})
                    continue

                if msg_type == "end":
                    audio_path = sessions._path(session_id) / "audio.webm"
                    if audio_path.exists():
                        for segment in transcriber.transcribe_accumulated(audio_path):
                            sessions.add_segment(session_id, segment)
                            await websocket.send_json(
                                {"type": "segment_final", **segment}
                            )

                    completed = sessions.complete(session_id)
                    artifact = sessions.to_artifact(session_id)
                    await websocket.send_json(
                        {
                            "type": "session_complete",
                            "full_text": artifact["full_text"],
                            "duration_seconds": artifact["duration_seconds"],
                            "segment_count": len(artifact["segments"]),
                        }
                    )
                    break

            if "bytes" in message and message["bytes"] is not None:
                chunk = message["bytes"]
                if not chunk:
                    continue
                sessions.append_audio(session_id, chunk)
                chunk_count += 1

                audio_path = sessions._path(session_id) / "audio.webm"
                current_size = audio_path.stat().st_size
                if current_size - last_transcribed_size < 8000 and chunk_count % 4 != 0:
                    continue

                last_transcribed_size = current_size
                offset = session.duration_seconds
                for segment in transcriber.transcribe_webm_chunk(audio_path, offset_seconds=offset):
                    sessions.add_segment(session_id, segment)
                    await websocket.send_json({"type": "partial", **segment})
                    await websocket.send_json({"type": "segment_final", **segment})

    except WebSocketDisconnect:
        logger.info("WS disconnected session_id=%s", session_id)
    except Exception as exc:
        logger.exception("WS error session_id=%s", session_id)
        sessions.fail(session_id, str(exc))
        await websocket.send_json(
            {"type": "error", "code": "internal", "message": str(exc)}
        )
    finally:
        try:
            await websocket.close()
        except RuntimeError:
            pass
