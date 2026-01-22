"""Parallel collection runner using asyncio work-stealing queue.

Provides concurrent execution of collection tasks with:
- asyncio.Queue for work distribution (atomic task claiming)
- Shared failure counter with asyncio.Lock
- Activity event emission for SSE streaming
- Configurable worker count (default 5)
"""

import asyncio
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar('T')
R = TypeVar('R')

MAX_WORKERS = 5
MAX_CONSECUTIVE_FAILURES = 5


@dataclass
class ActivityEvent:
    """Activity event for SSE streaming."""
    id: str
    timestamp: str
    worker_id: int
    phase: str  # "amazon" or "ebay"
    action: str  # "fetching", "found", "error", "rate_limited", "complete"
    category: str | None = None
    product_name: str | None = None
    seller_found: str | None = None
    new_sellers_count: int | None = None
    error_message: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in self.__dict__.items() if v is not None}


class CollectionPausedException(Exception):
    """Raised when collection should pause due to consecutive failures."""
    pass


class ParallelCollectionRunner:
    """
    Orchestrates parallel collection with work-stealing queue pattern.

    Usage:
        runner = ParallelCollectionRunner(
            on_activity=lambda event: activity_queue.put_nowait(event)
        )
        results = await runner.run(tasks, process_task_fn)
    """

    def __init__(
        self,
        max_workers: int = MAX_WORKERS,
        on_activity: Callable[[ActivityEvent], None] | None = None,
    ):
        self.max_workers = max_workers
        self.on_activity = on_activity
        self.work_queue: asyncio.Queue = asyncio.Queue()
        self.consecutive_failures = 0
        self.failure_lock = asyncio.Lock()
        self._cancelled = False

    def cancel(self):
        """Signal workers to stop processing."""
        self._cancelled = True

    async def emit_activity(self, event: ActivityEvent):
        """Emit activity event if callback registered."""
        if self.on_activity:
            try:
                self.on_activity(event)
            except Exception as e:
                logger.warning(f"Failed to emit activity: {e}")

    async def handle_failure(self, worker_id: int, error: str) -> bool:
        """
        Handle task failure. Returns True if should pause collection.

        Thread-safe via asyncio.Lock.
        """
        async with self.failure_lock:
            self.consecutive_failures += 1
            logger.warning(f"Worker {worker_id} failure: {error} (consecutive: {self.consecutive_failures})")

            if self.consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                logger.error(f"Max consecutive failures reached ({MAX_CONSECUTIVE_FAILURES})")
                return True
            return False

    async def reset_failures(self):
        """Reset failure counter on success."""
        async with self.failure_lock:
            self.consecutive_failures = 0

    async def worker(
        self,
        worker_id: int,
        process_task: Callable[[T, int], Awaitable[R]],
        phase: str,
    ) -> list[R]:
        """
        Worker pulls tasks from queue until poison pill received.

        Args:
            worker_id: Worker identifier (1-5)
            process_task: Async function that processes a single task
            phase: Current phase ("amazon" or "ebay")

        Returns:
            List of results from processed tasks
        """
        results: list[R] = []

        while not self._cancelled:
            try:
                task = await asyncio.wait_for(self.work_queue.get(), timeout=0.5)
            except asyncio.TimeoutError:
                # Check if queue is empty and all workers should exit
                if self.work_queue.empty():
                    break
                continue

            if task is None:  # Poison pill
                self.work_queue.task_done()
                break

            try:
                result = await process_task(task, worker_id)
                results.append(result)
                await self.reset_failures()

            except CollectionPausedException:
                self.work_queue.task_done()
                raise

            except Exception as e:
                should_pause = await self.handle_failure(worker_id, str(e))
                if should_pause:
                    self.work_queue.task_done()
                    raise CollectionPausedException(f"Max failures reached: {e}")

            finally:
                self.work_queue.task_done()

        return results

    async def run(
        self,
        tasks: list[T],
        process_task: Callable[[T, int], Awaitable[R]],
        phase: str = "collection",
    ) -> list[R]:
        """
        Execute tasks in parallel using work-stealing queue.

        Args:
            tasks: List of tasks to process
            process_task: Async function(task, worker_id) -> result
            phase: Phase name for activity events

        Returns:
            Combined results from all workers
        """
        if not tasks:
            return []

        # Reset state
        self._cancelled = False
        self.consecutive_failures = 0
        self.work_queue = asyncio.Queue()

        # Populate queue
        for task in tasks:
            await self.work_queue.put(task)

        # Add poison pills for clean shutdown
        for _ in range(self.max_workers):
            await self.work_queue.put(None)

        # Start workers
        worker_tasks = [
            asyncio.create_task(self.worker(i + 1, process_task, phase))
            for i in range(self.max_workers)
        ]

        # Wait for all workers
        try:
            results_per_worker = await asyncio.gather(*worker_tasks, return_exceptions=True)
        except Exception as e:
            logger.error(f"Parallel run failed: {e}")
            self.cancel()
            raise

        # Flatten results, filtering out exceptions
        all_results: list[R] = []
        for result in results_per_worker:
            if isinstance(result, list):
                all_results.extend(result)
            elif isinstance(result, Exception):
                logger.warning(f"Worker exception: {result}")

        return all_results


def create_activity_event(
    worker_id: int,
    phase: str,
    action: str,
    **kwargs,
) -> ActivityEvent:
    """Helper to create ActivityEvent with auto-generated id and timestamp."""
    return ActivityEvent(
        id=str(uuid.uuid4()),
        timestamp=datetime.now(timezone.utc).isoformat(),
        worker_id=worker_id,
        phase=phase,
        action=action,
        **kwargs,
    )
