import type { Cost, FarmType } from './resources';

export type BuildingType =
  | 'castle'
  | 'house'
  | 'storage'
  | 'granary'
  | 'barracks'
  | 'watchtower'
  | 'exchange'
  | 'lab';

export interface BuildingDef {
  name: string;
  description: string;
  /** Cost of the first level you pay for (level 2 for the castle, level 1 for others). */
  baseCost: Cost;
  unlockCastle: number;
  maxCount: number;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  castle: {
    name: 'Castle',
    description: 'Heart of your zone. Its level sets how many builders you have and the max level of everything else.',
    baseCost: { stick: 150, circle: 150, triangle: 100, square: 50, food: 50, gold: 50 },
    unlockCastle: 1,
    maxCount: 1,
  },
  house: {
    name: 'House',
    description: 'Shape citizens live here and pay Gold $ tax every hour.',
    baseCost: { stick: 50, circle: 40, triangle: 10 },
    unlockCastle: 1,
    maxCount: 4,
  },
  storage: {
    name: 'Storage',
    description: 'Raises how many shapes and Gold $ you can keep.',
    baseCost: { stick: 60, circle: 40, triangle: 20, square: 20 },
    unlockCastle: 1,
    maxCount: 1,
  },
  granary: {
    name: 'Granary',
    description: 'Raises how much Food you can keep.',
    baseCost: { stick: 60, circle: 40, triangle: 20 },
    unlockCastle: 1,
    maxCount: 1,
  },
  barracks: {
    name: 'Barracks',
    description: 'Assemble soldiers from shapes. Higher levels unlock new soldiers.',
    baseCost: { stick: 80, circle: 60, triangle: 40, food: 20, gold: 20 },
    unlockCastle: 2,
    maxCount: 1,
  },
  watchtower: {
    name: 'Watchtower',
    description: 'Defends your zone. (Battles arrive with the world map.)',
    baseCost: { stick: 60, circle: 40, triangle: 60, square: 40, gold: 20 },
    unlockCastle: 3,
    maxCount: 1,
  },
  exchange: {
    name: 'Shape Exchange',
    description: 'Trade basic shapes for the rare Pentagon.',
    baseCost: { stick: 80, circle: 80, triangle: 40, square: 40, gold: 50 },
    unlockCastle: 3,
    maxCount: 1,
  },
  lab: {
    name: 'Shape Lab',
    description: 'Research better farming: +5% production for all farms per level.',
    baseCost: { stick: 100, circle: 100, triangle: 80, square: 60, gold: 80 },
    unlockCastle: 4,
    maxCount: 1,
  },
};

/** Order shown in the build menu. */
export const BUILD_MENU: BuildingType[] = ['house', 'storage', 'granary', 'barracks', 'watchtower', 'exchange', 'lab'];

export const LOCKED_BUILDINGS = ['Guild Hall', 'World Gate'];

export const INNER_PLOTS = 12;
export const CASTLE_MAX_LEVEL = 5;
export const COST_GROWTH = 1.8;

export function buildersForCastle(castleLevel: number): number {
  if (castleLevel >= 5) return 3;
  if (castleLevel >= 3) return 2;
  return 1;
}

export const FARM_INFO: Record<FarmType, { name: string }> = {
  stick: { name: 'Stick Grove' },
  circle: { name: 'Circle Pond' },
  triangle: { name: 'Triangle Quarry' },
  square: { name: 'Square Kiln' },
  food: { name: 'Food Field' },
};

/** Cost of upgrading a farm to level 2 (farms start at level 1). */
export const FARM_BASE_COST: Cost = { stick: 40, circle: 40, triangle: 20, square: 10, food: 10 };

/** Production per hour at level 1..10. */
export const FARM_OUTPUT = [15, 25, 40, 60, 85, 120, 165, 225, 300, 400];

/** Gold per hour per House at level 1..10. */
export const HOUSE_GOLD = [5, 10, 18, 28, 40, 55, 75, 100, 130, 170];

/** Storage / Granary cap at level 1..10. */
export const STORAGE_CAP = [1500, 2500, 4000, 6000, 9000, 13000, 18000, 25000, 35000, 50000];
export const BASE_CAP = 1000;

export const LAB_BONUS_PER_LEVEL = 0.05;
export const WATCHTOWER_DEF_PER_LEVEL = 10;

/** Build time in seconds to reach level 1..10. */
export const BUILD_TIME_S = [5, 30, 120, 600, 3600, 4 * 3600, 12 * 3600, 86400, 3 * 86400, 7 * 86400];
export const CASTLE_TIME_MULT = 1.5;

/** Shape Exchange: this many of EACH basic shape buys 1 Pentagon. */
export const EXCHANGE_EACH = 25;
/** Chance per shape farm per game-hour to find a Pentagon. */
export const LUCKY_DROP_CHANCE = 0.01;
