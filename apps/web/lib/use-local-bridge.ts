'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameInputCommand } from '@livenova/shared';

/**
 * Connection to the Local Bridge running on the streamer's own machine.
 *
 * The bridge listens on loopback and requires a session token that the desktop
 * app generates at startup. That token is a local credential: it authorises
 * moving the keyboard of the machine it runs on.
 *
 * So it is stored in this browser's localStorage and nowhere else. It is never
 * sent to the API, never put in a URL, and never included in an overlay link —
 * an overlay's own token gets pasted into OBS and is routinely visible on
 * stream, and anything that can drive a keyboard must not travel that way.
 */

export const BRIDGE_TOKEN_KEY = 'ln_bridge_token';
export const BRIDGE_URL = 'ws://127.0.0.1:4000';

export type BridgeStatus = 'disabled' | 'connecting' | 'connected' | 'rejected' | 'offline';

export function readStoredBridgeToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(BRIDGE_TOKEN_KEY) ?? '';
  } catch {
    // Private-mode browsers throw rather than returning null.
    return '';
  }
}

export function storeBridgeToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = token.trim();
    if (trimmed === '') window.localStorage.removeItem(BRIDGE_TOKEN_KEY);
    else window.localStorage.setItem(BRIDGE_TOKEN_KEY, trimmed);
  } catch {
    // Nothing useful to do; the caller surfaces the connection status instead.
  }
}

interface Options {
  token: string;
  /** Injectable for tests. */
  createSocket?: (url: string) => WebSocket;
  enabled?: boolean;
}

export interface UseLocalBridgeResult {
  status: BridgeStatus;
  /** Last error the bridge reported, if it refused a command. */
  lastError: string | null;
  send: (command: GameInputCommand) => void;
  sendBlind: (effectType: string, durationMs?: number, caption?: string) => void;
}

export function useLocalBridge(options: Options): UseLocalBridgeResult {
  const { token, createSocket, enabled = true } = options;

  const [status, setStatus] = useState<BridgeStatus>('disabled');
  const [lastError, setLastError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  // Held in a ref, not a dependency. A caller passing an inline factory would
  // otherwise change its identity on every render, tearing the socket down and
  // dialling loopback again in a loop.
  const createSocketRef = useRef(createSocket);
  useEffect(() => {
    createSocketRef.current = createSocket;
  }, [createSocket]);

  useEffect(() => {
    if (!enabled || token.trim() === '') {
      setStatus('disabled');
      return;
    }

    setStatus('connecting');
    const url = `${BRIDGE_URL}/?token=${encodeURIComponent(token.trim())}`;
    const factory = createSocketRef.current;
    const socket = factory ? factory(url) : new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => setStatus('connected');

    socket.onmessage = (event) => {
      try {
        const reply = JSON.parse(String(event.data)) as { ok?: boolean; error?: string };
        // A refused command is worth showing: the streamer configured a key the
        // bridge will not press, and silence would read as the rule not firing.
        setLastError(reply.ok === false ? (reply.error ?? 'Lệnh bị từ chối') : null);
      } catch {
        setLastError('Không đọc được phản hồi từ Local Bridge');
      }
    };

    socket.onerror = () => undefined;

    socket.onclose = (event) => {
      socketRef.current = null;
      // The bridge answers a bad token with HTTP 401 before the upgrade, which
      // surfaces here as an abnormal close. Distinguishing it from "the desktop
      // app is not running" matters: one is a wrong token, the other is a
      // process to start, and telling the streamer the wrong one wastes them.
      setStatus(event.code === 1006 ? 'offline' : 'rejected');
    };

    return () => {
      socket.onclose = null;
      socket.close();
      socketRef.current = null;
      setStatus('disabled');
    };
  }, [token, enabled]);

  const send = useCallback((command: GameInputCommand) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== 1 /* OPEN */) return;

    // The server may redeliver a dispatch after a reconnect. Pressing a key
    // twice is not idempotent the way redrawing an overlay is.
    if (seenRef.current.has(command.id)) return;
    seenRef.current.add(command.id);

    socket.send(
      JSON.stringify({
        type: 'key_press',
        id: command.id,
        vkCode: command.vkCode,
        holdMs: command.holdMs,
        cooldownMs: command.cooldownMs,
      }),
    );
  }, []);

  const sendBlind = useCallback((effectType: string, durationMs?: number, caption?: string) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== 1 /* OPEN */) return;

    socket.send(
      JSON.stringify({
        type: effectType === 'flashbang' ? 'flashbang' : 'blackout',
        id: `blind-${Date.now()}`,
        durationMs: durationMs ?? 5000,
        caption,
      }),
    );
  }, []);

  return { status, lastError, send, sendBlind };
}
