import { createStore } from './store';
import type { Lang, StaffSession, SubmittedReport } from '../api/types';

/** Language for labels returned by the API (categories, statuses, time options). */
export const langStore = createStore<Lang>('en', { key: 'sanket.lang' });

export interface UserLocation {
  lat: number;
  lng: number;
  /** current = device GPS · manual = a monitored area the user picked · default = nothing shared yet */
  source: 'current' | 'manual' | 'default';
  label: string;
  areaId?: string;
}
export const DEFAULT_LOCATION: UserLocation = { lat: 18.5204, lng: 73.8567, source: 'default', label: 'Pune, Maharashtra' };
export const locationStore = createStore<UserLocation>(DEFAULT_LOCATION, { key: 'sanket.location' });

/** The report just submitted (shown on the success screen). */
export const lastReportStore = createStore<SubmittedReport | null>(null);
/** Pattern the citizen is looking at. */
export const patternStore = createStore<string | null>(null);

/** Authority session. sessionStorage: it disappears when the tab closes. */
export const staffStore = createStore<StaffSession | null>(null, { key: 'sanket.staff', storage: 'session' });

/** Anonymous users have no server-side "read" state; notifications are marked read on this device. */
export const readNotifStore = createStore<string[]>([], { key: 'sanket.readNotifs' });
