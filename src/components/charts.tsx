'use client';

import { useState, type ReactNode } from 'react';
import { formatCount } from '@/lib/format';
import { Panel } from './ui';

/** Horizontal bar row: leading icon/rank, label, filled track, trailing text. */
export function BarRow({
  leading,
  label,
  fraction,
  trailing,
  onClick,
}: {
  leading: ReactNode;
  label: string;
  fraction: number;
  trailing: string;
  onClick: () => void;
}) {
  return (
    <button className="bar-row" onClick={onClick} title={label}>
      <span className="lead">{leading}</span>
      <span className="lab">{label}</span>
      <span className="track">
        <span className="fill" style={{ width: `${Math.max(0.02, Math.min(1, fraction)) * 100}%` }} />
      </span>
      <span className="trail">{trailing}</span>
    </button>
  );
}

/** Monthly columns with a y-axis, grid lines and a hover tooltip. */
export function MonthChart({ data, unit }: { data: { label: string; value: number }[]; unit: 'downloads' | 'releases' }) {
  const H = 180;
  const maxV = Math.max(...data.map((d) => d.value), 0);
  const top = maxV === 0 ? 1 : maxV;
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div role="img" aria-label="Bar chart by month" style={{ height: H + 28, display: 'flex', alignItems: 'flex-start', marginTop: 14 }}>
      <div className="axis" style={{ height: H }}>
        {[top, Math.floor(top / 2), 0].map((v, i) => (
          <span key={i}>{formatCount(v)}</span>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ position: 'relative', height: H }}>
          {[0, 0.5, 1].map((f) => (
            <div key={f} className="grid-line" style={{ top: 6 + (H - 6) * f - (f === 1 ? 1 : 0) }} />
          ))}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end' }}>
            {data.map((d, i) => {
              const barH = d.value === 0 ? 2 : Math.min(H, Math.max(4, (d.value / top) * (H - 40)));
              const word = unit === 'releases' ? (d.value === 1 ? 'release' : 'releases') : 'downloads';
              return (
                <div
                  key={d.label + i}
                  className="mcol"
                  style={{ height: H, background: hover === i ? 'color-mix(in srgb, var(--primary) 6%, transparent)' : 'transparent' }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setHover(hover === i ? null : i)}
                >
                  <div className="mbar" style={{ height: barH, background: hover === i ? 'var(--primary)' : 'color-mix(in srgb, var(--primary) 55%, var(--panel))' }} />
                  {hover === i && <div className="tip" style={{ bottom: barH + 4 }}>{d.value} {word}</div>}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex' }}>
          {data.map((d, i) => (
            <span key={d.label + i} className="mlabel">{d.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Bar chart card (platform downloads / per-release downloads). */
export function BarChartCard({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: { label: string; value: number; onClick?: () => void }[];
}) {
  const maxV = Math.max(1, ...items.map((i) => i.value));
  const topItem = items.length ? items.reduce((a, b) => (b.value > a.value ? b : a)) : null;
  const [hover, setHover] = useState<string | null>(null);
  return (
    <Panel style={{ padding: '22px 16px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 17, fontWeight: 700 }}>{title}</div>
      <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{subtitle}</div>
      <div style={{ display: 'flex', height: 190, marginTop: 14 }}>
        {items.map((it) => {
          const active = it === topItem || hover === it.label;
          const frac = Math.min(1, Math.max(0.08, it.value / maxV));
          const h = (190 - 8 - 15 - 26) * frac; // plot height minus label, as in the Flutter chart
          return (
            <button
              key={it.label}
              className="cbar"
              onClick={it.onClick}
              onMouseEnter={() => setHover(it.label)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="cbar-plot">
                <span className="cbar-tip" style={{ bottom: h + 6, opacity: active ? 1 : 0 }}>{formatCount(it.value)}</span>
                <span className="cbar-fill" style={{ height: h, background: active ? 'var(--primary)' : 'color-mix(in srgb, var(--primary) 32%, var(--panel))' }} />
              </span>
              <span className="cbar-label">{it.label}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
