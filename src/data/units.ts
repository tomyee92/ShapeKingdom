import type { Cost } from './resources';

export type UnitType = 'clubman' | 'slinger' | 'spearman' | 'shield';
export const UNIT_TYPES: UnitType[] = ['clubman', 'slinger', 'spearman', 'shield'];

export interface UnitDef {
  name: string;
  recipe: string;
  /** Recipe shapes plus Gold wage. */
  cost: Cost;
  trainSec: number;
  foodPerHour: number;
  atk: number;
  def: number;
  hp: number;
  barracksLevel: number;
}

export const UNITS: Record<UnitType, UnitDef> = {
  clubman: {
    name: 'Clubman',
    recipe: 'Circle head, 5-stick body, stick club',
    cost: { circle: 1, stick: 6, gold: 2 },
    trainSec: 10,
    foodPerHour: 1,
    atk: 5,
    def: 3,
    hp: 20,
    barracksLevel: 1,
  },
  slinger: {
    name: 'Slinger',
    recipe: 'Circle head, 5-stick body, circle stone',
    cost: { circle: 2, stick: 5, gold: 3 },
    trainSec: 20,
    foodPerHour: 1,
    atk: 6,
    def: 2,
    hp: 15,
    barracksLevel: 2,
  },
  spearman: {
    name: 'Spearman',
    recipe: 'Circle head, 5-stick body, stick shaft, triangle tip',
    cost: { circle: 1, stick: 6, triangle: 1, gold: 4 },
    trainSec: 30,
    foodPerHour: 1,
    atk: 9,
    def: 4,
    hp: 22,
    barracksLevel: 3,
  },
  shield: {
    name: 'Shield Bearer',
    recipe: 'Circle head, 5-stick body, square shield',
    cost: { circle: 1, stick: 5, square: 1, gold: 5 },
    trainSec: 45,
    foodPerHour: 2,
    atk: 3,
    def: 10,
    hp: 35,
    barracksLevel: 4,
  },
};

export const MAX_TRAIN_QUEUE = 5;
