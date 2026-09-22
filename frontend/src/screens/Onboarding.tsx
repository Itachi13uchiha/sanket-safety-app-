import { useState } from 'react';
import type { Screen } from '../types';

const slides = [
  {
    title: 'Notice something uncomfortable?',
    body: 'It takes only a few seconds to make a difference. Your small signal can help keep public spaces safer.',
    Icon: SlideIcon1,
    bg: '#EEF2FF',
  },
  {
    title: 'Report it in seconds.',
    body: 'Tap, choose the incident type, confirm your location, and submit — completely anonymous. No forms, no hassle.',
    Icon: SlideIcon2,
    bg: '#F0FDF4',
  },
  {
    title: 'Help identify emerging safety patterns.',
    body: 'Your reports join others to reveal patterns. Authorities are alerted automatically when a pattern emerges — not just individual reports.',
    Icon: SlideIcon3,
    bg: '#FFF7ED',
  },
];

function SlideIcon1() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" fill="none">
      <circle cx="60" cy="60" r="50" fill="#E0E7FF" />
      {/* Person silhouette feeling uncomfortable */}
      <ellipse cx="60" cy="45" rx="14" ry="14" fill="#4F46E5" opacity="0.8"/>
      <path d="M42 80C42 67 50 62 60 62C70 62 78 67 78 80" stroke="#4F46E5" strokeWidth="4" fill="none" strokeLinecap="round"/>
      {/* Location pin */}
      <path d="M85 28C81 28 78 31 78 35C78 41 85 48 85 48C85 48 92 41 92 35C92 31 89 28 85 28Z" fill="#EF4444"/>
      <circle cx="85" cy="35" r="3" fill="white"/>
      {/* Exclamation */}
      <circle cx="38" cy="72" r="10" fill="#F59E0B" opacity="0.9"/>
      <text x="38" y="77" textAnchor="middle" fontSize="14" fontWeight="bold" fill="white">!</text>
    </svg>
  );
}
function SlideIcon2() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" fill="none">
      <circle cx="60" cy="60" r="50" fill="#DCFCE7" />
      {/* Phone */}
      <rect x="40" y="28" width="40" height="64" rx="6" fill="white" stroke="#10B981" strokeWidth="2"/>
      <rect x="45" y="35" width="30" height="45" rx="3" fill="#F0FDF4"/>
      {/* Checkmarks */}
      <circle cx="60" cy="57" r="14" fill="#10B981"/>
      <path d="M53 57L58 62L68 52" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Timer indicator */}
      <text x="60" y="93" textAnchor="middle" fontSize="7" fontWeight="600" fill="#6B7280">3 seconds</text>
    </svg>
  );
}
function SlideIcon3() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" fill="none">
      <circle cx="60" cy="60" r="50" fill="#FEF3C7" />
      {/* Network nodes */}
      {[
        [60,60],[35,40],[85,40],[35,80],[85,80],[60,25]
      ].map(([cx,cy],i) => (
        <g key={i}>
          {i>0 && <line x1="60" y1="60" x2={cx} y2={cy} stroke="#F59E0B" strokeWidth="1.5" opacity="0.5"/>}
          <circle cx={cx} cy={cy} r={i===0?10:7} fill={i===0?"#F59E0B":"#FCD34D"} opacity="0.9"/>
        </g>
      ))}
      <text x="60" y="64" textAnchor="middle" fontSize="9" fontWeight="bold" fill="white">PAT</text>
      {/* Alert icon top right */}
      <circle cx="88" cy="28" r="12" fill="#EF4444" opacity="0.9"/>
      <text x="88" y="33" textAnchor="middle" fontSize="14" fontWeight="bold" fill="white">!</text>
    </svg>
  );
}

export default function Onboarding({ navigate }: { navigate: (s: Screen) => void }) {
  const [step, setStep] = useState(0);
  const slide = slides[step];

  return (
    <div className="w-full min-h-full flex flex-col bg-white">
      {/* Skip */}
      <div className="flex justify-end px-6 pt-4 pb-4">
        <button onClick={() => navigate('location-permission')}
          className="text-sm text-slate-400 font-medium px-3 py-1 rounded-full hover:bg-slate-100 transition-colors">
          Skip
        </button>
      </div>

      {/* Illustration */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8">
        <div className="w-48 h-48 animate-fade-in" key={step}>
          <slide.Icon />
        </div>

        <div className="text-center animate-fade-in" key={`text-${step}`}>
          <h2 className="text-2xl font-bold text-slate-900 mb-3 leading-snug">{slide.title}</h2>
          <p className="text-slate-500 text-sm leading-relaxed max-w-xs">{slide.body}</p>
        </div>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-2 mb-6">
        {slides.map((_, i) => (
          <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-[#2D3BE8]' : 'w-2 bg-slate-200'}`} />
        ))}
      </div>

      {/* Buttons */}
      <div className="px-6 pb-10 flex flex-col gap-3">
        {step < slides.length - 1 ? (
          <>
            <button onClick={() => setStep(s => s + 1)}
              className="w-full py-4 bg-[#2D3BE8] text-white font-semibold rounded-2xl text-base shadow-lg shadow-blue-400/30 active:scale-[0.98] transition-transform">
              Next
            </button>
            <button onClick={() => navigate('location-permission')}
              className="w-full py-3 text-slate-400 font-medium text-sm">
              Skip
            </button>
          </>
        ) : (
          <button onClick={() => navigate('location-permission')}
            className="w-full py-4 bg-[#2D3BE8] text-white font-semibold rounded-2xl text-base shadow-lg shadow-blue-400/30 active:scale-[0.98] transition-transform">
            Get Started
          </button>
        )}
      </div>
    </div>
  );
}
