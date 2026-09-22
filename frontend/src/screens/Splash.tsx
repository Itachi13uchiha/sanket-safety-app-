import { useEffect } from 'react';
import type { Screen } from '../types';

export default function Splash({ navigate }: { navigate: (s: Screen) => void }) {
  useEffect(() => {
    const t = setTimeout(() => navigate('onboarding'), 2500);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="relative w-full flex flex-col items-center justify-center overflow-hidden"
      style={{ minHeight: '100%', height: '100%', background: 'linear-gradient(160deg, #0D1B6B 0%, #1A237E 40%, #2D3BE8 100%)' }}>

      {/* Stars / particles */}
      {[...Array(20)].map((_, i) => (
        <div key={i} className="absolute rounded-full bg-white"
          style={{
            width: Math.random() * 3 + 1,
            height: Math.random() * 3 + 1,
            top: `${Math.random() * 60}%`,
            left: `${Math.random() * 100}%`,
            opacity: Math.random() * 0.4 + 0.1,
          }}
        />
      ))}

      {/* City skyline silhouette */}
      <svg viewBox="0 0 390 120" className="absolute bottom-0 w-full" preserveAspectRatio="xMidYMax slice">
        <path d="M0,120 L0,80 L20,80 L20,60 L30,60 L30,50 L40,50 L40,60 L50,60 L50,40 L55,40 L55,30 L60,30 L60,40 L65,40 L65,80 L80,80 L80,55 L85,55 L85,45 L95,45 L95,55 L100,55 L100,70 L110,70 L110,50 L120,50 L120,35 L125,35 L125,25 L130,25 L130,35 L135,35 L135,50 L145,50 L145,65 L160,65 L160,45 L170,45 L170,30 L175,30 L175,20 L180,20 L180,30 L185,30 L185,45 L195,45 L195,60 L210,60 L210,50 L215,50 L215,40 L225,40 L225,50 L235,50 L235,60 L245,60 L245,45 L255,45 L255,55 L265,55 L265,40 L270,40 L270,30 L278,30 L278,20 L283,20 L283,30 L290,30 L290,40 L300,40 L300,55 L315,55 L315,65 L330,65 L330,50 L340,50 L340,40 L350,40 L350,50 L360,50 L360,65 L375,65 L375,80 L390,80 L390,120 Z"
          fill="rgba(255,255,255,0.08)" />
        <path d="M0,120 L0,90 L15,90 L15,75 L35,75 L35,85 L55,85 L55,70 L70,70 L70,80 L90,80 L90,68 L105,68 L105,78 L125,78 L125,62 L140,62 L140,75 L160,75 L160,60 L180,60 L180,72 L200,72 L200,65 L215,65 L215,75 L235,75 L235,62 L250,62 L250,72 L270,72 L270,58 L290,58 L290,70 L310,70 L310,80 L330,80 L330,68 L355,68 L355,78 L375,78 L375,90 L390,90 L390,120 Z"
          fill="rgba(255,255,255,0.05)" />
      </svg>

      {/* Logo */}
      <div className="animate-fade-in flex flex-col items-center z-10">
        <div className="animate-float w-20 h-20 rounded-3xl bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center mb-6 shadow-2xl">
          <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none">
            <path d="M24 4C15.16 4 8 11.16 8 20C8 31.5 24 44 24 44C24 44 40 31.5 40 20C40 11.16 32.84 4 24 4Z" fill="#60A5FA" opacity="0.9"/>
            <path d="M24 4C15.16 4 8 11.16 8 20C8 31.5 24 44 24 44C24 44 40 31.5 40 20C40 11.16 32.84 4 24 4Z" fill="url(#shieldGrad)" />
            <defs>
              <linearGradient id="shieldGrad" x1="8" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
                <stop stopColor="#93C5FD"/>
                <stop offset="1" stopColor="#3B82F6"/>
              </linearGradient>
            </defs>
            <circle cx="24" cy="21" r="5" fill="white" opacity="0.9"/>
            <path d="M24 27C20 27 17 29 17 31V32H31V31C31 29 28 27 24 27Z" fill="white" opacity="0.9"/>
          </svg>
        </div>

        <h1 className="text-4xl font-bold text-white tracking-tight mb-2">Sanket</h1>
        <p className="text-blue-200 text-sm font-medium tracking-widest uppercase">Small Signals. Safer Places.</p>

        <div className="mt-12 flex flex-col items-center gap-3">
          <p className="text-blue-300 text-sm">Report. Alert. Prevent.</p>
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className={`h-1 rounded-full bg-white ${i === 0 ? 'w-6 opacity-100' : 'w-2 opacity-30'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Loading bar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full overflow-hidden">
        <div className="h-full bg-blue-300 rounded-full"
          style={{ animation: 'loadBar 2.4s ease-in-out forwards', width: '0%' }} />
      </div>

      <style>{`
        @keyframes loadBar { from { width: 0% } to { width: 100% } }
      `}</style>
    </div>
  );
}
