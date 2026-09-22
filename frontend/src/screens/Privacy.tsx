import { useState } from 'react';
import type { Screen } from '../types';
import { citizen, friendly, toApiError } from '../api';
import { useAsync } from '../hooks/useAsync';
import { readNotifStore } from '../state/app';

export default function Privacy({ navigate }: { navigate: (s: Screen) => void }) {
  const info = useAsync(() => citizen.privacy(), []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const days = info.data?.retentionDays ?? 90;

  const deleteData = async () => {
    if (!window.confirm('Delete all reports submitted from this device? This cannot be undone.')) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await citizen.deleteMyData();
      readNotifStore.set([]);
      setMsg({ ok: true, text: `Done. ${r.reportsRemoved} report${r.reportsRemoved === 1 ? '' : 's'} deleted from this device's anonymous identity.` });
    } catch (e) {
      setMsg({ ok: false, text: friendly(toApiError(e)) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full min-h-full bg-[#F5F7FF] overflow-y-auto pb-8">
      <div className="bg-white px-5 pt-4 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('profile')} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          </button>
          <h1 className="font-bold text-slate-900 text-xl">Privacy & Data</h1>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div className="bg-[#1A237E] rounded-2xl p-5 text-white">
          <div className="text-2xl mb-3">🛡️</div>
          <h2 className="font-bold text-lg mb-2">Your Privacy is our Priority</h2>
          <p className="text-blue-200 text-sm leading-relaxed">Sanket is built from the ground up to protect your identity while enabling community safety.</p>
        </div>

        {[
          { icon: '👤', title: 'Reports are Anonymous', body: 'No name, phone number, email, or any identifying information is ever attached to your safety reports. Reports are truly anonymous from the moment you submit.' },
          { icon: '🔒', title: 'Identity Never Displayed', body: 'Your personal identity is never publicly displayed or shared with other citizens. Only aggregated, anonymized data is ever shown on public interfaces.' },
          { icon: '📊', title: 'Data Aggregated for Patterns', body: 'Individual reports are aggregated with other signals to detect emerging safety patterns. No individual report can be traced back to a specific person.' },
          { icon: '🛡️', title: 'Protected Against Misuse', body: 'Our multi-factor pattern detection system prevents fake or coordinated report abuse. Each pattern requires diverse, independent signals across time and location.' },
          { icon: '🗑️', title: 'Data Retention', body: `Raw report data is retained for ${days} days for pattern analysis and then removed. You can delete everything reported from this device at any time using the button below.` },
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{item.icon}</span>
              <div>
                <div className="text-sm font-semibold text-slate-800 mb-1">{item.title}</div>
                <p className="text-xs text-slate-500 leading-relaxed">{item.body}</p>
              </div>
            </div>
          </div>
        ))}

        {msg && (
          <p role="status" className={`text-xs rounded-xl p-3 border ${msg.ok ? 'text-green-700 bg-green-50 border-green-100' : 'text-red-600 bg-red-50 border-red-100'}`}>{msg.text}</p>
        )}
        <button onClick={deleteData} disabled={busy}
          className="w-full py-4 border-2 border-slate-200 rounded-2xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
          {busy ? 'Deleting…' : 'Delete My Data'}
        </button>
      </div>
    </div>
  );
}
