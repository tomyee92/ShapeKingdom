import { INNER_PLOTS } from '../data/buildings';

// Zone layout in world units on the ground plane (x, z). The castle sits at the origin.

export const ZONE_RADIUS = 11.5;
export const PLOT_RING = 4.7;
export const FARM_RING = 8.9;
export const FARM_PATCH_RADIUS = 1.75;

export function plotPos(plot: number): [number, number] {
  const a = (plot / INNER_PLOTS) * Math.PI * 2 + Math.PI / INNER_PLOTS;
  return [Math.cos(a) * PLOT_RING, Math.sin(a) * PLOT_RING];
}

export function farmPos(index: number): [number, number] {
  const a = (index / 8) * Math.PI * 2 + Math.PI / 8;
  return [Math.cos(a) * FARM_RING, Math.sin(a) * FARM_RING];
}

/** Spots for decorations inside a farm patch (local x, z). */
export const FARM_ITEM_SPOTS: [number, number][] = [
  [-0.7, -0.2],
  [0.55, -0.55],
  [0.1, 0.55],
  [-0.45, 0.85],
  [0.9, 0.35],
  [-0.15, -0.95],
];
