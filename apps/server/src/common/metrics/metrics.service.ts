import { Injectable } from '@nestjs/common';
import { loadEnv } from '../config/env';

/**
 * The four numbers you need when a streamer says "the overlay froze".
 *
 * Today the only answer to that question is to read Nest's logs by hand, which
 * during a live broadcast is not an answer. These are chosen to separate the
 * three places it can actually break:
 *
 * - `battles_active` — is the round even running on this instance, or did
 *   ownership move somewhere else?
 * - `gift_to_broadcast_ms` — did the gift arrive and get turned into a state
 *   push, and how long did that take?
 * - `flush_failures` — is Postgres refusing the writes, so the score on screen
 *   will vanish on the next restart?
 * - `overlay_sockets` — is anything actually connected to receive the push?
 *
 * A frozen overlay with a healthy latency figure and zero connected sockets is
 * a different bug from a frozen overlay with sockets and no latency samples.
 * Without these you cannot tell them apart.
 *
 * Deliberately hand-rolled in Prometheus text format rather than pulling in
 * `prom-client`: four series do not justify a dependency, and the exposition
 * format is a dozen lines of string building.
 */

/** Bucket edges in milliseconds for the gift-to-broadcast histogram. */
const LATENCY_BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

@Injectable()
export class MetricsService {
  private readonly instanceId = loadEnv().instanceId;

  private battlesActive = 0;
  private overlaySockets = 0;
  private flushFailures = 0;
  private flushTotal = 0;

  private readonly latencyCounts = new Array(LATENCY_BUCKETS.length + 1).fill(0);
  private latencySum = 0;
  private latencyTotal = 0;

  setActiveBattles(n: number): void {
    this.battlesActive = n;
  }

  socketConnected(): void {
    this.overlaySockets += 1;
  }

  socketDisconnected(): void {
    // Clamped: a disconnect for a socket that was never counted (a handshake
    // rejected before the connect hook ran) would otherwise drive this
    // negative and make the gauge useless.
    this.overlaySockets = Math.max(0, this.overlaySockets - 1);
  }

  recordFlush(ok: boolean): void {
    this.flushTotal += 1;
    if (!ok) this.flushFailures += 1;
  }

  /** Milliseconds from accepting a gift to emitting the overlay state push. */
  recordGiftLatency(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    this.latencySum += ms;
    this.latencyTotal += 1;
    const idx = LATENCY_BUCKETS.findIndex((edge) => ms <= edge);
    this.latencyCounts[idx === -1 ? LATENCY_BUCKETS.length : idx] += 1;
  }

  render(): string {
    const label = `{instance="${this.instanceId}"}`;
    const lines: string[] = [];

    lines.push('# HELP livenova_battles_active Battles this instance currently owns and ticks.');
    lines.push('# TYPE livenova_battles_active gauge');
    lines.push(`livenova_battles_active${label} ${this.battlesActive}`);

    lines.push('# HELP livenova_overlay_sockets Overlay clients connected to this instance.');
    lines.push('# TYPE livenova_overlay_sockets gauge');
    lines.push(`livenova_overlay_sockets${label} ${this.overlaySockets}`);

    lines.push('# HELP livenova_battle_flush_total Battle score flushes attempted.');
    lines.push('# TYPE livenova_battle_flush_total counter');
    lines.push(`livenova_battle_flush_total${label} ${this.flushTotal}`);

    lines.push('# HELP livenova_battle_flush_failures_total Flushes that threw.');
    lines.push('# TYPE livenova_battle_flush_failures_total counter');
    lines.push(`livenova_battle_flush_failures_total${label} ${this.flushFailures}`);

    lines.push(
      '# HELP livenova_gift_to_broadcast_ms Milliseconds from accepting a gift to pushing overlay state.',
    );
    lines.push('# TYPE livenova_gift_to_broadcast_ms histogram');
    let cumulative = 0;
    LATENCY_BUCKETS.forEach((edge, i) => {
      cumulative += this.latencyCounts[i];
      lines.push(
        `livenova_gift_to_broadcast_ms_bucket{instance="${this.instanceId}",le="${edge}"} ${cumulative}`,
      );
    });
    cumulative += this.latencyCounts[LATENCY_BUCKETS.length];
    lines.push(
      `livenova_gift_to_broadcast_ms_bucket{instance="${this.instanceId}",le="+Inf"} ${cumulative}`,
    );
    lines.push(`livenova_gift_to_broadcast_ms_sum${label} ${Math.round(this.latencySum)}`);
    lines.push(`livenova_gift_to_broadcast_ms_count${label} ${this.latencyTotal}`);

    return lines.join('\n') + '\n';
  }
}
