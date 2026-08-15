'use client';

import React from 'react';
import { Icon } from '../../ui/Icon';
import { Badge, Button, Card, Field, Input, Switch } from '../../ui/primitives';
import { VIDEO_PRESETS, MUSIC_PRESETS, type DiscoController } from '../use-disco-controller';

/** Một hàng nút chọn nhanh, đánh dấu cái đang dùng. */
function PresetRow({
  label,
  presets,
  active,
  onPick,
}: {
  label: string;
  presets: readonly { label: string; url: string }[];
  active: string;
  onPick: (url: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{label}</span>
      {presets.map((p) => (
        <Button
          key={p.label}
          size="sm"
          variant={active === p.url ? 'primary' : 'secondary'}
          onClick={() => onPick(p.url)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}

/** Video nền màn LED, nhạc sàn, và độ mờ màn hình. */
export function MediaPanel({ c }: { c: DiscoController }) {
  const onVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) c.setVideo(URL.createObjectURL(file));
  };

  const onMusicFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const title = file.name.replace(/\.[^/.]+$/, '');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) c.setMusic(dataUrl, title);
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <Card
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Icon name="preview" size={18} /> Màn hình LED sân khấu
          </span>
        }
      >
        <Field
          label="Đường dẫn video"
          hint="Nhận MP4, WebM, GIF hoặc link YouTube. Để trống thì dùng visualizer dựng sẵn."
        >
          {(props) => (
            <Input
              {...props}
              value={c.djVideoUrl}
              onChange={(e) => c.setVideo(e.target.value)}
              placeholder="https://…"
            />
          )}
        </Field>

        <PresetRow label="Mẫu:" presets={VIDEO_PRESETS} active={c.djVideoUrl} onPick={c.setVideo} />

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Nút tải lên là một <label> bọc input ẩn: input file mặc định
              không thể tạo kiểu, còn cách này giữ được thao tác bàn phím. */}
          <label>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                minHeight: 34,
                padding: '0.3rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--secondary))',
                color: 'hsl(var(--secondary-foreground))',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Icon name="plus" size={14} /> Tải video lên
            </span>
            <input
              type="file"
              accept="video/mp4,video/webm,video/*,image/gif"
              onChange={onVideoFile}
              style={{ display: 'none' }}
            />
          </label>

          <Button size="sm" variant="ghost" onClick={() => c.setVideo('')}>
            Về mặc định
          </Button>
        </div>

        <Switch
          checked={!c.isDjVideoMuted}
          onChange={(on) => c.setMuted(!on)}
          label="Phát tiếng của video"
          hint="Bật khi dùng video YouTube làm nhạc nền thay cho trình phát bên dưới."
        />

        <Field
          label={`Độ mờ màn LED — ${Math.round(c.ledDim * 100)}%`}
          hint="Video phát hết độ sáng làm nhân vật phía trước bị chìm. Lớp tối mỏng kéo video lùi lại."
        >
          {(props) => (
            <input
              {...props}
              type="range"
              min={0}
              max={0.6}
              step={0.02}
              value={c.ledDim}
              onChange={(e) => c.setDim(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'hsl(var(--primary))' }}
            />
          )}
        </Field>
      </Card>

      <Card
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Icon name="audio" size={18} /> Nhạc sàn
          </span>
        }
        actions={c.trackTitle ? <Badge tone="accent">{c.trackTitle}</Badge> : null}
      >
        <Field label="Đường dẫn nhạc" hint="Link MP3 trực tiếp, hoặc tải tệp từ máy lên.">
          {(props) => (
            <Input
              {...props}
              value={c.musicUrl}
              onChange={(e) => c.setMusic(e.target.value, c.trackTitle)}
              placeholder="https://…"
            />
          )}
        </Field>

        <PresetRow
          label="Mẫu:"
          presets={MUSIC_PRESETS}
          active={c.musicUrl}
          onPick={(url) => {
            const preset = MUSIC_PRESETS.find((p) => p.url === url);
            c.setMusic(url, preset?.label ?? 'Nhạc sàn');
          }}
        />

        <label>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              minHeight: 34,
              padding: '0.3rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--secondary))',
              color: 'hsl(var(--secondary-foreground))',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Icon name="plus" size={14} /> Tải nhạc lên
          </span>
          <input type="file" accept="audio/*" onChange={onMusicFile} style={{ display: 'none' }} />
        </label>
      </Card>
    </>
  );
}
