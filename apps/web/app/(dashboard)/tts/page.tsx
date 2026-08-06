'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../../../components/ui/Icon';
import { previewTts } from '../../../lib/api-client';

interface SpeechVoiceOption {
  id: string;
  name: string;
  lang: string;
  voiceObj?: SpeechSynthesisVoice;
  isOnlineFallback?: boolean;
}

interface TtsQueueItem {
  id: string;
  text: string;
  type: 'comment' | 'gift' | 'follow' | 'test';
  sender?: string;
  status: 'pending' | 'playing' | 'completed';
}

export default function TtsPage() {
  const [availableVoices, setAvailableVoices] = useState<SpeechVoiceOption[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('google-vi');
  const [speed, setSpeed] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(1.0);
  const [testText, setTestText] = useState<string>('Cảm ơn bạn đã theo dõi kênh livestream!');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Queue state
  const [queue, setQueue] = useState<TtsQueueItem[]>([]);
  const isProcessingQueue = useRef<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load voices
  useEffect(() => {
    const googleVoice: SpeechVoiceOption = {
      id: 'google-vi',
      name: 'Google Voice (Tiếng Việt Trực tuyến - Chuẩn & Tự nhiên nhất)',
      lang: 'vi-VN',
      isOnlineFallback: true,
    };

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setAvailableVoices([googleVoice]);
      return;
    }

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices() || [];

      const formatted: SpeechVoiceOption[] = voices.map((v, i) => ({
        id: v.voiceURI || `${v.lang}-${i}`,
        name: `${v.name} (${v.lang})`,
        lang: v.lang,
        voiceObj: v,
      }));

      formatted.sort((a, b) => {
        const aVi = a.lang.toLowerCase().includes('vi');
        const bVi = b.lang.toLowerCase().includes('vi');
        if (aVi && !bVi) return -1;
        if (!aVi && bVi) return 1;
        return a.name.localeCompare(b.name);
      });

      setAvailableVoices([googleVoice, ...formatted]);
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Save/load settings from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('livenova_tts_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.speed) setSpeed(parsed.speed);
        if (parsed.pitch) setPitch(parsed.pitch);
        if (parsed.voiceId) setSelectedVoiceId(parsed.voiceId);
      }
    } catch {
      // Ignore
    }
  }, []);

  const saveConfig = (newVoice: string, newSpeed: number, newPitch: number) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        'livenova_tts_config',
        JSON.stringify({ voiceId: newVoice, speed: newSpeed, pitch: newPitch }),
      );
    } catch {
      // Ignore
    }
  };

  const stopAllAudio = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    isProcessingQueue.current = false;
  };

  // ── Queue Processor ───────────────────────────────────────────────────
  const addToQueue = (text: string, type: TtsQueueItem['type'], sender?: string) => {
    const newItem: TtsQueueItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      text,
      type,
      sender,
      status: 'pending',
    };
    setQueue((prev) => [...prev, newItem]);
  };

  // Process queue sequentially
  useEffect(() => {
    const processNextInQueue = async () => {
      if (isProcessingQueue.current) return;

      const nextItem = queue.find((item) => item.status === 'pending');
      if (!nextItem) return;

      isProcessingQueue.current = true;
      setQueue((prev) =>
        prev.map((i) => (i.id === nextItem.id ? { ...i, status: 'playing' } : i)),
      );

      try {
        await playAudioItem(nextItem.text);
      } catch (err) {
        console.error('Failed to play queue item:', err);
      } finally {
        setQueue((prev) => prev.filter((i) => i.id !== nextItem.id));
        isProcessingQueue.current = false;
      }
    };

    void processNextInQueue();
  }, [queue]);

  const playAudioItem = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      const selected = availableVoices.find((v) => v.id === selectedVoiceId);
      if (selected?.isOnlineFallback || selectedVoiceId === 'google-vi') {
        // Straight to the API, so the request goes through the same auth guard,
        // length validation and throttle as every other TTS call. `rate` and
        // `pitch` are the field names the API's DTO expects.
        previewTts({ text, voice: selectedVoiceId, rate: speed, pitch })
          .then((data) => {
            if (!data.url) throw new Error('No audio URL');
            const audio = new Audio(data.url);
            audio.playbackRate = speed;
            audioRef.current = audio;

            audio.onplay = () => {
              setIsPlaying(true);
              setStatusMessage(`Đang đọc: "${text}"`);
            };
            audio.onended = () => {
              setIsPlaying(false);
              setStatusMessage(null);
              resolve();
            };
            audio.onerror = () => {
              setIsPlaying(false);
              resolve();
            };

            audio.play().catch(() => resolve());
          })
          .catch(() => resolve());
      } else {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
          resolve();
          return;
        }

        window.speechSynthesis.resume();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = speed;
        utterance.pitch = pitch;

        if (selected?.voiceObj) {
          utterance.voice = selected.voiceObj;
          utterance.lang = selected.voiceObj.lang;
        } else {
          utterance.lang = 'vi-VN';
        }

        utterance.onstart = () => {
          setIsPlaying(true);
          setStatusMessage(`Đang đọc: "${text}"`);
        };
        utterance.onend = () => {
          setIsPlaying(false);
          setStatusMessage(null);
          resolve();
        };
        utterance.onerror = () => {
          setIsPlaying(false);
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      }
    });
  };

  const handleTestSpeech = () => {
    if (isPlaying || queue.length > 0) {
      stopAllAudio();
      setQueue([]);
      setStatusMessage(null);
      return;
    }

    if (!testText.trim()) {
      setStatusMessage('Vui lòng nhập văn bản cần đọc.');
      return;
    }

    addToQueue(testText, 'test');
  };

  const handleSimulateGift = () => {
    addToQueue('Nguyễn Văn A vừa tặng 100 Hoa Hồng!', 'gift', 'Nguyễn Văn A');
  };

  const handleSimulateComment = () => {
    addToQueue('Minh Anh bình luận: Chúc kênh ngày càng phát triển nhé!', 'comment', 'Minh Anh');
  };

  const clearQueue = () => {
    stopAllAudio();
    setQueue([]);
    setStatusMessage(null);
  };

  return (
    <div>
      <h1 className="page-title">Giọng đọc</h1>
      <p style={{ color: 'hsl(var(--muted-foreground))', margin: '0.25rem 0 1.5rem' }}>
        Chọn giọng và cách đọc cho những câu LiveNova nói hộ bạn trên sóng.
      </p>

      {statusMessage && (
        <div
          style={{
            padding: '0.75rem 1rem',
            marginBottom: '1.5rem',
            borderRadius: 'var(--radius)',
            background: isPlaying ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)',
            border: `1px solid ${isPlaying ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)'}`,
            color: isPlaying ? '#22c55e' : '#eab308',
            fontSize: '0.9rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Icon name={isPlaying ? 'audio' : 'settings'} size={18} />
          {statusMessage}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '2rem',
          marginBottom: '2rem',
        }}
      >
        {/* Settings Card */}
        <div
          style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
          }}
        >
          <h2
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '1.25rem',
              fontWeight: 700,
              marginBottom: '1.5rem',
            }}
          >
            <Icon name="settings" size={20} style={{ color: 'hsl(var(--primary))' }} />
            Chọn giọng
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Giọng đọc
              </label>
              <select
                value={selectedVoiceId}
                onChange={(e) => {
                  setSelectedVoiceId(e.target.value);
                  saveConfig(e.target.value, speed, pitch);
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius)',
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  border: '1px solid hsl(var(--input))',
                }}
              >
                {availableVoices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {/* <option> renders text only, so the marker has to be a
                        character. A bracketed word beats an emoji: it is read
                        aloud correctly and does not depend on the platform's
                        emoji font. */}
                    {v.isOnlineFallback
                      ? '[Trực tuyến] '
                      : v.lang.toLowerCase().includes('vi')
                        ? '[Tiếng Việt] '
                        : ''}
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label htmlFor="tts-speed" style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                  Đọc nhanh hay chậm
                </label>
                {/* A word, not "1.4x". Nobody has an intuition for what 1.4x
                    of a synthetic voice sounds like. */}
                <span style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
                  {speed < 0.85 ? 'chậm rãi' : speed > 1.25 ? 'nhanh' : 'vừa phải'}
                </span>
              </div>
              <input
                id="tts-speed"
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={speed}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setSpeed(val);
                  saveConfig(selectedVoiceId, val, pitch);
                }}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label htmlFor="tts-pitch" style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                  Giọng cao hay trầm
                </label>
                <span style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
                  {pitch < 0.9 ? 'trầm' : pitch > 1.1 ? 'cao' : 'tự nhiên'}
                </span>
              </div>
              <input
                id="tts-pitch"
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={pitch}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setPitch(val);
                  saveConfig(selectedVoiceId, speed, val);
                }}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>

        {/* Test & Queue Card */}
        <div
          style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '1.25rem',
                fontWeight: 700,
                marginBottom: '1.5rem',
              }}
            >
              <Icon name="audio" size={20} style={{ color: 'hsl(var(--primary))' }} />
              Nghe thử
            </h2>
            <textarea
              rows={3}
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Nhập nội dung bạn muốn nghe thử..."
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: 'var(--radius)',
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                border: '1px solid hsl(var(--input))',
                marginBottom: '1rem',
                resize: 'none',
                fontFamily: 'inherit',
              }}
            />

            {/* Simulation Quick Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={handleSimulateGift}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  background: 'hsl(var(--muted))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
              >
                <Icon name="gift" size={16} />
                Giả lập tặng quà
              </button>
              <button
                type="button"
                onClick={handleSimulateComment}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  background: 'hsl(var(--muted))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
              >
                <Icon name="comment" size={16} />
                Giả lập bình luận
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestSpeech}
            className={`btn ${isPlaying || queue.length > 0 ? 'btn-secondary' : 'btn-primary'}`}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.85rem',
              fontWeight: 700,
            }}
          >
            <Icon name={isPlaying || queue.length > 0 ? 'stop' : 'play'} size={18} weight="fill" />
            {isPlaying || queue.length > 0 ? 'Dừng & Xóa hàng chờ' : 'Đưa vào Hàng chờ phát'}
          </button>
        </div>
      </div>

      {/* Queue Viewer */}
      <div
        style={{
          padding: '1.5rem',
          borderRadius: 'var(--radius-lg)',
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h2
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '1.1rem',
              fontWeight: 700,
              margin: 0,
            }}
          >
            <Icon name="queue" size={18} style={{ color: 'hsl(var(--primary))' }} />
            Đang chờ đọc ({queue.length})
          </h2>
          {queue.length > 0 && (
            <button
              type="button"
              onClick={clearQueue}
              style={{
                fontSize: '0.8rem',
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                cursor: 'pointer',
              }}
            >
              Xóa hàng chờ
            </button>
          )}
        </div>

        {queue.length === 0 ? (
          <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.9rem', margin: 0 }}>
            Hàng chờ hiện đang trống. Hãy thêm văn bản hoặc bấm nút giả lập để test đọc tuần tự.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {queue.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius)',
                  background: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', opacity: 0.6, fontWeight: 700 }}>#{idx + 1}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{item.text}</span>
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    background:
                      item.status === 'playing'
                        ? 'hsl(var(--accent-surface))'
                        : 'hsl(var(--muted))',
                    color:
                      item.status === 'playing'
                        ? 'hsl(var(--primary))'
                        : 'hsl(var(--muted-foreground))',
                  }}
                >
                  <Icon
                    name={item.status === 'playing' ? 'audio' : 'pending'}
                    size={13}
                    weight="fill"
                  />
                  {item.status === 'playing' ? 'Đang đọc' : 'Đang chờ'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
