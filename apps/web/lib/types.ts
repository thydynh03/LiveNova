/**
 * Shapes of the API resources the web app reads.
 *
 * These were hand-declared in three separate page files, so `Rule` and
 * `Overlay` each existed twice with slightly different fields. One definition
 * means adding a column to the API updates every consumer at once instead of
 * leaving whichever page nobody remembered.
 *
 * They live here rather than in @livenova/shared because they describe what
 * this client actually consumes — a deliberately narrower view than the full
 * domain model the server works with.
 */

export interface CreditBalance {
  balance: number;
  dailyFreeUsed: number;
  resetsAt: string | null;
}

export interface RuleAction {
  type: string;
}

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  actions: RuleAction[] | null;
}

export interface Overlay {
  id: string;
  type: string;
  publicToken: string;
  enabled: boolean;
}

export type Platform = 'TIKTOK' | 'FACEBOOK' | 'YOUTUBE';

export interface Channel {
  id: string;
  platform: Platform;
  platformChannelId: string;
  handle: string;
  avatarUrl: string | null;
  verified: boolean;
  /** Code the user must publish on their channel profile to prove ownership. */
  verificationCode: string | null;
  isLive: boolean;
  lastLiveAt: string | null;
  createdAt: string;
}
