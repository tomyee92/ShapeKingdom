import { BUILDINGS, FARM_INFO, LUCKY_DROP_CHANCE } from '../data/buildings';
import { RESOURCES } from '../data/resources';
import { UNITS, UNIT_TYPES, type UnitType } from '../data/units';
import { caps, rates } from './formulas';
import { random } from './rng';
import { HOUR_MS, pushEvent, type Castle, type GameState } from './state';

const FOOD_EPSILON = 1e-6;

/** Advance the game to the real time `realNowMs` (scaled by dev speed). Pure: returns a new state. */
export function advance(s: GameState, realNowMs: number): GameState {
  const dtReal = Math.max(0, realNowMs - s.realMs);
  const next = advanceGame(s, s.gameMs + dtReal * s.devSpeed);
  next.realMs = Math.max(s.realMs, realNowMs);
  return next;
}

/** Advance the game clock to `gameMs`. Pure: returns a new state. */
export function advanceGame(s: GameState, gameMs: number): GameState {
  const next = structuredClone(s);
  const to = Math.max(gameMs, next.gameMs);
  for (const c of next.castles) simulateCastle(next, c, next.gameMs, to);
  next.gameMs = to;
  return next;
}

function simulateCastle(s: GameState, c: Castle, from: number, to: number): void {
  let t = from;
  // Guard only protects against bugs; real runs need far fewer steps.
  for (let guard = 0; guard < 1_000_000; guard++) {
    starveIfNeeded(s, c, t);
    const r = rates(c);

    let nextT = to;
    for (const b of c.builds) nextT = Math.min(nextT, b.endMs);
    if (c.training.length) nextT = Math.min(nextT, c.training[0].nextMs);
    if (r.food < 0 && c.resources.food > 0) {
      nextT = Math.min(nextT, t + (c.resources.food / -r.food) * HOUR_MS);
    }
    nextT = Math.max(nextT, t);

    produce(s, c, nextT - t, t);
    t = nextT;
    completeBuilds(s, c, t);
    completeTraining(s, c, t);

    if (t >= to) break;
  }
  starveIfNeeded(s, c, t);
}

function produce(s: GameState, c: Castle, dtMs: number, t: number): void {
  if (dtMs <= 0) return;
  const r = rates(c);
  const cap = caps(c);
  const hours = dtMs / HOUR_MS;
  for (const res of RESOURCES) {
    const rate = r[res];
    const amt = c.resources[res];
    if (rate >= 0) {
      if (amt < cap[res]) c.resources[res] = Math.min(cap[res], amt + rate * hours);
    } else {
      const v = amt + rate * hours;
      c.resources[res] = v < FOOD_EPSILON ? 0 : v;
    }
  }
  for (const f of c.farms) {
    if (f.type === 'food' || f.level < 1) continue;
    f.luckMs += dtMs;
    while (f.luckMs >= HOUR_MS) {
      f.luckMs -= HOUR_MS;
      if (random(s) < LUCKY_DROP_CHANCE) {
        c.pentagons += 1;
        pushEvent(s, 'lucky', `Lucky! Your ${FARM_INFO[f.type].name} found a Pentagon.`, t);
      }
    }
  }
}

function completeBuilds(s: GameState, c: Castle, t: number): void {
  const done = c.builds.filter((b) => b.endMs <= t).sort((a, b) => a.endMs - b.endMs);
  for (const job of done) {
    if (job.target.kind === 'farm') {
      const farm = c.farms[job.target.index];
      farm.level = job.toLevel;
      pushEvent(s, 'build', `${FARM_INFO[farm.type].name} reached Lv ${job.toLevel}.`, job.endMs);
    } else {
      const id = job.target.id;
      const b = c.buildings.find((x) => x.id === id);
      if (b) {
        b.level = job.toLevel;
        const verb = job.toLevel === 1 ? 'built' : `reached Lv ${job.toLevel}`;
        pushEvent(s, 'build', `${BUILDINGS[b.type].name} ${verb}.`, job.endMs);
      }
    }
  }
  c.builds = c.builds.filter((b) => b.endMs > t);
}

function completeTraining(s: GameState, c: Castle, t: number): void {
  while (c.training.length && c.training[0].nextMs <= t) {
    const job = c.training[0];
    c.soldiers[job.unit] += 1;
    job.count -= 1;
    if (job.count > 0) {
      job.nextMs += job.unitMs;
    } else {
      c.training.shift();
      pushEvent(s, 'train', `${job.total} ${UNITS[job.unit].name} ready.`, job.nextMs);
      if (c.training.length) c.training[0].nextMs = job.nextMs + c.training[0].unitMs;
    }
    // A new soldier may tip food/hour negative while the granary is empty.
    starveIfNeeded(s, c, job.nextMs);
  }
}

/** When food is empty and food/hour is negative, random soldiers die until food/hour >= 0. */
export function starveIfNeeded(s: GameState, c: Castle, t: number): void {
  if (c.resources.food > FOOD_EPSILON) return;
  c.resources.food = 0;
  const dead: Partial<Record<UnitType, number>> = {};
  while (rates(c).food < 0) {
    const total = UNIT_TYPES.reduce((a, u) => a + c.soldiers[u], 0);
    if (total === 0) break;
    let pick = Math.floor(random(s) * total);
    for (const u of UNIT_TYPES) {
      if (pick < c.soldiers[u]) {
        c.soldiers[u] -= 1;
        dead[u] = (dead[u] ?? 0) + 1;
        break;
      }
      pick -= c.soldiers[u];
    }
  }
  const parts = UNIT_TYPES.filter((u) => dead[u]).map((u) => `${dead[u]} ${UNITS[u].name}`);
  if (parts.length) pushEvent(s, 'starve', `Starvation! ${parts.join(', ')} died. Food/hour is balanced again.`, t);
}
