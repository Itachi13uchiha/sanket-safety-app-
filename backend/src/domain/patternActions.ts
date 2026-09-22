import { db, tx } from '../db/index.js';
import type { PatternRow } from '../db/types.js';
import { Errors } from '../lib/errors.js';
import type { PatternStatus } from '../lib/i18n.js';
import { snapPoint } from '../lib/geo.js';
import { ensureAlert, pushNotification, setAlertStatus } from './alerts.js';
import { addPatternEvent } from './detection.js';
import { getSettings } from './settings.js';

export type StatusTarget = Exclude<PatternStatus, 'emerging'>;

const ALLOWED: Record<PatternStatus, PatternStatus[]> = {
  emerging: ['monitoring', 'escalated', 'resolved'],
  monitoring: ['escalated', 'resolved'],
  escalated: ['monitoring', 'resolved'],
  resolved: ['monitoring'],
};

/** The single code path for Start Monitoring / Escalate / Mark Resolved (used by patterns and alerts). */
export function changePatternStatus(
  patternId: string,
  to: StatusTarget,
  actor: { id: string; label: string },
  note?: string,
  now = Date.now(),
): PatternRow {
  return tx(() => {
    const p = db.prepare('SELECT * FROM patterns WHERE id = ? AND merged_into IS NULL').get(patternId) as PatternRow | undefined;
    if (!p) throw Errors.notFound('Pattern');
    if (p.status === to) throw Errors.conflict(`Pattern is already ${to}`, 'NO_CHANGE');
    if (!ALLOWED[p.status].includes(to)) {
      throw Errors.conflict(`A ${p.status} pattern cannot be moved to ${to}`, 'INVALID_TRANSITION');
    }

    db.prepare('UPDATE patterns SET status = ?, resolved_at = ?, updated_at = ? WHERE id = ?').run(
      to, to === 'resolved' ? now : null, now, p.id,
    );
    addPatternEvent(p.id, 'status', now, actor.label, { from: p.status, to, note: note ?? null });

    if (to !== 'resolved') ensureAlert({ ...p, status: to }, now, false);
    setAlertStatus(p.id, to === 'monitoring' ? 'acknowledged' : to === 'escalated' ? 'escalated' : 'resolved', now, actor.id);

    const minPublic = getSettings().privacy.minReportersForPublic;
    const publiclyVisible = p.emerged_at != null && p.distinct_reporters >= minPublic;
    const pub = snapPoint(p.lat, p.lng, getSettings().privacy.publicGridDegrees);

    if (to === 'monitoring' && publiclyVisible) {
      pushNotification({
        audience: 'citizen', type: 'monitoring_active', title: 'Monitoring Active',
        body: `Authorities are now monitoring ${p.area_label} following pattern detection.`,
        level: null, patternId: p.id, lat: pub.lat, lng: pub.lng, now,
      });
    }
    if (to === 'escalated') {
      pushNotification({
        audience: 'authority', type: 'pattern_escalated', title: 'Pattern escalated',
        body: `${p.area_label} was escalated by ${actor.label}.`, level: 'high', patternId: p.id, now,
      });
    }
    return db.prepare('SELECT * FROM patterns WHERE id = ?').get(p.id) as PatternRow;
  });
}
