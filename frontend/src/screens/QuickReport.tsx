import { useRef, useState } from 'react';
import type { Screen } from '../types';
import MapView from '../components/MapView';
import { citizen, friendly, toApiError, type ApiError, type LatLng, type NewReportBody } from '../api';
import { useAsync } from '../hooks/useAsync';
import { lastReportStore, langStore, locationStore } from '../state/app';
import { uuid } from '../lib/id';
import { Loading } from '../components/ui/StateViews';

const categories = [
  { id: 'harassment',  label: 'Harassment',           icon: '🚫', color: 'bg-red-50 border-red-200',    active: 'bg-red-500 border-red-500 text-white' },
  { id: 'catcalling',  label: 'Catcalling',            icon: '📢', color: 'bg-orange-50 border-orange-200', active: 'bg-orange-500 border-orange-500 text-white' },
  { id: 'following',   label: 'Following',             icon: '👤', color: 'bg-amber-50 border-amber-200',  active: 'bg-amber-500 border-amber-500 text-white' },
  { id: 'loitering',   label: 'Loitering',             icon: '🕐', color: 'bg-yellow-50 border-yellow-200',active: 'bg-yellow-500 border-yellow-500 text-white' },
  { id: 'suspicious',  label: 'Suspicious Activity',   icon: '👁️', color: 'bg-purple-50 border-purple-200',active: 'bg-purple-500 border-purple-500 text-white' },
  { id: 'intimidation',label: 'Intimidation',          icon: '⚠️', color: 'bg-pink-50 border-pink-200',    active: 'bg-pink-500 border-pink-500 text-white' },
  { id: 'unsafe-area', label: 'Unsafe Area',           icon: '📍', color: 'bg-blue-50 border-blue-200',    active: 'bg-blue-500 border-blue-500 text-white' },
  { id: 'other',       label: 'Other',                 icon: '💬', color: 'bg-slate-50 border-slate-200',  active: 'bg-slate-600 border-slate-600 text-white' },
];

const timeOptions = [
  { id: 'now',    label: 'Just Now',             sub: 'Right now' },
  { id: 'hour',   label: 'Within the Last Hour', sub: 'Less than 60 mins ago' },
  { id: 'today',  label: 'Earlier Today',        sub: 'A few hours ago' },
];

type LocId = 'current' | 'map' | 'area';

