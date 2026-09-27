// Resource definitions. Colors are shared by UI icons, farms and soldier recipes.

export const BASIC = ['stick', 'circle', 'triangle', 'square'] as const;
export type BasicRes = (typeof BASIC)[number];

export const RESOURCES = ['stick', 'circle', 'triangle', 'square', 'food', 'gold'] as const;
export type Res = (typeof RESOURCES)[number];

export type FarmType = BasicRes | 'food';
export const FARM_TYPES: FarmType[] = ['stick', 'circle', 'triangle', 'square', 'food'];

export type Cost = Partial<Record<Res, number>>;

export const RES_INFO: Record<Res, { name: string; color: string }> = {
  stick: { name: 'Stick', color: '#a0673a' },
  circle: { name: 'Circle', color: '#3f8fd8' },
  triangle: { name: 'Triangle', color: '#d9534f' },
  square: { name: 'Square', color: '#7d8b9c' },
  food: { name: 'Food', color: '#e8a93a' },
  gold: { name: 'Gold', color: '#f2c230' },
};

export const PENTAGON = { name: 'Pentagon', color: '#9b59d0' };
export const CRYSTAL = { name: 'Crystal', color: '#35c6d6' };
