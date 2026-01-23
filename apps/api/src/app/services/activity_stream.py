"""Activity stream manager for real-time SSE streaming.

Manages in-memory activity queues keyed by run_id.
Each run has its own asyncio.Queue that workers push to
and SSE endpoints consume from.
"""

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Buffer size per run - older events dropped when full
ACTIVITY_BUFFER_SIZE = 100


class ActivityStreamManager:
    """
    Singleton manager for activity streams.

    Each collection run gets its own asyncio.Queue for activity events.
    Queues are automatically cleaned up when no longer referenced.
    """

    _instance: "ActivityStreamManager | None" = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._streams: dict[str, asyncio.Queue] = {}
            cls._instance._lock = asyncio.Lock()
        return cls._instance

    async def get_or_create(self, run_id: str) -> asyncio.Queue:
        """Get existing queue or create new one for run_id."""
        async with self._lock:
            if run_id not in self._streams:
                self._streams[run_id] = asyncio.Queue(maxsize=ACTIVITY_BUFFER_SIZE)
                logger.debug(f"Created activity stream for run {run_id}")
            return self._streams[run_id]

    async def push(self, run_id: str, event: dict[str, Any]):
        """
        Push event to run's queue.

        If queue is full, drops oldest event to make room.
        """
        queue = await self.get_or_create(run_id)

        # If queue full, drop oldest
        if queue.full():
            try:
                queue.get_nowait()
                logger.debug(f"Activity queue full, dropped oldest event for run {run_id}")
            except asyncio.QueueEmpty:
                pass

        try:
            queue.put_nowait(event)
            action = event.get("action", "unknown")
            logger.debug(f"Pushed activity event: {action} for run {run_id} (queue size: {queue.qsize()})")
        except asyncio.QueueFull:
            # Should not happen after dropping oldest, but handle anyway
            logger.warning(f"Activity queue full for run {run_id}")

    async def cleanup(self, run_id: str):
        """Remove queue for completed run."""
        async with self._lock:
            if run_id in self._streams:
                del self._streams[run_id]
                logger.debug(f"Cleaned up activity stream for run {run_id}")


# Global instance getter
def get_activity_stream() -> ActivityStreamManager:
    """Get the singleton ActivityStreamManager instance."""
    return ActivityStreamManager()
