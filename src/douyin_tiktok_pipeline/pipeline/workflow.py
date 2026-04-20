from __future__ import annotations

import json
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

from douyin_tiktok_pipeline.core.config import PipelineConfig
from douyin_tiktok_pipeline.core.ids import make_request_id
from douyin_tiktok_pipeline.core.models import (
    DownloadedVideo,
    PreparedVideo,
    PublishRequest,
    PublishResult,
    SubtitleAsset,
    Transcript,
    TranslationResult,
)
from douyin_tiktok_pipeline.crawler.douyin import DouyinCrawler
from douyin_tiktok_pipeline.processor.subtitle_renderer import SubtitleRenderer
from douyin_tiktok_pipeline.processor.transcriber import Transcriber, build_transcriber
from douyin_tiktok_pipeline.processor.translator import Translator, build_translator
from douyin_tiktok_pipeline.processor.video_processor import VideoProcessor
from douyin_tiktok_pipeline.publisher.tiktok import TikTokPublisher


class PipelineOrchestrator:
    """End-to-end orchestration for the Douyin -> TikTok flow."""

    def __init__(
        self,
        config: PipelineConfig,
        crawler: DouyinCrawler | None = None,
        transcriber: Transcriber | None = None,
        translator: Translator | None = None,
        subtitle_renderer: SubtitleRenderer | None = None,
        video_processor: VideoProcessor | None = None,
        publisher: TikTokPublisher | None = None,
    ) -> None:
        self.config = config
        self.config.ensure_directories()

        self.crawler = crawler or DouyinCrawler(
            output_dir=config.downloads_dir,
            yt_dlp_binary=config.yt_dlp_binary,
        )
        self.transcriber = transcriber or build_transcriber(
            mode=config.transcriber_mode,
            output_dir=config.temp_dir / "transcripts",
            whisper_model=config.whisper_model,
            whisper_binary=config.whisper_binary,
        )
        self.translator = translator or build_translator(
            mode=config.translator_mode,
            libretranslate_url=config.libretranslate_url,
            libretranslate_api_key=config.libretranslate_api_key,
        )
        self.subtitle_renderer = subtitle_renderer or SubtitleRenderer(config.subtitles_dir)
        self.video_processor = video_processor or VideoProcessor(
            ffmpeg_binary=config.ffmpeg_binary
        )
        self.publisher = publisher or TikTokPublisher(
            session_id=config.tiktok_session_id,
            endpoint=config.tiktok_publish_endpoint,
            dry_run=config.dry_run,
        )

    def run(self, source_url: str, caption_template: str, hashtags: list[str] | None = None) -> dict:
        request_id = make_request_id(prefix="job")
        hashtags = hashtags or []

        downloaded = self.crawler.fetch(source_url, request_id=request_id)
        transcript = self.transcriber.transcribe(
            downloaded.local_path,
            request_id=request_id,
            language=self.config.transcript_lang,
        )
        translation = self.translator.translate(
            transcript=transcript,
            target_language=self.config.target_lang,
        )

        subtitle_asset = self.subtitle_renderer.render_srt(
            request_id=request_id,
            translated=translation,
        )
        final_caption = self._build_caption(caption_template, downloaded, transcript, translation)
        prepared = self._prepare_video(
            request_id=request_id,
            downloaded=downloaded,
            subtitle_asset=subtitle_asset,
            final_caption=final_caption,
        )

        publish_request = PublishRequest(
            video_path=prepared.video_path,
            caption=final_caption,
            hashtags=hashtags,
        )
        published = self.publisher.publish(publish_request)

        report = self._build_report(
            request_id=request_id,
            downloaded=downloaded,
            transcript=transcript,
            translation=translation,
            subtitle_asset=subtitle_asset,
            prepared=prepared,
            published=published,
            caption_template=caption_template,
            final_caption=final_caption,
            hashtags=hashtags,
        )
        self._save_report(request_id, report)
        return report

    def _prepare_video(
        self,
        request_id: str,
        downloaded: DownloadedVideo,
        subtitle_asset: SubtitleAsset,
        final_caption: str,
    ) -> PreparedVideo:
        output_video_path = self.config.translated_dir / f"{request_id}.mp4"

        if self.config.burn_subtitles:
            return self.video_processor.burn_subtitle(
                source_video=downloaded.local_path,
                subtitle_path=subtitle_asset.path,
                destination=output_video_path,
                caption_text=final_caption,
            )
        return self.video_processor.copy_video(
            source_video=downloaded.local_path,
            destination=output_video_path,
            caption_text=final_caption,
        )

    @staticmethod
    def _build_caption(
        caption_template: str,
        downloaded: DownloadedVideo,
        transcript: Transcript,
        translation: TranslationResult,
    ) -> str:
        return caption_template.format(
            source_title=downloaded.title or "",
            source_url=downloaded.source_url,
            source_id=downloaded.source_id or "",
            transcript_text=transcript.text,
            translated_text=translation.text,
            source_language=translation.source_language,
            target_language=translation.target_language,
        ).strip()

    def _build_report(
        self,
        *,
        request_id: str,
        downloaded: DownloadedVideo,
        transcript: Transcript,
        translation: TranslationResult,
        subtitle_asset: SubtitleAsset,
        prepared: PreparedVideo,
        published: PublishResult,
        caption_template: str,
        final_caption: str,
        hashtags: list[str],
    ) -> dict:
        return {
            "request_id": request_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "input": {
                "source_url": downloaded.source_url,
                "caption_template": caption_template,
                "hashtags": hashtags,
            },
            "downloaded_video": self._convert(downloaded),
            "transcript": self._convert(transcript),
            "translation": self._convert(translation),
            "subtitle": self._convert(subtitle_asset),
            "prepared_video": self._convert(prepared),
            "final_caption": final_caption,
            "publish_result": self._convert(published),
            "config": {
                "target_lang": self.config.target_lang,
                "transcript_lang": self.config.transcript_lang,
                "transcriber_mode": self.config.transcriber_mode,
                "translator_mode": self.config.translator_mode,
                "dry_run": self.config.dry_run,
                "burn_subtitles": self.config.burn_subtitles,
            },
        }

    def _save_report(self, request_id: str, report: dict) -> None:
        report_path = self.config.reports_dir / f"{request_id}.json"
        report_path.write_text(
            json.dumps(report, indent=2, ensure_ascii=False, default=str),
            encoding="utf-8",
        )

    @staticmethod
    def _convert(value: object) -> object:
        if hasattr(value, "__dataclass_fields__"):
            normalized = asdict(value)
            return {
                key: str(item) if isinstance(item, Path) else item
                for key, item in normalized.items()
            }
        return value


# Backward-compatible aliases.
DouyinToTikTokWorkflow = PipelineOrchestrator
PipelineWorkflow = PipelineOrchestrator
