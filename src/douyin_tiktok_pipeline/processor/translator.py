from __future__ import annotations

import json
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

import requests

from douyin_tiktok_pipeline.core.errors import ConfigurationError, ProcessError
from douyin_tiktok_pipeline.core.models import Transcript, TranslationResult


class Translator(ABC):
    @abstractmethod
    def translate(self, transcript: Transcript, target_language: str) -> TranslationResult:
        raise NotImplementedError


class MockTranslator(Translator):
    """Simple placeholder translator for local testing."""

    def translate(self, transcript: Transcript, target_language: str) -> TranslationResult:
        if transcript.language == target_language:
            translated_text = transcript.text
        else:
            translated_text = f"[{target_language}] {transcript.text}"
        translated_segments = []
        for segment in transcript.segments:
            translated_segments.append(
                {
                    **segment,
                    "text": (
                        segment.get("text")
                        if transcript.language == target_language
                        else f"[{target_language}] {segment.get('text', '')}"
                    ),
                }
            )
        return TranslationResult(
            text=translated_text,
            source_language=transcript.language,
            target_language=target_language,
            segments=translated_segments,
        )


class LibreTranslateTranslator(Translator):
    """
    Translator implementation backed by LibreTranslate API.

    Environment variables required:
    - LIBRETRANSLATE_URL
    Optional:
    - LIBRETRANSLATE_API_KEY
    """

    def __init__(
        self,
        endpoint: str,
        api_key: str | None = None,
        timeout: int = 45,
    ) -> None:
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout

    def translate(self, transcript: Transcript, target_language: str) -> TranslationResult:
        source_lang = transcript.language if transcript.language != "auto" else "auto"
        translated_text = self._translate_text(transcript.text, source_lang, target_language)

        translated_segments = []
        for segment in transcript.segments:
            original_text = segment.get("text", "")
            translated_segment = self._translate_text(
                original_text,
                source_lang,
                target_language,
            )
            translated_segments.append({**segment, "text": translated_segment})

        return TranslationResult(
            text=translated_text,
            source_language=transcript.language,
            target_language=target_language,
            segments=translated_segments,
        )

    def _translate_text(self, text: str, source_lang: str, target_lang: str) -> str:
        payload: dict[str, Any] = {
            "q": text,
            "source": source_lang,
            "target": target_lang,
            "format": "text",
        }
        if self.api_key:
            payload["api_key"] = self.api_key

        try:
            response = requests.post(
                f"{self.endpoint}/translate",
                headers={"Content-Type": "application/json"},
                data=json.dumps(payload),
                timeout=self.timeout,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise ProcessError(f"Translation request failed: {exc}") from exc

        try:
            data = response.json()
            return str(data["translatedText"])
        except (ValueError, KeyError, TypeError) as exc:
            raise ProcessError("Unexpected translation response format") from exc


def build_translator(
    mode: str,
    libretranslate_url: str | None = None,
    libretranslate_api_key: str | None = None,
) -> Translator:
    normalized = mode.strip().lower()
    if normalized == "mock":
        return MockTranslator()
    if normalized == "libretranslate":
        if not libretranslate_url:
            raise ConfigurationError(
                "TRANSLATOR_MODE=libretranslate requires LIBRETRANSLATE_URL."
            )
        return LibreTranslateTranslator(
            endpoint=libretranslate_url,
            api_key=libretranslate_api_key,
        )
    raise ConfigurationError(
        f"Unsupported translator mode '{mode}'. Use 'mock' or 'libretranslate'."
    )


def save_translation(result: TranslationResult, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = {
        "text": result.text,
        "source_language": result.source_language,
        "target_language": result.target_language,
        "segments": result.segments,
    }
    path.write_text(json.dumps(serialized, ensure_ascii=False, indent=2))


# Backward-compatible alias.
BaseTranslator = Translator
