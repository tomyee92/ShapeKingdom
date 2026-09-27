import type { Res } from './resources';

// Starting state and premium-currency tuning.

export const START_RESOURCES: Record<Res, number> = {
  stick: 300,
  circle: 300,
  triangle: 300,
  square: 300,
  food: 300,
  gold: 100,
};
export const START_CRYSTALS = 500;

export const DEV_SPEEDS = [1, 10, 100];
export const DEFAULT_DEV_SPEED = 10;

/** [seconds remaining, crystals] — interpolated linearly. */
export const FINISH_PRICE_POINTS: [number, number][] = [
  [60, 1],
  [600, 5],
  [3600, 20],
  [4 * 3600, 60],
  [12 * 3600, 150],
  [86400, 260],
  [3 * 86400, 600],
  [7 * 86400, 1000],
];
export const FREE_FINISH_SEC = 60;
export const EXTRA_CRYSTALS_PER_DAY = 150;

/** 1 Crystal buys this many missing resources. */
export const RES_PER_CRYSTAL = 50;

export interface ShopPack {
  id: string;
  crystals: number;
  price: string;
  label: string;
}

export const SHOP_PACKS: ShopPack[] = [
  { id: 'handful', crystals: 100, price: '$0.99', label: 'Handful' },
  { id: 'pouch', crystals: 500, price: '$4.99', label: 'Pouch' },
  { id: 'chest', crystals: 1200, price: '$9.99', label: 'Chest' },
  { id: 'vault', crystals: 3000, price: '$19.99', label: 'Vault' },
];
