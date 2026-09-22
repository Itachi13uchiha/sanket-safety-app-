import { useEffect } from 'react';
import type { Screen } from '../types';
import { lastReportStore } from '../state/app';
import { fmtTime } from '../lib/format';

export default function ReportSuccess({ navigate }: { navigate: (s: Screen) => void }) {
  const report = lastReportStore.use();
  useEffect(() => {
    if (!report) navigate('home'); // opened directly, nothing to show
  }, [report, navigate]);
  if (!report) return null;

  return (
    <div className="w-full min-h-full bg-white flex flex-col items-center justify-between px-6 py-12">
      {/* Success animation */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="w-28 h-28 rounded-full bg-green-50 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-12 h-12 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          {/* Pulse rings */}
          <div className="absolute inset-0 rounded-full bg-green-300 opacity-20 animate-ping" />
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">{report.duplicate ? 'Already Received' : 'Signal Received'}</h2>
          <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
            {report.duplicate
              ? 'We already have this report from you, so it was not counted twice. Thank you.'
              : 'Your anonymous report has been added to the local safety pattern. Thank you for helping make public spaces safer.'}
          </p>
        </div>

        {/* Report details card */}
        <div className="w-full bg-slate-50 rounded-2xl p-5 space-y-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Report Details</div>

          <DetailRow icon="📍" label="Location" value={report.location.label} />
          <DetailRow icon="🚫" label="Incident" value={report.category.label} />
          <DetailRow icon="🕐" label="Time" value={`${report.time.label} · ${fmtTime(report.submittedAt)}`} />
          <div className="pt-2 mt-2 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                </svg>
              </div>
              <span className="text-xs font-semibold text-green-700">Submitted Anonymously</span>
            </div>
            <span className="text-xs font-mono text-slate-400">#{report.id}</span>
          </div>
        </div>

        {/* Pattern info */}
        <div className="w-full bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-800 mb-0.5">How this helps</p>
              <p className="text-xs text-blue-600 leading-relaxed">
                When multiple independent reports emerge from this area, an alert is automatically sent to local authorities for monitoring.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="w-full flex flex-col gap-3">
        <button onClick={() => navigate('nearby-map')}
          className="w-full py-4 bg-[#2D3BE8] text-white font-semibold rounded-2xl shadow-lg shadow-blue-400/30 active:scale-[0.98] transition-transform">
          View Nearby Patterns
        </button>
        <button onClick={() => navigate('home')}
          className="w-full py-4 border-2 border-slate-200 text-slate-700 font-semibold rounded-2xl hover:bg-slate-50 transition-colors">
          Back to Home
        </button>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-base">{icon}</span>
      <div className="flex-1 flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs font-semibold text-slate-700">{value}</span>
      </div>
    </div>
  );
}
