import { CRYSTAL, PENTAGON, RES_INFO, type Res } from '../data/resources';
import { INK, bounds, circle, ngon, poly, rect, stick, stickPoly, tri, type Prim } from './prims';

const OUTLINE = 0.05;

function primPath(p: Prim, grow = 0): string {
  if (p.t === 'circle') return `<circle cx="${f(p.x)}" cy="${f(-p.y)}" r="${f(p.r + grow)}"`;
  const pts = p.t === 'poly' ? p.pts : stickPoly(p);
  return `<polygon points="${pts.map(([x, y]) => `${f(x)},${f(-y)}`).join(' ')}"`;
}

const f = (n: number) => (Math.round(n * 1000) / 1000).toString();

/**
 * Render prims to an inline SVG: an ink silhouette first (paper cut-out look),
 * then the coloured shapes on top.
 */
export function primsToSvg(prims: Prim[], size: number, opts: { outline?: number; className?: string } = {}): string {
  const o = opts.outline ?? OUTLINE;
  const b = bounds(prims);
  const pad = o * 2 + 0.05;
  const w = b.maxX - b.minX + pad * 2;
  const h = b.maxY - b.minY + pad * 2;
  const vb = `${f(b.minX - pad)} ${f(-b.maxY - pad)} ${f(w)} ${f(h)}`;
  const ink = o > 0 ? prims.map((p) => `${primPath(p)} fill="${INK}" stroke="${INK}" stroke-width="${f(o * 2)}" stroke-linejoin="round"/>`).join('') : '';
  const fills = prims.map((p) => `${primPath(p)} fill="${p.fill}"/>`).join('');
  const cls = opts.className ? ` class="${opts.className}"` : '';
  return `<svg${cls} viewBox="${vb}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${ink}${fills}</svg>`;
}

export function resourcePrims(res: Res | 'pentagon' | 'crystal'): Prim[] {
  switch (res) {
    case 'stick':
      return [stick(-0.35, -0.35, 0.35, 0.35, RES_INFO.stick.color, 0.2)];
    case 'circle':
      return [circle(0, 0, 0.45, RES_INFO.circle.color)];
    case 'triangle':
      return [tri(0, -0.4, 0.95, 0.85, RES_INFO.triangle.color)];
    case 'square':
      return [rect(-0.4, -0.4, 0.8, 0.8, RES_INFO.square.color)];
    case 'food':
      return [
        poly(
          Array.from({ length: 20 }, (_, i): [number, number] => {
            const a = (i / 20) * Math.PI * 2;
            return [0.5 * Math.cos(a), 0.3 * Math.sin(a) + (Math.sin(a) > 0 ? 0.1 : 0)];
          }),
          RES_INFO.food.color,
        ),
        stick(-0.2, 0.05, -0.05, 0.25, '#b97a1e', 0.06),
        stick(0.05, 0.05, 0.2, 0.25, '#b97a1e', 0.06),
      ];
    case 'gold':
      return [circle(0, 0, 0.45, RES_INFO.gold.color), stick(0, -0.3, 0, 0.3, '#b98d12', 0.1), stick(-0.18, 0, 0.18, 0, '#b98d12', 0.1)];
    case 'pentagon':
      return [ngon(0, 0, 0.48, 5, PENTAGON.color)];
    case 'crystal':
      return [poly([[0, 0.5], [0.4, 0.05], [0, -0.5], [-0.4, 0.05]], CRYSTAL.color), poly([[0, 0.5], [0.4, 0.05], [0, 0.05]], '#8fe8f1')];
  }
}

export function iconSvg(res: Res | 'pentagon' | 'crystal', size = 18): string {
  if (res === 'gold') {
    return `<svg class="icon" viewBox="-0.6 -0.6 1.2 1.2" width="${size}" height="${size}" aria-hidden="true"><circle r="0.48" fill="${RES_INFO.gold.color}" stroke="${INK}" stroke-width="0.1"/><text y="0.24" text-anchor="middle" font-size="0.72" font-weight="800" fill="#8a6508" font-family="Fredoka, sans-serif">$</text></svg>`;
  }
  return primsToSvg(resourcePrims(res), size, { outline: 0.06, className: 'icon' });
}
