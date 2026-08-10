'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
  describeCommercialUse,
  isCommercialUseAllowed,
  parseVrmMeta,
  type VrmModelMeta,
} from '@livenova/shared';
import { api, uploadVrmModel } from '../../lib/api-client';
import { isUsingLocalDevModel, resolveVrmModelUrl } from '../../lib/vrm/model';
import { Panel, StatusPill } from './AdminShell';

/**
 * Chọn và tải lên mô hình VRM cho nhân vật sân khấu.
 *
 * Kiểm tra giấy phép chạy hai lần, và đó là chủ ý: ở trình duyệt để người dùng
 * biết ngay trước khi ngồi chờ tải lên 20MB, và ở máy chủ vì đó mới là nơi tin
 * được — bất kỳ ai cũng gọi thẳng được endpoint mà không đi qua trang này.
 */

const LABEL: React.CSSProperties = {
  fontSize: '0.82rem',
  fontWeight: 600,
  color: 'hsl(var(--foreground))',
};

const VALUE: React.CSSProperties = {
  fontSize: '0.78rem',
  color: 'hsl(var(--muted-foreground))',
  lineHeight: 1.5,
};

/**
 * Chỉ đọc phần đầu tệp.
 *
 * Siêu dữ liệu nằm trong chunk JSON ngay sau header GLB, nên không có lý do gì
 * nạp cả 20MB vào bộ nhớ trình duyệt chỉ để đọc tên tác giả.
 */
const HEAD_BYTES = 2 * 1024 * 1024;

interface OverlaySummary {
  id: string;
  type: string;
  config?: Record<string, unknown> | null;
}

interface Props {
  /** URL đang dùng cho khung xem của studio. */
  modelUrl: string;
  onModelUrlChange: (url: string) => void;
  onNote: (message: string) => void;
}

