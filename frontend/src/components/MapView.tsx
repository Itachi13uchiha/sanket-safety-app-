import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '../api/types';

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  level: 'high' | 'medium' | 'low';
  label: string;
  count: number;
  sub?: string;
}

const KM_PER_DEG = 111.32;

/**
 * Equirectangular projection onto a W×H canvas. The shorter side always spans ±radiusKm around the centre
 * (50 units = radiusKm), so a point inside the radius is visible whatever the container's aspect ratio.
 */
export function project(center: LatLng, p: LatLng, radiusKm: number, W = 100, H = 100) {
  const dx = (p.lng - center.lng) * Math.cos((center.lat * Math.PI) / 180) * KM_PER_DEG;
  const dy = (p.lat - center.lat) * KM_PER_DEG;
  const unit = 50 / radiusKm;
  return { x: W / 2 + dx * unit, y: H / 2 - dy * unit };
}

export function unproject(center: LatLng, x: number, y: number, radiusKm: number, W = 100, H = 100): LatLng {
  const unit = 50 / radiusKm;
  const dx = (x - W / 2) / unit;
  const dy = (H / 2 - y) / unit;
  return {
    lat: center.lat + dy / KM_PER_DEG,
    lng: center.lng + dx / (KM_PER_DEG * Math.cos((center.lat * Math.PI) / 180)),
  };
}

/** Pick a centre and radius that show every point with some breathing room. */
export function fitView(points: LatLng[], fallback: LatLng, minRadiusKm = 1.5): { center: LatLng; radiusKm: number } {
  if (!points.length) return { center: fallback, radiusKm: 5 };
  const lat = (Math.min(...points.map((p) => p.lat)) + Math.max(...points.map((p) => p.lat))) / 2;
  const lng = (Math.min(...points.map((p) => p.lng)) + Math.max(...points.map((p) => p.lng))) / 2;
  const center = { lat, lng };
  let far = 0;
  for (const p of points) {
    const dx = (p.lng - lng) * Math.cos((lat * Math.PI) / 180) * KM_PER_DEG;
    const dy = (p.lat - lat) * KM_PER_DEG;
    far = Math.max(far, Math.hypot(dx, dy));
  }
  return { center, radiusKm: Math.max(minRadiusKm, far * 1.4) };
}

const colors = {
  high:   { fill: '#EF4444', stroke: '#DC2626', text: 'text-red-600',   bg: 'bg-red-50' },
  medium: { fill: '#F59E0B', stroke: '#D97706', text: 'text-amber-600', bg: 'bg-amber-50' },
  low:    { fill: '#10B981', stroke: '#059669', text: 'text-green-600', bg: 'bg-green-50' },
};

const roads = [
  'M 0,30 L 100,30', 'M 0,55 L 100,55', 'M 0,75 L 100,75',
  'M 20,0 L 20,100', 'M 50,0 L 50,100', 'M 80,0 L 80,100',
  'M 0,10 L 40,30', 'M 60,70 L 100,90',
  'M 0,45 L 30,55', 'M 70,40 L 100,50',
];

/**
 * Stylised map that plots real coordinates. In `pick` mode the user taps anywhere to choose a location.
 * (Swap the SVG for Leaflet/MapLibre later without changing the callers: they only pass points + centre.)
 */
