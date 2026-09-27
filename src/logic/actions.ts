import { BUILDINGS, EXCHANGE_EACH, INNER_PLOTS, type BuildingType } from '../data/buildings';
import { DEV_SPEEDS, SHOP_PACKS } from '../data/economy';
import { BASIC, RESOURCES, RES_INFO, type Cost } from '../data/resources';
import { MAX_TRAIN_QUEUE, UNITS, type UnitType } from '../data/units';
import { advanceGame } from './advance';
import {
  buildTimeMs,
  buildingCost,
  buildingLevel,
  builderSlots,
  canAfford,
  caps,
  castleLevel,
  farmCost,
  finishPrice,
  levelCap,
  missing,
  missingPrice,
  multiplyCost,
  overCap,
  targetLevel,
  trainingRemainingMs,
} from './formulas';
import { getCastle, newId, pushEvent, type BuildTarget, type Castle, type GameState } from './state';

export type Result = { ok: true; state: GameState } | { ok: false; error: string };

// All actions assume the state was already advanced to "now" and never mutate their input.

function fail(error: string): Result {
  return { ok: false, error };
}

function pay(c: Castle, cost: Cost): void {
  for (const r of RESOURCES) c.resources[r] -= cost[r] ?? 0;
}

function checkPayable(c: Castle, cost: Cost): string | null {
  const big = overCap(c, cost);
  if (big) return `Not enough room: ${RES_INFO[big].name} cost is above your storage cap. Upgrade ${big === 'food' ? 'the Granary' : 'Storage'}.`;
  if (!canAfford(c, cost)) return 'Not enough resources.';
  return null;
}

function checkBuilder(c: Castle): string | null {
  return c.builds.length >= builderSlots(c) ? 'All builders are busy.' : null;
}

export function constructBuilding(s0: GameState, castleId: string, type: BuildingType, plot: number): Result {
  const s = structuredClone(s0);
  const c = getCastle(s, castleId);
  const def = BUILDINGS[type];
  if (type === 'castle') return fail('You already have a Castle.');
  if (!Number.isInteger(plot) || plot < 0 || plot >= INNER_PLOTS) return fail('Invalid plot.');
  if (c.buildings.some((b) => b.plot === plot)) return fail('That plot is taken.');
  if (castleLevel(c) < def.unlockCastle) return fail(`Needs Castle Lv ${def.unlockCastle}.`);
  if (c.buildings.filter((b) => b.type === type).length >= def.maxCount) return fail(`You can only have ${def.maxCount} ${def.name}.`);
  const cost = buildingCost(type, 1);
  const err = checkBuilder(c) ?? checkPayable(c, cost);
  if (err) return fail(err);
  pay(c, cost);
  const id = newId(s, 'b');
  c.buildings.push({ id, type, level: 0, plot });
  c.builds.push({ id: newId(s, 'j'), target: { kind: 'building', id }, toLevel: 1, startMs: s.gameMs, endMs: s.gameMs + buildTimeMs(1, false) });
  return { ok: true, state: s };
}

export function upgradeCost(c: Castle, target: BuildTarget): Cost {
  const to = targetLevel(c, target) + 1;
  if (target.kind === 'farm') return farmCost(to);
  const b = c.buildings.find((x) => x.id === target.id)!;
  return buildingCost(b.type, to);
}

export function isCastleTarget(c: Castle, target: BuildTarget): boolean {
  return target.kind === 'building' && c.buildings.find((b) => b.id === target.id)?.type === 'castle';
}

export function upgrade(s0: GameState, castleId: string, target: BuildTarget): Result {
  const s = structuredClone(s0);
  const c = getCastle(s, castleId);
  const sameTarget = (t: BuildTarget) =>
    t.kind === target.kind && (t.kind === 'farm' ? t.index === (target as { index: number }).index : t.id === (target as { id: string }).id);
  if (c.builds.some((j) => sameTarget(j.target))) return fail('Already under construction.');
  const isCastle = isCastleTarget(c, target);
  const to = targetLevel(c, target) + 1;
  const cap = levelCap(c, isCastle);
  if (to > cap) return fail(isCastle ? `Castle Lv ${cap} is the max for the Stone Age demo.` : `Max Lv ${cap} for now. Upgrade your Castle first.`);
  const cost = upgradeCost(c, target);
  const err = checkBuilder(c) ?? checkPayable(c, cost);
  if (err) return fail(err);
  pay(c, cost);
  c.builds.push({ id: newId(s, 'j'), target, toLevel: to, startMs: s.gameMs, endMs: s.gameMs + buildTimeMs(to, isCastle) });
  return { ok: true, state: s };
}

