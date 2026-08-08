'use client';

import React, { useState, useRef } from 'react';
import { Icon } from '../ui/Icon';
import { uploadImage, api } from '../../lib/api-client';

export interface RuleModalProps {
  rule?: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem',
  borderRadius: 'var(--radius)',
  border: '1px solid hsl(var(--input))',
  background: 'hsl(var(--background))',
  color: 'inherit',
  fontSize: '0.95rem',
  outline: 'none',
};

export function RuleModal({ rule, onClose, onSuccess }: RuleModalProps) {
  const isEditing = Boolean(rule?.id);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Basic Info
  const [name, setName] = useState(rule?.name || '');
  const [priority, setPriority] = useState<number>(rule?.priority ?? 1);
  const [cooldownSec, setCooldownSec] = useState<number>(rule?.cooldownMs ? Math.round(rule.cooldownMs / 1000) : 0);
  const [enabled, setEnabled] = useState<boolean>(rule?.enabled ?? true);
  const [continueMatching, setContinueMatching] = useState<boolean>(rule?.continueMatching ?? false);

  // Step 2: Conditions
  const [eventType, setEventType] = useState<string>(rule?.conditions?.eventType?.[0] || 'gift');
  const [giftName, setGiftName] = useState<string>(rule?.conditions?.giftName || '');
  const [minCoinValue, setMinCoinValue] = useState<string>(rule?.conditions?.minCoinValue !== undefined ? String(rule.conditions.minCoinValue) : '');
  const [maxCoinValue, setMaxCoinValue] = useState<string>(rule?.conditions?.maxCoinValue !== undefined ? String(rule.conditions.maxCoinValue) : '');
  const [keywords, setKeywords] = useState<string>(rule?.conditions?.keywords ? rule.conditions.keywords.join(', ') : '');

  // Step 3: Actions Pipeline
  const defaultActions = rule?.actions || [
    {
      type: 'media_popup',
      payload: {
        mediaType: 'image',
        url: '',
        durationMs: 5000,
        position: 'center',
        caption: 'Cảm ơn {sender} đã tặng {gift}!',
        volume: 0.8,
      },
    },
  ];
  const [actions, setActions] = useState<any[]>(defaultActions);
  const [uploadingActionIdx, setUploadingActionIdx] = useState<number | null>(null);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  async function handleFileUpload(actionIndex: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingActionIdx(actionIndex);
    setError(null);

    try {
      const res = await uploadImage(file);
      const newActions = [...actions];
      newActions[actionIndex].payload.url = res.url;
      // Auto-detect media type
      if (file.type.startsWith('video/')) {
        newActions[actionIndex].payload.mediaType = 'video';
      } else {
        newActions[actionIndex].payload.mediaType = 'image';
      }
      setActions(newActions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải tệp media lên thất bại');
    } finally {
      setUploadingActionIdx(null);
    }
  }

  function addAction() {
    setActions((prev) => [
      ...prev,
      {
        type: 'tts_read',
        payload: {
          text: 'Cảm ơn {sender} đã tương tác livestream!',
        },
      },
    ]);
  }

  function removeAction(index: number) {
    if (actions.length <= 1) return;
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateActionType(index: number, type: string) {
    const newActions = [...actions];
    newActions[index].type = type;
    if (type === 'media_popup') {
      newActions[index].payload = {
        mediaType: 'image',
        url: '',
        durationMs: 5000,
        position: 'center',
        caption: 'Cảm ơn {sender}!',
      };
    } else if (type === 'tts_read') {
      newActions[index].payload = { text: 'Cảm ơn {sender}!' };
    }
    setActions(newActions);
  }

  function updateActionPayload(index: number, field: string, value: any) {
    const newActions = [...actions];
    newActions[index].payload = { ...newActions[index].payload, [field]: value };
    setActions(newActions);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Vui lòng nhập tên luật');
      setStep(1);
      return;
    }

    const formattedConditions: any = {
      eventType: [eventType],
    };

    if (eventType === 'gift') {
      if (giftName.trim()) formattedConditions.giftName = giftName.trim();
      if (minCoinValue) formattedConditions.minCoinValue = parseInt(minCoinValue, 10);
      if (maxCoinValue) formattedConditions.maxCoinValue = parseInt(maxCoinValue, 10);
    } else if (eventType === 'comment') {
      if (keywords.trim()) {
        formattedConditions.keywords = keywords.split(',').map((k) => k.trim()).filter(Boolean);
      }
    }

    const payload = {
      name,
      priority: Number(priority),
      cooldownMs: Number(cooldownSec) * 1000,
      enabled,
      continueMatching,
      conditions: formattedConditions,
      actions,
    };

    setSubmitting(true);
    try {
      if (isEditing) {
        await api.patch(`/rules/${rule.id}`, payload);
      } else {
        await api.post('/rules', payload);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu luật thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'hsl(20 8% 11% / 0.45)',
        backdropFilter: 'blur(8px)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid hsl(var(--border))',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid hsl(var(--border))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Icon name="goal" size={22} />
            {isEditing ? 'Chỉnh sửa Luật Tự động' : 'Tạo Luật Tự động Mới'}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'hsl(var(--muted-foreground))', fontSize: '1.5rem', cursor: 'pointer' }}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Wizard Step Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--muted))' }}>
          {[
            { num: 1, label: '1. Thông tin' },
            { num: 2, label: '2. Điều kiện' },
            { num: 3, label: '3. Hành động' },
          ].map((tab) => (
            <button
              key={tab.num}
              type="button"
              onClick={() => setStep(tab.num as any)}
              style={{
                flex: 1,
                padding: '0.85rem',
                border: 'none',
                background: step === tab.num ? 'hsl(var(--primary) / 0.15)' : 'transparent',
                color: step === tab.num ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                fontWeight: step === tab.num ? 700 : 500,
                borderBottom: step === tab.num ? '2px solid hsl(var(--primary))' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {error && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius)',
                background: 'hsl(var(--destructive) / 0.08)',
                border: '1px solid hsl(var(--destructive) / 0.3)',
                color: 'hsl(var(--destructive))',
                marginBottom: '1.25rem',
                fontSize: '0.9rem',
              }}
            >
              {error}
            </div>
          )}

          {/* STEP 1: Basic Info */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Tên luật kích hoạt</label>
                <input
                  type="text"
                  placeholder="VD: Kích hoạt Popup Video khi tặng Hoa Hồng"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Thứ tự ưu tiên (Priority)</label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
                    style={inputStyle}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Số nhỏ hơn xét trước</span>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Thời gian giãn cách (Cooldown)</label>
                  <input
                    type="number"
                    min={0}
                    max={3600}
                    value={cooldownSec}
                    onChange={(e) => setCooldownSec(parseInt(e.target.value, 10) || 0)}
                    style={inputStyle}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Thời gian chờ giữa 2 lần kích hoạt (giây)</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    style={{ width: '1.1rem', height: '1.1rem', accentColor: 'hsl(var(--primary))' }}
                  />
                  <span style={{ fontWeight: 600 }}>Bật kích hoạt luật ngay</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={continueMatching}
                    onChange={(e) => setContinueMatching(e.target.checked)}
                    style={{ width: '1.1rem', height: '1.1rem', accentColor: 'hsl(var(--primary))' }}
                  />
                  <span>Cho phép khớp tiếp luật sau</span>
                </label>
              </div>
            </div>
          )}

          {/* STEP 2: Trigger Conditions */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Sự kiện kích hoạt (Event Type)</label>
                <select value={eventType} onChange={(e) => setEventType(e.target.value)} style={{ ...inputStyle, background: '#18181b' }}>
                  <option value="gift">Quà tặng (Gift)</option>
                  <option value="comment">Bình luận (Comment)</option>
                  <option value="like">Thả tim (Like Milestone)</option>
                  <option value="follow">Theo dõi mới (Follow)</option>
                  <option value="share">Chia sẻ stream (Share)</option>
                  <option value="join">Người xem vào phòng (Join)</option>
                </select>
              </div>

              {eventType === 'gift' && (
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))' }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>Tên quà tặng chính xác (Tùy chọn)</label>
                    <input
                      type="text"
                      placeholder="VD: Rose, Dragon, TikTok, Leon (Để trống nếu áp dụng cho mọi quà)"
                      value={giftName}
                      onChange={(e) => setGiftName(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>Giá trị Xu tối thiểu (Min Coins)</label>
                      <input
                        type="number"
                        placeholder="VD: 1"
                        value={minCoinValue}
                        onChange={(e) => setMinCoinValue(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>Giá trị Xu tối đa (Max Coins)</label>
                      <input
                        type="number"
                        placeholder="VD: 9999"
                        value={maxCoinValue}
                        onChange={(e) => setMaxCoinValue(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>
              )}

              {eventType === 'comment' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Từ khóa bình luận (Phân cách bằng dấu phẩy)</label>
                  <input
                    type="text"
                    placeholder="VD: chao, hi, choigame, muaw"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    style={inputStyle}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Nếu viewer comment có chứa từ khóa này, luật sẽ kích hoạt</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Action Pipeline */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Danh sách hành động ({actions.length})</span>
                <button
                  type="button"
                  onClick={addAction}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: 'var(--radius)',
                    background: 'hsl(var(--primary) / 0.15)',
                    color: 'hsl(var(--primary))',
                    border: '1px solid hsl(var(--primary) / 0.3)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  + Thêm hành động
                </button>
              </div>

              {actions.map((act, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'hsl(var(--background))',
                    padding: '1.25rem',
                    borderRadius: 'var(--radius)',
                    border: '1px solid hsl(var(--border))',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'hsl(var(--primary))' }}>Hành động #{idx + 1}</span>
                    {actions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAction(idx)}
                        style={{ background: 'none', border: 'none', color: 'hsl(var(--destructive))', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        Xóa
                      </button>
                    )}
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem' }}>Loại hành động</label>
                    <select
                      value={act.type}
                      onChange={(e) => updateActionType(idx, e.target.value)}
                      style={{ ...inputStyle, background: '#18181b', padding: '0.5rem' }}
                    >
                      <option value="media_popup">Video / Ảnh Popup trên OBS Overlay</option>
                      <option value="tts_read">Đọc giọng nói TTS (Text-to-Speech)</option>
                    </select>
                  </div>

                  {act.type === 'media_popup' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {/* Media Upload & URL */}
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem' }}>Tệp Video / Ảnh (Upload lên Cloudinary hoặc dán Link)</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            type="text"
                            placeholder="https://res.cloudinary.com/.../video.mp4"
                            value={act.payload.url || ''}
                            onChange={(e) => updateActionPayload(idx, 'url', e.target.value)}
                            style={{ ...inputStyle, flex: 1 }}
                          />
                          <input
                            ref={(el) => { fileInputRefs.current[idx] = el; }}
                            type="file"
                            accept="image/*,video/*"
                            onChange={(e) => handleFileUpload(idx, e)}
                            style={{ display: 'none' }}
                          />
                          <button
                            type="button"
                            disabled={uploadingActionIdx === idx}
                            onClick={() => fileInputRefs.current[idx]?.click()}
                            style={{
                              padding: '0.5rem 0.85rem',
                              borderRadius: 'var(--radius)',
                              background: 'hsl(var(--primary))',
                              color: '#fff',
                              border: 'none',
                              fontWeight: 600,
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {uploadingActionIdx === idx ? 'Đang tải...' : 'Upload Cloudinary'}
                          </button>
                        </div>
                      </div>

                      {/* Display Settings */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.8rem' }}>Vị trí hiển thị</label>
                          <select
                            value={act.payload.position || 'center'}
                            onChange={(e) => updateActionPayload(idx, 'position', e.target.value)}
                            style={{ ...inputStyle, background: '#18181b', padding: '0.5rem', fontSize: '0.85rem' }}
                          >
                            <option value="center">Giữa màn hình (Center)</option>
                            <option value="top">Phía trên (Top)</option>
                            <option value="bottom">Phía dưới (Bottom)</option>
                            <option value="top-left">Góc trên trái</option>
                            <option value="top-right">Góc trên phải</option>
                            <option value="bottom-left">Góc dưới trái</option>
                            <option value="bottom-right">Góc dưới phải</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.8rem' }}>Thời gian (Giây)</label>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={act.payload.durationMs ? act.payload.durationMs / 1000 : 5}
                            onChange={(e) => updateActionPayload(idx, 'durationMs', parseInt(e.target.value, 10) * 1000)}
                            style={{ ...inputStyle, padding: '0.5rem', fontSize: '0.85rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.8rem' }}>Âm lượng (0 - 100%)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={act.payload.volume !== undefined ? Math.round(act.payload.volume * 100) : 80}
                            onChange={(e) => updateActionPayload(idx, 'volume', parseInt(e.target.value, 10) / 100)}
                            style={{ ...inputStyle, padding: '0.5rem', fontSize: '0.85rem' }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.8rem' }}>Chú thích Caption (Hỗ trợ &#123;sender&#125;, &#123;gift&#125;, &#123;coins&#125;)</label>
                        <input
                          type="text"
                          placeholder="VD: Cảm ơn {sender} đã tặng {gift} ({coins} Xu)!"
                          value={act.payload.caption || ''}
                          onChange={(e) => updateActionPayload(idx, 'caption', e.target.value)}
                          style={{ ...inputStyle, fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>
                  )}

                  {act.type === 'tts_read' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem' }}>Nội dung đọc (Hỗ trợ &#123;sender&#125;, &#123;gift&#125;, &#123;coins&#125;)</label>
                      <input
                        type="text"
                        placeholder="VD: Cảm ơn bạn {sender} đã ủng hộ livestream!"
                        value={act.payload.text || ''}
                        onChange={(e) => updateActionPayload(idx, 'text', e.target.value)}
                        style={{ ...inputStyle, fontSize: '0.85rem' }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Footer Actions */}
          <div
            style={{
              marginTop: '1.75rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '1rem',
              borderTop: '1px solid var(--glass-border)',
            }}
          >
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as any)}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: 'var(--radius)',
                  background: 'rgba(255,255,255,0.08)',
                  color: 'inherit',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ← Quay lại
              </button>
            ) : <div />}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s + 1) as any)}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: 'var(--radius)',
                    background: 'hsl(var(--primary))',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Tiếp theo →
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '0.65rem 1.5rem',
                    borderRadius: 'var(--radius)',
                    background: 'hsl(var(--primary))',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? 'Đang lưu...' : isEditing ? 'Cập nhật Luật' : 'Tạo Luật Mới'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
