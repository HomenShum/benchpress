import { useState, useCallback, useRef } from "react";

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiReturn<T> extends UseApiState<T> {
  /** Trigger the async operation. Returns the result on success. */
  execute: (...args: unknown[]) => Promise<T | null>;
  /** Reset state to initial. */
  reset: () => void;
}

/**
 * Generic async hook.
 *
 * ```ts
 * const { data, loading, error, execute } = useApi(() => qaCheck(url));
 * ```
 */
export function useApi<T>(fn: (...args: unknown[]) => Promise<T>): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  // Keep fn ref stable so callers don't need to memoize
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const execute = useCallback(async (...args: unknown[]): Promise<T | null> => {
    setState({ data: null, loading: true, error: null });
    try {
      const result = await fnRef.current(...args);
      setState({ data: result, loading: false, error: null });
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setState({ data: null, loading: false, error: message });
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}
