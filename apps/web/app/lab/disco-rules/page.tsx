'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { LiveEventType, interpretDiscoEvent, interpretGift } from '@livenova/shared';
import { DiscoEngine, DJ_LIVENOVA_ID } from '../../../components/disco/disco-engine';
import { applyDiscoAction } from '../../../components/disco/apply-disco-action';
import DiscoStageView from '../../../components/disco/DiscoStageView';

/**
 * Bàn thử nghiệp vụ sàn nhảy.
 *
 * Chạy đúng bộ luật và đúng engine mà buổi live dùng, rồi công bố kết quả qua
 * `data-report` để script bằng chứng đọc được. Đây là chỗ khẳng định những điều
 * mà ảnh chụp không nói được: ai đang ngồi ghế DJ, ai đứng ô nào trên bục.
 *
 * Không nằm trong điều hướng — đây là trang kiểm thử, không phải tính năng.
 */
export default function DiscoRulesLabPage() {
  const engine = useMemo(() => new DiscoEngine(), []);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const fire = (event: Parameters<typeof interpretDiscoEvent>[0]) => {
      const action = interpretDiscoEvent(event);
      if (action) applyDiscoAction(engine, action, { speak: false });
      return action;
    };

    // Ba khán giả vào sàn bằng lệnh, rồi một người tặng quà lớn.
    fire({ type: LiveEventType.COMMENT, senderUsername: 'khach_a', senderDisplayName: 'Khách A', content: 'hey' });
    fire({ type: LiveEventType.COMMENT, senderUsername: 'khach_b', senderDisplayName: 'Khách B', content: '1' });
    fire({ type: LiveEventType.COMMENT, senderUsername: 'khach_c', senderDisplayName: 'Khách C', content: 'vào nhảy' });

    fire({ type: LiveEventType.GIFT, senderUsername: 'khach_a', senderDisplayName: 'Khách A', giftName: 'Hoa Hồng', giftCoinValue: 1 });
    fire({ type: LiveEventType.GIFT, senderUsername: 'khach_b', senderDisplayName: 'Khách B', giftName: 'Rosa', giftCoinValue: 20 });

    // Quà lớn nhất: trước đây lệnh này chiếm luôn ghế DJ.
    fire({ type: LiveEventType.GIFT, senderUsername: 'dai_gia', senderDisplayName: 'Đại Gia', giftName: 'Pháo Hoa Giấy', giftCoinValue: 500 });

    const podium = engine.getPodiumDancers();
    const bigGifter = engine.dancers.get('dai_gia');

    setReport({
      djAfterBigGift: engine.currentDjId,
      bigGifterIsDj: Boolean(bigGifter?.isDj),
      podiumAfterBigGift: podium.map((d) => d.id),
      podiumPoints: podium.map((d) => d.points),
      podiumSize: podium.length,
      djOnPodium: podium.some((d) => d.id === DJ_LIVENOVA_ID),
      totalDancers: engine.dancers.size,

      // Hai lỗi chồng lấn ngưỡng xu mà bản audit nêu.
      rosaExpensive: interpretGift('Rosa', 500).effect,
      sodaOneCoin: interpretGift('Nước Ngọt', 1).effect,

      heyCommand: interpretDiscoEvent({
        type: LiveEventType.COMMENT, senderUsername: 'x', senderDisplayName: 'X', content: 'hey',
      })?.kind ?? null,
      chatterCommand: interpretDiscoEvent({
        type: LiveEventType.COMMENT, senderUsername: 'x', senderDisplayName: 'X', content: 'stream hay quá ad ơi',
      })?.kind ?? null,
    });
  }, [engine]);

  if (!report) return <p style={{ padding: '2rem' }}>Đang chạy kịch bản…</p>;

  return (
    <main style={{ padding: '1.5rem', fontFamily: 'monospace', background: '#0b0a12', color: '#e6e6f0', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '1.25rem', marginTop: 0 }}>Kết quả nghiệp vụ sàn nhảy</h1>

      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div data-testid="rules-report" data-report={JSON.stringify(report)}>
          <table style={{ borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <tbody>
              {Object.entries(report).map(([key, value]) => (
                <tr key={key}>
                  <td style={{ padding: '0.3rem 1rem 0.3rem 0', color: '#8f8fae', verticalAlign: 'top' }}>{key}</td>
                  <td style={{ padding: '0.3rem 0', color: '#7dffb0' }}>{JSON.stringify(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sân khấu thật sau khi kịch bản chạy — để nhìn thấy ai đứng ô nào. */}
        <div
          data-testid="lab-stage"
          style={{ width: 360, height: 640, border: '1px solid #2a2740', borderRadius: 8, overflow: 'hidden', flex: 'none' }}
        >
          <DiscoStageView engine={engine} enableAudio={false} />
        </div>
      </div>
    </main>
  );
}
