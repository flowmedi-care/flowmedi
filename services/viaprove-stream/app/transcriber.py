import io
import logging
import tempfile
import time
from pathlib import Path
from threading import Lock

logger = logging.getLogger(__name__)


class StreamTranscriber:
    def __init__(self, model_size: str, compute_type: str, language: str) -> None:
        self.model_size = model_size
        self.compute_type = compute_type
        self.language = language
        self._model = None
        self._lock = Lock()

    def _get_model(self):
        if self._model is not None:
            return self._model
        with self._lock:
            if self._model is not None:
                return self._model
            from faster_whisper import WhisperModel

            logger.info(
                "Loading faster-whisper model=%s compute_type=%s",
                self.model_size,
                self.compute_type,
            )
            self._model = WhisperModel(self.model_size, device="cpu", compute_type=self.compute_type)
            return self._model

    def transcribe_webm_chunk(self, audio_path: Path, offset_seconds: float) -> list[dict]:
        if audio_path.stat().st_size < 1000:
            return []

        started = time.time()
        try:
            from pydub import AudioSegment

            audio = AudioSegment.from_file(audio_path)
            if len(audio) < 500:
                return []

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp_path = Path(tmp.name)
            audio.export(tmp_path, format="wav")

            model = self._get_model()
            segments, _info = model.transcribe(
                str(tmp_path),
                language=self.language,
                vad_filter=True,
                beam_size=1,
                best_of=1,
            )

            results: list[dict] = []
            for idx, segment in enumerate(segments):
                text = (segment.text or "").strip()
                if not text:
                    continue
                results.append(
                    {
                        "start": float(segment.start) + offset_seconds,
                        "end": float(segment.end) + offset_seconds,
                        "text": text,
                        "is_final": True,
                        "segment_index": idx,
                    }
                )

            rtf = (time.time() - started) / max(audio.duration_seconds, 0.1)
            logger.info("Transcribed chunk rtf=%.2f segments=%d", rtf, len(results))
            return results
        except Exception:
            logger.exception("Failed to transcribe chunk")
            return []
        finally:
            try:
                if "tmp_path" in locals() and tmp_path.exists():
                    tmp_path.unlink()
            except OSError:
                pass

    def transcribe_accumulated(self, audio_path: Path) -> list[dict]:
        return self.transcribe_webm_chunk(audio_path, offset_seconds=0.0)
