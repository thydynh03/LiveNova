'use client';

import React, { useEffect, useState, useRef } from 'react';

type ChatMsg = { id: string; user: string; avatar: string; text: string; time: number };

export default function ChatOverlay() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Set up transparent body for OBS
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';

    // Simulate incoming messages
    let msgId = 0;
    const interval = setInterval(() => {
      setMessages(prev => {
        const newMsgs = [...prev, {
          id: `msg_${msgId++}`,
          user: `Viewer${Math.floor(Math.random() * 1000)}`,
          avatar: `https://api.dicebear.com/6.x/avataaars/svg?seed=${msgId}`,
          text: ['Hello!', 'Awesome stream', 'LMAO', 'Keep it up!'][Math.floor(Math.random() * 4)],
          time: Date.now()
        }];
        return newMsgs.slice(-20); // Keep last 20
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{
      width: '100vw', height: '100vh', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      padding: '1rem', boxSizing: 'border-box'
    }}>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .chat-msg {
          animation: slideIn 0.3s ease-out forwards;
        }
      `}</style>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '350px' }}>
        {messages.map((m) => (
          <div key={m.id} className="chat-msg glass" style={{
            display: 'flex', gap: '0.75rem', padding: '0.75rem',
            borderRadius: '12px', background: 'rgba(20, 20, 20, 0.65)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'white', backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
          }}>
            <img src={m.avatar} alt="avatar" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#a78bfa' }}>{m.user}</div>
              <div style={{ fontSize: '1rem', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{m.text}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
