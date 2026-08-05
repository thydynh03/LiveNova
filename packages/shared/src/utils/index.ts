import { createHash } from 'crypto';
import { SYSTEM_LIMITS } from '../constants';

export function computeTtsCacheKey(text: string, voice: string, speed: number, pitch: number): string {
  return createHash('sha256')
    .update(`${text}|${voice}|${speed}|${pitch}`)
    .digest('hex');
}

export function calculateCreditsNeeded(textLength: number): number {
  return Math.ceil(textLength / SYSTEM_LIMITS.MAX_TTS_CHARS_PER_CREDIT);
}

export function generateSecureToken(bytes: number = SYSTEM_LIMITS.OVERLAY_TOKEN_BYTES): string {
  const array = new Uint8Array(bytes);
  // In Node.js use crypto.randomBytes, in browser use crypto.getRandomValues
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(array);
  }
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

export function isDuplicateComment(
  content: string,
  sender: string,
  recentComments: Array<{ content: string; sender: string; timestamp: number }>,
): boolean {
  const now = Date.now();
  return recentComments.some(
    c => c.sender === sender && c.content === content && now - c.timestamp < SYSTEM_LIMITS.DUPLICATE_COMMENT_WINDOW_MS,
  );
}

export function truncateComment(text: string, maxLength: number = SYSTEM_LIMITS.MAX_COMMENT_LENGTH): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength);
}
