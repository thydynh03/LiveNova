'use client';

import { Suspense } from 'react';
import { BattleOverlayContent } from '../../../components/battle/BattleOverlayContent';

export default function BattleOverlayPage() {
  return (
    <Suspense
      fallback={<div style={{ color: '#fff', padding: '1rem' }}>Đang khởi tạo Đấu trường 4 Vương quốc...</div>}
    >
      <BattleOverlayContent />
    </Suspense>
  );
}
