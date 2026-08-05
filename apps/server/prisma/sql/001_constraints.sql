-- ─────────────────────────────────────────────────────────────────────────────
-- Database-level invariants that Prisma schema cannot express.
-- Run AFTER `prisma migrate deploy` / `prisma db push`.
--
--   psql "$DIRECT_URL" -f apps/server/prisma/sql/001_constraints.sql
--
-- These exist so that an application bug can never corrupt financial state.
-- ─────────────────────────────────────────────────────────────────────────────

-- H-08 / BR-08 — credit balance must never go negative, no matter what the
-- application layer does. This is the last line of defence for money.
ALTER TABLE "CreditBalance"
  DROP CONSTRAINT IF EXISTS credit_balance_non_negative;
ALTER TABLE "CreditBalance"
  ADD CONSTRAINT credit_balance_non_negative CHECK ("balance" >= 0);

ALTER TABLE "CreditBalance"
  DROP CONSTRAINT IF EXISTS credit_balance_daily_used_non_negative;
ALTER TABLE "CreditBalance"
  ADD CONSTRAINT credit_balance_daily_used_non_negative CHECK ("dailyFreeUsed" >= 0);

-- A ledger entry of zero carries no information and usually signals a bug.
ALTER TABLE "CreditLedger"
  DROP CONSTRAINT IF EXISTS credit_ledger_delta_non_zero;
ALTER TABLE "CreditLedger"
  ADD CONSTRAINT credit_ledger_delta_non_zero CHECK ("delta" <> 0);

ALTER TABLE "CreditLedger"
  DROP CONSTRAINT IF EXISTS credit_ledger_balance_after_non_negative;
ALTER TABLE "CreditLedger"
  ADD CONSTRAINT credit_ledger_balance_after_non_negative CHECK ("balanceAfter" >= 0);

-- Money amounts are unsigned; refunds are modelled as separate rows, not negatives.
ALTER TABLE "Transaction"
  DROP CONSTRAINT IF EXISTS transaction_amount_non_negative;
ALTER TABLE "Transaction"
  ADD CONSTRAINT transaction_amount_non_negative CHECK ("amountMinor" >= 0 AND "creditAmount" >= 0);

-- FR-020 — TTS parameter ranges enforced at rest, not only in the DTO.
ALTER TABLE "TtsSettings"
  DROP CONSTRAINT IF EXISTS tts_settings_ranges;
ALTER TABLE "TtsSettings"
  ADD CONSTRAINT tts_settings_ranges CHECK (
    "rate" >= 0.5 AND "rate" <= 2.0 AND
    "pitch" >= -20 AND "pitch" <= 20 AND
    "volume" >= 0 AND "volume" <= 1.0
  );

-- BR-25 — a binding can never be configured to hammer a game faster than the
-- documented floor, even if the API is bypassed.
ALTER TABLE "GameBinding"
  DROP CONSTRAINT IF EXISTS game_binding_safety_limits;
ALTER TABLE "GameBinding"
  ADD CONSTRAINT game_binding_safety_limits CHECK (
    "durationMs" BETWEEN 10 AND 2000 AND
    "cooldownMs" >= 1000
  );

ALTER TABLE "GameProfile"
  DROP CONSTRAINT IF EXISTS game_profile_rate_limit;
ALTER TABLE "GameProfile"
  ADD CONSTRAINT game_profile_rate_limit CHECK ("maxActionsPerMinute" BETWEEN 1 AND 120);
