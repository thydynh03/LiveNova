import { RuleAction, RuleCondition } from '../types';

/**
 * Shape of `Template.config` for each `TemplateKind`.
 *
 * Kept in shared so the admin editor, the API validation and the runtime read
 * one definition. A template whose config the editor and the engine disagree
 * about is a template that looks saved and does nothing.
 */

/** One rule inside a RULE_PACK. Mirrors CreateRuleDto without the ownership. */
export interface TemplateRule {
  name: string;
  enabled?: boolean;
  priority?: number;
  cooldownMs?: number;
  continueMatching?: boolean;
  conditions: RuleCondition;
  actions: RuleAction[];
}

export interface RulePackConfig {
  rules: TemplateRule[];
}

export interface MediaPackConfig {
  /** Asset keys this pack expects to exist in `TemplateAsset`. */
  assetKeys: string[];
}

/** One side of a TEAM_BATTLE. */
export interface BattleTeamConfig {
  key: string;
  name: string;
  color: string;
  castleAsset?: string;
  /**
   * Gift names that count for this team.
   *
   * Side selection is by gift, not by the viewer's identity — the webcast does
   * not reliably give us one. See PLAN_GAME_MODES_AND_TEMPLATES.md §2.1.
   */
  giftNames: string[];
}

export interface BattleActionTier {
  minPower: number;
  key: string;
  asset?: string;
}

export interface TeamBattleConfig {
  teams: BattleTeamConfig[];
  /** Coin-equivalent value of the free events. Gifts use their real coin value. */
  power: { like: number; share: number; follow: number };
  /** Anti-spam budget shared by likes and shares, per viewer. */
  energy: { capacity: number; refillPerSec: number };
  /** Free events may never trigger an action above this tier key. */
  freeEventMaxAction: string;
  actions: BattleActionTier[];
  battle: { durationSec: number; showTopDonors: number };
}

export type TemplateConfig = RulePackConfig | MediaPackConfig | TeamBattleConfig;

export const TEMPLATE_LIMITS = {
  MAX_RULES_PER_PACK: 50,
  MAX_TEAMS: 8,
  MIN_TEAMS: 2,
  MAX_ACTION_TIERS: 20,
} as const;

/**
 * Validate a TEAM_BATTLE config.
 *
 * Returns the list of problems rather than throwing, so the admin editor can
 * show all of them at once instead of one per save attempt.
 */
export function validateTeamBattleConfig(config: unknown): string[] {
  const problems: string[] = [];
  const c = config as Partial<TeamBattleConfig> | null;

  const teams = Array.isArray(c?.teams) ? c!.teams : [];
  if (teams.length < TEMPLATE_LIMITS.MIN_TEAMS) {
    problems.push(`Cần ít nhất ${TEMPLATE_LIMITS.MIN_TEAMS} phe`);
  }
  if (teams.length > TEMPLATE_LIMITS.MAX_TEAMS) {
    problems.push(`Tối đa ${TEMPLATE_LIMITS.MAX_TEAMS} phe`);
  }

  const seenKeys = new Set<string>();
  // A gift claimed by two teams makes scoring ambiguous, and the ambiguity would
  // only show up mid-broadcast. Caught here, at save time.
  const giftOwner = new Map<string, string>();

  for (const team of teams) {
    if (!team?.key || !team.name) {
      problems.push('Mỗi phe cần có mã và tên');
      continue;
    }
    if (seenKeys.has(team.key)) problems.push(`Mã phe bị trùng: ${team.key}`);
    seenKeys.add(team.key);

    const gifts = Array.isArray(team.giftNames) ? team.giftNames : [];
    if (gifts.length === 0) {
      problems.push(`Phe "${team.name}" chưa gán món quà nào — sẽ không ai vào được phe này`);
    }

    for (const gift of gifts) {
      const normalised = gift.trim().toLowerCase();
      const owner = giftOwner.get(normalised);
      if (owner && owner !== team.key) {
        problems.push(`Quà "${gift}" đang thuộc hai phe (${owner} và ${team.key})`);
      }
      giftOwner.set(normalised, team.key);
    }
  }

  const actions = Array.isArray(c?.actions) ? c!.actions : [];
  if (actions.length === 0) problems.push('Cần ít nhất một bậc hành động');
  if (actions.length > TEMPLATE_LIMITS.MAX_ACTION_TIERS) {
    problems.push(`Tối đa ${TEMPLATE_LIMITS.MAX_ACTION_TIERS} bậc hành động`);
  }

  if (c?.freeEventMaxAction && !actions.some((a) => a?.key === c.freeEventMaxAction)) {
    problems.push(`freeEventMaxAction "${c.freeEventMaxAction}" không có trong bảng hành động`);
  }

  const duration = c?.battle?.durationSec;
  if (typeof duration !== 'number' || duration < 60 || duration > 7200) {
    problems.push('Thời lượng trận phải từ 60 đến 7200 giây');
  }

  return problems;
}
