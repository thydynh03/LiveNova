import { LiveEvent, Rule, RuleCondition, RuleAction, LiveEventType } from '../types';
import { SYSTEM_LIMITS } from '../constants';

export interface EvaluationResult {
  matched: boolean;
  rule: Rule;
  actions: RuleAction[];
}

export class RuleEvaluator {
  private lastTriggerMap = new Map<string, number>();

  evaluate(event: LiveEvent, rules: Rule[]): EvaluationResult[] {
    const sortedRules = [...rules]
      .filter(r => r.enabled)
      .sort((a, b) => a.priority - b.priority);

    const results: EvaluationResult[] = [];

    for (const rule of sortedRules) {
      if (this.isOnCooldown(rule)) continue;
      if (this.matchCondition(event, rule.conditions)) {
        this.recordTrigger(rule);
        results.push({ matched: true, rule, actions: rule.actions });
        if (!rule.continueMatching) break;
      }
    }

    return results;
  }

  private matchCondition(event: LiveEvent, cond: RuleCondition): boolean {
    if (cond.eventType && cond.eventType.length > 0 && !cond.eventType.includes(event.type)) return false;
    if (cond.giftName && event.giftName !== cond.giftName) return false;
    if (cond.minCoinValue != null && (event.giftCoinValue ?? 0) < cond.minCoinValue) return false;
    if (cond.maxCoinValue != null && (event.giftCoinValue ?? 0) > cond.maxCoinValue) return false;
    if (cond.senderUsername && event.senderUsername !== cond.senderUsername) return false;
    if (cond.keywords && cond.keywords.length > 0 && event.content) {
      const lower = event.content.toLowerCase();
      if (!cond.keywords.some(k => lower.includes(k.toLowerCase()))) return false;
    }
    return true;
  }

  private isOnCooldown(rule: Rule): boolean {
    if (rule.cooldownMs <= 0) return false;
    const last = this.lastTriggerMap.get(rule.id);
    if (!last) return false;
    return Date.now() - last < rule.cooldownMs;
  }

  private recordTrigger(rule: Rule): void {
    this.lastTriggerMap.set(rule.id, Date.now());
  }

  clearCooldowns(): void {
    this.lastTriggerMap.clear();
  }
}
