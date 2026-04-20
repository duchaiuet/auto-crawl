from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _env_bool(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(slots=True)
class PipelineConfig:
    workspace_dir: Path
    output_dir: Path
    temp_dir: Path
    downloads_dir: Path
    translated_dir: Path
    subtitles_dir: Path
    reports_dir: Path
    transcript_lang: str
    target_lang: str
    transcriber_mode: str
    translator_mode: str
    yt_dlp_binary: str
    whisper_binary: str
    whisper_model: str
    ffmpeg_binary: str
    libretranslate_url: str | None
    libretranslate_api_key: str | None
    tiktok_session_id: str | None
    tiktok_publish_endpoint: str
    dry_run: bool
    keep_intermediate: bool
    burn_subtitles: bool

    @classmethod
    def from_env(
        cls,
        workspace_dir: Path | None = None,
        output_dir: Path | None = None,
        dry_run: bool | None = None,
    ) -> "PipelineConfig":
        root = workspace_dir or Path.cwd()
        destination = output_dir or (root / "output")
        temp_dir = destination / "tmp"
        downloads = destination / "downloads"
        translated = destination / "translated"
        subtitles = destination / "subtitles"
        reports = destination / "reports"

        env_dry_run = _env_bool("DRY_RUN", True)

        return cls(
            workspace_dir=root,
            output_dir=destination,
            temp_dir=temp_dir,
            downloads_dir=downloads,
            translated_dir=translated,
            subtitles_dir=subtitles,
            reports_dir=reports,
            transcript_lang=os.getenv("TRANSCRIPT_LANG", "auto"),
            target_lang=os.getenv("TARGET_LANG", "vi"),
            transcriber_mode=os.getenv("TRANSCRIBER_MODE", "whisper"),
            translator_mode=os.getenv("TRANSLATOR_MODE", "mock"),
            yt_dlp_binary=os.getenv("YT_DLP_BINARY", "yt-dlp"),
            whisper_binary=os.getenv("WHISPER_BINARY", "whisper"),
            whisper_model=os.getenv("WHISPER_MODEL", "small"),
            ffmpeg_binary=os.getenv("FFMPEG_BINARY", "ffmpeg"),
            libretranslate_url=os.getenv("LIBRETRANSLATE_URL"),
            libretranslate_api_key=os.getenv("LIBRETRANSLATE_API_KEY"),
            tiktok_session_id=os.getenv("TIKTOK_SESSION_ID"),
            tiktok_publish_endpoint=os.getenv(
                "TIKTOK_PUBLISH_ENDPOINT",
                "https://open.tiktokapis.com/v2/post/publish/video/init/",
            ),
            dry_run=env_dry_run if dry_run is None else dry_run,
            keep_intermediate=_env_bool("KEEP_INTERMEDIATE", False),
            burn_subtitles=_env_bool("BURN_SUBTITLES", True),
        )

    def ensure_directories(self) -> None:
        for path in (
            self.output_dir,
            self.temp_dir,
            self.downloads_dir,
            self.translated_dir,
            self.subtitles_dir,
            self.reports_dir,
        ):
            path.mkdir(parents=True, exist_ok=True)
