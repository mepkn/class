import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * Debounces `callback` by `delayMs`. Always calls the latest callback.
 * Pending calls are flushed on unmount so the last edit is never lost.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
) {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgsRef = useRef<Args | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const flush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const args = pendingArgsRef.current;
    pendingArgsRef.current = null;
    if (args) callbackRef.current(...args);
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    pendingArgsRef.current = null;
  }, []);

  const run = useCallback(
    (...args: Args) => {
      pendingArgsRef.current = args;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, delayMs);
    },
    [delayMs, flush],
  );

  useEffect(() => flush, [flush]);

  return useMemo(() => ({ run, flush, cancel }), [run, flush, cancel]);
}
