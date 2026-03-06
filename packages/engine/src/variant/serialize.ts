import type { GameVariant } from '../types';
import { validateVariant } from './validate';

// ─── serializeVariant ────────────────────────────────────────────────────────

/**
 * Serializes a GameVariant to a JSON string.
 *
 * The variant is assumed to be valid; call `validateVariant` or
 * `assertVariantValid` beforehand if you need a guarantee.
 *
 * @param variant - The variant to serialize.
 * @returns A compact JSON representation of the variant.
 */
export function serializeVariant(variant: GameVariant): string {
  return JSON.stringify(variant);
}

// ─── deserializeVariant ──────────────────────────────────────────────────────

/**
 * Deserializes a GameVariant from a JSON string.
 *
 * Performs structural checks and runs `validateVariant` on the result.
 * Throws on any of the following:
 *   - Malformed JSON
 *   - Missing or wrong-typed required fields
 *   - Validation errors (see `validateVariant`)
 *
 * @param json - A JSON string previously produced by `serializeVariant`.
 * @returns The deserialized and validated GameVariant.
 * @throws {Error} If the JSON cannot be parsed or the variant is invalid.
 */
export function deserializeVariant(json: string): GameVariant {
  // ── Parse ──────────────────────────────────────────────────────────────────
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('deserializeVariant: invalid JSON string');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('deserializeVariant: JSON root must be an object');
  }

  const obj = parsed as Record<string, unknown>;

  // ── Structural checks ──────────────────────────────────────────────────────
  if (typeof obj['name'] !== 'string') {
    throw new Error("deserializeVariant: missing or invalid field 'name'");
  }
  if (typeof obj['playerCount'] !== 'number') {
    throw new Error("deserializeVariant: missing or invalid field 'playerCount'");
  }
  if (typeof obj['deckCount'] !== 'number') {
    throw new Error("deserializeVariant: missing or invalid field 'deckCount'");
  }
  if (typeof obj['powerAssignments'] !== 'object' || obj['powerAssignments'] === null) {
    throw new Error("deserializeVariant: missing or invalid field 'powerAssignments'");
  }

  // ── Construct candidate ───────────────────────────────────────────────────
  const candidate: GameVariant = {
    name: obj['name'] as string,
    playerCount: obj['playerCount'] as number,
    deckCount: obj['deckCount'] as number,
    powerAssignments: obj['powerAssignments'] as GameVariant['powerAssignments'],
    ...(obj['uniquePowerAssignments'] !== undefined
      ? { uniquePowerAssignments: obj['uniquePowerAssignments'] as GameVariant['uniquePowerAssignments'] }
      : {}),
  };

  // ── Validate ───────────────────────────────────────────────────────────────
  const errors = validateVariant(candidate);
  if (errors.length > 0) {
    const details = errors.map((e) => `[${e.field}] ${e.message}`).join('; ');
    throw new Error(`deserializeVariant: invalid variant — ${details}`);
  }

  return candidate;
}
