# Douyin -> Translate -> TikTok Pipeline

Pipeline module hoa de:

1. Crawl video tu Douyin (qua `yt-dlp`)
2. Tao transcript (Whisper CLI hoac mock)
3. Dich noi dung (mock hoac LibreTranslate)
4. Tao subtitle `.srt` va burn subtitle vao video (ffmpeg)
5. Dang len TikTok (mac dinh dry-run an toan)

## Kien truc module

```text
src/douyin_tiktok_pipeline/
  core/
    config.py           # Env + duong dan + runtime flags
    models.py           # Dataclasses cho assets va result
    errors.py           # Nhom exceptions cua pipeline
  crawler/
    douyin.py           # DouyinCrawler (yt-dlp)
  processor/
    transcriber.py      # WhisperTranscriber, MockTranscriber
    translator.py       # LibreTranslateTranslator, MockTranslator
    subtitle_renderer.py# Render subtitle SRT
    video_processor.py  # Burn subtitle/copy video bang ffmpeg
  publisher/
    tiktok.py           # TikTokPublisher (dry-run + placeholder upload)
  pipeline/
    workflow.py         # PipelineOrchestrator
  cli.py                # Command line entrypoint
```

## Cai dat

Yeu cau:

- Python >= 3.10
- `yt-dlp`
- `ffmpeg`
- Neu dung transcriber that: `openai-whisper` CLI (`whisper`)

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

## Bien moi truong

| Bien | Mac dinh | Mo ta |
|---|---|---|
| `DRY_RUN` | `true` | Khong dang that len TikTok |
| `TARGET_LANG` | `vi` | Ngon ngu dich dich den |
| `TRANSCRIPT_LANG` | `auto` | Ngon ngu dau vao cho Whisper |
| `TRANSCRIBER_MODE` | `whisper` | `whisper` hoac `mock` |
| `TRANSLATOR_MODE` | `mock` | `mock` hoac `libretranslate` |
| `LIBRETRANSLATE_URL` | - | Bat buoc neu `TRANSLATOR_MODE=libretranslate` |
| `LIBRETRANSLATE_API_KEY` | - | API key cho LibreTranslate (neu can) |
| `YT_DLP_BINARY` | `yt-dlp` | Duong dan binary yt-dlp |
| `WHISPER_BINARY` | `whisper` | Duong dan binary whisper |
| `WHISPER_MODEL` | `small` | Whisper model |
| `FFMPEG_BINARY` | `ffmpeg` | Duong dan binary ffmpeg |
| `TIKTOK_SESSION_ID` | - | Session id de publish that |
| `TIKTOK_PUBLISH_ENDPOINT` | TikTok Open API URL | Endpoint upload |
| `BURN_SUBTITLES` | `true` | Burn subtitle vao video output |
| `KEEP_INTERMEDIATE` | `false` | Giu file tam (hien chua dung sau pipeline) |

## Chay CLI

### 1) Dry run (khuyen nghi test truoc)

```bash
douyin-pipeline \
  --url "https://www.douyin.com/video/xxxxxxxxxxxx" \
  --caption-template "{translated_text}" \
  --hashtags trend viet-hoa \
  --dry-run
```

### 2) Publish that len TikTok

```bash
export DRY_RUN=false
export TIKTOK_SESSION_ID="your-session-id"

douyin-pipeline \
  --url "https://www.douyin.com/video/xxxxxxxxxxxx" \
  --caption-template "{source_title} | {translated_text}" \
  --hashtags trend remix \
  --publish
```

## Output

Sau moi lan chay, pipeline tao cac file trong `output/`:

- `downloads/<request_id>/source.mp4`
- `downloads/<request_id>/metadata.json`
- `subtitles/<request_id>.srt`
- `translated/<request_id>.mp4`
- `reports/<request_id>.json`

`report` chua toan bo thong tin: video da tai, transcript, translation, subtitle path, publish result.

## Luu y phap ly va ban quyen

- Ban can tuan thu Terms of Service cua Douyin va TikTok.
- Chi nen su dung video co quyen tai su dung / da duoc phep.
- Neu dang lai noi dung cua nguoi khac, can xem xet quyen tac gia va attribution phu hop.
