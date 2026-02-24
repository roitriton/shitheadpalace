import type { GameVariant, Power, Rank } from '../types';
import { JACK_ONLY_POWERS } from './defaults';

// ─── Valid rank set ───────────────────────────────────────────────────────────

const VALID_RANKS = new Set<Rank>([
  '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A',
]);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VariantValidationError {
  /** Dot-notation path to the field that failed validation. */
  field: string;
  /** Human-readable description of the failure. */
  message: string;
}

// ─── validateVariant ─────────────────────────────────────────────────────────

/**
 * Validates a GameVariant for correctness and internal consistency.
 *
 * Rules enforced:
 * 1. `name` — non-empty string, ≤ 50 characters.
 * 2. `playerCount` — integer in [2, 6].
 * 3. `deckCount` — integer in [1, 4].
 * 4. `powerAssignments` — each entry must:
 *    a. Name a configurable power (not a Jack-only power).
 *    b. Map to valid Rank value(s).
 *    c. Not share a rank with any other power (no rank conflicts).
 *
 * @param variant - The variant to validate.
 * @returns Array of validation errors. Empty array means the variant is valid.
 */
export function validateVariant(variant: GameVariant): VariantValidationError[] {
  const errors: VariantValidationError[] = [];

  // ── 1. name ────────────────────────────────────────────────────────────────
  if (typeof variant.name !== 'string' || variant.name.length === 0) {
    errors.push({ field: 'name', message: 'name must be a non-empty string' });
  } else if (variant.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'name must not be blank (whitespace only)' });
  } else if (variant.name.length > 50) {
    errors.push({ field: 'name', message: 'name must be at most 50 characters' });
  }

  // ── 2. playerCount ────────────────────────────────────────────────────────
  if (
    !Number.isInteger(variant.playerCount) ||
    variant.playerCount < 2 ||
    variant.playerCount > 6
  ) {
    errors.push({
      field: 'playerCount',
      message: 'playerCount must be an integer between 2 and 6',
    });
  }

  // ── 3. deckCount ──────────────────────────────────────────────────────────
  if (
    !Number.isInteger(variant.deckCount) ||
    variant.deckCount < 1 ||
    variant.deckCount > 4
  ) {
    errors.push({
      field: 'deckCount',
      message: 'deckCount must be an integer between 1 and 4',
    });
  }

  // ── 4. powerAssignments ───────────────────────────────────────────────────
  // Map from rank → first power that claimed it (for conflict detection)
  const claimedBy = new Map<Rank, Power>();

  for (const [powerStr, assignment] of Object.entries(variant.powerAssignments)) {
    if (assignment === undefined) continue;

    const power = powerStr as Power;
    const field = `powerAssignments.${power}`;

    // 4a. Jack-only powers must not be rank-assigned
    if ((JACK_ONLY_POWERS as readonly string[]).includes(power)) {
      errors.push({
        field,
        message: `'${power}' is triggered by Jack suit and cannot be rank-assigned`,
      });
      continue;
    }

    // Normalise single rank to array for uniform processing
    const ranks: Rank[] = Array.isArray(assignment)
      ? (assignment as Rank[])
      : [assignment as Rank];

    for (const rank of ranks) {
      // 4b. Each rank must be valid
      if (!VALID_RANKS.has(rank)) {
        errors.push({ field, message: `'${rank}' is not a valid card rank` });
        continue;
      }

      // 4c. No rank conflict between different powers
      const existing = claimedBy.get(rank);
      if (existing !== undefined && existing !== power) {
        errors.push({
          field,
          message: `rank '${rank}' is already assigned to power '${existing}'`,
        });
      } else {
        claimedBy.set(rank, power);
      }
    }
  }

  return errors;
}

/**
 * Like `validateVariant`, but throws a `TypeError` listing all errors when
 * the variant is invalid. Useful in contexts where you want a hard failure.
 *
 * @throws {TypeError} If one or more validation errors are found.
 */
export function assertVariantValid(variant: GameVariant): void {
  const errors = validateVariant(variant);
  if (errors.length > 0) {
    const details = errors.map((e) => `[${e.field}] ${e.message}`).join('; ');
    throw new TypeError(`Invalid GameVariant: ${details}`);
  }
}