export function VrmModelPanel({ modelUrl, onModelUrlChange, onNote }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [meta, setMeta] = useState<VrmModelMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishState, setPublishState] = useState<'idle' | 'saving' | 'done'>('idle');

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setMeta(null);
      setPublishState('idle');
      setBusy(true);
      try {
        setProgressLabel('Đang đọc giấy phép trong tệp…');
        const head = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
        const parsed = parseVrmMeta(head);

        if (!parsed.ok) {
          setError('Tệp này không phải mô hình VRM hợp lệ. Hãy chọn tệp .vrm.');
          return;
        }
        if (!isCommercialUseAllowed(parsed.meta)) {
          // Chặn tại đây để người dùng không phải chờ tải lên rồi mới bị từ chối.
          setMeta(parsed.meta);
          setError(
            `Không dùng được mô hình "${parsed.meta.name}": ${describeCommercialUse(
              parsed.meta.commercialUse,
            )}.`,
          );
          return;
        }

        setProgressLabel(`Đang tải lên ${(file.size / 1024 / 1024).toFixed(1)}MB…`);
        const result = await uploadVrmModel(file);
        setMeta(result.meta);
        onModelUrlChange(result.url);
        onNote(`Đã tải lên “${result.meta.name}”`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải mô hình lên thất bại');
      } finally {
        setBusy(false);
        setProgressLabel(null);
      }
    },
    [onModelUrlChange, onNote],
  );

  /**
   * Ghi URL vào cấu hình của overlay STAGE.
   *
   * Đây là bước biến "xem thử trong studio" thành "phát trên sóng". Overlay đọc
   * cấu hình của chính nó qua token công khai, nên không cần thêm endpoint nào.
   */
  const publishToStage = useCallback(async () => {
    setPublishState('saving');
    setError(null);
    try {
      const overlays = await api.get<OverlaySummary[]>('/overlays');
      const stage = overlays.find((o) => o.type === 'STAGE');
      if (!stage) {
        setError(
          'Chưa có overlay Sân khấu (STAGE). Hãy tạo overlay đó trước, rồi dán URL của nó vào OBS.',
        );
        setPublishState('idle');
        return;
      }

      await api.patch(`/overlays/${stage.id}/config`, {
        config: { ...(stage.config ?? {}), vrmModelUrl: modelUrl },
      });
      setPublishState('done');
      onNote('Sân khấu phát sóng đã dùng mô hình này');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được vào overlay Sân khấu');
      setPublishState('idle');
    }
  }, [modelUrl, onNote]);

  const usingDevModel = isUsingLocalDevModel() && modelUrl === resolveVrmModelUrl();

  return (
    <Panel
      title="Mô hình nhân vật"
      subtitle="Tệp .vrm quyết định nhân vật nào xuất hiện trên sân khấu."
    >
      {usingDevModel && (
        <div style={{ ...VALUE, padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'hsl(var(--secondary) / 0.5)' }}>
          Đang dùng mô hình đo thử của môi trường phát triển. Mô hình đó không có trên bản phát hành và
          giấy phép của nó cấm dùng thương mại — hãy tải lên mô hình của bạn.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <span style={LABEL}>Đang dùng</span>
        <span
          style={{
            ...VALUE,
            fontFamily: 'var(--font-mono), monospace',
            wordBreak: 'break-all',
            fontSize: '0.72rem',
          }}
        >
          {modelUrl}
        </span>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".vrm,application/octet-stream"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />

      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        style={{ width: '100%' }}
      >
        {busy ? progressLabel ?? 'Đang xử lý…' : 'Tải lên tệp .vrm'}
      </button>

      {error && (
        <div
          style={{
            ...VALUE,
            color: 'hsl(var(--destructive))',
            padding: '0.6rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            background: 'hsl(var(--destructive) / 0.08)',
            border: '1px solid hsl(var(--destructive) / 0.3)',
          }}
        >
          {error}
        </div>
      )}

      {meta && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={LABEL}>{meta.name}</span>
            <StatusPill tone={isCommercialUseAllowed(meta) ? 'good' : 'bad'}>
              {isCommercialUseAllowed(meta) ? 'Dùng thương mại được' : 'Không dùng thương mại được'}
            </StatusPill>
            <span style={{ ...VALUE, fontSize: '0.72rem' }}>VRM {meta.specVersion}</span>
          </div>

          <div style={VALUE}>Tác giả: {meta.authors.join(', ') || 'không ghi'}</div>

          {/*
            Ràng buộc giấy phép hiển thị ngay cạnh mô hình chứ không giấu trong
            tài liệu: người bật nhân vật lên sóng là người phải tuân thủ chúng,
            và họ đang đứng ở đúng màn hình này.
          */}
          {meta.creditRequired && (
            <div style={{ ...VALUE, color: 'hsl(var(--warning))' }}>
              Giấy phép yêu cầu ghi công — hãy hiển thị tên tác giả ở nơi khán giả thấy được.
            </div>
          )}
          {!meta.allowRedistribution && (
            <div style={VALUE}>Không được phát tán lại tệp mô hình cho người khác.</div>
          )}
          {!meta.allowModification && <div style={VALUE}>Không được chỉnh sửa mô hình.</div>}
          {meta.licenseUrl && (
            <a
              href={meta.licenseUrl}
              target="_blank"
              rel="noreferrer noopener"
              style={{ ...VALUE, color: 'hsl(var(--primary))', textDecoration: 'underline' }}
            >
              Đọc toàn văn giấy phép
            </a>
          )}
        </div>
      )}

      <button
        type="button"
        className="btn btn-secondary"
        disabled={busy || publishState === 'saving'}
        onClick={() => void publishToStage()}
        style={{ width: '100%', fontSize: '0.82rem' }}
      >
        {publishState === 'saving'
          ? 'Đang lưu…'
          : publishState === 'done'
          ? 'Đã áp dụng cho sân khấu phát sóng'
          : 'Dùng mô hình này cho sân khấu phát sóng'}
      </button>
    </Panel>
  );
}
