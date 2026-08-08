import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { OverlayType } from '@prisma/client';
import {
  LiveEvent,
  LiveEventType,
  BattleState,
  BattleTeamState,
  BattleEventLog,
  TeamBattleConfig,
  OVERLAY_STATE_EVENT,
  OverlayStateDispatch,
} from '@livenova/shared';
import { SimulateBattleEventDto } from './dto/battle.dto';

interface ActiveBattle {
  userId: string;
  battleId: string;
  templateId?: string;
  title: string;
  config: TeamBattleConfig;
  state: BattleState;
}

/**
 * Presentation defaults for the four kingdoms — names, colours, positions.
 *
 * Scores and soldier counts start at zero. They used to start at 3400 / 2200 /
 * 2400 / 2000, which put an invented scoreboard on a live broadcast the moment
 * the overlay loaded, next to real donations.
 */
export const KINGDOM_WAR_DEFAULT_TEAMS: BattleTeamState[] = [
  {
    key: 'cat',
    name: 'Vương quốc Mèo 🐱',
    color: '#a855f7',
    score: 0,
    energy: 85,
    castleHp: 1000,
    maxHp: 1000,
    giftNames: ['Rose', 'Hoa Hồng', 'Tạ'],
    quote: 'MEOW~ Đứa nào cản bổn tọa? 😼',
    motto: 'Ăn chơi không sợ mưa rơi',
    position: 'top-left',
    soldierCount: 0,
  },
  {
    key: 'dog',
    name: 'Vương quốc Chó 🐶',
    color: '#3b82f6',
    score: 0,
    energy: 70,
    castleHp: 1000,
    maxHp: 1000,
    giftNames: ['Perfume', 'Nước Hoa', 'Cap'],
    quote: 'GÂU GÂU! Đến đây xem ai gâu hơn! 🐶',
    motto: 'Đoàn kết là sức mạnh gâu!',
    position: 'top-right',
    soldierCount: 0,
  },
  {
    key: 'bear',
    name: 'Vương quốc Gấu 🐻',
    color: '#f97316',
    score: 0,
    energy: 90,
    castleHp: 1000,
    maxHp: 1000,
    giftNames: ['Donut', 'Bánh Donut', 'Bomb'],
    quote: 'GRÙÙÙ!!! Đụng vào ta là ta đập nát! 🐻',
    motto: 'Gấu không ngại ai, chỉ ngại đói',
    position: 'bottom-left',
    soldierCount: 0,
  },
  {
    key: 'capy',
    name: 'Vương quốc Capybara 🦫',
    color: '#10b981',
    score: 0,
    energy: 100,
    castleHp: 1000,
    maxHp: 1000,
    giftNames: ['Dragon', 'Thần Rồng', 'Universe'],
    quote: 'Bình tĩnh sống chill phá làng từ từ... 🌿',
    motto: 'Chill là sức mạnh Capy! 😎',
    position: 'bottom-right',
    soldierCount: 0,
  },
];

const DEFAULT_CONFIG: TeamBattleConfig = {
  teams: [
    { key: 'cat', name: 'Vương quốc Mèo 🐱', color: '#a855f7', giftNames: ['Rose', 'Hoa Hồng'], castleAsset: 'castle_cat' },
    { key: 'dog', name: 'Vương quốc Chó 🐶', color: '#3b82f6', giftNames: ['Perfume', 'Nước Hoa'], castleAsset: 'castle_dog' },
    { key: 'bear', name: 'Vương quốc Gấu 🐻', color: '#f97316', giftNames: ['Donut', 'Bánh Donut'], castleAsset: 'castle_bear' },
    { key: 'capy', name: 'Vương quốc Capybara 🦫', color: '#10b981', giftNames: ['Dragon', 'Thần Rồng'], castleAsset: 'castle_capy' },
  ],
  power: { like: 1, share: 3, follow: 10 },
  energy: { capacity: 100, refillPerSec: 1 },
  actions: [
    { key: 'soldier', asset: 'fx_soldier', minPower: 1 },
    { key: 'castle', asset: 'fx_castle', minPower: 10 },
    { key: 'bomb', asset: 'fx_bomb', minPower: 50 },
    { key: 'dragon', asset: 'fx_dragon', minPower: 99 },
    { key: 'cannon', asset: 'fx_cannon', minPower: 199 },
    { key: 'meteor', asset: 'fx_meteor', minPower: 999 },
  ],
  battle: { durationSec: 1800, showTopDonors: 5 },
  freeEventMaxAction: 'castle',
};

