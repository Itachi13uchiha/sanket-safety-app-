import { useState } from 'react';
import type { Screen } from '../types';
import { citizen } from '../api';
import { locationStore } from '../state/app';
import { useAsync } from '../hooks/useAsync';
import { ErrorBox, Loading } from '../components/ui/StateViews';

export default function LocationPermission({ navigate }: { navigate: (s: Screen) => void }) {
  const [mode, setMode] = useState<'ask' | 'manual'>('ask');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const areas = useAsync(() => (mode === 'manual' ? citizen.areas() : Promise.resolve(null)), [mode]);

  const allow = () => {
    if (!('geolocation' in navigator)) {
      setError('This browser cannot share location. Please choose your area manually.');
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        locationStore.set({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'current', label: 'Current location' });
        navigate('home');
      },
      (err) => {
        setBusy(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. You can still choose your area manually.'
            : 'We could not work out your location. Please choose your area manually.',
        );
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  };

  if (mode === 'manual') {
    return (
      <div className="w-full min-h-full flex flex-col bg-white px-6">
        <div className="pt-4 pb-4 flex items-center gap-3">
          <button onClick={() => setMode('ask')} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center" aria-label="Back">
            <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          </button>
          <h2 className="text-xl font-bold text-slate-900">Choose your area</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">Pick the monitored area closest to you. Nothing else about you is collected.</p>
        {areas.loading && <Loading rows={4} />}
        {areas.error && <ErrorBox error={areas.error} onRetry={areas.reload} compact />}
        <div className="space-y-2 pb-8">
          {areas.data?.areas.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                locationStore.set({ lat: a.lat, lng: a.lng, source: 'manual', label: `${a.name}, ${a.city}`, areaId: a.id });
                navigate('home');
              }}
              className="w-full p-4 rounded-2xl border-2 border-slate-200 text-left flex items-center gap-3 hover:border-[#2D3BE8] hover:bg-blue-50 transition-colors"
            >
              <span className="text-2xl">📍</span>
              <div>
                <div className="text-sm font-semibold text-slate-800">{a.name}</div>
                <div className="text-xs text-slate-400">{a.city}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full flex flex-col bg-white px-6">
      {/* Back */}
      <div className="pt-4 pb-8 flex justify-start">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </div>
      </div>

      {/* Illustration */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-44 h-44 mb-8 animate-float">
          <svg viewBox="0 0 180 180" fill="none" className="w-full h-full">
            <circle cx="90" cy="90" r="80" fill="#EEF2FF"/>
            {/* Map */}
            <rect x="35" y="50" width="110" height="90" rx="10" fill="white" stroke="#E0E7FF" strokeWidth="2"/>
            {/* Road lines */}
            <line x1="35" y1="90" x2="145" y2="90" stroke="#E0E7FF" strokeWidth="3"/>
            <line x1="90" y1="50" x2="90" y2="140" stroke="#E0E7FF" strokeWidth="3"/>
            {/* Location pin pulsing */}
            <circle cx="90" cy="90" r="20" fill="#2D3BE8" opacity="0.1"/>
            <circle cx="90" cy="90" r="12" fill="#2D3BE8" opacity="0.2"/>
            <path d="M90 68C82 68 75 75 75 83C75 94 90 106 90 106C90 106 105 94 105 83C105 75 98 68 90 68Z" fill="#2D3BE8"/>
            <circle cx="90" cy="83" r="5" fill="white"/>
            {/* Buildings */}
            <rect x="45" y="60" width="15" height="25" rx="2" fill="#E0E7FF"/>
            <rect x="120" y="65" width="18" height="20" rx="2" fill="#E0E7FF"/>
            <rect x="50" y="100" width="12" height="20" rx="2" fill="#E0E7FF"/>
            <rect x="115" y="95" width="20" height="30" rx="2" fill="#E0E7FF"/>
          </svg>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Allow Location Access</h2>
          <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
            Help us understand where safety concerns are emerging. Your location helps detect nearby patterns and show relevant alerts.
          </p>
        </div>

        {/* Privacy note */}
        <div className="w-full bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-8">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-800 mb-1">Your identity is protected</p>
              <p className="text-xs text-blue-600 leading-relaxed">
                Your exact personal identity is never displayed publicly. Location data is used only for pattern detection in your area.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="pb-10 flex flex-col gap-3">
        {error && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</p>}
        <button onClick={allow} disabled={busy}
          className="w-full py-4 bg-[#2D3BE8] text-white font-semibold rounded-2xl text-base shadow-lg shadow-blue-400/30 active:scale-[0.98] transition-transform disabled:opacity-60">
          {busy ? 'Finding your location…' : 'Allow Location'}
        </button>
        <button onClick={() => setMode('manual')}
          className="w-full py-4 border-2 border-slate-200 text-slate-700 font-semibold rounded-2xl text-base hover:bg-slate-50 transition-colors">
          Enter Location Manually
        </button>
      </div>
    </div>
  );
}
