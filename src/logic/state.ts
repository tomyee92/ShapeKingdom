import type { BuildingType } from '../data/buildings';
import { DEFAULT_DEV_SPEED, START_CRYSTALS, START_RESOURCES } from '../data/economy';
import { NEWBIE_PATTERN_ID, getPattern } from '../data/patterns';
import type { FarmType, Res } from '../data/resources';
import { UNIT_TYPES, type UnitType } from '../data/units';

export const SAVE_VERSION = 1;
export const HOUR_MS = 3600 * 1000;

export interface Farm {
  type: FarmType;
  level: number;
  /** Game-ms of production since the last lucky-drop roll. */
  luckMs: number;
}

export interface Building {
  id: string;
  type: BuildingType;
  /** 0 while the first level is under construction. */
  level: number;
  /** Inner plot index; the castle uses -1 (centre). */
  plot: number;
}

export type BuildTarget = { kind: 'farm'; index: number } | { kind: 'building'; id: string };

export interface BuildJob {
  id: string;
  target: BuildTarget;
  toLevel: number;
  startMs: number;
  endMs: number;
}

export interface TrainJob {
  id: string;
  unit: UnitType;
  /** Units still to come out. */
  count: number;
  total: number;
  unitMs: number;
  /** When the next unit comes out. Only meaningful for the front job. */
  nextMs: number;
}

export interface Castle {
  id: string;
  name: string;
  zonePatternId: string;
  resources: Record<Res, number>;
  pentagons: number;
  farms: Farm[];
  buildings: Building[];
  builds: BuildJob[];
  training: TrainJob[];
  soldiers: Record<UnitType, number>;
}

export type EventKind = 'build' | 'train' | 'starve' | 'lucky' | 'info';

export interface GameEvent {
  id: number;
  gameMs: number;
  kind: EventKind;
  text: string;
}

export interface GameState {
  version: typeof SAVE_VERSION;
  crystals: number;
  devSpeed: number;
  /** Game clock. Runs devSpeed times faster than the real clock. */
  gameMs: number;
  /** Real clock (Date.now()) at the moment gameMs was last advanced. */
  realMs: number;
  rng: number;
  nextId: number;
  castles: Castle[];
  events: GameEvent[];
}

export const MAX_EVENTS = 50;

export function emptySoldiers(): Record<UnitType, number> {
  return Object.fromEntries(UNIT_TYPES.map((u) => [u, 0])) as Record<UnitType, number>;
}

export function createGame(realNowMs: number, seed = realNowMs >>> 0): GameState {
  const pattern = getPattern(NEWBIE_PATTERN_ID);
  const castle: Castle = {
    id: 'c1',
    name: 'Home Castle',
    zonePatternId: pattern.id,
    resources: { ...START_RESOURCES },
    pentagons: 0,
    farms: pattern.farms.map((type) => ({ type, level: 1, luckMs: 0 })),
    buildings: [{ id: 'b1', type: 'castle', level: 1, plot: -1 }],
    builds: [],
    training: [],
    soldiers: emptySoldiers(),
  };
  return {
    version: SAVE_VERSION,
    crystals: START_CRYSTALS,
    devSpeed: DEFAULT_DEV_SPEED,
    gameMs: 0,
    realMs: realNowMs,
    rng: seed || 1,
    nextId: 2,
    castles: [castle],
    events: [],
  };
}

export function newId(s: GameState, prefix: string): string {
  return `${prefix}${s.nextId++}`;
}

export function pushEvent(s: GameState, kind: EventKind, text: string, gameMs = s.gameMs): void {
  s.events.push({ id: s.nextId++, gameMs, kind, text });
  if (s.events.length > MAX_EVENTS) s.events.splice(0, s.events.length - MAX_EVENTS);
}

export function getCastle(s: GameState, castleId: string): Castle {
  const c = s.castles.find((x) => x.id === castleId);
  if (!c) throw new Error(`No castle ${castleId}`);
  return c;
}
