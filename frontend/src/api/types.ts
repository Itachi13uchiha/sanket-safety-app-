/* Response shapes of the Sanket API (only the fields the UI uses). */

export type Lang = 'en' | 'hi' | 'mr';
export type Level = 'low' | 'medium' | 'high';
export type PatternStatusCode = 'monitoring' | 'emerging' | 'escalated' | 'resolved';
export type TimeBucket = 'now' | 'hour' | 'today';
export type Range = 'today' | 'week' | 'month';

export interface LatLng { lat: number; lng: number }
export interface Labelled { id: string; label: string }
export interface Pagination { page: number; pageSize: number; total: number; totalPages: number }

/* ───────── citizen ───────── */
export interface Meta {
  language: Lang;
  categories: Labelled[];
  timeOptions: Labelled[];
  patternStatuses: Labelled[];
  limits: { noteMaxLength: number };
  emergencyNumber: string;
}
export interface Area { id: string; name: string; city: string; lat: number; lng: number }

export interface PublicPattern {
  id: string;
  area: string;
  category: Labelled;
  status: { code: PatternStatusCode; label: string };
  term: { code: string; label: string };
  level: Level;
  distinctReports: number;
  distinctPeriods: number;
  daysObserved: number;
  peakWindow: { startHour: number; endHour: number; label: string } | null;
  firstDetectedAt: string | null;
  lastSignalAt: string | null;
  location: LatLng;
  distanceKm?: number;
  summary: string;
}
export interface PublicSignal {
  location: LatLng;
  category: Labelled;
  distinctReports: number;
  level: Level;
  term: { code: string; label: string };
  lastSignalAt: string;
  recency: 'now' | 'today' | 'earlier';
  distanceKm: number;
}
export interface HomeData {
  area: { id: string; name: string; city: string } | null;
  status: { level: 'calm' | 'moderate' | 'elevated'; label: string; nearbyPatterns: number; nearbySignals: number };
  nearbyPatterns: PublicPattern[];
  recentSignals: PublicSignal[];
  tip: string;
}
export interface MapData { patterns: PublicPattern[]; signals: PublicSignal[]; center: LatLng; radiusKm: number }
export interface PatternDetail extends PublicPattern { trend: { date: string; reports: number }[]; note: string }
export interface CitizenNotification { id: string; type: string; title: string; body: string; level: string | null; patternId: string | null; createdAt: string }
export interface AlertsData {
  nearbyPatterns: PublicPattern[];
  notifications: CitizenNotification[];
  system: { id: string; type: string; title: string; body: string; createdAt: string }[];
}
export interface PrivacyInfo { retentionDays: number; minimumReportersBeforePublic: number }

export interface SubmittedReport {
  id: string;
  category: Labelled;
  location: { label: string; lat?: number; lng?: number };
  time: { bucket: string; label: string; occurredAt: string };
  status: 'open' | 'resolved';
  submittedAt: string;
  anonymous: true;
  note?: string | null;
  duplicate?: boolean;
  message?: string;
}
export interface MyReports {
  reports: SubmittedReport[];
  counts: { all: number; open: number; resolved: number };
  pagination: Pagination;
}
export interface NewReportBody {
  category: string;
  when: TimeBucket;
  lat?: number;
  lng?: number;
  areaId?: string;
  locationSource: 'current' | 'map' | 'manual';
  note?: string;
}

/* ───────── authority ───────── */
export interface StaffUser {
  id: string; officialId: string; name: string; email: string;
  role: 'officer' | 'supervisor' | 'admin'; roleLabel: string; status: 'active' | 'inactive';
  lastLoginAt: string | null; createdAt: string | null;
}
export type Permission =
  | 'reports:view' | 'patterns:view' | 'cases:manage' | 'alerts:escalate'
  | 'audit:view' | 'users:manage' | 'data:export' | 'settings:modify';
export interface StaffSession { token: string; expiresAt: string; user: StaffUser; permissions: Permission[] }
export interface LoginChallenge {
  challengeId: string; channel: string; destination: string; expiresInSeconds: number; resendAfterSeconds: number; devOtp?: string;
}

