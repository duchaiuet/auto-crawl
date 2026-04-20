class PipelineError(Exception):
    """Base exception for this pipeline."""


class ConfigurationError(PipelineError):
    """Raised when required configuration is missing or invalid."""


class CrawlError(PipelineError):
    """Raised when fetching media from Douyin fails."""


class ProcessError(PipelineError):
    """Raised when media processing fails."""


class PublishError(PipelineError):
    """Raised when publishing media to TikTok fails."""


# Backward-compatibility alias for older class name usage.
CrawlerError = CrawlError