export default function MapView({
  points,
  center,
  radiusKm = 5,
  onPointClick,
  selectedId,
  compact = false,
  showCenter = true,
  pick,
}: {
  points: MapPoint[];
  center: LatLng;
  radiusKm?: number;
  onPointClick?: (p: MapPoint) => void;
  selectedId?: string;
  compact?: boolean;
  showCenter?: boolean;
  pick?: { value: LatLng | null; onPick: (p: LatLng) => void };
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(1);

  // Keep the canvas the same shape as its container so nothing is cropped and circles stay round.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) setAspect(el.clientWidth / el.clientHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = aspect >= 1 ? 100 * aspect : 100;
  const H = aspect >= 1 ? 100 : 100 / aspect;

  const placed = points
    .map((p) => ({ p, ...project(center, p, radiusKm, W, H) }))
    .filter(({ x, y }) => x > -4 && x < W + 4 && y > -4 && y < H + 4);

  const handlePick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!pick || !svgRef.current) return;
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svg.getScreenCTM();
    if (!m) return;
    const local = pt.matrixTransform(m.inverse());
    pick.onPick(unproject(center, local.x, local.y, radiusKm, W, H));
  };

  const picked = pick?.value ? project(center, pick.value, radiusKm, W, H) : null;
  const hover = hovered ? placed.find((x) => x.p.id === hovered)?.p : undefined;

  return (
    <div ref={boxRef} className={`relative map-bg rounded-2xl overflow-hidden ${compact ? 'h-44' : 'h-full'}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className={`absolute inset-0 w-full h-full ${pick ? 'cursor-crosshair' : ''}`}
        onClick={handlePick}
      >
        <g transform={`scale(${W / 100} ${H / 100})`}>
          {roads.map((d, i) => (
            <path key={i} d={d} stroke="white" strokeWidth="1.2" fill="none" opacity="0.7" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 1.6 }} />
          ))}
        </g>

        {placed.map(({ p, x, y }) => {
          const col = colors[p.level];
          const isSelected = selectedId === p.id;
          const isHovered = hovered === p.id;
          return (
            <g key={p.id}>
              <circle cx={x} cy={y} r={isSelected ? 12 : 9} fill={col.fill} opacity="0.15" />
              <circle cx={x} cy={y} r={isSelected ? 8 : 6} fill={col.fill} opacity="0.25" />
              <circle
                cx={x} cy={y} r={isSelected || isHovered ? 4.5 : 3.5}
                fill={col.fill} stroke={col.stroke} strokeWidth="0.8"
                style={{ cursor: onPointClick ? 'pointer' : 'default', transition: 'r 0.2s' }}
                onClick={(e) => { e.stopPropagation(); onPointClick?.(p); }}
                onMouseEnter={() => setHovered(p.id)}
                onMouseLeave={() => setHovered(null)}
              />
              <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize="2.5" fontWeight="700" fill="white"
                style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {p.count}
              </text>
            </g>
          );
        })}

        {showCenter && (
          <>
            <circle cx={W / 2} cy={H / 2} r={2} fill="#2D3BE8" stroke="white" strokeWidth="1" />
            <circle cx={W / 2} cy={H / 2} r={5} fill="#2D3BE8" opacity="0.2" />
          </>
        )}

        {picked && (
          <g style={{ pointerEvents: 'none' }}>
            <circle cx={picked.x} cy={picked.y} r={6} fill="#2D3BE8" opacity="0.15" />
            <path d={`M ${picked.x} ${picked.y - 1} c -3 -4 -5 -6 -5 -9 a 5 5 0 1 1 10 0 c 0 3 -2 5 -5 9 z`} fill="#2D3BE8" stroke="white" strokeWidth="0.8" />
            <circle cx={picked.x} cy={picked.y - 10} r={1.8} fill="white" />
          </g>
        )}
      </svg>

      {!compact && !pick && (
        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur rounded-xl px-3 py-2 shadow-sm">
          <div className="text-[10px] font-semibold text-slate-500 mb-1">Activity Level</div>
          {(['high', 'medium', 'low'] as const).map((l) => (
            <div key={l} className="flex items-center gap-1.5 text-[10px] font-medium capitalize text-slate-700">
              <span className="w-2 h-2 rounded-full" style={{ background: colors[l].fill }} />
              {l}
            </div>
          ))}
        </div>
      )}

      {pick && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur rounded-full px-3 py-1 text-[10px] font-semibold text-slate-600 shadow-sm whitespace-nowrap">
          {pick.value ? 'Tap again to move the pin' : 'Tap the map to drop a pin'}
        </div>
      )}

      {hover && !compact && (
        <div className={`absolute top-3 right-3 ${colors[hover.level].bg} border border-white/50 rounded-xl px-3 py-2 shadow-md max-w-[60%]`}>
          <div className={`text-[11px] font-semibold ${colors[hover.level].text}`}>{hover.label}</div>
          <div className="text-[10px] text-slate-500">{hover.sub ?? `${hover.count} reports`}</div>
        </div>
      )}
    </div>
  );
}
