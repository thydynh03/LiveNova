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
  private energyTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    this.energyTimer = setInterval(() => this.tickEnergyRefill(), 1000);
  }

  onModuleDestroy() {
    if (this.energyTimer) clearInterval(this.energyTimer);
  }

  private tickEnergyRefill() {
    for (const battle of this.battles.values()) {
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
    const initialTeams: BattleTeamState[] = KINGDOM_WAR_DEFAULT_TEAMS.map((t) => ({ ...t }));

    const durationSec = config.battle?.durationSec ?? 1800;
    const state: BattleState = {
      kind: 'battle',
      battleId: `battle_${Date.now()}`,
      templateId: applied?.templateId,
      title: applied?.name || 'Cuộc Chiến 4 Vương Quốc (Kingdom War Live)',
      teams: initialTeams,
      // Empty until somebody actually donates. Four invented names with
      // five-figure totals would be shown to a live audience as a real
      // leaderboard.
      topDonors: [],
      recentEvents: [],
      winnerTeamKey: null,
      endsAtMs: Date.now() + durationSec * 1000,
      active: true,
    };

    this.battles.set(userId, {
      userId,
      battleId: state.battleId,
      templateId: applied?.templateId,
      title: state.title || 'Cuộc Chiến 4 Vương Quốc',
      config,
      state,
    });

    return state;
  }

  async resetBattle(userId: string): Promise<BattleState> {
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
      case 'LIKE':
        power = (battle.config.power?.like ?? 1) * giftCount;
        actionKey = 'soldier';
        break;
      case 'SHARE':
        power = (battle.config.power?.share ?? 3) * giftCount;
        actionKey = 'soldier';
        break;
      case 'FOLLOW':
        power = (battle.config.power?.follow ?? 10) * giftCount;
        actionKey = 'castle';
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

      case LiveEventType.LIKE:
        await this.simulateEvent(battle.userId, { sender, teamKey, eventType: 'LIKE' });
        break;

      case LiveEventType.SHARE:
        await this.simulateEvent(battle.userId, { sender, teamKey, eventType: 'SHARE' });
        break;

      case LiveEventType.FOLLOW:
        await this.simulateEvent(battle.userId, { sender, teamKey, eventType: 'FOLLOW' });
        break;

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
