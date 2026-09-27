import type { FarmType } from './resources';

export interface ZonePattern {
  id: string;
  name: string;
  /** Exactly 8 farm slots, in ring order. */
  farms: FarmType[];
}

export const NEWBIE_PATTERN_ID = 'newbie';

export const ZONE_PATTERNS: ZonePattern[] = [
  { id: 'newbie', name: 'Homeland', farms: ['stick', 'circle', 'food', 'triangle', 'stick', 'circle', 'food', 'square'] },
  // Used by future castles on the world map.
  { id: 'circle-rich', name: 'Circle-rich', farms: ['circle', 'circle', 'food', 'stick', 'circle', 'triangle', 'food', 'circle'] },
  { id: 'breadbasket', name: 'Breadbasket', farms: ['food', 'stick', 'food', 'circle', 'food', 'triangle', 'food', 'square'] },
  { id: 'triangle-mine', name: 'Triangle mine', farms: ['triangle', 'stick', 'food', 'triangle', 'circle', 'triangle', 'food', 'square'] },
];

export function getPattern(id: string): ZonePattern {
  const p = ZONE_PATTERNS.find((z) => z.id === id);
  if (!p) throw new Error(`Unknown zone pattern ${id}`);
  return p;
}