@Injectable()
export class BattleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BattleService.name);
  private readonly battles = new Map<string, ActiveBattle>();

  /** channelId → owning userId. */
  private readonly channelOwners = new Map<string, string>();

  /**
   * `userId:senderUsername` → team key, from that viewer's most recent gift.
   *
   * In memory on purpose. Unlike the score, this rebuilds itself from the very
   * next gift, so persisting it would mean a database write every time anyone
   * taps the heart button to protect something that recovers on its own.
   */
  private readonly allegiance = new Map<string, string>();

  /**
   * Anti-spam budget, per viewer, shared by likes and shares.
   *
   * `team.energy` is a team resource and only ever goes up, so it never limited
   * anything. A single viewer can hold the heart button down and produce dozens
   * of likes a second, so the budget has to be theirs, not their kingdom's.
   *
   * Key is `userId:senderUsername`. In memory: it refills on its own, so losing
   * it on restart costs at most one bucket of free score.
   */
  private readonly viewerEnergy = new Map<string, { left: number; at: number }>();

  /** `userId:senderUsername` for viewers whose follow has already been counted. */
  private readonly followed = new Set<string>();

  /** Battles whose score has moved since the last flush. */
  private readonly dirty = new Set<string>();

  private energyTimer: NodeJS.Timeout | null = null;
  private persistTimer: NodeJS.Timeout | null = null;

  /**
   * Ceiling on remembered viewers.
   *
   * A viral broadcast can have tens of thousands of distinct gifters, and both
   * viewer maps grow with that. The oldest entries are dropped rather than
   * letting one popular stream exhaust the process. A dropped viewer loses only
   * their remembered side, which their next gift restores.
   */
  private static readonly MAX_TRACKED_VIEWERS = 20000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    this.energyTimer = setInterval(() => this.tickEnergyRefill(), 1000);
    // Batched every two seconds rather than written per event: a busy broadcast
    // produces hundreds of events a minute, and a write for each would make the
    // database the bottleneck. Losing at most two seconds to a crash is the
    // price, and it is a fair one.
    this.persistTimer = setInterval(() => void this.flush(), 2000);
    this.energyTimer.unref?.();
    this.persistTimer.unref?.();

    void this.restoreRunningBattles();
  }

  onModuleDestroy() {
    if (this.energyTimer) clearInterval(this.energyTimer);
    if (this.persistTimer) clearInterval(this.persistTimer);
  }

  /**
   * Pick up where a restart left off.
   *
   * A deploy takes a few seconds. Without this the scoreboard drops to zero
   * mid-broadcast, in front of an audience that has just paid to move it.
   */
  private async restoreRunningBattles(): Promise<void> {
    try {
      const rows = await this.prisma.battle.findMany({
        where: { status: 'RUNNING', endsAt: { gt: new Date() } },
        include: { scores: true, donors: { orderBy: { totalScore: 'desc' } } },
      });

      for (const row of rows) {
        const config = row.configSnapshot as unknown as TeamBattleConfig;
        const assets = await this.loadAssets(row.templateId);
        const teams = KINGDOM_WAR_DEFAULT_TEAMS.map((t) => {
          const saved = row.scores.find((sc) => sc.teamKey === t.key);
          return {
            ...t,
            score: saved?.score ?? 0,
            castleHp: saved?.castleHp ?? t.maxHp,
            soldierCount: saved?.soldierCount ?? 0,
          };
        });

        this.battles.set(row.userId, {
          userId: row.userId,
          battleId: row.id,
          templateId: row.templateId ?? undefined,
          title: row.title,
          config,
          state: {
            kind: 'battle',
            battleId: row.id,
            templateId: row.templateId ?? undefined,
            title: row.title,
            teams,
            topDonors: row.donors.map((d) => ({
              username: d.username,
              nickname: d.nickname,
              teamKey: d.teamKey,
              totalScore: d.totalScore,
            })),
            recentEvents: [],
            winnerTeamKey: row.winnerTeamKey,
            endsAtMs: row.endsAt.getTime(),
            active: true,
            assets,
          },
        });
      }

      if (rows.length > 0) {
        this.logger.log(`Khoi phuc ${rows.length} tran dang chay sau khi khoi dong lai`);
      }
    } catch (err) {
      // A restore failure must not stop the server booting; new battles still work.
      this.logger.error(`Khong khoi phuc duoc tran dang chay: ${message(err)}`);
    }
  }

  /**
   * Close a round and write the result.
   *
   * `reason` distinguishes the two ways a match can end: a kingdom levelled
   * every other castle, or the clock ran out and the highest score takes it.
   * Both mark the row FINISHED — the status existed in the schema from the
   * start and nothing had ever written it, so every round stayed RUNNING and a
   * restart would happily resume a match that ended hours ago.
   */
  private async finishBattle(battle: ActiveBattle, reason: 'time' | 'conquest'): Promise<void> {
    if (!battle.state.active) return;

    battle.state.active = false;

    if (!battle.state.winnerTeamKey) {
      // Decided on score. Ties keep `null` rather than picking whichever team
      // happens to sort first: declaring an arbitrary winner in front of an
      // audience that paid for the result is worse than admitting a draw.
      const ranked = [...battle.state.teams].sort((a, b) => b.score - a.score);
      const top = ranked[0];
      const tied = ranked.length > 1 && ranked[1].score === top?.score;
      battle.state.winnerTeamKey = top && !tied && top.score > 0 ? top.key : null;
    }

    this.logger.log(
      `Tran ${battle.battleId} ket thuc (${reason}), thang: ${battle.state.winnerTeamKey ?? 'hoa'}`,
    );

    // Flush first so the final scores are on disk before the row is closed;
    // marking it FINISHED with stale scores would lose the last two seconds of
    // a match at the exact moment they matter most.
    this.dirty.add(battle.userId);
    await this.flush();

    await this.prisma.battle
      .update({
        where: { id: battle.battleId },
        data: {
          status: 'FINISHED',
          finishedAt: new Date(),
          winnerTeamKey: battle.state.winnerTeamKey ?? null,
        },
      })
      .catch((err) => {
        this.logger.error(`Khong dong duoc tran ${battle.battleId}: ${message(err)}`);
      });

    this.broadcastState(battle.userId);
  }

  /**
   * Template media as a flat `key -> url` map.
   *
   * Returns an empty map rather than throwing: a template with no artwork
   * yet still has to produce a playable round, and the renderer falls back to
   * its built-in drawings.
   */
  private async loadAssets(templateId: string | null): Promise<Record<string, string>> {
    if (!templateId) return {};

    try {
      const rows = await this.prisma.templateAsset.findMany({
        where: { templateId },
        select: { key: true, url: true },
      });
      return Object.fromEntries(rows.map((a) => [a.key, a.url]));
    } catch (err) {
      this.logger.warn(`Khong tai duoc media cua mau ${templateId}: ${message(err)}`);
      return {};
    }
  }

  /** Write the moved scores of every dirty battle. */
  private async flush(): Promise<void> {
    if (this.dirty.size === 0) return;

    const userIds = Array.from(this.dirty);
    this.dirty.clear();

    for (const userId of userIds) {
      const battle = this.battles.get(userId);
      if (!battle) continue;

      try {
        await this.prisma.$transaction([
          ...battle.state.teams.map((t) =>
            this.prisma.battleScore.upsert({
              where: { battleId_teamKey: { battleId: battle.battleId, teamKey: t.key } },
              create: {
                battleId: battle.battleId,
                teamKey: t.key,
                score: t.score,
                castleHp: t.castleHp,
                soldierCount: t.soldierCount ?? 0,
              },
              update: { score: t.score, castleHp: t.castleHp, soldierCount: t.soldierCount ?? 0 },
            }),
          ),
          ...battle.state.topDonors.map((d) =>
            this.prisma.battleDonor.upsert({
              where: { battleId_username: { battleId: battle.battleId, username: d.username } },
              create: {
                battleId: battle.battleId,
                username: d.username,
                nickname: d.nickname,
                teamKey: d.teamKey,
                totalScore: d.totalScore,
              },
              update: { totalScore: d.totalScore, teamKey: d.teamKey },
            }),
          ),
          this.prisma.battle.update({
            where: { id: battle.battleId },
            data: { winnerTeamKey: battle.state.winnerTeamKey ?? null },
          }),
        ]);
      } catch (err) {
        // Put it back so the next tick retries rather than losing the round.
        this.dirty.add(userId);
        this.logger.error(`Khong luu duoc diem tran ${battle.battleId}: ${message(err)}`);
      }
    }
  }

  /**
   * Spend from a viewer's free-event budget.
   *
   * Returns false once they are out. The caller then drops the score while the
   * overlay still shows a small effect: silence would read as the system being
   * broken, and scoring would reward holding the button down.
   */
  private spendViewerEnergy(battle: ActiveBattle, sender: string, cost: number): boolean {
    const key = `${battle.userId}:${sender}`;
    const capacity = battle.config.energy?.capacity ?? 30;
    const refillPerSec = battle.config.energy?.refillPerSec ?? 0.5;
    const now = Date.now();

    const entry = this.viewerEnergy.get(key) ?? { left: capacity, at: now };
    const refilled = Math.min(capacity, entry.left + ((now - entry.at) / 1000) * refillPerSec);

    if (refilled < cost) {
      this.viewerEnergy.set(key, { left: refilled, at: now });
      return false;
    }

    this.viewerEnergy.set(key, { left: refilled - cost, at: now });
    this.evictIfCrowded(this.viewerEnergy);
    return true;
  }

  private evictIfCrowded(map: { size: number; keys(): Iterable<string>; delete(k: string): unknown }): void {
    if (map.size <= BattleService.MAX_TRACKED_VIEWERS) return;
    // Map iterates in insertion order, so the front is the least recently added.
    let excess = map.size - BattleService.MAX_TRACKED_VIEWERS;
    for (const key of map.keys()) {
      map.delete(key);
      if (--excess <= 0) break;
    }
  }

  private tickEnergyRefill() {
    for (const battle of this.battles.values()) {
      // Nothing checked `endsAtMs`, so the countdown reached 00:00 and the round
      // simply carried on — no winner, no result, gifts still scoring into a
      // match that had visibly ended. A timer that runs out and changes nothing
      // is worse than no timer.
      if (battle.state.active && Date.now() >= battle.state.endsAtMs) {
        void this.finishBattle(battle, 'time');
        continue;
      }

      if (!battle.state.active || battle.state.winnerTeamKey) continue;
      const refill = battle.config.energy?.refillPerSec ?? 0.5;
      const maxCap = battle.config.energy?.capacity ?? 100;
      let changed = false;

      for (const team of battle.state.teams) {
        if (team.energy < maxCap) {
          team.energy = Math.min(maxCap, Math.round((team.energy + refill) * 10) / 10);
          changed = true;
        }
      }

      if (changed) {
        this.broadcastState(battle.userId);
      }
    }
  }

  async getOrCreateBattle(userId: string): Promise<BattleState> {
    const existing = this.battles.get(userId);
    if (existing) return existing.state;

    // Look for applied UserTemplate
    const applied = await this.prisma.userTemplate.findFirst({
      where: { userId, template: { kind: 'GAME' } },
      include: { template: true },
      orderBy: { createdAt: 'desc' },
    });

    const config: TeamBattleConfig = (applied?.config as unknown as TeamBattleConfig) || DEFAULT_CONFIG;

    // Media travels with the state. The browser source authenticates with a
    // public token and has no credential that would let it read a template, so
    // it cannot fetch these itself.
    const assets = await this.loadAssets(applied?.templateId ?? null);
    const initialTeams: BattleTeamState[] = KINGDOM_WAR_DEFAULT_TEAMS.map((t) => ({ ...t }));

    const durationSec = config.battle?.durationSec ?? 1800;
    const endsAt = new Date(Date.now() + durationSec * 1000);
    const title = applied?.name || 'Cuộc Chiến 4 Vương Quốc (Kingdom War Live)';

    // The row is created up front so the batching flush has something to write
    // to, and so a restart can find the round and resume it. The config is
    // snapshotted here: editing the template at 9pm must not change the rules
    // of a round that started at 8:45 and is on air.
    const row = await this.prisma.battle.create({
      data: {
        userId,
        templateId: applied?.templateId ?? null,
        title,
        status: 'RUNNING',
        configSnapshot: config as unknown as object,
        endsAt,
      },
      select: { id: true },
    });

    const state: BattleState = {
      kind: 'battle',
      battleId: row.id,
      templateId: applied?.templateId,
      mapTheme: 'fantasy_kingdoms',
      title,
      teams: initialTeams,
      topDonors: [],
      recentEvents: [],
      winnerTeamKey: null,
      endsAtMs: endsAt.getTime(),
      active: true,
      assets,
    };

    this.battles.set(userId, {
      userId,
      battleId: state.battleId,
      templateId: applied?.templateId,
      title,
      config,
      state,
    });

    return state;
  }

  async setMapTheme(userId: string, mapTheme: string): Promise<BattleState> {
    const state = await this.getOrCreateBattle(userId);
    state.mapTheme = mapTheme;
    const active = this.battles.get(userId);
    if (active) {
      active.state.mapTheme = mapTheme;
    }
    await this.broadcastState(userId);
    return active ? active.state : state;
  }

  async resetBattle(userId: string): Promise<BattleState> {
    const previous = this.battles.get(userId);
    if (previous) {
      // Close the old row instead of leaving it RUNNING, or a restart would
      // restore a round the streamer has already ended.
      await this.prisma.battle
        .update({
          where: { id: previous.battleId },
          data: { status: 'CANCELLED', finishedAt: new Date() },
        })
        .catch(() => undefined);
    }

    this.battles.delete(userId);
    const state = await this.getOrCreateBattle(userId);
    // Reset initial scores and donors for clean round
    state.teams.forEach((t) => {
      t.score = 0;
      t.castleHp = 1000;
      t.energy = 100;
      t.soldierCount = 0;
    });
    state.topDonors = [];
    state.recentEvents = [];
    state.winnerTeamKey = null;

    this.broadcastState(userId);
    return state;
  }

  async simulateEvent(userId: string, dto: SimulateBattleEventDto): Promise<BattleState> {
    await this.getOrCreateBattle(userId);
    const battle = this.battles.get(userId);
    if (!battle) return this.getOrCreateBattle(userId);

    // A finished round must not keep scoring. Somebody gifting a second after
    // the horn should not move a result that has already been announced.
    if (!battle.state.active) return battle.state;

    // No silent fallback to the first team: an unknown key used to quietly
    // credit whichever side happened to be listed first, so a typo in the
    // config moved points to the wrong kingdom with nothing to show for it.
    const team = battle.state.teams.find((t) => t.key === dto.teamKey);
    if (!team) {
      this.logger.warn(`Bỏ qua sự kiện cho phe không tồn tại: ${dto.teamKey}`);
      return battle.state;
    }

    let power = 1;
    let actionKey = 'soldier';
    const giftCount = dto.giftCount || 1;

    switch (dto.eventType) {
      // Free events are capped at the cheap tiers on purpose. Tuning their
      // power down is not enough on its own — spam still accumulates towards
      // the dragon threshold. Separating the two groups means no amount of
      // tapping produces one.
      // Free events read the same tier table as gifts, then get capped below.
      // Hard-coding them to 'soldier'/'castle' made the cap unreachable, so the
      // rule it expresses was never actually enforced by anything.
      case 'LIKE':
        power = (battle.config.power?.like ?? 1) * giftCount;
        actionKey = this.actionForPower(battle.config, power);
        break;
      case 'SHARE':
        power = (battle.config.power?.share ?? 3) * giftCount;
        actionKey = this.actionForPower(battle.config, power);
        break;
      case 'FOLLOW':
        power = (battle.config.power?.follow ?? 10) * giftCount;
        actionKey = this.actionForPower(battle.config, power);
        break;
      case 'GIFT': {
        // Firepower is the coin value the platform reported, not a guess from
        // substrings in the gift's name. Name matching read "Rose" as 1 and an
        // unrecognised 30,000-coin gift as 1 too, so the biggest donations
        // scored the least and renaming a gift silently changed the game.
        power = (dto.coinValue ?? 0) > 0 ? (dto.coinValue as number) * giftCount : giftCount;
        actionKey = this.actionForPower(battle.config, power);
        break;
      }
      default:
        power = 1;
        actionKey = 'soldier';
    }

    // A free event may not buy an expensive effect. Lowering its power alone is
    // not enough: spam still accumulates towards the dragon threshold. Capping
    // the tier means no amount of tapping produces one.
    if (dto.eventType !== 'GIFT') {
      actionKey = capFreeAction(battle.config, actionKey);
    }

    // Apply power & score
    team.score += power;
    team.soldierCount = (team.soldierCount || 0) + (actionKey === 'soldier' ? 10 * giftCount : 5);
    team.energy = Math.max(0, Math.min(battle.config.energy?.capacity ?? 100, team.energy + Math.round(power * 0.05)));

    // Damage other teams
    const opponents = battle.state.teams.filter((t) => t.key !== team.key);
    for (const opp of opponents) {
      if (actionKey === 'castle') {
        // Castle repairs own wall
        team.castleHp = Math.min(team.maxHp, team.castleHp + power * 2);
      } else {
        const damagePerOpponent = Math.max(1, Math.round(power / Math.max(1, opponents.length)));
        opp.castleHp = Math.max(0, opp.castleHp - damagePerOpponent);
      }
    }

    // Check winner
    const aliveOpponents = opponents.filter((t) => t.castleHp > 0);
    if (opponents.length > 0 && aliveOpponents.length === 0) {
      battle.state.winnerTeamKey = team.key;
      // Ends the round rather than leaving it running with a winner already
      // declared, which let later gifts keep scoring into a decided match.
      void this.finishBattle(battle, 'conquest');
    }

    // Update Top Donors
    const existingDonor = battle.state.topDonors.find((d) => d.username === dto.sender && d.teamKey === team.key);
    if (existingDonor) {
      existingDonor.totalScore += power;
    } else {
      battle.state.topDonors.push({
        username: dto.sender,
        nickname: dto.sender.replace('@', ''),
        teamKey: team.key,
        totalScore: power,
      });
    }
    battle.state.topDonors.sort((a, b) => b.totalScore - a.totalScore);
    battle.state.topDonors = battle.state.topDonors.slice(0, battle.config.battle?.showTopDonors ?? 5);

    // Event Log
    const eventLog: BattleEventLog = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      teamKey: team.key,
      sender: dto.sender,
      actionKey,
      giftName: dto.giftName || (dto.eventType === 'LIKE' ? '❤️ Like' : dto.eventType === 'SHARE' ? '🔁 Share' : '➕ Follow'),
      giftCount,
      powerAdded: power,
      quote: team.quote,
      timestamp: Date.now(),
    };

    battle.state.recentEvents = [eventLog, ...battle.state.recentEvents.slice(0, 19)];

    // Persisted by the batching timer rather than here.
    this.dirty.add(userId);
    this.broadcastState(userId);
    return battle.state;
  }

  /**
   * Real live traffic.
   *
   * The previous listener was bound to `tiktok.event`, which nothing emits —
   * the ingest publishes `live.gift` / `live.like` / … / `live.any` carrying a
   * `LiveEvent`. Everything looked wired and no real gift ever reached the
   * battle; it only ever moved through the simulate endpoint.
   */
  @OnEvent('live.any')
  async handleLiveEvent(event: LiveEvent) {
    const battle = this.battles.get(await this.resolveOwner(event.channelId) ?? '');
    if (!battle) return;

    const teamKey = this.resolveTeam(battle, event);
    // No team means no score. Crediting an unmatched gift to a default team is
    // worse than ignoring it: the number on screen is wrong and nobody can see
    // why. Previously every unrecognised gift — and every single like, which
    // carries no gift at all — was credited to whichever team happened to be
    // first in the list.
    if (!teamKey) return;

    const sender = event.senderUsername && event.senderUsername !== 'unknown'
      ? `@${event.senderUsername}`
      : null;
    if (!sender) return;

    switch (event.type) {
      case LiveEventType.GIFT:
        // Remember the allegiance so this viewer's later likes and shares have
        // a team to go to. Decision A in PLAN_GAME_MODES_AND_TEMPLATES.md §2.3.
        this.allegiance.set(`${battle.userId}:${event.senderUsername}`, teamKey);
        await this.simulateEvent(battle.userId, {
          sender,
          teamKey,
          eventType: 'GIFT',
          giftName: event.giftName,
          // The real coin value, not a guess from the gift's name.
          coinValue: event.giftCoinValue ?? 0,
        });
        break;

      case LiveEventType.LIKE: {
        // `content` carries the batched count the webcast already summed, e.g.
        // "Tha 15 tim". Charging one unit per frame would let a burst of 15
        // through for the price of one.
        const taps = countFrom(event.content) || 1;
        const cost = (battle.config.power?.like ?? 1) * taps;
        if (!this.spendViewerEnergy(battle, event.senderUsername, cost)) return;
        await this.simulateEvent(battle.userId, {
          sender,
          teamKey,
          eventType: 'LIKE',
          giftCount: taps,
        });
        break;
      }

      case LiveEventType.SHARE: {
        const cost = battle.config.power?.share ?? 3;
        if (!this.spendViewerEnergy(battle, event.senderUsername, cost)) return;
        await this.simulateEvent(battle.userId, { sender, teamKey, eventType: 'SHARE' });
        break;
      }

      case LiveEventType.FOLLOW: {
        // A follow is worth counting once. It can be undone and redone, so the
        // guard is a seen-list rather than a budget.
        const followKey = `${battle.userId}:${event.senderUsername}`;
        if (this.followed.has(followKey)) return;
        this.followed.add(followKey);
        this.evictIfCrowded(this.followed);
        await this.simulateEvent(battle.userId, { sender, teamKey, eventType: 'FOLLOW' });
        break;
      }

      default:
        // Comments and joins carry no firepower in this mode.
        break;
    }
  }

  /** channelId → owning userId. Ownership effectively never changes. */
  private async resolveOwner(channelId: string): Promise<string | null> {
    const cached = this.channelOwners.get(channelId);
    if (cached) return cached;

    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { userId: true },
    });
    if (!channel) return null;

    this.channelOwners.set(channelId, channel.userId);
    return channel.userId;
  }

  /**
   * Which side an event counts for.
   *
   * A gift carries its own team through the config. A like, share or follow
   * carries nothing, so it takes the team of the sender's most recent gift —
   * and scores nothing at all if they have never given one.
   */
  private resolveTeam(battle: ActiveBattle, event: LiveEvent): string | null {
    if (event.type === LiveEventType.GIFT) {
      const giftName = (event.giftName ?? '').trim().toLowerCase();
      if (giftName === '') return null;

      const match = battle.state.teams.find((t) =>
        t.giftNames.some((g) => g.trim().toLowerCase() === giftName),
      );
      return match?.key ?? null;
    }

    return this.allegiance.get(`${battle.userId}:${event.senderUsername}`) ?? null;
  }

  /**
   * Which effect a given firepower buys.
   *
   * Reads the tier table from the template so an admin can reprice the game
   * without a deploy, and falls back to the cheapest tier rather than nothing.
   */
  private actionForPower(config: TeamBattleConfig, power: number): string {
    const tiers = [...(config.actions ?? [])].sort((a, b) => b.minPower - a.minPower);
    return tiers.find((t) => power >= t.minPower)?.key ?? 'soldier';
  }

  private async broadcastState(userId: string) {
    const battle = this.battles.get(userId);
    if (!battle) return;

    const overlay = await this.prisma.overlay.findFirst({
      where: { userId, type: OverlayType.GAME_BATTLE },
      select: { id: true },
    });

    if (overlay) {
      const dispatch: OverlayStateDispatch = {
        userId,
        overlayId: overlay.id,
        state: battle.state,
      };
      this.eventEmitter.emit(OVERLAY_STATE_EVENT, dispatch);
    }
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Pull the batched tap count out of a like event's text.
 *
 * The ingest formats it as "Tha N tim" because `likeCount` in a webcast frame
 * is already a sum. Reading it back beats charging once per frame.
 */
function countFrom(content: string | undefined): number {
  const match = /(\d+)/.exec(content ?? '');
  return match ? Number(match[1]) : 0;
}

/**
 * Clamp an action to the highest tier a free event may trigger.
 *
 * Falls through to the requested action when the template does not name a cap,
 * so a config written before this existed keeps working.
 */
function capFreeAction(config: TeamBattleConfig, requested: string): string {
  const cap = config.freeEventMaxAction;
  if (!cap) return requested;

  const tiers = config.actions ?? [];
  const capTier = tiers.find((t) => t.key === cap);
  const wanted = tiers.find((t) => t.key === requested);
  if (!capTier || !wanted) return requested;

  return wanted.minPower > capTier.minPower ? cap : requested;
}
