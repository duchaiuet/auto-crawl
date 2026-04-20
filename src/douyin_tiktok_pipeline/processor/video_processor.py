from __future__ import annotations

import subprocess
from pathlib import Path

from douyin_tiktok_pipeline.core.errors import ProcessError
from douyin_tiktok_pipeline.core.models import PreparedVideo


class VideoProcessor:
    """Burn subtitles into a video with ffmpeg."""

    def __init__(self, ffmpeg_binary: str = "ffmpeg") -> None:
        self.ffmpeg_binary = ffmpeg_binary

    def burn_subtitle(
        self,
        source_video: Path,
        subtitle_path: Path,
        destination: Path,
        caption_text: str,
    ) -> PreparedVideo:
        destination.parent.mkdir(parents=True, exist_ok=True)
        cmd = [
            self.ffmpeg_binary,
            "-y",
            "-i",
            str(source_video),
            "-vf",
            f"subtitles={subtitle_path.as_posix()}",
            "-c:a",
            "copy",
            str(destination),
        ]
        self._run(cmd)
        return PreparedVideo(
            video_path=destination,
            subtitle_path=subtitle_path,
            caption_text=caption_text,
        )

    def copy_video(self, source_video: Path, destination: Path, caption_text: str) -> PreparedVideo:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(source_video.read_bytes())
        return PreparedVideo(video_path=destination, caption_text=caption_text)

    def _run(self, cmd: list[str]) -> None:
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True)
        except FileNotFoundError as exc:
            raise ProcessError(
                "ffmpeg was not found. Please install ffmpeg to burn subtitles into videos."
            ) from exc
        except subprocess.CalledProcessError as exc:
            details = exc.stderr.strip() or exc.stdout.strip() or str(exc)
            raise ProcessError(f"Unable to render translated video with subtitles: {details}") from exc


# Backward-compatible alias for previous class name.
VideoSubtitleBurner = VideoProcessor
