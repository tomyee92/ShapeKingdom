import { iconSvg } from '../art/svg';
import { RESOURCES, type Cost } from '../data/resources';
import type { Castle } from '../logic/state';

export function fmtNum(n: number): string {
  const v = Math.floor(n);
  if (Math.abs(v) < 10000) return v.toString();
  if (Math.abs(v) < 1_000_000) return `${(v / 1000).toFixed(v < 100000 ? 1 : 0)}k`;
  return `${(v / 1_000_000).toFixed(1)}M`;
}

export function fmtRate(n: number): string {
  const r = Math.round(n);
  return `${r >= 0 ? '+' : '−'}${fmtNum(Math.abs(r))}/h`;
}

export function fmtDuration(ms: number): string {
  let s = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export function costChips(cost: Cost, c: Castle | null): string {
  return RESOURCES.filter((r) => cost[r])
    .map((r) => {
      const short = c && Math.floor(c.resources[r]) < cost[r]!;
      return `<span class="chip${short ? ' short' : ''}">${iconSvg(r, 16)}${fmtNum(cost[r]!)}</span>`;
    })
    .join('');
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}
