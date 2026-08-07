import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import {
  LiveEvent,
  LiveEventType,
  KingdomFactionId,
  KingdomWarState,
  KingdomFactionState,
} from '@livenova/shared';
import { PrismaService } from '../../prisma/prisma.service';

export const KINGDOM_WAR_EVENT = 'kingdom_war.update';

function createDefaultFactions(): Record<KingdomFactionId, KingdomFactionState> {
  return {
    cat: {
      id: 'cat',
      name: 'Mèo Neon',
      emoji: '🐱',
      color: '#ff2a70',
      hp: 1000,
      maxHp: 1000,
      level: 1,
      troops: 0,
      mvpScore: 0,
    },
    dog: {
      id: 'dog',
      name: 'Chó Sói',
      emoji: '🐶',
      color: '#00f0ff',
      hp: 1000,
      maxHp: 1000,
      level: 1,
      troops: 0,
      mvpScore: 0,
    },
    bear: {
      id: 'bear',
      name: 'Gấu Dũng Sĩ',
      emoji: '🐻',
      color: '#00ff87',
      hp: 1000,
      maxHp: 1000,
      level: 1,
      troops: 0,
      mvpScore: 0,
    },
    capybara: {
      id: 'capybara',
      name: 'Capybara Vàng',
      emoji: '🦫',
      color: '#ffb703',
      hp: 1000,
      maxHp: 1000,
      level: 1,
      troops: 0,
      mvpScore: 0,
    },
  };
}

@Injectable()
export class KingdomWarService {
  private readonly logger = new Logger(KingdomWarService.name);

  /** Real-time game state per channelId */
  private readonly games = new Map<string, KingdomWarState>();

  /** Map user's username -> factionId */
  private readonly userFactions = new Map<string, KingdomFactionId>();

  /** User scores per faction */
  private readonly userScores = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  getGameState(channelId: string): KingdomWarState {
    if (!this.games.has(channelId)) {
      this.games.set(channelId, {
        channelId,
        factions: createDefaultFactions(),
        status: 'active',
      });
    }
    return this.games.get(channelId)!;
  }

  resetGame(channelId: string): KingdomWarState {
    const newState: KingdomWarState = {
      channelId,
      factions: createDefaultFactions(),
      status: 'active',
      lastAction: {
        type: 'repair',
        factionId: 'cat',
        actorDisplayName: 'Hệ thống',
        description: 'Cuộc chiến 4 Vương Quốc mới đã bắt đầu!',
        timestamp: Date.now(),
      },
    };
    this.games.set(channelId, newState);
    this.eventEmitter.emit(KINGDOM_WAR_EVENT, newState);
    return newState;
  }

