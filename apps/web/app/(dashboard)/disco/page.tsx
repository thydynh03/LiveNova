'use client';

import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Tabs, TabPanel, type TabItem } from '../../../components/ui/primitives';
import { useDiscoController } from '../../../components/disco/use-disco-controller';
import { StagePreview } from '../../../components/disco/panels/StagePreview';
import { MediaPanel } from '../../../components/disco/panels/MediaPanel';
import { DirectorPanel } from '../../../components/disco/panels/DirectorPanel';
import { SimulatorPanel } from '../../../components/disco/panels/SimulatorPanel';
import { OutputPanel } from '../../../components/disco/panels/OutputPanel';
import { CommandCheatSheet } from '../../../components/disco/panels/CommandCheatSheet';

/**
 * Màn hình Sàn Nhảy.
 *
 * Trước đây là một file 1932 dòng cuộn dọc vô tận, trộn lẫn sân khấu 3D, cấu
 * hình media, bộ chạy kịch bản và khu kiểm thử trong một cột duy nhất — streamer
 * đang live phải cuộn qua khu kiểm thử để tới thứ mình cần.
 *
 * Giờ file này chỉ còn bố cục: sân khấu dính bên trái, panel điều khiển theo tab
 * bên phải. Toàn bộ logic ở `use-disco-controller`, từng khu ở `panels/`.
 */

const TABS: TabItem[] = [
  { id: 'media', label: 'Nhạc & màn hình' },
  { id: 'director', label: 'Máy quay & hiệu ứng' },
  { id: 'output', label: 'Phát sóng' },
  { id: 'guide', label: 'Bảng lệnh' },
  // Kiểm thử đứng cuối, tách khỏi luồng vận hành để không bấm nhầm khi đang live.
  { id: 'test', label: 'Kiểm thử' },
];

export default function DiscoPage() {
  const { user } = useAuth();
  const controller = useDiscoController();
  const [tab, setTab] = useState('media');

  if (!user) {
    return <p style={{ padding: '2rem' }}>Vui lòng đăng nhập để dùng Sàn Nhảy.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <header>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Sàn Nhảy</h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
          Khán giả gõ lệnh trong chat để vào sàn, tặng quà để lên bục vinh danh.
        </p>
      </header>

      {/*
        Hai cột trên màn rộng, một cột dưới 1024px.
        `minmax(0, …)` chứ không phải `1fr` trần: nếu không, nội dung rộng trong
        cột phải (bảng lệnh, nhật ký) sẽ đẩy cả lưới tràn ngang.
      */}
      <div
        style={{
          display: 'grid',
          gap: '1.25rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))',
          alignItems: 'start',
        }}
      >
        <StagePreview c={controller} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
          <Tabs items={TABS} value={tab} onChange={setTab} label="Khu điều khiển sàn nhảy" />

          <TabPanel id="media" value={tab}>
            <MediaPanel c={controller} />
          </TabPanel>
          <TabPanel id="director" value={tab}>
            <DirectorPanel c={controller} />
          </TabPanel>
          <TabPanel id="output" value={tab}>
            <OutputPanel c={controller} />
          </TabPanel>
          <TabPanel id="guide" value={tab}>
            <CommandCheatSheet />
          </TabPanel>
          <TabPanel id="test" value={tab}>
            <SimulatorPanel c={controller} />
          </TabPanel>
        </div>
      </div>
    </div>
  );
}
