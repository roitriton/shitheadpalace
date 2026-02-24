import type { GameVariant, Power, Rank } from '../types';

// ─── Configurable vs. Jack-only powers ───────────────────────────────────────

/**
 * Powers that can be assigned to card ranks via GameVariant.powerAssignments.
 * Jack-suit powers (Revolution, Manouche, Flop Reverse, Shifumi and their
 * Super variants) are triggered exclusively by suit and are never rank-assigned.
 */
export const CONFIGURABLE_POWERS: readonly Power[] = [
  'burn',
  'reset',
  'under',
  'skip',
  'mirror',
  'target',
] as const;

/**
 * Powers that are determined by Jack suit, not by a rank assignment.
 * These must never appear in powerAssignments.
 */
export const JACK_ONLY_POWERS: readonly Power[] = [
  'revolution',
  'superRevolution',
  'manouche',
  'superManouche',
  'flopReverse',
  'flopRemake',
  'shifumi',
  'superShifumi',
] as const;

// ─── Default power assignments (Standard rules) ───────────────────────────────

/**
 * The standard power-to-rank assignments used in a default Shit Head game.
 *
 * | Power  | Rank | Effect                                        |
 * |--------|------|-----------------------------------------------|
 * | burn   | 10   | Burn pile → graveyard; launcher replays       |
 * | reset  | 2    | Pile value reset to 0 for the next player     |
 * | under  | 8    | Next player must play a card ≤ 8              |
 * | skip   | 7    | Skip the next player's turn                   |
 * | mirror | 9    | Takes effective rank of its companion card    |
 * | target | A    | Launcher chooses who plays next               |
 */
export const DEFAULT_POWER_ASSIGNMENTS: Partial<Record<Power, Rank | Rank[]>> = {
  burn: '10',
  reset: '2',
  under: '8',
  skip: '7',
  mirror: '9',
  target: 'A',
};

// ─── createVariant ────────────────────────────────────────────────────────────

/**
 * Creates a GameVariant, merging any provided overrides on top of the
 * standard defaults.
 *
 * - `powerAssignments` is merged field-by-field: only the powers explicitly
 *   listed in `overrides.powerAssignments` are changed; the rest keep their
 *   default values. To disable a specific power, pass `{ power: undefined }`
 *   alongside the spread of defaults.
 * - All other fields (name, playerCount, deckCount) are replaced entirely if
 *   present in overrides.
 *
 * @param overrides - Partial GameVariant to merge with defaults.
 * @returns A fully populated GameVariant.
 *
 * @example
 * // Standard 4-player game
 * const v = createVariant();
 *
 * @example
 * // Custom name, skip moved to 'Q', mirror disabled
 * const v = createVariant({
 *   name: 'Chaos',
 *   powerAssignments: { ...DEFAULT_POWER_ASSIGNMENTS, skip: 'Q', mirror: undefined },
 * });
 */
export function createVariant(overrides: Partial<GameVariant> = {}): GameVariant {
  const { powerAssignments: overridePowers, ...rest } = overrides;
  return {
    name: 'Standard',
    playerCount: 4,
    deckCount: 1,
    ...rest,
    powerAssignments: {
      ...DEFAULT_POWER_ASSIGNMENTS,
      ...(overridePowers ?? {}),
    },
  };
}
