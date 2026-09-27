import type { BuildingType } from '../data/buildings';
import { CRYSTAL, PENTAGON, RES_INFO, type FarmType } from '../data/resources';
import { circle, dome, ngon, poly, rect, star, stick, tri, type Prim } from './prims';

// Stone Age palette: flat paper colours.
const P = {
  stone: '#9aa5b4',
  stoneDark: '#77838f',
  stoneLight: '#c3cad3',
  roof: '#c9533f',
  roofDark: '#a8412f',
  wall: '#efe3c4',
  wood: RES_INFO.stick.color,
  woodDark: '#7a4b27',
  door: '#5a3a22',
  window: RES_INFO.circle.color,
  flag: '#f2c230',
  wheat: '#e8b94a',
  leaf: '#6fae4b',
  leafDark: '#4f8a36',
  water: '#7fc4ea',
};

/** Building art; ground at y = 0, centred on x = 0. */
export function buildingPrims(type: BuildingType, level: number): Prim[] {
  const lv = Math.max(1, level);
  switch (type) {
    case 'castle': {
      const out: Prim[] = [
        rect(-1.35, 0, 0.55, 1.75, P.stoneDark),
        rect(0.8, 0, 0.55, 1.75, P.stoneDark),
        tri(-1.075, 1.75, 0.8, 0.6, P.roof),
        tri(1.075, 1.75, 0.8, 0.6, P.roof),
        rect(-1.0, 0, 2.0, 1.15, P.stone),
        rect(-0.5, 0, 1.0, 1.95, P.stoneLight),
        tri(0, 1.95, 1.3, 0.8, P.roofDark),
        stick(0, 2.7, 0, 3.25, P.woodDark, 0.06),
        poly([[0.03, 3.25], [0.5, 3.1], [0.03, 2.95]], P.flag),
        rect(-0.22, 0, 0.44, 0.5, P.door),
        circle(0, 0.5, 0.22, P.door),
        circle(0, 1.45, 0.17, P.window),
      ];
      // Battlements grow with level.
      for (let i = 0; i < Math.min(lv, 5); i++) out.push(rect(-0.95 + i * 0.4, 1.15, 0.22, 0.18, P.stone));
      return out;
    }
    case 'house':
      return [
        rect(-0.55, 0, 1.1, 0.8, P.wall),
        tri(0, 0.8, 1.45, 0.65, lv >= 5 ? P.roofDark : P.roof),
        rect(-0.4, 0, 0.3, 0.48, P.door),
        circle(0.25, 0.45, 0.14, P.window),
        ...(lv >= 3 ? [rect(0.25, 1.05, 0.16, 0.35, P.stoneDark)] : []),
      ];
    case 'storage':
      return [
        rect(-0.8, 0, 0.75, 0.75, P.wood),
        rect(0.05, 0, 0.75, 0.75, P.wood),
        rect(-0.4, 0.75, 0.8, 0.75, P.woodDark),
        stick(-0.8, 0, -0.05, 0.75, P.woodDark, 0.06),
        stick(-0.8, 0.75, -0.05, 0, P.woodDark, 0.06),
        stick(0.05, 0, 0.8, 0.75, P.woodDark, 0.06),
        stick(0.05, 0.75, 0.8, 0, P.woodDark, 0.06),
        ...(lv >= 4 ? [rect(-0.25, 1.5, 0.5, 0.5, RES_INFO.square.color)] : []),
      ];
    case 'granary':
      return [
        rect(-0.55, 0, 1.1, 0.8, P.wheat),
        dome(0, 0.8, 0.55, P.wall),
        rect(-0.18, 0, 0.36, 0.5, P.door),
        stick(-0.55, 0.8, 0.55, 0.8, P.woodDark, 0.07),
        circle(0, 1.05, 0.12, P.wheat),
      ];
    case 'barracks':
      return [
        stick(-0.95, 0.1, -0.55, 1.85, P.wood, 0.06),
        tri(-0.55, 1.8, 0.18, 0.28, RES_INFO.triangle.color),
        stick(0.95, 0.1, 0.55, 1.85, P.wood, 0.06),
        tri(0.55, 1.8, 0.18, 0.28, RES_INFO.triangle.color),
        rect(-0.85, 0, 1.7, 0.75, P.roofDark),
        poly([[-1.0, 0.75], [1.0, 0.75], [0.7, 1.2], [-0.7, 1.2]], P.woodDark),
        rect(-0.25, 0, 0.5, 0.5, P.door),
        circle(0, 0.98, 0.14, P.flag),
      ];
    case 'watchtower':
      return [
        stick(-0.35, 0, -0.25, 1.6, P.wood, 0.1),
        stick(0.35, 0, 0.25, 1.6, P.wood, 0.1),
        stick(-0.33, 0.3, 0.3, 1.1, P.woodDark, 0.05),
        stick(0.33, 0.3, -0.3, 1.1, P.woodDark, 0.05),
        rect(-0.5, 1.55, 1.0, 0.45, P.wood),
        tri(0, 2.0, 1.2, 0.6, P.roof),
        circle(0, 1.78, 0.1, P.door),
      ];
    case 'exchange':
      return [
        rect(-0.75, 0, 1.5, 0.8, P.wall),
        rect(-0.85, 0.8, 1.7, 0.14, P.woodDark),
        circle(-0.45, 1.25, 0.2, RES_INFO.circle.color),
        tri(-0.45, 0.96, 0.3, 0.3, RES_INFO.triangle.color),
        stick(-0.15, 1.2, 0.2, 1.2, P.door, 0.06),
        tri(0.2, 1.08, 0.12, 0.24, P.door),
        ngon(0.5, 1.2, 0.26, 5, PENTAGON.color),
        rect(-0.2, 0, 0.4, 0.5, P.door),
      ];
    case 'lab':
      return [
        rect(-0.7, 0, 1.4, 0.95, P.stoneLight),
        dome(0, 0.95, 0.5, P.stone),
        stick(0.35, 1.2, 0.35, 1.7, P.stoneDark, 0.1),
        circle(0.35, 1.8, 0.14, CRYSTAL.color),
        star(-0.25, 1.35, 0.2, P.flag),
        rect(-0.18, 0, 0.36, 0.55, P.door),
        circle(0.4, 0.55, 0.12, P.window),
      ];
  }
}