export default function QuickReport({ navigate }: { navigate: (s: Screen) => void }) {
  const lang = langStore.use();
  const loc = locationStore.use();
  const meta = useAsync(() => citizen.meta(), [lang]);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<{ category: string; location: LocId | ''; time: string; note: string; picked: LatLng | null; areaId: string | null }>(
    { category: '', location: '', time: '', note: '', picked: null, areaId: null },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const idempotencyKey = useRef(uuid()); // reused on retry so a flaky network can never create two reports
  const areas = useAsync(() => (step === 1 && selected.location === 'area' ? citizen.areas() : Promise.resolve(null)), [step, selected.location]);

  const hasCurrent = loc.source !== 'default';
  const catLabel = (id: string, fallback: string) => meta.data?.categories.find((c) => c.id === id)?.label ?? fallback;
  const timeLabel = (id: string, fallback: string) => meta.data?.timeOptions.find((t) => t.id === id)?.label ?? fallback;
  const locationOptions: { id: LocId; label: string; icon: string; sub: string; disabled?: boolean }[] = [
    { id: 'current', label: 'Use Current Location', icon: '📍', sub: hasCurrent ? loc.label : 'Location not shared – pick another option', disabled: !hasCurrent },
    { id: 'map',     label: 'Select on Map',        icon: '🗺️', sub: 'Tap to pick location' },
    { id: 'area',    label: 'Choose an Area',       icon: '🏙️', sub: 'Pick from monitored areas' },
  ];

  const steps = ['What happened?', 'Where?', 'When?', 'Anything else?'];
  const progress = ((step + 1) / steps.length) * 100;

  const locationReady =
    selected.location === 'current' ? hasCurrent
    : selected.location === 'map' ? !!selected.picked
    : selected.location === 'area' ? !!selected.areaId
    : false;

  const canNext = step === 0 ? !!selected.category
    : step === 1 ? locationReady
    : step === 2 ? !!selected.time
    : true;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: NewReportBody = {
        category: selected.category,
        when: selected.time as NewReportBody['when'],
        note: selected.note.trim() || undefined,
        locationSource: 'current',
      };
      if (selected.location === 'current') {
        if (loc.source === 'manual' && loc.areaId) Object.assign(body, { areaId: loc.areaId, locationSource: 'manual' });
        else Object.assign(body, { lat: loc.lat, lng: loc.lng, locationSource: 'current' });
      } else if (selected.location === 'map' && selected.picked) {
        Object.assign(body, { lat: selected.picked.lat, lng: selected.picked.lng, locationSource: 'map' });
      } else if (selected.location === 'area' && selected.areaId) {
        Object.assign(body, { areaId: selected.areaId, locationSource: 'manual' });
      }
      const report = await citizen.submitReport(body, idempotencyKey.current);
      lastReportStore.set(report);
      navigate('report-success');
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleNext = () => {
    if (step < 3) setStep(s => s + 1);
    else void submit();
  };

  const locSummary =
    selected.location === 'current' ? `Current Location · ${loc.label}`
    : selected.location === 'map' ? 'Selected on Map'
    : selected.location === 'area' ? (areas.data?.areas.find((a) => a.id === selected.areaId)?.name ?? 'Chosen area')
    : '—';

  return (
    <div className="w-full min-h-full bg-white flex flex-col">
      {/* Header */}
      <div className="px-5 pt-4 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => step > 0 ? setStep(s => s - 1) : navigate('home')}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
          </button>
          <div className="flex-1">
            <div className="text-xs text-slate-400 font-medium mb-1">Step {step + 1} of {steps.length}</div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#2D3BE8] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          {step === 0 && 'What did you notice?'}
          {step === 1 && 'Where did it happen?'}
          {step === 2 && 'When did it happen?'}
          {step === 3 && 'Anything else? (Optional)'}
        </h2>
        {step === 3 && <p className="text-sm text-slate-400 mt-1">Add a brief description to help authorities understand the context.</p>}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {step === 0 && (
          <div className="grid grid-cols-2 gap-3">
            {categories.map(cat => {
              const isActive = selected.category === cat.id;
              return (
                <button key={cat.id}
                  onClick={() => setSelected(s => ({ ...s, category: cat.id }))}
                  className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 active:scale-[0.96] ${isActive ? cat.active : `${cat.color} text-slate-700`}`}>
                  <span className="text-2xl mb-2 block">{cat.icon}</span>
                  <span className="text-sm font-semibold leading-tight">{catLabel(cat.id, cat.label)}</span>
                </button>
              );
            })}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            {locationOptions.map(opt => {
              const isActive = selected.location === opt.id;
              return (
                <button key={opt.id} disabled={opt.disabled}
                  onClick={() => setSelected(s => ({ ...s, location: opt.id }))}
                  className={`w-full p-4 rounded-2xl border-2 text-left flex items-center gap-4 transition-all disabled:opacity-40 ${isActive ? 'border-[#2D3BE8] bg-blue-50' : 'border-slate-200 bg-white'}`}>
                  <span className="text-3xl">{opt.icon}</span>
                  <div>
                    <div className={`font-semibold text-sm ${isActive ? 'text-[#2D3BE8]' : 'text-slate-800'}`}>{opt.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{opt.sub}</div>
                  </div>
                  {isActive && (
                    <div className="ml-auto w-5 h-5 rounded-full bg-[#2D3BE8] flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}

            {selected.location === 'map' && (
              <div className="h-56 rounded-2xl overflow-hidden border-2 border-slate-200">
                <MapView compact={false} center={loc} radiusKm={2} points={[]} showCenter
                  pick={{ value: selected.picked, onPick: (p) => setSelected(s => ({ ...s, picked: p })) }} />
              </div>
            )}

            {selected.location === 'area' && (
              <div className="space-y-2">
                {areas.loading && <Loading rows={2} />}
                {areas.data?.areas.map(a => (
                  <button key={a.id} onClick={() => setSelected(s => ({ ...s, areaId: a.id }))}
                    className={`w-full px-4 py-3 rounded-xl border-2 text-left text-sm font-medium ${selected.areaId === a.id ? 'border-[#2D3BE8] bg-blue-50 text-[#2D3BE8]' : 'border-slate-200 text-slate-700'}`}>
                    {a.name} <span className="text-xs text-slate-400 font-normal">· {a.city}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {timeOptions.map(opt => {
              const isActive = selected.time === opt.id;
              return (
                <button key={opt.id}
                  onClick={() => setSelected(s => ({ ...s, time: opt.id }))}
                  className={`w-full p-4 rounded-2xl border-2 text-left flex items-center justify-between transition-all ${isActive ? 'border-[#2D3BE8] bg-blue-50' : 'border-slate-200 bg-white'}`}>
                  <div>
                    <div className={`font-semibold text-sm ${isActive ? 'text-[#2D3BE8]' : 'text-slate-800'}`}>{timeLabel(opt.id, opt.label)}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{opt.sub}</div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isActive ? 'border-[#2D3BE8] bg-[#2D3BE8]' : 'border-slate-300'}`}>
                    {isActive && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <textarea
              value={selected.note}
              onChange={e => setSelected(s => ({ ...s, note: e.target.value }))}
              maxLength={200}
              placeholder="e.g. Near main gate, platform 2... (optional)"
              className="w-full h-36 p-4 rounded-2xl border-2 border-slate-200 text-sm text-slate-700 resize-none focus:outline-none focus:border-[#2D3BE8] placeholder:text-slate-300"
            />
            <div className="text-right text-xs text-slate-400">{selected.note.length}/200</div>

            {/* Summary */}
            <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Report Summary</div>
              <Row label="Incident" value={selected.category ? catLabel(selected.category, categories.find(c => c.id === selected.category)?.label ?? '—') : '—'} />
              <Row label="Location" value={locSummary} />
              <Row label="Time" value={selected.time ? timeLabel(selected.time, timeOptions.find(t => t.id === selected.time)?.label ?? '—') : '—'} />
              <Row label="Identity" value="Anonymous" highlight />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-10">
        {/* Privacy note */}
        <div className="flex items-center gap-2 mb-4 px-1">
          <svg className="w-4 h-4 text-green-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
          </svg>
          <p className="text-xs text-slate-400">No name, phone number, or public identity is attached to your report.</p>
        </div>

        {error && (
          <p role="alert" className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
            {error.code === 'LOCATION_REQUIRED' ? 'Please choose a location for this report.' : friendly(error)}
            {error.code === 'NETWORK_ERROR' && ' Your answers are kept – tap Submit again to retry.'}
          </p>
        )}
        <button onClick={handleNext} disabled={!canNext || busy}
          className="w-full py-4 rounded-2xl font-bold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          style={{ background: canNext && !busy ? 'linear-gradient(135deg, #2D3BE8 0%, #1A237E 100%)' : '#E2E8F0', color: canNext && !busy ? 'white' : '#94A3B8' }}>
          {step === 3 ? (busy ? 'Submitting…' : '🔒 Submit Anonymously') : 'Next →'}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-xs font-semibold ${highlight ? 'text-green-600' : 'text-slate-700'}`}>{value}</span>
    </div>
  );
}