  @OnEvent('live.any')
  handleLiveEvent(event: LiveEvent): void {
    const game = this.getGameState(event.channelId);
    if (game.status !== 'active') return;

    const username = event.senderUsername.toLowerCase();
    const displayName = event.senderDisplayName || event.senderUsername;

    // Check if comment specifies faction assignment
    if (event.type === LiveEventType.COMMENT && event.content) {
      const text = event.content.toLowerCase().trim();
      let assignedFaction: KingdomFactionId | undefined;

      if (text.includes('!meo') || text.includes('mèo') || text.includes('cat')) {
        assignedFaction = 'cat';
      } else if (text.includes('!cho') || text.includes('chó') || text.includes('dog')) {
        assignedFaction = 'dog';
      } else if (text.includes('!gau') || text.includes('gấu') || text.includes('bear')) {
        assignedFaction = 'bear';
      } else if (text.includes('!capy') || text.includes('capybara') || text.includes('chuột')) {
        assignedFaction = 'capybara';
      }

      if (assignedFaction) {
        this.userFactions.set(username, assignedFaction);
        game.lastAction = {
          type: 'summon',
          factionId: assignedFaction,
          actorDisplayName: displayName,
          description: `${displayName} đã gia nhập Vương Quốc ${game.factions[assignedFaction].name}!`,
          timestamp: Date.now(),
        };
        this.eventEmitter.emit(KINGDOM_WAR_EVENT, game);
      }
    }

    // Default to 'cat' if user hasn't chosen a faction yet
    const userFactionId = this.userFactions.get(username) || 'cat';
    const faction = game.factions[userFactionId];

    if (!faction || faction.hp <= 0) return;

    // Track user contribution score
    const currentScore = (this.userScores.get(username) || 0) + (event.giftCoinValue || 1);
    this.userScores.set(username, currentScore);
    if (currentScore > faction.mvpScore) {
      faction.mvpScore = currentScore;
      faction.mvpDisplayName = displayName;
    }

    if (event.type === LiveEventType.GIFT) {
      const coins = event.giftCoinValue || 1;

      if (coins >= 1000) {
        // Dragon Ultimate! Attack highest HP enemy
        const enemyFactions = (Object.values(game.factions) as KingdomFactionState[])
          .filter((f) => f.id !== userFactionId && f.hp > 0)
          .sort((a, b) => b.hp - a.hp);

        const target = enemyFactions[0];
        if (target) {
          const damage = 400;
          target.hp = Math.max(0, target.hp - damage);
          game.lastAction = {
            type: 'dragon',
            factionId: userFactionId,
            targetFactionId: target.id,
            actorDisplayName: displayName,
            description: `🐉 ${displayName} gọi RỒNG THẦN thiêu rụi ${target.name} (-${damage} HP)!`,
            timestamp: Date.now(),
          };
        }
      } else if (coins >= 500) {
        // Cannon strike all enemy castles!
        const enemyFactions = (Object.values(game.factions) as KingdomFactionState[])
          .filter((f) => f.id !== userFactionId && f.hp > 0);

        for (const enemy of enemyFactions) {
          enemy.hp = Math.max(0, enemy.hp - 150);
        }

        game.lastAction = {
          type: 'cannon',
          factionId: userFactionId,
          actorDisplayName: displayName,
          description: `💥 ${displayName} BẮN ĐẠI BÁC làm rung chuyển các vương quốc đối thủ!`,
          timestamp: Date.now(),
        };
      } else if (coins >= 100) {
        // Repair / upgrade castle HP
        const heal = 200;
        faction.hp = Math.min(faction.maxHp, faction.hp + heal);
        game.lastAction = {
          type: 'repair',
          factionId: userFactionId,
          actorDisplayName: displayName,
          description: `🏰 ${displayName} gia cố thành ${faction.name} (+${heal} HP)!`,
          timestamp: Date.now(),
        };
      } else {
        // Small gift -> Summon 5 troops!
        faction.troops += 5;
        // Small damage to lowest HP enemy
        const enemyFactions = (Object.values(game.factions) as KingdomFactionState[])
          .filter((f) => f.id !== userFactionId && f.hp > 0)
          .sort((a, b) => a.hp - b.hp);

        if (enemyFactions[0]) {
          enemyFactions[0].hp = Math.max(0, enemyFactions[0].hp - 15);
        }

        game.lastAction = {
          type: 'summon',
          factionId: userFactionId,
          actorDisplayName: displayName,
          description: `⚔️ ${displayName} triệu hồi 5 lính xông trận!`,
          timestamp: Date.now(),
        };
      }
    } else if (event.type === LiveEventType.COMMENT || event.type === LiveEventType.LIKE) {
      // Free actions -> summon 1 troop
      faction.troops += 1;
    }

    // Check win condition
    const aliveFactions = (Object.values(game.factions) as KingdomFactionState[]).filter((f) => f.hp > 0);
    if (aliveFactions.length === 1) {
      game.status = 'ended';
      game.winningFactionId = aliveFactions[0].id;
      game.lastAction = {
        type: 'repair',
        factionId: aliveFactions[0].id,
        actorDisplayName: 'Hệ thống',
        description: `🏆 VƯƠNG QUỐC ${aliveFactions[0].name.toUpperCase()} ĐÃ GIÀNH CHIẾN THẮNG CHUNG CUỘC!`,
        timestamp: Date.now(),
      };
    }

    this.eventEmitter.emit(KINGDOM_WAR_EVENT, game);
  }
}
