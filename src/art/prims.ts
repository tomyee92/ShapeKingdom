// Shape primitives. Everything in the game is drawn from these, in a 2D
// coordinate space where y points up and y = 0 is the ground line.

export type Pt = [number, number];

export type Prim =
  | { t: 'circle'; x: number; y: number; r: number; fill: string }
  | { t: 'poly'; pts: Pt[]; fill: string }
  | { t: 'stick'; a: Pt; b: Pt; w: number; fill: string };

export const INK = '#2b2118';

export const circle = (x: number, y: number, r: number, fill: string): Prim => ({ t: 'circle', x, y, r, fill });

export const poly = (pts: Pt[], fill: string): Prim => ({ t: 'poly', pts, fill });

/** Axis-aligned rectangle from its bottom-left corner. */
export const rect = (x: number, y: number, w: number, h: number, fill: string): Prim =>
  poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill);

/** Triangle with base centred on (cx, y), pointing up. */
export const tri = (cx: number, y: number, w: number, h: number, fill: string): Prim =>
  poly([[cx - w / 2, y], [cx + w / 2, y], [cx, y + h]], fill);

export const ngon = (cx: number, cy: number, r: number, n: number, fill: string, rot = Math.PI / 2): Prim =>
  poly(
    Array.from({ length: n }, (_, i): Pt => {
      const a = rot + (i * 2 * Math.PI) / n;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    }),
    fill,
  );

export const star = (cx: number, cy: number, r: number, fill: string, points = 5): Prim =>
  poly(
    Array.from({ length: points * 2 }, (_, i): Pt => {
      const a = Math.PI / 2 + (i * Math.PI) / points;
      const rr = i % 2 === 0 ? r : r * 0.45;
      return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
    }),
    fill,
  );

/** Upper half disc sitting on (cx, y). */
export const dome = (cx: number, y: number, r: number, fill: string): Prim =>
  poly(
    Array.from({ length: 17 }, (_, i): Pt => {
      const a = (i * Math.PI) / 16;
      return [cx + r * Math.cos(a), y + r * Math.sin(a)];
    }),
    fill,
  );

export const stick = (x1: number, y1: number, x2: number, y2: number, fill: string, w = 0.08): Prim => ({
  t: 'stick',
  a: [x1, y1],
  b: [x2, y2],
  w,
  fill,
});

/** A stick as a polygon (rectangle along the segment). */
export function stickPoly(p: Extract<Prim, { t: 'stick' }>, extra = 0): Pt[] {
  const [x1, y1] = p.a;
  const [x2, y2] = p.b;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const dx = (x2 - x1) / len;
  const dy = (y2 - y1) / len;
  const hw = p.w / 2 + extra;
  const nx = -dy * hw;
  const ny = dx * hw;
  const ax = x1 - dx * extra;
  const ay = y1 - dy * extra;
  const bx = x2 + dx * extra;
  const by = y2 + dy * extra;
  return [
    [ax + nx, ay + ny],
    [bx + nx, by + ny],
    [bx - nx, by - ny],
    [ax - nx, ay - ny],
  ];
}

function signedArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/** Grow a polygon outward by `d` (miter join, clamped) — used for the ink outline. */
export function offsetPoly(pts: Pt[], d: number): Pt[] {
  const ccw = signedArea(pts) > 0 ? pts : [...pts].reverse();
  const n = ccw.length;
  return ccw.map((p, i): Pt => {
    const prev = ccw[(i - 1 + n) % n];
    const next = ccw[(i + 1) % n];
    const e1 = norm([p[0] - prev[0], p[1] - prev[1]]);
    const e2 = norm([next[0] - p[0], next[1] - p[1]]);
    // Outward normals for a CCW polygon.
    const n1: Pt = [e1[1], -e1[0]];
    const n2: Pt = [e2[1], -e2[0]];
    const bis = norm([n1[0] + n2[0], n1[1] + n2[1]]);
    const cos = Math.max(0.35, bis[0] * n1[0] + bis[1] * n1[1]);
    return [p[0] + (bis[0] * d) / cos, p[1] + (bis[1] * d) / cos];
  });
}

function norm(v: Pt): Pt {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}

/** Bounding box of a prim list. */
export function bounds(prims: Prim[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const p of prims) {
    if (p.t === 'circle') {
      add(p.x - p.r, p.y - p.r);
      add(p.x + p.r, p.y + p.r);
    } else {
      for (const [x, y] of p.t === 'poly' ? p.pts : stickPoly(p)) add(x, y);
    }
  }
  return { minX, minY, maxX, maxY };
}
