from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import requests

from douyin_tiktok_pipeline.core.errors import ConfigurationError, PublishError
from douyin_tiktok_pipeline.core.models import PublishRequest, PublishResult


class TikTokPublisher:
    """Upload video to TikTok through a configurable API endpoint."""

    def __init__(
        self,
        session_id: str | None,
        endpoint: str = "https://open.tiktokapis.com/v2/post/publish/video/init/",
        dry_run: bool = True,
    ) -> None:
        self.session_id = session_id
        self.endpoint = endpoint
        self.dry_run = dry_run

    def publish(self, request: PublishRequest) -> PublishResult:
        if self.dry_run:
            fake_id = f"dry-run-{request.video_path.stem}"
            return PublishResult(
                success=True,
                remote_id=fake_id,
                post_url=f"https://www.tiktok.com/@draft/video/{fake_id}",
                raw_response={"mode": "dry-run"},
            )

        if not self.session_id:
            raise ConfigurationError(
                "TIKTOK_SESSION_ID is required when running in non dry-run mode."
            )
        if not request.video_path.exists():
            raise PublishError(f"Video not found for upload: {request.video_path}")

        # Placeholder implementation: for production use TikTok Content Posting API
        # with OAuth access_token and chunked upload flow.
        with request.video_path.open("rb") as f:
            files = {"video": (request.video_path.name, f, "video/mp4")}
            data = {
                "caption": request.caption,
                "hashtags": json.dumps(request.hashtags, ensure_ascii=False),
            }
            if request.schedule_at:
                data["schedule_at"] = request.schedule_at.isoformat()

            headers = {"Cookie": f"sessionid={self.session_id}"}
            try:
                response = requests.post(
                    self.endpoint,
                    files=files,
                    data=data,
                    headers=headers,
                    timeout=60,
                )
            except requests.RequestException as exc:
                raise PublishError(f"TikTok publish request failed: {exc}") from exc

        if response.status_code >= 400:
            raise PublishError(
                f"TikTok publish failed [{response.status_code}]: {response.text}"
            )

        payload: dict[str, Any]
        try:
            payload = response.json()
        except ValueError:
            payload = {"raw_text": response.text}

        remote_id = str(payload.get("publish_id") or payload.get("video_id") or "")
        post_url = payload.get("share_url")
        if post_url is None and remote_id:
            post_url = f"https://www.tiktok.com/@unknown/video/{remote_id}"

        return PublishResult(
            success=True,
            remote_id=remote_id or None,
            post_url=post_url,
            raw_response=payload,
            published_at=datetime.now(timezone.utc),
        )
