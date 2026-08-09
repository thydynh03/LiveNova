'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  OVERLAY_SOCKET,
  OverlayAction,
  OverlayState,
  OverlayType,
} from '@livenova/shared';

/**
 * `error` was in this union but nothing ever set it, so every consumer carried a
 * dead branch. Transport failures surface as `reconnecting` (recoverable) and a
 * refused token as `rejected` (terminal) — those two cover every real outcome.
 */
export type OverlayConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'rejected';

export interface OverlayReadyInfo {
  overlayId: string;
  type: OverlayType;
  /**
   * The overlay's own render config, delivered with the handshake.
   *
   * A browser source has no credential with which to fetch this separately, and
   * a goal bar cannot draw itself before it knows its own target.
   */
  config?: Record<string, unknown>;
}

export interface UseOverlaySocketOptions {
  /** Called once per unique action. Duplicates are filtered before this runs. */
  onAction: (action: OverlayAction) => void;
  /**
   * Called with continuous state, such as goal progress.
   *
   * Deliberately not de-duplicated: unlike an action this is a current value,
   * and the newest frame always wins.
   */
  onState?: (state: OverlayState) => void;
  /** Override the API origin. Defaults to NEXT_PUBLIC_WS_URL. */
  url?: string;
  enabled?: boolean;
}

export interface UseOverlaySocketResult {
  status: OverlayConnectionStatus;
  ready: OverlayReadyInfo | null;
  /** Set when the server refused the token — retrying will not help. */
  rejectionCode: string | null;
}

/** How many recent action ids to remember for de-duplication. */
const SEEN_ACTION_LIMIT = 200;

/**
 * Connects an OBS overlay page to the `/overlay` namespace.
 *
 * Three things this handles that a bare `io()` call does not:
 *
 * 1. **De-duplication.** Socket.IO redelivers buffered events after a reconnect,
 *    and an overlay that plays the same gift video twice looks broken on stream.
 *    Every action carries a unique `id`; we keep a bounded window of the ones
 *    already handled.
 *
 * 2. **Reconnect without touching OBS.** A streamer cannot alt-tab to refresh a
 *    browser source mid-broadcast (FR-048), so reconnection is infinite with
 *    backoff — except when the server explicitly rejected the token, where
 *    retrying forever would just hammer the server.
 *
 * 3. **No credentials.** `withCredentials` stays false: the token in the URL is
 *    the only credential, and sending cookies to this namespace would widen the
 *    surface for no benefit.
 */
export function useOverlaySocket(
  token: string | null | undefined,
  options: UseOverlaySocketOptions,
): UseOverlaySocketResult {
  const { onAction, onState, url, enabled = true } = options;

  const [status, setStatus] = useState<OverlayConnectionStatus>('idle');
  const [ready, setReady] = useState<OverlayReadyInfo | null>(null);
  const [rejectionCode, setRejectionCode] = useState<string | null>(null);

  // Kept in a ref so a changing callback identity never tears down the socket.
  const onActionRef = useRef(onAction);
  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  const onStateRef = useRef(onState);
  useEffect(() => {
    onStateRef.current = onState;
  }, [onState]);

  const seenRef = useRef<Set<string>>(new Set());
  const seenOrderRef = useRef<string[]>([]);

  const isDuplicate = useCallback((id: string): boolean => {
    if (!id) return false;
    if (seenRef.current.has(id)) return true;

    seenRef.current.add(id);
    seenOrderRef.current.push(id);

    // Bounded window — an overlay can run for many hours.
    if (seenOrderRef.current.length > SEEN_ACTION_LIMIT) {
      const evicted = seenOrderRef.current.shift();
      if (evicted) seenRef.current.delete(evicted);
    }
    return false;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    if (!token) {
      setStatus('rejected');
      setRejectionCode('TOKEN_REQUIRED');
      return;
    }

    const base =
      url ?? process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4001';

    setStatus('connecting');
    setRejectionCode(null);

    const socket: Socket = io(`${base}${OVERLAY_SOCKET.NAMESPACE}`, {
      // Studio browser sources and HTTPS tunnels do not always permit a direct
      // WebSocket handshake. Start with polling, then let Socket.IO upgrade to
      // WebSocket when the embedded browser supports it.
      transports: ['polling', 'websocket'],
      withCredentials: false,
      query: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      timeout: 8_000,
    });

    socket.on('connect', () => setStatus('connected'));

    socket.on('disconnect', (reason) => {
      // A server-side disconnect after a rejected handshake must not be retried.
      setStatus(reason === 'io server disconnect' ? 'rejected' : 'reconnecting');
    });

    socket.on('connect_error', () => setStatus('reconnecting'));

    socket.on(OVERLAY_SOCKET.READY, (info: OverlayReadyInfo) => {
      setReady(info);
      setStatus('connected');
    });

    socket.on(OVERLAY_SOCKET.ERROR, (payload: { code?: string }) => {
      setRejectionCode(payload?.code ?? 'UNKNOWN');
      setStatus('rejected');
      // The server disconnects us right after; stop the client retrying.
      socket.io.reconnection(false);
    });

    socket.on(OVERLAY_SOCKET.ACTION, (action: OverlayAction) => {
      if (!action?.id || isDuplicate(action.id)) return;
      onActionRef.current(action);
    });

    socket.on(OVERLAY_SOCKET.STATE, (state: OverlayState) => {
      if (state) onStateRef.current?.(state);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      setStatus('idle');
      setReady(null);
    };
  }, [token, url, enabled, isDuplicate]);

  return { status, ready, rejectionCode };
}
