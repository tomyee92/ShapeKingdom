import {
  BASE_CAP,
  BUILDINGS,
  BUILD_TIME_S,
  CASTLE_MAX_LEVEL,
  CASTLE_TIME_MULT,
  COST_GROWTH,
  FARM_BASE_COST,
  FARM_OUTPUT,
  HOUSE_GOLD,
  LAB_BONUS_PER_LEVEL,
  STORAGE_CAP,
  buildersForCastle,
  type BuildingType,
} from '../data/buildings';
import {
  EXTRA_CRYSTALS_PER_DAY,
  FINISH_PRICE_POINTS,
  FREE_FINISH_SEC,
  RES_PER_CRYSTAL,
} from '../data/economy';
import { RESOURCES, type Cost, type Res } from '../data/resources';
import { UNITS, UNIT_TYPES } from '../data/units';
import type { BuildTarget, Castle } from './state';

function scaleCost(base: Cost, steps: number): Cost {
  const out: Cost = {};
  for (const r of RESOURCES) {
    const v = base[r];
    if (v) out[r] = Math.round(v * COST_GROWTH ** steps);
  }
  return out;
}

/** Cost to build/upgrade a building to `toLevel`. */
export function buildingCost(type: BuildingType, toLevel: number): Cost {
  const firstPaidLevel = type === 'castle' ? 2 : 1;
  return scaleCost(BUILDINGS[type].baseCost, toLevel - firstPaidLevel);
}

/** Cost to upgrade a farm to `toLevel` (farms start at level 1). */
export function farmCost(toLevel: number): Cost {
  return scaleCost(FARM_BASE_COST, toLevel - 2);
}

export function buildTimeMs(toLevel: number, isCastle: boolean): number {
  const sec = BUILD_TIME_S[Math.min(toLevel, BUILD_TIME_S.length) - 1];
  return sec * 1000 * (isCastle ? CASTLE_TIME_MULT : 1);
}

/** Crystals needed to finish something with `remainingMs` of game time left. */
export function finishPrice(remainingMs: number): number {
  const sec = remainingMs / 1000;
  if (sec <= FREE_FINISH_SEC) return 0;
  const pts = FINISH_PRICE_POINTS;
  const last = pts[pts.length - 1];
  if (sec >= last[0]) return Math.ceil(last[1] + ((sec - last[0]) / 86400) * EXTRA_CRYSTALS_PER_DAY);
  for (let i = 1; i < pts.length; i++) {
    const [s1, c1] = pts[i];
    if (sec <= s1) {
      const [s0, c0] = pts[i - 1];
      return Math.max(1, Math.round(c0 + ((sec - s0) / (s1 - s0)) * (c1 - c0)));
    }
  }
  return last[1];
}

export function castleLevel(c: Castle): number {
  return c.buildings.find((b) => b.type === 'castle')?.level ?? 1;
}

export function builderSlots(c: Castle): number {
  return buildersForCastle(castleLevel(c));
}

/** Highest level a non-castle building or farm may reach right now. */
export function levelCap(c: Castle, isCastle: boolean): number {
  return isCastle ? CASTLE_MAX_LEVEL : castleLevel(c) * 2;
}

export function buildingLevel(c: Castle, type: BuildingType): number {
  return Math.max(0, ...c.buildings.filter((b) => b.type === type).map((b) => b.level));
}

export function targetLevel(c: Castle, t: BuildTarget): number {
  if (t.kind === 'farm') return c.farms[t.index].level;
  const b = c.buildings.find((x) => x.id === t.id);
  if (!b) throw new Error(`No building ${t.id}`);
  return b.level;
}

export interface Rates {
  stick: number;
  circle: number;
  triangle: number;
  square: number;
  /** Net food: production minus upkeep. */
  food: number;
  gold: number;
  foodProduction: number;
  upkeep: number;
}

export function farmOutput(level: number, labLevel: number): number {
  if (level < 1) return 0;
  return FARM_OUTPUT[level - 1] * (1 + LAB_BONUS_PER_LEVEL * labLevel);
}

/** Per game-hour. */
export function rates(c: Castle): Rates {
  const lab = buildingLevel(c, 'lab');
  const r: Rates = { stick: 0, circle: 0, triangle: 0, square: 0, food: 0, gold: 0, foodProduction: 0, upkeep: 0 };
  for (const f of c.farms) {
    const out = farmOutput(f.level, lab);
    if (f.type === 'food') r.foodProduction += out;
    else r[f.type] += out;
  }
  for (const b of c.buildings) {
    if (b.type === 'house' && b.level > 0) r.gold += HOUSE_GOLD[b.level - 1];
  }
  for (const u of UNIT_TYPES) r.upkeep += c.soldiers[u] * UNITS[u].foodPerHour;
  r.food = r.foodProduction - r.upkeep;
  return r;
}

export function caps(c: Castle): Record<Res, number> {
  const st = buildingLevel(c, 'storage');
  const gr = buildingLevel(c, 'granary');
  const shapeCap = st > 0 ? STORAGE_CAP[st - 1] : BASE_CAP;
  const foodCap = gr > 0 ? STORAGE_CAP[gr - 1] : BASE_CAP;
  return { stick: shapeCap, circle: shapeCap, triangle: shapeCap, square: shapeCap, gold: shapeCap, food: foodCap };
}

export function missing(c: Castle, cost: Cost): Cost {
  const out: Cost = {};
  for (const r of RESOURCES) {
    const need = (cost[r] ?? 0) - Math.floor(c.resources[r]);
    if (need > 0) out[r] = need;
  }
  return out;
}

export function canAfford(c: Castle, cost: Cost): boolean {
  return Object.keys(missing(c, cost)).length === 0;
}

export function missingPrice(c: Castle, cost: Cost): number {
  const total = Object.values(missing(c, cost)).reduce((a, b) => a + (b ?? 0), 0);
  return Math.ceil(total / RES_PER_CRYSTAL);
}

/** First resource whose cost is larger than the castle can store, if any. */
export function overCap(c: Castle, cost: Cost): Res | null {
  const cap = caps(c);
  for (const r of RESOURCES) if ((cost[r] ?? 0) > cap[r]) return r;
  return null;
}

export function multiplyCost(cost: Cost, n: number): Cost {
  const out: Cost = {};
  for (const r of RESOURCES) if (cost[r]) out[r] = cost[r]! * n;
  return out;
}

export function trainingRemainingMs(c: Castle, gameMs: number): number {
  let total = 0;
  c.training.forEach((j, i) => {
    total += i === 0 ? Math.max(0, j.nextMs - gameMs) + (j.count - 1) * j.unitMs : j.count * j.unitMs;
  });
  return total;
}
