'use client';

import React, { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { OverlayAction, LiveEventType } from '@livenova/shared';
import { useOverlaySocket } from '../../../lib/use-overlay-socket';

interface ChatMsg {
  id: string;
  user: string;
  avatar?: string;
  text: string;
}

const MAX_VISIBLE = 20;

function ChatOverlay() {
  const token = useSearchParams().get('token');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // OBS composites this over the video, so the page itself must be see-through.
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
  }, []);

  /**
   * NOTE — this renderer is complete, but it will stay empty until the server
   * dispatches chatbox actions.
   *
   * Raw comments travel on the authenticated `/events` namespace as
   * `live_event`. An OBS Browser Source has no session and cannot subscribe
   * there, so the only channel it can use is `/overlay`, which carries
   * rule-produced actions. Showing every comment therefore needs a CHATBOX
   * action handler plus a matching rule — that is feature F04, and it is not in
   * this change. Wiring the transport now means F04 is renderer-complete on day
   * one, but do not expect messages to appear before then.
   */
  const handleAction = useCallback((action: OverlayAction) => {
    const { event } = action;
    // A chatbox only renders things a viewer said; gifts and follows belong to
    // other overlays.
    if (event.type !== LiveEventType.COMMENT || !event.content) return;

    setMessages((prev) =>
      [
        ...prev,
        {
          id: action.id,
          user: event.senderDisplayName,
          avatar: event.senderAvatar,
          text: event.content as string,
        },
      ].slice(-MAX_VISIBLE),
    );
  }, []);

  const { status, rejectionCode } = useOverlaySocket(token, { onAction: handleAction });

  // Explicit mapping, so a state with nothing useful to say (idle, connected)
  // renders no banner at all rather than an empty box.
  const statusMessage = !token
    ? 'Thiếu ?token= trong URL overlay'
    : status === 'connecting'
      ? 'Đang kết nối…'
      : status === 'reconnecting'
        ? 'Mất kết nối — đang thử lại…'
        : status === 'rejected'
          ? `Token không hợp lệ (${rejectionCode ?? 'unknown'})`
          : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .chat-msg { animation: slideIn 0.3s ease-out forwards; }
        @media (prefers-reduced-motion: reduce) {
          .chat-msg { animation: none; }
        }
      `}</style>

      {/*
        Status is only drawn while something is wrong, and only when there is
        actually a message to show. Rendering the box for every non-connected
        state flashed an empty dark rectangle on first paint (status starts as
        'idle') — which OBS would burn straight into the broadcast.
      */}
      {statusMessage && (
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            fontFamily: 'sans-serif',
            fontSize: '0.85rem',
            width: 'fit-content',
          }}
        >
          {statusMessage}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '350px' }}>
        {messages.map((m) => (
          <div
            key={m.id}
            className="chat-msg glass"
            style={{
              display: 'flex',
              gap: '0.75rem',
              padding: '0.75rem',
              borderRadius: '12px',
              background: 'rgba(20, 20, 20, 0.65)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'white',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            }}
          >
            {m.avatar && (
              /*
               * A plain <img>, not next/image. Avatars come from arbitrary
               * TikTok CDN hosts that cannot be enumerated in
               * next.config images.remotePatterns, and the overlay renders
               * inside OBS where the optimiser buys nothing.
               */
              <img
                src={m.avatar}
                alt=""
                width={32}
                height={32}
                style={{ width: 32, height: 32, borderRadius: '50%' }}
              />
            )}
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#a78bfa' }}>
                {m.user}
              </div>
              <div style={{ fontSize: '1rem', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                {m.text}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export default function ChatOverlayPage() {
  return (
    <Suspense fallback={null}>
      <ChatOverlay />
    </Suspense>
  );
}
