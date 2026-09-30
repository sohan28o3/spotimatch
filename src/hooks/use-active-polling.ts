"use client";

import { useEffect, useEffectEvent } from "react";

export const ACTIVE_POLL_INTERVAL_MS = 10_000;

export function useActivePolling(
  poll: () => void | Promise<void>,
  enabled = true,
  intervalMs = ACTIVE_POLL_INTERVAL_MS
) {
  const onPoll = useEffectEvent(poll);

  useEffect(() => {
    if (!enabled) return;

    const runWhenVisible = () => {
      if (document.visibilityState === "visible") void onPoll();
    };

    runWhenVisible();
    const interval = window.setInterval(runWhenVisible, intervalMs);
    window.addEventListener("focus", runWhenVisible);
    document.addEventListener("visibilitychange", runWhenVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", runWhenVisible);
      document.removeEventListener("visibilitychange", runWhenVisible);
    };
  }, [enabled, intervalMs]);
}