export interface StaffPattern {
  id: string;
  category: Labelled;
  area: string;
  location: LatLng;
  status: { code: PatternStatusCode; label: string };
  confidence: number;
  reportCount: number;
  distinctReporters: number;
  distinctPeriods: number;
  peakWindow: { startHour: number; endHour: number; label: string } | null;
  firstSeenAt: string;
  lastSignalAt: string;
  emergedAt: string | null;
  resolvedAt: string | null;
  updatedAt: string;
}
export interface StaffAlert {
  id: string; patternId: string; level: Level; status: 'open' | 'acknowledged' | 'escalated' | 'resolved';
  title: string; body: string; recommendedAction: string; createdAt: string; updatedAt: string; handledBy: string | null;
}
export interface StaffReportRow {
  id: string;
  category: Labelled;
  location: { label: string; lat: number; lng: number; source: string };
  time: { bucket: string; label: string; occurredAt: string };
  submittedAt: string;
  status: 'new' | 'linked' | 'confirmed' | 'dismissed';
  patternId: string | null;
  integrity: { reporterTrust: 'new' | 'established' | 'reduced'; flaggedImplausibleTravel: boolean };
  note?: string | null;
  review?: { decision: string; note: string | null; by: string; at: string } | null;
  pattern?: StaffPattern | null;
}
export interface PatternFull {
  pattern: StaffPattern;
  signals: {
    distinctReporters: number; effectiveReporters: number; distinctPeriods: number; distinctDays: number;
    confidence: number; spreadMeters: number;
    components?: { reporters: number; temporal: number; spatial: number; integrity: number };
    burstRatio?: number; duplicateRatio?: number; newReporterRatio?: number;
  };
  reportingTimeline: { perDay: { date: string; reports: number; reporters: number }[]; perTimeBlock: { block: string; count: number }[] };
  history: { at: string; type: string; actor: string | null; detail: Record<string, unknown> | null }[];
  alert: StaffAlert | null;
  cases: { id: string; status: string; title: string }[];
  allowedActions: string[];
  reports?: StaffReportRow[];
}
export interface AlertListItem extends StaffAlert {
  area: string; category: string; confidence: number; distinctReporters: number; distinctPeriods: number; patternStatus: string;
}
export interface Dashboard {
  metrics: {
    activeEmergingPatterns: { value: number; previous: number };
    reportsToday: { value: number; previous: number };
    areasMonitored: { value: number };
    alertsGenerated: { value: number; open: number };
  };
  emergingPatterns: StaffPattern[];
  priorityAlerts: (StaffAlert & { area: string; category: string; confidence: number })[];
  recentReports?: StaffReportRow[];
  trend: { date: string; reports: number; patternsDetected: number }[];
  liveMap: { id: string; lat: number; lng: number; status: PatternStatusCode; confidence: number; category: string; area: string }[];
}
export interface StaffMap { patterns: (StaffPattern & { intensity: number })[]; reports?: { id: string; category: string; lat: number; lng: number }[] }
export interface Analytics {
  range: string;
  reportsOverTime: { date: string; reports: number; distinctReporters: number }[];
  categories: { id: string; label: string; count: number; share: number }[];
  patternsByArea: { area: string; patterns: number; emerging: number; reports: number }[];
  peakTimes: { byTimeBlock: { block: string; count: number }[]; byWeekday: { day: string; count: number }[] };
  patternGrowth: { date: string; detected: number; emerged: number; resolved: number }[];
  integrity: { flaggedImplausibleTravel: number; dismissedOrSpam: number };
  methodology: { summary: string; signals: string[] };
}
export interface CaseRow {
  id: string; patternId: string | null; title: string; category: Labelled;
  location: { label: string; lat: number | null; lng: number | null };
  status: 'open' | 'in_progress' | 'on_hold' | 'closed'; priority: Level;
  assignedOfficer: { id: string; name: string | null; officialId: string | null } | null;
  createdBy: string; createdAt: string; updatedAt: string; closedAt: string | null;
}
export interface CaseFull {
  case: CaseRow;
  pattern: StaffPattern | null;
  reports: StaffReportRow[];
  timeline: { at: string; type: string; actor: string; from: string | null; to: string | null; note: string | null }[];
  notes: { id: number; author: string; body: string; createdAt: string }[];
  attachments: { id: number; filename: string; mimeType: string; sizeBytes: number; uploadedBy: string; createdAt: string }[];
}
export interface AuditLog {
  id: number; timestamp: string; actor: { id: string | null; label: string }; action: string;
  resource: string | null; ip: string | null; device: string | null; result: 'success' | 'failed' | 'denied';
}
export interface RolesMatrix {
  roles: { id: string; label: string }[];
  permissions: { id: string; label: string }[];
  matrix: Record<string, Record<string, boolean>>;
}
export interface StaffNotification {
  id: string; type: string; title: string; body: string; level: string | null; patternId: string | null; createdAt: string; read: boolean;
}
