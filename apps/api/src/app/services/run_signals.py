"""In-memory signal registry for instant pause/cancel/resume detection.

This module provides a shared in-memory registry that allows API endpoints
to signal background workers instantly without database polling.

How it works:
1. When /pause or /cancel endpoint is called, it adds run_id to the registry
2. Workers check `is_cancelled(run_id)` - instant, no DB call
3. When /resume is called, it removes from the registry
4. Registry is cleaned up when run completes

This eliminates the need for database polling while providing instant response.
"""

import asyncio
from enum import Enum
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)


class RunSignal(Enum):
    """Signal types for collection runs."""
    PAUSE = "pause"
    CANCEL = "cancel"


# Global registry: run_id -> signal
# Using a simple dict protected by a lock for thread safety
_signals: Dict[str, RunSignal] = {}
_lock = asyncio.Lock()

# Debug: Print registry ID on module load
print(f"[SIGNAL] Registry initialized: id={id(_signals)}")


async def signal_run(run_id: str, signal: RunSignal) -> None:
    """
    Signal a run to pause or cancel.

    Called by API endpoints when user clicks pause/cancel.
    Workers will detect this instantly on their next check.
    """
    async with _lock:
        _signals[run_id] = signal
        print(f"[SIGNAL] Run {run_id} signaled: {signal.value} (registry now has {len(_signals)} signals)")
        logger.info(f"Run {run_id} signaled: {signal.value}")


async def clear_signal(run_id: str) -> None:
    """
    Clear signal for a run.

    Called by API endpoints when user clicks resume,
    or when a run completes/fails.
    """
    async with _lock:
        if run_id in _signals:
            old_signal = _signals[run_id]
            del _signals[run_id]
            print(f"[SIGNAL] Run {run_id} signal cleared (was: {old_signal.value}, registry now has {len(_signals)} signals)")
            logger.info(f"Run {run_id} signal cleared")
        else:
            print(f"[SIGNAL] Run {run_id} clear requested but no signal was set")


def check_signal(run_id: str) -> Optional[RunSignal]:
    """
    Check if a run has been signaled (instant, no await needed).

    Called by workers on every iteration.
    Returns the signal if present, None otherwise.

    Note: This is intentionally synchronous for minimal overhead.
    The dict read is atomic in Python (GIL), so no lock needed for reads.
    """
    return _signals.get(run_id)


def is_paused_or_cancelled(run_id: str) -> bool:
    """
    Quick check if run should stop processing.

    Returns True if run has PAUSE or CANCEL signal.
    """
    result = run_id in _signals
    if result:
        print(f"[SIGNAL] Worker detected signal for run {run_id}: {_signals.get(run_id)}")
    return result


def is_cancelled(run_id: str) -> bool:
    """Check if run has CANCEL signal specifically."""
    return _signals.get(run_id) == RunSignal.CANCEL


def is_paused(run_id: str) -> bool:
    """Check if run has PAUSE signal specifically."""
    return _signals.get(run_id) == RunSignal.PAUSE
