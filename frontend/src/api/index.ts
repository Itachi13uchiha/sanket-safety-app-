import { request, resetAnonIdentity } from './http';
import { staffStore } from '../state/app';
import type * as T from './types';

export { ApiError, friendly, toApiError, resetAnonIdentity } from './http';
export type * from './types';

/* ───────────────────────────── citizen (anonymous) ───────────────────────────── */
export const citizen = {
  meta: () => request<T.Meta>('/meta'),
  areas: () => request<{ areas: T.Area[] }>('/areas'),
  home: (p: T.LatLng & { radiusKm?: number }) => request<T.HomeData>('/home', { query: { ...p } }),
  map: (p: T.LatLng & { radiusKm?: number; range: T.Range; category?: string }) => request<T.MapData>('/map', { query: { ...p } }),
  pattern: (id: string) => request<T.PatternDetail>(`/patterns/${encodeURIComponent(id)}`),
  alerts: (p: T.LatLng & { radiusKm?: number }) => request<T.AlertsData>('/alerts', { query: { ...p } }),
  privacy: () => request<T.PrivacyInfo>('/privacy'),

  submitReport: (body: T.NewReportBody, idempotencyKey: string) =>
    request<T.SubmittedReport>('/reports', { method: 'POST', auth: 'anon', body, headers: { 'Idempotency-Key': idempotencyKey } }),
  myReports: (p: { status?: 'all' | 'open' | 'resolved'; page?: number; pageSize?: number } = {}) =>
    request<T.MyReports>('/reports/mine', { auth: 'anon', query: { ...p } }),
  deleteMyData: async () => {
    const r = await request<{ deleted: boolean; reportsRemoved: number }>('/anon/me', { method: 'DELETE', auth: 'anon' });
    return r;
  },
  resetIdentity: resetAnonIdentity,
};

/* ───────────────────────────── authority ───────────────────────────── */
const s = 'staff' as const;
const A = '/authority';

