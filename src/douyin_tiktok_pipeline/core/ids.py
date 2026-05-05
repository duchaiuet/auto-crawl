from __future__ import annotations

from datetime import datetime, timezone


def make_request_id(prefix: str = "job") -> str:
    """Create a unique-ish request id based on UTC timestamp."""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return f"{prefix}-{timestamp}"


def new_request_id(prefix: str = "job") -> str:
    """Backward-compatible alias."""
    return make_request_id(prefix=prefix)
