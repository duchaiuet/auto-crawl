from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class DownloadedVideo:
    source_url: str
    local_path: Path
    title: str | None = None
    source_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class Transcript:
    source_video: Path
    text: str
    language: str
    segments: list[dict[str, Any]] = field(default_factory=list)


@dataclass(slots=True)
class TranslationResult:
    text: str
    source_language: str
    target_language: str
    segments: list[dict[str, Any]] = field(default_factory=list)


@dataclass(slots=True)
class SubtitleAsset:
    path: Path
    language: str
    format: str = "srt"


@dataclass(slots=True)
class PreparedVideo:
    video_path: Path
    subtitle_path: Path | None = None
    caption_text: str | None = None


@dataclass(slots=True)
class PublishRequest:
    video_path: Path
    caption: str
    hashtags: list[str] = field(default_factory=list)
    schedule_at: datetime | None = None


@dataclass(slots=True)
class PublishResult:
    success: bool
    remote_id: str | None = None
    post_url: str | None = None
    raw_response: dict[str, Any] = field(default_factory=dict)
    published_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
