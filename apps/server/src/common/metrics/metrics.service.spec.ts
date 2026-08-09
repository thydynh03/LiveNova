import { MetricsService } from './metrics.service';
import { resetEnvCache } from '../config/env';

describe('MetricsService', () => {
  let metrics: MetricsService;

  beforeEach(() => {
    resetEnvCache();
    process.env.JWT_SECRET = 'x'.repeat(40);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(40);
    process.env.INSTANCE_ID = 'test-instance';
    resetEnvCache();
    metrics = new MetricsService();
  });

  it('exposes the four numbers a frozen overlay is diagnosed with', () => {
    const out = metrics.render();
    expect(out).toContain('livenova_battles_active');
    expect(out).toContain('livenova_overlay_sockets');
    expect(out).toContain('livenova_battle_flush_failures_total');
    expect(out).toContain('livenova_gift_to_broadcast_ms_bucket');
  });

  it('labels every series with the instance, so a fleet stays readable', () => {
    metrics.setActiveBattles(3);
    expect(metrics.render()).toContain('livenova_battles_active{instance="test-instance"} 3');
  });

  it('never lets the socket gauge go negative', () => {
    // A handshake rejected before the connect hook still fires a disconnect.
    // Left unclamped this drifts below zero and the gauge stops meaning
    // anything — which is worse than not having it.
    metrics.socketDisconnected();
    metrics.socketDisconnected();
    metrics.socketConnected();

    expect(metrics.render()).toContain('livenova_overlay_sockets{instance="test-instance"} 1');
  });

  it('counts failed flushes separately from attempts', () => {
    metrics.recordFlush(true);
    metrics.recordFlush(false);
    metrics.recordFlush(true);

    const out = metrics.render();
    expect(out).toContain('livenova_battle_flush_total{instance="test-instance"} 3');
    expect(out).toContain('livenova_battle_flush_failures_total{instance="test-instance"} 1');
  });

  it('accumulates latency buckets cumulatively, as Prometheus requires', () => {
    metrics.recordGiftLatency(8);
    metrics.recordGiftLatency(40);
    metrics.recordGiftLatency(9000);

    const out = metrics.render();
    // A histogram bucket is "how many were <= le", not "how many landed here".
    // Emitting per-bucket counts renders a broken histogram that still scrapes.
    expect(out).toContain('le="10"} 1');
    expect(out).toContain('le="50"} 2');
    expect(out).toContain('le="5000"} 2');
    expect(out).toContain('le="+Inf"} 3');
    expect(out).toContain('livenova_gift_to_broadcast_ms_count{instance="test-instance"} 3');
  });

  it('ignores a nonsense latency rather than poisoning the sum', () => {
    metrics.recordGiftLatency(Number.NaN);
    metrics.recordGiftLatency(-5);

    expect(metrics.render()).toContain('livenova_gift_to_broadcast_ms_count{instance="test-instance"} 0');
  });
});
