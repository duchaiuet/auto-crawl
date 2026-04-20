from __future__ import annotations

import argparse
import json
from pathlib import Path

from douyin_tiktok_pipeline.core.config import PipelineConfig
from douyin_tiktok_pipeline.core.errors import PipelineError
from douyin_tiktok_pipeline.pipeline.workflow import PipelineOrchestrator


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="douyin-pipeline",
        description="Fetch a Douyin video, translate content, and publish to TikTok.",
    )
    parser.add_argument("--url", required=True, help="Douyin video URL to process")
    parser.add_argument(
        "--caption-template",
        default="{translated_text}",
        help="Caption template for TikTok post.",
    )
    parser.add_argument(
        "--hashtags",
        nargs="*",
        default=[],
        help="Optional hashtags without # prefix",
    )
    parser.add_argument(
        "--workspace",
        type=Path,
        default=Path.cwd(),
        help="Workspace root where output folder will be created",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Custom output directory (defaults to <workspace>/output)",
    )
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        "--dry-run",
        dest="dry_run",
        action="store_true",
        help="Run processing and skip actual TikTok upload",
    )
    mode_group.add_argument(
        "--publish",
        dest="dry_run",
        action="store_false",
        help="Force actual publish (override DRY_RUN env)",
    )
    parser.set_defaults(dry_run=None)
    return parser


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    config = PipelineConfig.from_env(
        workspace_dir=args.workspace,
        output_dir=args.output_dir,
        dry_run=args.dry_run,
    )
    config.ensure_directories()

    orchestrator = PipelineOrchestrator(config=config)
    try:
        result = orchestrator.run(
            source_url=args.url,
            caption_template=args.caption_template,
            hashtags=args.hashtags,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except PipelineError as exc:
        raise SystemExit(str(exc))


if __name__ == "__main__":
    main()
