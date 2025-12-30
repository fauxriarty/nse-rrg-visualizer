import { useEffect, useState, useCallback } from 'react';

interface UseAutoRefreshProps {
  onRefresh: () => void;
  enabled: boolean;
  intervalSeconds: number;
  shouldSkipBacktest?: boolean;
  isBacktesting?: boolean;
}

export const useAutoRefresh = ({
  onRefresh,
  enabled,
  intervalSeconds,
  shouldSkipBacktest = true,
  isBacktesting = false,
}: UseAutoRefreshProps) => {
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [nextRefreshIn, setNextRefreshIn] = useState<number>(intervalSeconds);

  useEffect(() => {
    if (!enabled || (shouldSkipBacktest && isBacktesting)) {
      return;
    }

    console.log('[useAutoRefresh] Enabled, calling onRefresh immediately');
    // Immediate refresh on enable
    onRefresh();
    setLastRefreshTime(new Date());
    setNextRefreshIn(intervalSeconds);

    const interval = setInterval(() => {
      console.log('[useAutoRefresh] Interval trigger, calling onRefresh');
      onRefresh();
      setLastRefreshTime(new Date());
      setNextRefreshIn(intervalSeconds);
    }, intervalSeconds * 1000);

    return () => clearInterval(interval);
  }, [enabled, intervalSeconds, onRefresh, shouldSkipBacktest, isBacktesting]);

  // Countdown timer for next refresh
  useEffect(() => {
    if (!enabled || (shouldSkipBacktest && isBacktesting)) {
      return;
    }

    const countdownInterval = setInterval(() => {
      setNextRefreshIn((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [enabled, shouldSkipBacktest, isBacktesting]);

  return { lastRefreshTime, nextRefreshIn };
};
