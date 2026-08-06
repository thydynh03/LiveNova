'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { EVENTS_SOCKET, LiveEvent } from '@livenova/shared';
import { getAccessToken } from './api-client';

export type EventsConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'unauthorized';

export interface UseEventsSocketOptions {
  /** Channels to subscribe to. The server rejects any the user does not own. */
  channelIds: string[];
  onEvent: (event: LiveEvent) => void;
  enabled?: boolean;
  url?: string;
}

export interface UseEventsSocketResult {
  status: EventsConnectionStatus;
  /** Channels the server actually accepted, which may be fewer than requested. */
  subscribed: string[];
}

/**
 * Connects the dashboard to the authenticated `/events` namespace.
 *
 * Different from `useOverlaySocket` in two ways that matter:
 *
 * 1. **It authenticates with a JWT**, not an overlay token, because this runs in
 *    a real session. The access token lives in module memory and is read at
 *    connect time rather than captured in a closure — a token refreshed between
 *    renders would otherwise leave this holding a stale one.
 *
 * 2. **Auth and subscription are re-done on every reconnect.** Socket.IO
 *    restores the transport but the server keeps no memory of who a socket was,
 *    so a reconnected client that skipped re-authenticating would sit connected
 *    and silent — the worst kind of failure, because it looks fine.
 */
export function useEventsSocket(options: UseEventsSocketOptions): UseEventsSocketResult {
  const { channelIds, onEvent, enabled = true, url } = options;

  const [status, setStatus] = useState<EventsConnectionStatus>('idle');
  const [subscribed, setSubscribed] = useState<string[]>([]);

  // Mirror of `subscribed` for use inside effects that must not depend on it.
  const subscribedRef = useRef<string[]>([]);
  useEffect(() => {
    subscribedRef.current = subscribed;
  }, [subscribed]);

  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  // Kept in a ref so the socket is not torn down and rebuilt every time the
  // caller passes a new array literal with the same contents.
  const channelIdsRef = useRef<string[]>(channelIds);
  const channelKey = channelIds.join(',');
  useEffect(() => {
    channelIdsRef.current = channelIds;
  }, [channelIds]);

  const socketRef = useRef<Socket | null>(null);

  const authenticateAndSubscribe = useCallback((socket: Socket) => {
    const token = getAccessToken();
    if (!token) {
      setStatus('unauthorized');
      return;
    }

    setStatus('authenticating');
    socket.emit(EVENTS_SOCKET.AUTHENTICATE, { token });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const base = url ?? process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4001';
    setStatus('connecting');

    const socket: Socket = io(`${base}${EVENTS_SOCKET.NAMESPACE}`, {
      transports: ['websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      timeout: 8_000,
    });
    socketRef.current = socket;

    socket.on('connect', () => authenticateAndSubscribe(socket));

    socket.on('authenticated', () => {
      setStatus('connected');
      setSubscribed([]);
      for (const id of channelIdsRef.current) {
        socket.emit(EVENTS_SOCKET.SUBSCRIBE_CHANNEL, id);
      }
    });

    socket.on('subscribed', (payload: { channelId?: string }) => {
      if (!payload?.channelId) return;
      setSubscribed((prev) =>
        prev.includes(payload.channelId as string) ? prev : [...prev, payload.channelId as string],
      );
    });

    socket.on('error', (payload: { code?: string }) => {
      // AUTH_REQUIRED / AUTH_INVALID are terminal: the server disconnects right
      // after, and reconnecting with the same dead token would just loop.
      if (payload?.code === 'AUTH_REQUIRED' || payload?.code === 'AUTH_INVALID') {
        setStatus('unauthorized');
        socket.io.reconnection(false);
      }
    });

    socket.on('disconnect', (reason) => {
      setSubscribed([]);
      setStatus(reason === 'io server disconnect' ? 'unauthorized' : 'reconnecting');
    });

    socket.on('connect_error', () => setStatus('reconnecting'));

    socket.on(EVENTS_SOCKET.LIVE_EVENT, (event: LiveEvent) => {
      if (!event?.id) return;
      onEventRef.current(event);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setStatus('idle');
      setSubscribed([]);
    };
  }, [enabled, url, authenticateAndSubscribe]);

  // Subscribing to a newly linked channel must not drop the socket, so the
  // channel list is reconciled incrementally rather than being a dependency of
  // the connection effect.
  //
  // The current subscriptions are read from a ref, not from state: depending on
  // `subscribed` would re-run this on every server ack, and each run would emit
  // again — the effect would feed itself.
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || status !== 'connected') return;

    const want = channelIdsRef.current;
    const have = subscribedRef.current;

    for (const id of want) {
      if (!have.includes(id)) socket.emit(EVENTS_SOCKET.SUBSCRIBE_CHANNEL, id);
    }
    for (const id of have) {
      if (!want.includes(id)) socket.emit(EVENTS_SOCKET.UNSUBSCRIBE_CHANNEL, id);
    }
  }, [channelKey, status]);

  return { status, subscribed };
}
