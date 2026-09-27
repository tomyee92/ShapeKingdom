import { describe, expect, it } from 'vitest';
import {
  buyMissing,
  constructBuilding,
  exchange,
  finishBuild,
  finishTraining,
  train,
  upgrade,
  type Result,
} from '../src/logic/actions';
import { advance, advanceGame } from '../src/logic/advance';
import {
  buildTimeMs,
  buildingCost,
  builderSlots,
  caps,
  farmCost,
  finishPrice,
  rates,
} from '../src/logic/formulas';
import { HOUR_MS, createGame, type GameState } from '../src/logic/state';

const C = 'c1';

function ok(r: Result): GameState {
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

function rich(s: GameState): GameState {
  const c = s.castles[0];
  for (const k of Object.keys(c.resources) as (keyof typeof c.resources)[]) c.resources[k] = 1000;
  return s;
}

/** Give the castle a level directly (test setup shortcut). */
function setCastleLevel(s: GameState, lvl: number): GameState {
  s.castles[0].buildings.find((b) => b.type === 'castle')!.level = lvl;
  return s;
}

describe('new game', () => {
  it('starts with the newbie pattern, castle Lv1 and starting stock', () => {
    const s = createGame(0, 1);
    const c = s.castles[0];
    expect(c.farms.map((f) => f.type).sort()).toEqual(
      ['circle', 'circle', 'food', 'food', 'square', 'stick', 'stick', 'triangle'].sort(),
    );
    expect(c.farms.every((f) => f.level === 1)).toBe(true);
    expect(c.resources.stick).toBe(300);
    expect(s.crystals).toBe(500);
  });
});

describe('formulas', () => {
  it('build times follow the level table, castle 1.5x', () => {
    expect(buildTimeMs(1, false)).toBe(5000);
    expect(buildTimeMs(5, false)).toBe(HOUR_MS);
    expect(buildTimeMs(10, false)).toBe(7 * 24 * HOUR_MS);
    expect(buildTimeMs(2, true)).toBe(45000);
  });

  it('costs grow x1.8 per level', () => {
    expect(buildingCost('house', 1)).toEqual({ stick: 50, circle: 40, triangle: 10 });
    expect(buildingCost('house', 2)).toEqual({ stick: 90, circle: 72, triangle: 18 });
    expect(buildingCost('castle', 2).stick).toBe(150);
    expect(farmCost(2).stick).toBe(40);
    expect(farmCost(3).stick).toBe(72);
  });

  it('finish price: free under a minute, table points, extra per day', () => {
    expect(finishPrice(30_000)).toBe(0);
    expect(finishPrice(60_000)).toBe(0);
    expect(finishPrice(600_000)).toBe(5);
    expect(finishPrice(HOUR_MS)).toBe(20);
    expect(finishPrice(24 * HOUR_MS)).toBe(260);
    expect(finishPrice(7 * 24 * HOUR_MS)).toBe(1000);
    expect(finishPrice(8 * 24 * HOUR_MS)).toBe(1150);
  });

  it('builders: 1 at Castle 1-2, 2 at 3-4, 3 at 5', () => {
    const s = createGame(0, 1);
    const c = s.castles[0];
    expect(builderSlots(c)).toBe(1);
    setCastleLevel(s, 3);
    expect(builderSlots(c)).toBe(2);
    setCastleLevel(s, 5);
    expect(builderSlots(c)).toBe(3);
  });
});

describe('production', () => {
  it('produces per game-hour and respects storage cap', () => {
    const s = createGame(0, 1);
    const after = advanceGame(s, HOUR_MS);
    const c = after.castles[0];
    expect(c.resources.stick).toBeCloseTo(330); // 2 stick farms x 15
    expect(c.resources.square).toBeCloseTo(315);
    const later = advanceGame(s, 1000 * HOUR_MS);
    expect(later.castles[0].resources.stick).toBe(caps(c).stick);
  });

  it('dev speed scales real time into game time', () => {
    const s = createGame(0, 1);
    s.devSpeed = 100;
    const after = advance(s, 36_000); // 36 real seconds = 1 game hour
    expect(after.gameMs).toBe(HOUR_MS);
    expect(after.castles[0].resources.stick).toBeCloseTo(330);
  });

  it('does not mutate the input state', () => {
    const s = createGame(0, 1);
    advanceGame(s, HOUR_MS);
    expect(s.gameMs).toBe(0);
    expect(s.castles[0].resources.stick).toBe(300);
  });
});

describe('building', () => {
  it('constructs a house that completes after 5s and pays gold', () => {
    let s = createGame(0, 1);
    s = ok(constructBuilding(s, C, 'house', 0));
    expect(s.castles[0].resources.stick).toBe(250);
    expect(s.castles[0].buildings.find((b) => b.type === 'house')!.level).toBe(0);
    s = advanceGame(s, 5000);
    expect(s.castles[0].buildings.find((b) => b.type === 'house')!.level).toBe(1);
    expect(rates(s.castles[0]).gold).toBe(5);
  });

  it('limits concurrent builds by builder count', () => {
    let s = rich(createGame(0, 1));
    s = ok(constructBuilding(s, C, 'house', 0));
    const r = constructBuilding(s, C, 'house', 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/builders/);
  });

  it('caps building level at castle level x2', () => {
    let s = rich(createGame(0, 1));
    s.castles[0].farms[0].level = 2;
    const r = upgrade(s, C, { kind: 'farm', index: 0 });
    expect(r.ok).toBe(false);
    s = ok(upgrade(s, C, { kind: 'farm', index: 1 }));
  });

  it('castle stops at level 5', () => {
    const s = rich(setCastleLevel(createGame(0, 1), 5));
    const r = upgrade(s, C, { kind: 'building', id: 'b1' });
    expect(r.ok).toBe(false);
  });

  it('respects unlock levels', () => {
    const s = rich(createGame(0, 1));
    expect(constructBuilding(s, C, 'barracks', 0).ok).toBe(false);
    expect(constructBuilding(setCastleLevel(s, 2), C, 'barracks', 0).ok).toBe(true);
  });

  it('finish now charges crystals by remaining time', () => {
    let s = rich(setCastleLevel(createGame(0, 1), 3));
    s.castles[0].farms[0].level = 4; // next level 5 = 1 hour
    s = ok(upgrade(s, C, { kind: 'farm', index: 0 }));
    const job = s.castles[0].builds[0];
    s = ok(finishBuild(s, C, job.id));
    expect(s.crystals).toBe(500 - 20);
    expect(s.castles[0].farms[0].level).toBe(5);
    expect(s.castles[0].builds).toHaveLength(0);
  });

  it('buyMissing tops up resources for crystals (1 per 50)', () => {
    let s = createGame(0, 1);
    s.castles[0].resources.stick = 0;
    s = ok(buyMissing(s, C, { stick: 120 }));
    expect(s.castles[0].resources.stick).toBe(120);
    expect(s.crystals).toBe(497);
  });
});

describe('army and food', () => {
  function withBarracks(level: number): GameState {
    const s = rich(setCastleLevel(createGame(0, 1), 5));
    s.castles[0].buildings.push({ id: 'bx', type: 'barracks', level, plot: 0 });
    return s;
  }

  it('trains units one at a time', () => {
    let s = withBarracks(1);
    s = ok(train(s, C, 'clubman', 3));
    expect(s.castles[0].resources.stick).toBe(1000 - 18);
    s = advanceGame(s, 25_000);
    expect(s.castles[0].soldiers.clubman).toBe(2);
    s = advanceGame(s, 30_000);
    expect(s.castles[0].soldiers.clubman).toBe(3);
    expect(s.castles[0].training).toHaveLength(0);
  });

  it('needs the right barracks level', () => {
    expect(train(withBarracks(1), C, 'spearman', 1).ok).toBe(false);
    expect(train(withBarracks(3), C, 'spearman', 1).ok).toBe(true);
  });

  it('finish training completes the whole queue', () => {
    let s = withBarracks(4);
    s = ok(train(s, C, 'clubman', 10));
    s = ok(train(s, C, 'shield', 10));
    s = ok(finishTraining(s, C));
    expect(s.castles[0].soldiers.clubman).toBe(10);
    expect(s.castles[0].soldiers.shield).toBe(10);
  });

  it('food goes negative per hour but stock stops at 0, then soldiers die until balanced', () => {
    const s = withBarracks(1);
    const c = s.castles[0];
    c.soldiers.clubman = 100; // upkeep 100/h vs 30/h production -> -70/h
    c.resources.food = 140; // runs out after 2 hours
    const after = advanceGame(s, 10 * HOUR_MS);
    const c2 = after.castles[0];
    expect(c2.resources.food).toBe(0);
    expect(c2.soldiers.clubman).toBe(30); // food production is 30/h
    expect(rates(c2).food).toBe(0);
    expect(after.events.some((e) => e.kind === 'starve')).toBe(true);
  });

  it('no starvation while food stock remains', () => {
    const s = withBarracks(1);
    s.castles[0].soldiers.clubman = 100;
    s.castles[0].resources.food = 1000;
    const after = advanceGame(s, 10 * HOUR_MS);
    expect(after.castles[0].soldiers.clubman).toBe(100);
    expect(after.castles[0].resources.food).toBeCloseTo(300);
  });
});

describe('rare shapes', () => {
  it('exchange trades 25 of each basic for 1 pentagon', () => {
    let s = rich(createGame(0, 1));
    s.castles[0].buildings.push({ id: 'bx', type: 'exchange', level: 1, plot: 0 });
    s = ok(exchange(s, C, 2));
    expect(s.castles[0].pentagons).toBe(2);
    expect(s.castles[0].resources.square).toBe(950);
  });

  it('lucky drops happen about 1% per shape farm per hour', () => {
    const s = createGame(0, 12345);
    const after = advanceGame(s, 1000 * HOUR_MS); // 6 shape farms x 1000 h x 1% ~ 60
    const p = after.castles[0].pentagons;
    expect(p).toBeGreaterThan(30);
    expect(p).toBeLessThan(100);
  });
});
