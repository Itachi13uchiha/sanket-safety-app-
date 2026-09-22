import type { PatternStatus } from '../lib/i18n.js';

export interface PatternRow {
  id: string;
  category: string;
  status: PatternStatus;
  lat: number;
  lng: number;
  area_id: string | null;
  area_label: string;
  report_count: number;
  distinct_reporters: number;
  effective_reporters: number;
  distinct_periods: number;
  distinct_days: number;
  spread_m: number;
  confidence: number;
  peak_start_hour: number | null;
  peak_end_hour: number | null;
  analysis_json: string;
  first_seen_at: number;
  last_report_at: number;
  emerged_at: number | null;
  resolved_at: number | null;
  merged_into: string | null;
  created_at: number;
  updated_at: number;
}

export interface ReportRow {
  id: string;
  reporter_id: string;
  category: string;
  lat: number;
  lng: number;
  location_source: string;
  area_id: string | null;
  area_label: string;
  time_bucket: string;
  occurred_at: number;
  created_at: number;
  note: string | null;
  note_hash: string | null;
  status: 'active' | 'confirmed' | 'dismissed' | 'spam';
  suspicious: number;
  pattern_id: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: number | null;
  idem_key: string | null;
}

export interface UserRow {
  id: string;
  official_id: string;
  email: string;
  name: string;
  password_hash: string;
  role: 'officer' | 'supervisor' | 'admin';
  status: 'active' | 'inactive';
  failed_attempts: number;
  locked_until: number | null;
  last_login_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface AlertRow {
  id: string;
  pattern_id: string;
  level: 'low' | 'medium' | 'high';
  status: 'open' | 'acknowledged' | 'escalated' | 'resolved';
  title: string;
  body: string;
  recommended_action: string;
  created_at: number;
  updated_at: number;
  handled_by: string | null;
}

export interface CaseRow {
  id: string;
  seq: number;
  pattern_id: string | null;
  title: string;
  category: string;
  area_label: string;
  lat: number | null;
  lng: number | null;
  status: 'open' | 'in_progress' | 'on_hold' | 'closed';
  priority: 'low' | 'medium' | 'high';
  assigned_officer_id: string | null;
  created_by: string;
  created_at: number;
  updated_at: number;
  closed_at: number | null;
}

export interface AreaRow {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  radius_m: number;
  active: number;
}
