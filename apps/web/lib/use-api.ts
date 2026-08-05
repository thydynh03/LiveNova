'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, ApiError } from './api-client';

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Minimal GET-and-render hook.
 *
 * Deliberately not a cache layer — TanStack Query is the right answer once
 * several screens share data, but pulling it in for three read-only screens
 * would be more machinery than the problem needs today.
 *
 * The dependency list is exactly [path, nonce]. An earlier version accepted a
 * caller-supplied `deps` array and spread it into the effect, which makes the
 * dependency list variable-length — something the exhaustive-deps rule cannot
 * verify and React itself does not support. Callers that need to re-fetch on
 * some other change should vary `path` or call `reload()`.
 */
export function useApi<T>(path: string | null): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // Guards against a slow response from a previous path overwriting a newer one.
  const requestId = useRef(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    api
      .get<T>(path)
      .then((result) => {
        if (id !== requestId.current) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        // A 401 is handled globally by the auth provider, which redirects; there
        // is no useful message to show in the page body for it.
        if (err instanceof ApiError && err.status === 401) return;
        setError(err instanceof Error ? err.message : 'Không tải được dữ liệu');
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [path, nonce]);

  return { data, loading, error, reload };
}