export const authority = {
  /* auth */
  login: (identifier: string, password: string) =>
    request<T.LoginChallenge>('/auth/login', { method: 'POST', body: { identifier, password } }),
  resendOtp: (challengeId: string) =>
    request<{ resent: boolean; resendAfterSeconds: number; devOtp?: string }>('/auth/resend-otp', { method: 'POST', body: { challengeId } }),
  verifyOtp: async (challengeId: string, otp: string) => {
    const r = await request<{ accessToken: string; expiresAt: string; user: T.StaffUser; permissions: T.Permission[] }>('/auth/verify-otp', {
      method: 'POST',
      body: { challengeId, otp },
    });
    staffStore.set({ token: r.accessToken, expiresAt: r.expiresAt, user: r.user, permissions: r.permissions });
    return r;
  },
  logout: async () => {
    try {
      await request<void>('/auth/logout', { method: 'POST', auth: s });
    } catch {
      /* already signed out */
    }
    staffStore.set(null);
  },
  forgotPassword: (identifier: string) => request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { identifier } }),
  resetPassword: (token: string, newPassword: string) =>
    request<{ reset: boolean }>('/auth/reset-password', { method: 'POST', body: { token, newPassword } }),

  /* overview */
  dashboard: () => request<T.Dashboard>(`${A}/dashboard`, { auth: s }),
  map: (p: { range: T.Range; category?: string; status?: string }) => request<T.StaffMap>(`${A}/map`, { auth: s, query: { ...p } }),
  analytics: (range: '7d' | '30d' | '90d') => request<T.Analytics>(`${A}/analytics`, { auth: s, query: { range } }),

  /* patterns & alerts */
  pattern: (id: string) => request<T.PatternFull>(`${A}/patterns/${id}`, { auth: s }),
  setPatternStatus: (id: string, status: 'monitoring' | 'escalated' | 'resolved', note?: string) =>
    request<T.PatternFull>(`${A}/patterns/${id}/status`, { method: 'POST', auth: s, body: { status, note: note || undefined } }),
  alerts: (p: { status?: string; page?: number; pageSize?: number } = {}) =>
    request<{ alerts: T.AlertListItem[]; pagination: T.Pagination }>(`${A}/alerts`, { auth: s, query: { ...p } }),
  alert: (id: string) => request<T.PatternFull>(`${A}/alerts/${id}`, { auth: s }),
  alertAction: (id: string, action: 'start_monitoring' | 'escalate' | 'resolve', note?: string) =>
    request<T.PatternFull>(`${A}/alerts/${id}/action`, { method: 'POST', auth: s, body: { action, note: note || undefined } }),

  /* reports */
  reports: (p: { q?: string; status?: string; page?: number; pageSize?: number }) =>
    request<{ reports: T.StaffReportRow[]; pagination: T.Pagination }>(`${A}/reports`, { auth: s, query: { ...p } }),
  report: (id: string) => request<T.StaffReportRow>(`${A}/reports/${id}`, { auth: s }),
  reviewReport: (id: string, decision: 'confirm' | 'dismiss' | 'spam', note?: string) =>
    request<T.StaffReportRow>(`${A}/reports/${id}/review`, { method: 'POST', auth: s, body: { decision, note: note || undefined } }),
  exportReportsCsv: (p: { q?: string; status?: string }) =>
    request<Blob>(`${A}/reports/export.csv`, { auth: s, query: { ...p }, blob: true }),

  /* cases */
  cases: (p: { status?: string; q?: string; page?: number; pageSize?: number } = {}) =>
    request<{ cases: T.CaseRow[]; pagination: T.Pagination }>(`${A}/cases`, { auth: s, query: { ...p } }),
  caseDetail: (id: string) => request<T.CaseFull>(`${A}/cases/${id}`, { auth: s }),
  createCase: (body: { patternId: string; title?: string; assignedOfficerId?: string; priority?: T.Level }) =>
    request<T.CaseRow>(`${A}/cases`, { method: 'POST', auth: s, body }),
  updateCase: (id: string, body: { status?: string; priority?: string; assignedOfficerId?: string | null; note?: string }) =>
    request<T.CaseRow>(`${A}/cases/${id}`, { method: 'PATCH', auth: s, body }),
  addCaseNote: (id: string, note: string) =>
    request<{ added: boolean }>(`${A}/cases/${id}/notes`, { method: 'POST', auth: s, body: { body: note } }),
  assignees: () => request<{ assignees: { id: string; name: string; officialId: string; role: string }[] }>(`${A}/cases/assignees`, { auth: s }),

  /* audit, users, notifications */
  auditLogs: (p: { q?: string; action?: string; result?: string; page?: number; pageSize?: number }) =>
    request<{ logs: T.AuditLog[]; actions: string[]; pagination: T.Pagination }>(`${A}/audit-logs`, { auth: s, query: { ...p } }),
  verifyAudit: () => request<{ valid: boolean; checked: number; brokenAtSeq: number | null }>(`${A}/audit-logs/verify`, { auth: s }),
  roles: () => request<T.RolesMatrix>(`${A}/access/roles`, { auth: s }),
  users: () => request<{ users: T.StaffUser[] }>(`${A}/users`, { auth: s, query: { pageSize: 100 } }),
  createUser: (body: { officialId: string; name: string; email: string; role: string; password: string }) =>
    request<T.StaffUser>(`${A}/users`, { method: 'POST', auth: s, body }),
  updateUser: (id: string, body: { role?: string; status?: string }) =>
    request<T.StaffUser>(`${A}/users/${id}`, { method: 'PATCH', auth: s, body }),
  notifications: (p: { unread?: boolean; pageSize?: number } = {}) =>
    request<{ notifications: T.StaffNotification[]; unreadCount: number }>(`${A}/notifications`, {
      auth: s, query: { unread: p.unread ? 'true' : undefined, pageSize: p.pageSize },
    }),
  readAllNotifications: () => request<{ marked: number }>(`${A}/notifications/read-all`, { method: 'POST', auth: s }),
};

