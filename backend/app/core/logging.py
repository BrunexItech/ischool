import logging


def configure_logging() -> None:
    """A consistent, timestamped format for anything the app logs itself
    (as opposed to uvicorn's own access log) — the only way to see what
    went wrong in production without this is a school reporting it."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