export function finishBuild(s0: GameState, castleId: string, jobId: string): Result {
  const s = structuredClone(s0);
  const c = getCastle(s, castleId);
  const job = c.builds.find((j) => j.id === jobId);
  if (!job) return fail('Nothing to finish.');
  const price = finishPrice(job.endMs - s.gameMs);
  if (s.crystals < price) return fail(`Need ${price} Crystals.`);
  s.crystals -= price;
  job.endMs = s.gameMs;
  return { ok: true, state: advanceGame(s, s.gameMs) };
}

export function train(s0: GameState, castleId: string, unit: UnitType, count: number): Result {
  const s = structuredClone(s0);
  const c = getCastle(s, castleId);
  const def = UNITS[unit];
  const barracks = buildingLevel(c, 'barracks');
  if (barracks < 1) return fail('Build a Barracks first.');
  if (barracks < def.barracksLevel) return fail(`Needs Barracks Lv ${def.barracksLevel}.`);
  if (!Number.isInteger(count) || count < 1) return fail('Invalid amount.');
  if (c.training.length >= MAX_TRAIN_QUEUE) return fail(`Training queue is full (${MAX_TRAIN_QUEUE}).`);
  const cost = multiplyCost(def.cost, count);
  const err = checkPayable(c, cost);
  if (err) return fail(err);
  pay(c, cost);
  const unitMs = def.trainSec * 1000;
  c.training.push({ id: newId(s, 't'), unit, count, total: count, unitMs, nextMs: c.training.length ? 0 : s.gameMs + unitMs });
  return { ok: true, state: s };
}

export function finishTraining(s0: GameState, castleId: string): Result {
  const s = structuredClone(s0);
  const c = getCastle(s, castleId);
  if (!c.training.length) return fail('Nothing to finish.');
  const price = finishPrice(trainingRemainingMs(c, s.gameMs));
  if (s.crystals < price) return fail(`Need ${price} Crystals.`);
  s.crystals -= price;
  for (const job of c.training) {
    c.soldiers[job.unit] += job.count;
    pushEvent(s, 'train', `${job.total} ${UNITS[job.unit].name} ready.`);
  }
  c.training = [];
  return { ok: true, state: advanceGame(s, s.gameMs) };
}

export function exchange(s0: GameState, castleId: string, count: number): Result {
  const s = structuredClone(s0);
  const c = getCastle(s, castleId);
  if (buildingLevel(c, 'exchange') < 1) return fail('Build a Shape Exchange first.');
  if (!Number.isInteger(count) || count < 1) return fail('Invalid amount.');
  const cost: Cost = Object.fromEntries(BASIC.map((r) => [r, EXCHANGE_EACH * count]));
  if (!canAfford(c, cost)) return fail('Not enough shapes.');
  pay(c, cost);
  c.pentagons += count;
  return { ok: true, state: s };
}

export function buyCrystals(s0: GameState, packId: string): Result {
  const pack = SHOP_PACKS.find((p) => p.id === packId);
  if (!pack) return fail('Unknown pack.');
  const s = structuredClone(s0);
  s.crystals += pack.crystals;
  pushEvent(s, 'info', `+${pack.crystals} Crystals (demo — no payment).`);
  return { ok: true, state: s };
}

/** Spend Crystals to top up exactly the resources missing for `cost`. */
export function buyMissing(s0: GameState, castleId: string, cost: Cost): Result {
  const s = structuredClone(s0);
  const c = getCastle(s, castleId);
  const big = overCap(c, cost);
  if (big) return fail(`${RES_INFO[big].name} cost is above your storage cap.`);
  const price = missingPrice(c, cost);
  if (price === 0) return { ok: true, state: s };
  if (s.crystals < price) return fail(`Need ${price} Crystals.`);
  s.crystals -= price;
  const miss = missing(c, cost);
  for (const r of RESOURCES) c.resources[r] += miss[r] ?? 0;
  return { ok: true, state: s };
}

/** Demo-only cheat: fill every resource to its cap. */
export function devFill(s0: GameState, castleId: string): Result {
  const s = structuredClone(s0);
  const c = getCastle(s, castleId);
  const cap = caps(c);
  for (const r of RESOURCES) c.resources[r] = Math.max(c.resources[r], cap[r]);
  return { ok: true, state: s };
}

export function setDevSpeed(s0: GameState, speed: number): Result {
  if (!DEV_SPEEDS.includes(speed)) return fail('Invalid speed.');
  const s = structuredClone(s0);
  s.devSpeed = speed;
  return { ok: true, state: s };
}
