from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

from douyin_tiktok_pipeline.core.errors import CrawlError
from douyin_tiktok_pipeline.core.models import DownloadedVideo


class DouyinCrawler:
    """Download video and metadata from Douyin using yt-dlp."""

    def __init__(self, output_dir: Path, yt_dlp_binary: str = "yt-dlp") -> None:
        self.output_dir = output_dir
        self.yt_dlp_binary = yt_dlp_binary

    def fetch(self, url: str, request_id: str) -> DownloadedVideo:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        asset_dir = self.output_dir / request_id
        asset_dir.mkdir(parents=True, exist_ok=True)

        video_path = asset_dir / "source.mp4"
        metadata_path = asset_dir / "metadata.json"

        self._download_video(url, video_path)
        metadata = self._extract_info(url, asset_dir)
        metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2))

        return DownloadedVideo(
            source_url=url,
            local_path=video_path,
            title=self._clean_text(metadata.get("title")),
            source_id=self._clean_text(metadata.get("id")) or None,
            metadata={
                "metadata_path": str(metadata_path),
                "description": self._clean_text(metadata.get("description")),
                "author": self._clean_text(metadata.get("uploader")),
                **metadata,
            },
        )

    def _download_video(self, url: str, output_path: Path) -> None:
        cmd = [
            self.yt_dlp_binary,
            "--no-warnings",
            "-f",
            "mp4/best",
            "-o",
            str(output_path),
            url,
        ]
        self._run(cmd, "Unable to download video from Douyin")

    def _extract_info(self, url: str, temp_dir: Path) -> dict[str, Any]:
        info_path = temp_dir / "yt_dlp_info.json"
        cmd = [
            self.yt_dlp_binary,
            "--dump-single-json",
            "--skip-download",
            "--no-warnings",
            url,
        ]
        result = self._run(cmd, "Unable to fetch metadata from Douyin")
        info_path.write_text(result)
        try:
            return json.loads(result)
        except json.JSONDecodeError as exc:
            raise CrawlError("Invalid metadata returned by yt-dlp") from exc

    @staticmethod
    def _clean_text(value: str | None) -> str:
        return (value or "").strip()

    @staticmethod
    def _run(cmd: list[str], err: str) -> str:
        try:
            completed = subprocess.run(
                cmd,
                check=True,
                capture_output=True,
                text=True,
            )
            return completed.stdout
        except FileNotFoundError as exc:
            raise CrawlError(
                "yt-dlp was not found. Please install it before running this pipeline."
            ) from exc
        except subprocess.CalledProcessError as exc:
            message = exc.stderr.strip() or exc.stdout.strip() or str(exc)
            raise CrawlError(f"{err}: {message}") from exc
