'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { EVENTS_SOCKET, LiveEvent } from '@livenova/shared';
import { getAccessToken, restoreSession } from './api-client';

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
 *    a real session. The access token is read at connect time rather than
 *    captured in a closure — a token refreshed between renders would otherwise
 *    leave this holding a stale one.
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

  // Mirror of `subscribed` for effects that must not depend on it. Written
  // synchronously alongside the state so a reconcile that runs in the same tick
  // sees the truth rather than the previous render's value.
  const subscribedRef = useRef<string[]>([]);
  const setSubscribedBoth = useCallback((next: string[]) => {
    subscribedRef.current = next;
    setSubscribed(next);
  }, []);

  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const channelIdsRef = useRef<string[]>(channelIds);
  const channelKey = channelIds.join(',');
  useEffect(() => {
    channelIdsRef.current = channelIds;
  }, [channelIds]);

  const socketRef = useRef<Socket | null>(null);
  /** Subscribe requests emitted but not yet acknowledged. */
  const pendingRef = useRef<Set<string>>(new Set());
  /** Guards the one-shot token refresh so a dead session cannot loop. */
  const refreshAttempted = useRef(false);

  const authenticate = useCallback((socket: Socket) => {
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

    socket.on('connect', () => authenticate(socket));

    socket.on('authenticated', () => {
      refreshAttempted.current = false;
      pendingRef.current.clear();
      // Clear first: the server has no memory of this socket's previous
      // subscriptions, so anything we still believed is now wrong. The
      // reconcile effect below performs the actual subscribe once status flips
      // to 'connected' — emitting here as well would send every subscription
      // twice and double the ownership queries on the server.
      setSubscribedBoth([]);
      setStatus('connected');
    });

    socket.on('subscribed', (payload: { channelId?: string }) => {
      const id = payload?.channelId;
      if (!id) return;
      pendingRef.current.delete(id);

      // The channel may have been unlinked while this subscribe was in flight.
      // The reconcile effect cannot catch that case — it compares against the
      // acknowledged set, which did not contain this id at the time — so the
      // socket would stay subscribed to a channel the user removed and keep
      // feeding its events into the list.
      if (!channelIdsRef.current.includes(id)) {
        socket.emit(EVENTS_SOCKET.UNSUBSCRIBE_CHANNEL, id);
        return;
      }

      if (subscribedRef.current.includes(id)) return;
      setSubscribedBoth([...subscribedRef.current, id]);
    });

    // Without this the set only ever grows: unlinking then re-linking a channel
    // on a live socket would find the stale id still present and never re-send
    // SUBSCRIBE_CHANNEL, leaving the feed permanently silent for it.
    socket.on('unsubscribed', (payload: { channelId?: string }) => {
      const id = payload?.channelId;
      if (!id) return;
      setSubscribedBoth(subscribedRef.current.filter((existing) => existing !== id));
    });

    socket.on('error', (payload: { code?: string }) => {
      const code = payload?.code;
      if (code !== 'AUTH_REQUIRED' && code !== 'AUTH_INVALID') return;

      // An access token lives 15 minutes. A reconnect after that window is the
      // normal case, not a dead session — treating it as terminal killed the
      // feed for a streamer who simply left the tab open. Try once to mint a
      // fresh token from the refresh cookie before giving up.
      if (!refreshAttempted.current) {
        refreshAttempted.current = true;
        void restoreSession().then((fresh) => {
          if (fresh && socketRef.current === socket && socket.connected) {
            authenticate(socket);
          } else {
            setStatus('unauthorized');
            socket.io.reconnection(false);
          }
        });
        return;
      }

      setStatus('unauthorized');
      socket.io.reconnection(false);
    });

    socket.on('disconnect', (reason) => {
      pendingRef.current.clear();
      setSubscribedBoth([]);
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
      setSubscribedBoth([]);
    };
  }, [enabled, url, authenticate, setSubscribedBoth]);

  // Subscribing to a newly linked channel must not drop the socket, so the
  // channel list is reconciled incrementally rather than being a dependency of
  // the connection effect.
  //
  // Current subscriptions are read from the ref, not from state: depending on
  // `subscribed` would re-run this on every server ack, and each run would emit
  // again — the effect would feed itself.
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || status !== 'connected') return;

    const want = channelIdsRef.current;
    const have = subscribedRef.current;
    const pending = pendingRef.current;

    for (const id of want) {
      // `pending` stops a second reconcile from re-sending a subscribe that is
      // still awaiting its acknowledgement.
      if (!have.includes(id) && !pending.has(id)) {
        pending.add(id);
        socket.emit(EVENTS_SOCKET.SUBSCRIBE_CHANNEL, id);
      }
    }
    for (const id of have) {
      if (!want.includes(id)) socket.emit(EVENTS_SOCKET.UNSUBSCRIBE_CHANNEL, id);
    }
  }, [channelKey, status]);

  return { status, subscribed };
}
