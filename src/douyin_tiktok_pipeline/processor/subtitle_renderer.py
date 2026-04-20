from __future__ import annotations

import math
import subprocess
from pathlib import Path
from typing import Iterable

from douyin_tiktok_pipeline.core.errors import ProcessError
from douyin_tiktok_pipeline.core.models import PreparedVideo, SubtitleAsset, TranslationResult


def _to_srt_time(seconds: float) -> str:
    millis = max(0, int(math.floor(seconds * 1000)))
    hours, remainder = divmod(millis, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, ms = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}"


class SubtitleRenderer:
    """Create subtitle files and optionally burn them into the video."""

    def __init__(self, subtitle_dir: Path, ffmpeg_binary: str = "ffmpeg") -> None:
        self.subtitle_dir = subtitle_dir
        self.ffmpeg_binary = ffmpeg_binary

    def render_srt(self, request_id: str, translated: TranslationResult) -> SubtitleAsset:
        self.subtitle_dir.mkdir(parents=True, exist_ok=True)
        output_path = self.subtitle_dir / f"{request_id}.srt"
        lines = self._build_srt_lines(translated.segments or [{"text": translated.text}])
        output_path.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")
        return SubtitleAsset(path=output_path, language=translated.target_language, format="srt")

    def render(
        self,
        translation: TranslationResult,
        request_id: str,
        fallback_text: str | None = None,
    ) -> SubtitleAsset:
        if translation.segments:
            payload = translation
        else:
            payload = TranslationResult(
                text=translation.text or (fallback_text or ""),
                source_language=translation.source_language,
                target_language=translation.target_language,
                segments=[{"start": 0.0, "end": 3.0, "text": translation.text or fallback_text or ""}],
            )
        return self.render_srt(request_id=request_id, translated=payload)

    def burn_subtitles(
        self,
        source_video: Path,
        subtitles: SubtitleAsset,
        output_video: Path,
    ) -> PreparedVideo:
        output_video.parent.mkdir(parents=True, exist_ok=True)
        cmd = [
            self.ffmpeg_binary,
            "-y",
            "-i",
            str(source_video),
            "-vf",
            f"subtitles={subtitles.path}",
            "-c:a",
            "copy",
            str(output_video),
        ]
        self._run(cmd, "Unable to burn subtitles into video")
        return PreparedVideo(video_path=output_video, subtitle_path=subtitles.path)

    @staticmethod
    def _build_srt_lines(segments: Iterable[dict]) -> list[str]:
        entries: list[str] = []
        for idx, segment in enumerate(segments, start=1):
            text = str(segment.get("text", "")).strip()
            if not text:
                continue
            start = float(segment.get("start", idx * 2 - 2))
            end = float(segment.get("end", start + 2))
            entries.extend(
                [
                    str(idx),
                    f"{_to_srt_time(start)} --> {_to_srt_time(end)}",
                    text,
                    "",
                ]
            )
        if not entries:
            entries.extend(
                [
                    "1",
                    "00:00:00,000 --> 00:00:03,000",
                    "[No transcript available]",
                    "",
                ]
            )
        return entries

    @staticmethod
    def _run(cmd: list[str], err: str) -> None:
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True)
        except FileNotFoundError as exc:
            raise ProcessError(
                "ffmpeg was not found. Please install ffmpeg before rendering videos."
            ) from exc
        except subprocess.CalledProcessError as exc:
            message = exc.stderr.strip() or exc.stdout.strip() or str(exc)
            raise ProcessError(f"{err}: {message}") from exc