/** Upright decorations on a farm patch, keyed by type. `index` picks one of several spots. */
export function farmItemPrims(type: FarmType, index: number): Prim[] {
  const v = (index % 3) * 0.08;
  switch (type) {
    case 'stick': // a little tree made of sticks
      return [
        stick(0, 0, 0, 1.0 + v, P.wood, 0.1),
        stick(0, 0.55, -0.3, 0.85, P.wood, 0.06),
        stick(0, 0.7, 0.28, 1.0, P.wood, 0.06),
        circle(0, 1.1 + v, 0.28, P.leaf),
        circle(-0.2, 0.9, 0.18, P.leafDark),
      ];
    case 'circle':
      return [circle(0, 0.25 + v, 0.22, RES_INFO.circle.color), circle(0.25, 0.55 + v, 0.12, '#9fd0f5')];
    case 'triangle':
      return [tri(0, 0, 0.6, 0.55 + v, RES_INFO.triangle.color), tri(0.25, 0, 0.35, 0.3, '#e88a86')];
    case 'square':
      return [rect(-0.25, 0, 0.5, 0.5, RES_INFO.square.color), rect(-0.12, 0.5, 0.3, 0.3 + v, '#9aa7b6')];
    case 'food':
      return [
        stick(0, 0, 0, 0.6 + v, P.leafDark, 0.05),
        ngon(0, 0.7 + v, 0.11, 6, P.wheat),
        stick(0.18, 0, 0.18, 0.5, P.leafDark, 0.05),
        ngon(0.18, 0.58, 0.1, 6, P.wheat),
      ];
  }
}

export const FARM_PATCH_COLOR: Record<FarmType, string> = {
  stick: '#9cc27a',
  circle: P.water,
  triangle: '#d8c3a5',
  square: '#b9ab98',
  food: '#e9d58e',
};

/** Scaffolding drawn over a building under construction. */
export function scaffoldPrims(width: number, height: number): Prim[] {
  const x = width / 2;
  return [
    stick(-x, 0, -x, height, P.woodDark, 0.06),
    stick(x, 0, x, height, P.woodDark, 0.06),
    stick(-x, height * 0.45, x, height * 0.45, P.woodDark, 0.06),
    stick(-x, height * 0.9, x, height * 0.9, P.woodDark, 0.06),
    stick(-x, 0, x, height * 0.45, P.woodDark, 0.04),
  ];
}

/** Title logo: a castle of shapes. */
export function logoPrims(): Prim[] {
  return [
    ...buildingPrims('castle', 5),
    circle(-2.0, 0.35, 0.35, RES_INFO.circle.color),
    tri(2.0, 0, 0.8, 0.75, RES_INFO.triangle.color),
    rect(-2.7, 0, 0.5, 0.5, RES_INFO.square.color),
    ngon(2.75, 0.3, 0.3, 5, PENTAGON.color),
  ];
}
