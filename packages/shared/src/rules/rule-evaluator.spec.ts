import { RuleEvaluator } from './rule-evaluator';
import { LiveEvent, LiveEventType, Rule, RuleActionType } from '../types';

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'r1',
    userId: 'u1',
    name: 'Rule',
    enabled: true,
    priority: 0,
    conditions: {},
    actions: [{ type: RuleActionType.TTS_READ, payload: {} }],
    continueMatching: false,
    cooldownMs: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeEvent(overrides: Partial<LiveEvent> = {}): LiveEvent {
  return {
    id: 'e1',
    type: LiveEventType.GIFT,
    channelId: 'c1',
    senderUsername: 'nguyenvana',
    senderDisplayName: 'Nguyễn Văn A',
    occurredAt: new Date(),
    ...overrides,
  };
}

describe('RuleEvaluator', () => {
  it('skips disabled rules', () => {
    const results = new RuleEvaluator().evaluate(makeEvent(), [
      makeRule({ enabled: false }),
    ]);
    expect(results).toHaveLength(0);
  });

  it('stops at the first match by default (BR-18)', () => {
    const results = new RuleEvaluator().evaluate(makeEvent(), [
      makeRule({ id: 'low', priority: 10 }),
      makeRule({ id: 'high', priority: 1 }),
    ]);

    expect(results).toHaveLength(1);
    // Lower priority number wins, regardless of array order.
    expect(results[0].rule.id).toBe('high');
  });

  it('continues past a match when continueMatching is set (BR-19)', () => {
    const results = new RuleEvaluator().evaluate(makeEvent(), [
      makeRule({ id: 'a', priority: 1, continueMatching: true }),
      makeRule({ id: 'b', priority: 2 }),
    ]);

    expect(results.map((r) => r.rule.id)).toEqual(['a', 'b']);
  });

  describe('conditions', () => {
    it('filters by event type', () => {
      const rule = makeRule({ conditions: { eventType: [LiveEventType.COMMENT] } });
      expect(new RuleEvaluator().evaluate(makeEvent({ type: LiveEventType.GIFT }), [rule])).toHaveLength(0);
      expect(
        new RuleEvaluator().evaluate(makeEvent({ type: LiveEventType.COMMENT }), [rule]),
      ).toHaveLength(1);
    });

    it('filters by gift name', () => {
      const rule = makeRule({ conditions: { giftName: 'Hoa hồng' } });
      expect(new RuleEvaluator().evaluate(makeEvent({ giftName: 'Sư tử' }), [rule])).toHaveLength(0);
      expect(new RuleEvaluator().evaluate(makeEvent({ giftName: 'Hoa hồng' }), [rule])).toHaveLength(1);
    });

    it('filters by coin range inclusively', () => {
      const rule = makeRule({ conditions: { minCoinValue: 100, maxCoinValue: 1000 } });
      const at = (v: number) => new RuleEvaluator().evaluate(makeEvent({ giftCoinValue: v }), [rule]);

      expect(at(99)).toHaveLength(0);
      expect(at(100)).toHaveLength(1);
      expect(at(1000)).toHaveLength(1);
      expect(at(1001)).toHaveLength(0);
    });

    it('treats a missing coin value as zero', () => {
      const rule = makeRule({ conditions: { minCoinValue: 1 } });
      expect(new RuleEvaluator().evaluate(makeEvent({ giftCoinValue: undefined }), [rule])).toHaveLength(0);
    });

    it('matches keywords case-insensitively', () => {
      const rule = makeRule({ conditions: { keywords: ['XIN CHÀO'] } });
      expect(
        new RuleEvaluator().evaluate(
          makeEvent({ type: LiveEventType.COMMENT, content: 'xin chào mọi người' }),
          [rule],
        ),
      ).toHaveLength(1);
    });

    it('filters by sender', () => {
      const rule = makeRule({ conditions: { senderUsername: 'someone_else' } });
      expect(new RuleEvaluator().evaluate(makeEvent(), [rule])).toHaveLength(0);
    });

    it('matches everything when conditions are empty', () => {
      expect(new RuleEvaluator().evaluate(makeEvent(), [makeRule()])).toHaveLength(1);
    });
  });

  describe('cooldown (BR-25)', () => {
    it('suppresses a repeat trigger inside the window', () => {
      const evaluator = new RuleEvaluator();
      const rule = makeRule({ cooldownMs: 60_000 });

      expect(evaluator.evaluate(makeEvent(), [rule])).toHaveLength(1);
      expect(evaluator.evaluate(makeEvent(), [rule])).toHaveLength(0);
    });

    it('does not suppress when cooldown is zero', () => {
      const evaluator = new RuleEvaluator();
      const rule = makeRule({ cooldownMs: 0 });

      expect(evaluator.evaluate(makeEvent(), [rule])).toHaveLength(1);
      expect(evaluator.evaluate(makeEvent(), [rule])).toHaveLength(1);
    });

    it('tracks cooldowns per rule, not globally', () => {
      const evaluator = new RuleEvaluator();
      const a = makeRule({ id: 'a', cooldownMs: 60_000, continueMatching: true });
      const b = makeRule({ id: 'b', priority: 1, cooldownMs: 60_000 });

      expect(evaluator.evaluate(makeEvent(), [a, b])).toHaveLength(2);
      expect(evaluator.evaluate(makeEvent(), [a, b])).toHaveLength(0);
    });

    it('clearCooldowns resets the window', () => {
      const evaluator = new RuleEvaluator();
      const rule = makeRule({ cooldownMs: 60_000 });

      evaluator.evaluate(makeEvent(), [rule]);
      evaluator.clearCooldowns();

      expect(evaluator.evaluate(makeEvent(), [rule])).toHaveLength(1);
    });

    it('a rule on cooldown does not block a lower-priority rule from matching', () => {
      const evaluator = new RuleEvaluator();
      const first = makeRule({ id: 'first', priority: 1, cooldownMs: 60_000 });
      const second = makeRule({ id: 'second', priority: 2 });

      expect(evaluator.evaluate(makeEvent(), [first, second])[0].rule.id).toBe('first');
      // 'first' is now cooling down, so the next event should fall through to
      // 'second' rather than producing nothing at all.
      expect(evaluator.evaluate(makeEvent(), [first, second])[0].rule.id).toBe('second');
    });
  });

  it('does not mutate the caller’s rule array', () => {
    const rules = [makeRule({ id: 'b', priority: 5 }), makeRule({ id: 'a', priority: 1 })];
    new RuleEvaluator().evaluate(makeEvent(), rules);
    expect(rules.map((r) => r.id)).toEqual(['b', 'a']);
  });
});
