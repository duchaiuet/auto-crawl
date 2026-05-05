from __future__ import annotations

import json
import subprocess
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from douyin_tiktok_pipeline.core.errors import ProcessError
from douyin_tiktok_pipeline.core.models import Transcript


class Transcriber(ABC):
    """Interface for speech-to-text backends."""

    @abstractmethod
    def transcribe(
        self,
        video_path: Path,
        request_id: str,
        language: str = "auto",
    ) -> Transcript:
        raise NotImplementedError


class MockTranscriber(Transcriber):
    """Deterministic transcriber for local smoke tests."""

    def transcribe(
        self,
        video_path: Path,
        request_id: str,
        language: str = "auto",
    ) -> Transcript:
        text = (
            f"Transcript mock for {video_path.name} "
            f"(request={request_id}, lang={language})."
        )
        return Transcript(
            source_video=video_path,
            text=text,
            language=("vi" if language == "auto" else language),
            segments=[{"start": 0.0, "end": 3.0, "text": text}],
        )


class WhisperTranscriber(Transcriber):
    """Generate transcript with whisper CLI."""

    def __init__(
        self,
        output_dir: Path,
        model: str = "small",
        whisper_binary: str = "whisper",
    ) -> None:
        self.output_dir = output_dir
        self.model = model
        self.whisper_binary = whisper_binary

    def transcribe(
        self,
        video_path: Path,
        request_id: str,
        language: str = "auto",
    ) -> Transcript:
        target_dir = self.output_dir / request_id
        target_dir.mkdir(parents=True, exist_ok=True)
        json_path = target_dir / "transcript.json"

        cmd = [
            self.whisper_binary,
            str(video_path),
            "--model",
            self.model,
            "--output_format",
            "json",
            "--output_dir",
            str(target_dir),
            "--fp16",
            "False",
        ]
        if language != "auto":
            cmd.extend(["--language", language])

        self._run(cmd, "Unable to transcribe video with Whisper")
        raw_payload = self._load_whisper_json(video_path, target_dir)
        json_path.write_text(json.dumps(raw_payload, ensure_ascii=False, indent=2))

        text = (raw_payload.get("text") or "").strip()
        segments: list[dict[str, Any]] = raw_payload.get("segments") or []
        detected_language = raw_payload.get("language") or language

        if not text:
            raise ProcessError("Whisper returned an empty transcript")

        return Transcript(
            source_video=video_path,
            text=text,
            language=detected_language,
            segments=segments,
        )

    @staticmethod
    def _load_whisper_json(video_path: Path, target_dir: Path) -> dict[str, Any]:
        stem_path = target_dir / f"{video_path.stem}.json"
        if not stem_path.exists():
            available = ", ".join(path.name for path in target_dir.glob("*.json"))
            raise ProcessError(
                "Whisper transcript JSON not found. "
                f"Expected {stem_path.name}. Available: [{available}]"
            )
        try:
            return json.loads(stem_path.read_text())
        except json.JSONDecodeError as exc:
            raise ProcessError("Whisper output JSON is invalid") from exc

    @staticmethod
    def _run(cmd: list[str], err: str) -> None:
        try:
            subprocess.run(
                cmd,
                check=True,
                capture_output=True,
                text=True,
            )
        except FileNotFoundError as exc:
            raise ProcessError(
                "whisper CLI was not found. Install openai-whisper first."
            ) from exc
        except subprocess.CalledProcessError as exc:
            message = exc.stderr.strip() or exc.stdout.strip() or str(exc)
            raise ProcessError(f"{err}: {message}") from exc


def build_transcriber(
    mode: str,
    output_dir: Path,
    whisper_model: str = "small",
    whisper_binary: str = "whisper",
) -> Transcriber:
    normalized = mode.strip().lower()
    if normalized == "mock":
        return MockTranscriber()
    if normalized == "whisper":
        return WhisperTranscriber(
            output_dir=output_dir,
            model=whisper_model,
            whisper_binary=whisper_binary,
        )
    raise ProcessError(
        f"Unsupported transcriber mode '{mode}'. Use 'mock' or 'whisper'."
    )
