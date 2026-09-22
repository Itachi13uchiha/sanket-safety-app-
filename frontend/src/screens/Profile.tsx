import type { Screen } from '../types';
import { citizen } from '../api';
import { useAsync } from '../hooks/useAsync';
import { createStore } from '../state/store';
import { langStore, locationStore, readNotifStore } from '../state/app';
import type { Lang } from '../api';

// Notification preferences are device-local (anonymous users have no server-side profile).
const prefsStore = createStore({ nearby: true, system: true, digest: false }, { key: 'sanket.notifPrefs' });

export default function Profile({ navigate }: { navigate: (s: Screen) => void }) {
  const notifs = prefsStore.use();
  const setNotifs = (fn: (n: typeof notifs) => typeof notifs) => prefsStore.set(fn);
  const lang = langStore.use();
  const loc = locationStore.use();
  const mine = useAsync(() => citizen.myReports({ pageSize: 1 }).catch(() => null), []);
  const counts = mine.data?.counts;
  const enabled = Object.values(notifs).filter(Boolean).length;

  const menuItems: { icon: string; label: string; sub: string; section: Screen | null }[] = [
    { icon: '🔒', label: 'Anonymous Reporting', sub: 'Enabled · All reports anonymous', section: 'privacy' },
    { icon: '📋', label: 'My Reports', sub: counts ? `${counts.all} report${counts.all === 1 ? '' : 's'} submitted` : 'Track your reports', section: 'my-reports' },
    { icon: '🔔', label: 'Notification Preferences', sub: `${enabled} type${enabled === 1 ? '' : 's'} enabled`, section: null },
    { icon: '📍', label: 'Location Settings', sub: loc.source === 'default' ? 'Not shared' : loc.source === 'manual' ? `Area: ${loc.label}` : 'Using device location', section: 'location-permission' },
    { icon: '🛡️', label: 'Privacy & Data', sub: 'View your data rights', section: 'privacy' },
    { icon: '🌐', label: 'Language', sub: 'English / हिंदी / मराठी', section: null },
  ];

  const resetIdentity = () => {
    if (!window.confirm('Start over with a new anonymous identity? Your existing reports will no longer be listed under My Reports on this device.')) return;
    citizen.resetIdentity();
    readNotifStore.set([]);
    navigate('splash');
  };

  return (
    <div className="w-full min-h-full bg-[#F5F7FF] overflow-y-auto pb-8">
      {/* Header */}
      <div className="bg-white px-5 pt-4 pb-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('home')} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          </button>
          <h1 className="font-bold text-slate-900 text-xl">Profile</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#2D3BE8] flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-400/30">
            U
          </div>
          <div>
            <div className="font-bold text-slate-900 text-base">Anonymous User</div>
            <div className="text-xs text-slate-400 mt-0.5">No name, phone or e-mail stored</div>
            <div className="mt-2 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs font-medium text-green-600">Identity Protected</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <ProfileStat label="Reports" value={counts ? String(counts.all) : '–'} />
          <ProfileStat label="Open" value={counts ? String(counts.open) : '–'} />
          <ProfileStat label="Resolved" value={counts ? String(counts.resolved) : '–'} />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* Menu */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-50">
          {menuItems.map((item, i) => (
            <button key={i}
              onClick={() => item.section ? navigate(item.section) : undefined}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl">
              <span className="text-xl w-8 text-center">{item.icon}</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-800">{item.label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{item.sub}</div>
              </div>
              <svg className="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
              </svg>
            </button>
          ))}
        </div>

        {/* Notification Preferences inline */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="text-sm font-semibold text-slate-800 mb-3">Notification Preferences</div>
          <div className="space-y-3">
            <Toggle label="Nearby Alerts" sub="Get alerted to emerging patterns near you" value={notifs.nearby} onChange={v => setNotifs(n => ({ ...n, nearby: v }))} />
            <Toggle label="System Updates" sub="Product updates and announcements" value={notifs.system} onChange={v => setNotifs(n => ({ ...n, system: v }))} />
            <Toggle label="Daily Summary" sub="End-of-day safety digest" value={notifs.digest} onChange={v => setNotifs(n => ({ ...n, digest: v }))} />
          </div>
        </div>

        {/* Language */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="text-sm font-semibold text-slate-800 mb-1">Language / भाषा</div>
          <p className="text-[11px] text-slate-400 mb-3">Applies to incident types, statuses and alerts from the server.</p>
          <div className="space-y-2">
            {([
              { code: 'en', label: 'English', native: 'English' },
              { code: 'hi', label: 'Hindi', native: 'हिंदी' },
              { code: 'mr', label: 'Marathi', native: 'मराठी' },
            ] as { code: Lang; label: string; native: string }[]).map(l => (
              <button key={l.code} onClick={() => langStore.set(l.code)}
                className={`w-full text-left flex items-center justify-between p-3 rounded-xl border ${lang === l.code ? 'border-[#2D3BE8] bg-blue-50' : 'border-slate-100 bg-slate-50'}`}>
                <div>
                  <span className="text-sm font-semibold text-slate-800">{l.label}</span>
                  <span className="text-xs text-slate-400 ml-2">{l.native}</span>
                </div>
                {lang === l.code && (
                  <div className="w-5 h-5 rounded-full bg-[#2D3BE8] flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Logout */}
        <button onClick={resetIdentity} className="w-full py-4 border-2 border-red-200 text-red-500 font-semibold rounded-2xl bg-red-50 hover:bg-red-100 transition-colors">
          Reset Anonymous Identity
        </button>
      </div>
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-2 text-center">
      <div className="text-base font-bold text-[#2D3BE8]">{value}</div>
      <div className="text-[10px] text-slate-400 font-medium">{label}</div>
    </div>
  );
}

function Toggle({ label, sub, value, onChange }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1 mr-3">
        <div className="text-sm font-medium text-slate-700">{label}</div>
        <div className="text-xs text-slate-400">{sub}</div>
      </div>
      <button onClick={() => onChange(!value)}
        className={`w-12 h-6 rounded-full transition-colors relative ${value ? 'bg-[#2D3BE8]' : 'bg-slate-200'}`}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
