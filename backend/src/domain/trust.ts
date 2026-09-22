import { db } from '../db/index.js';
import { HOUR } from '../lib/time.js';
import { clamp } from '../lib/http.js';

/**
 * Reporters are anonymous, so trust cannot come from identity. It comes from behaviour:
 *  - age of the anonymous session (new sessions are discounted so mass-created sessions add little),
 *  - moderation outcomes (confirmed reports raise it, dismissed/spam reports lower it),
 *  - automatic anti-abuse checks (implausible travel etc.).
 */
export function trustOf(createdAt: number, behavior: number, now: number): number {
  const ageHours = Math.max(0, (now - createdAt) / HOUR);
  const ageFactor = 0.6 + 0.4 * Math.min(1, ageHours / 72);
  return clamp(ageFactor * behavior, 0, 1);
}

export function trustBand(createdAt: number, behavior: number, now: number): 'new' | 'established' | 'reduced' {
  if (behavior < 0.8) return 'reduced';
  return now - createdAt < 24 * HOUR ? 'new' : 'established';
}

export type ReviewDecision = 'confirm' | 'dismiss' | 'spam';

export function recordReview(reporterId: string, decision: ReviewDecision): void {
  if (decision === 'confirm') {
    db.prepare(
      'UPDATE reporters SET behavior = MIN(1.25, behavior + 0.05), confirmed_count = confirmed_count + 1 WHERE id = ?',
    ).run(reporterId);
  } else {
    const factor = decision === 'spam' ? 0.4 : 0.85;
    db.prepare(
      'UPDATE reporters SET behavior = MAX(0.02, behavior * ?), rejected_count = rejected_count + 1 WHERE id = ?',
    ).run(factor, reporterId);
  }
}

export function penalise(reporterId: string, factor: number): void {
  db.prepare('UPDATE reporters SET behavior = MAX(0.02, behavior * ?) WHERE id = ?').run(factor, reporterId);
}
