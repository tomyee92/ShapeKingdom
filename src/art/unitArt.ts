import { RES_INFO } from '../data/resources';
import type { UnitType } from '../data/units';
import { circle, rect, stick, tri, type Prim } from './prims';

const S = RES_INFO.stick.color;
const C = RES_INFO.circle.color;
const T = RES_INFO.triangle.color;
const Q = RES_INFO.square.color;
const W = 0.08;

/** The 5-stick body every Stone Age soldier shares: torso, two arms, two legs. */
function body(rightArmTo: [number, number]): Prim[] {
  return [
    stick(0, 0.8, -0.25, 0, S, W), // left leg
    stick(0, 0.8, 0.25, 0, S, W), // right leg
    stick(0, 1.48, 0, 0.8, S, W), // torso
    stick(0, 1.3, -0.33, 0.95, S, W), // left arm
    stick(0, 1.3, rightArmTo[0], rightArmTo[1], S, W), // right arm
  ];
}

const head = () => circle(0, 1.7, 0.22, C);

/** Soldiers are drawn exactly from their recipe. Feet at y = 0, about 2.3 tall. */
export function unitPrims(unit: UnitType): Prim[] {
  switch (unit) {
    case 'clubman':
      return [...body([0.36, 1.05]), stick(0.3, 0.95, 0.62, 1.65, S, 0.14), head()];
    case 'slinger':
      return [...body([0.34, 1.62]), head(), circle(0.46, 1.78, 0.11, C)];
    case 'spearman':
      return [stick(0.4, 0.2, 0.4, 2.05, S, 0.07), ...body([0.4, 1.1]), tri(0.4, 2.02, 0.24, 0.34, T), head()];
    case 'shield':
      return [...body([0.3, 1.0]), head(), rect(0.12, 0.55, 0.52, 0.62, Q)];
  }
}
