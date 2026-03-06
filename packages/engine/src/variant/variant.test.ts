import { describe, it, expect } from 'vitest';
import {
  CONFIGURABLE_POWERS,
  JACK_ONLY_POWERS,
  DEFAULT_POWER_ASSIGNMENTS,
  createVariant,
  validateVariant,
  assertVariantValid,
  serializeVariant,
  deserializeVariant,
} from './index';
import type { GameVariant } from '../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** A minimal valid variant used as a base in many tests. */
function validVariant(overrides: Partial<GameVariant> = {}): GameVariant {
  return {
    name: 'Test',
    playerCount: 4,
    deckCount: 1,
    powerAssignments: { burn: '10', reset: '2', skip: '7', mirror: '9' },
    ...overrides,
  };
}

// ─── CONFIGURABLE_POWERS / JACK_ONLY_POWERS ───────────────────────────────────

describe('CONFIGURABLE_POWERS', () => {
  it('includes burn, reset, under, skip, mirror, target', () => {
    expect(CONFIGURABLE_POWERS).toContain('burn');
    expect(CONFIGURABLE_POWERS).toContain('reset');
    expect(CONFIGURABLE_POWERS).toContain('under');
    expect(CONFIGURABLE_POWERS).toContain('skip');
    expect(CONFIGURABLE_POWERS).toContain('mirror');
    expect(CONFIGURABLE_POWERS).toContain('target');
  });

  it('does not include Jack-only powers', () => {
    for (const p of JACK_ONLY_POWERS) {
      expect(CONFIGURABLE_POWERS).not.toContain(p);
    }
  });
});

describe('JACK_ONLY_POWERS', () => {
  it('includes all four Jack suit powers and their super variants', () => {
    expect(JACK_ONLY_POWERS).toContain('revolution');
    expect(JACK_ONLY_POWERS).toContain('superRevolution');
    expect(JACK_ONLY_POWERS).toContain('manouche');
    expect(JACK_ONLY_POWERS).toContain('superManouche');
    expect(JACK_ONLY_POWERS).toContain('flopReverse');
    expect(JACK_ONLY_POWERS).toContain('flopRemake');
    expect(JACK_ONLY_POWERS).toContain('shifumi');
    expect(JACK_ONLY_POWERS).toContain('superShifumi');
  });
});

// ─── DEFAULT_POWER_ASSIGNMENTS ────────────────────────────────────────────────

describe('DEFAULT_POWER_ASSIGNMENTS', () => {
  it('assigns burn to 10', () => expect(DEFAULT_POWER_ASSIGNMENTS.burn).toBe('10'));
  it('assigns reset to 2',  () => expect(DEFAULT_POWER_ASSIGNMENTS.reset).toBe('2'));
  it('assigns under to 8',  () => expect(DEFAULT_POWER_ASSIGNMENTS.under).toBe('8'));
  it('assigns skip to 7',   () => expect(DEFAULT_POWER_ASSIGNMENTS.skip).toBe('7'));
  it('assigns mirror to 9', () => expect(DEFAULT_POWER_ASSIGNMENTS.mirror).toBe('9'));
  it('assigns target to A', () => expect(DEFAULT_POWER_ASSIGNMENTS.target).toBe('A'));

  it('has no Jack-only power assignments', () => {
    for (const p of JACK_ONLY_POWERS) {
      expect(DEFAULT_POWER_ASSIGNMENTS[p]).toBeUndefined();
    }
  });
});

// ─── createVariant ────────────────────────────────────────────────────────────

describe('createVariant', () => {
  it('returns a variant with standard defaults when called with no arguments', () => {
    const v = createVariant();
    expect(v.name).toBe('Standard');
    expect(v.playerCount).toBe(4);
    expect(v.deckCount).toBe(1);
    expect(v.powerAssignments.burn).toBe('10');
    expect(v.powerAssignments.reset).toBe('2');
    expect(v.powerAssignments.under).toBe('8');
    expect(v.powerAssignments.skip).toBe('7');
    expect(v.powerAssignments.mirror).toBe('9');
    expect(v.powerAssignments.target).toBe('A');
  });

  it('overrides top-level fields', () => {
    const v = createVariant({ name: 'Chaos', playerCount: 5, deckCount: 2 });
    expect(v.name).toBe('Chaos');
    expect(v.playerCount).toBe(5);
    expect(v.deckCount).toBe(2);
  });

  it('merges powerAssignments on top of defaults (only overridden powers change)', () => {
    const v = createVariant({ powerAssignments: { skip: 'Q' } });
    expect(v.powerAssignments.skip).toBe('Q');   // overridden
    expect(v.powerAssignments.burn).toBe('10');  // kept from default
    expect(v.powerAssignments.reset).toBe('2');  // kept from default
  });

  it('keeps defaults when powerAssignments override object is empty (merge semantics)', () => {
    // Passing {} means "no extra changes" — all defaults are preserved.
    // To fully disable a power, set it to undefined explicitly in the override.
    const v = createVariant({ powerAssignments: {} });
    expect(v.powerAssignments.burn).toBe('10');
    expect(v.powerAssignments.skip).toBe('7');
    expect(v.powerAssignments.target).toBe('A');
  });

  it('can disable a single power by explicitly setting it to undefined', () => {
    const v = createVariant({ powerAssignments: { ...DEFAULT_POWER_ASSIGNMENTS, mirror: undefined } });
    expect(v.powerAssignments.mirror).toBeUndefined();
    expect(v.powerAssignments.burn).toBe('10'); // others untouched
  });

  it('does not mutate the DEFAULT_POWER_ASSIGNMENTS', () => {
    const before = { ...DEFAULT_POWER_ASSIGNMENTS };
    createVariant({ powerAssignments: { skip: 'K' } });
    expect(DEFAULT_POWER_ASSIGNMENTS).toEqual(before);
  });

  it('produces a new object on each call (not the same reference)', () => {
    const v1 = createVariant();
    const v2 = createVariant();
    expect(v1).not.toBe(v2);
    expect(v1.powerAssignments).not.toBe(v2.powerAssignments);
  });
});

// ─── validateVariant ─────────────────────────────────────────────────────────

describe('validateVariant', () => {
  it('returns no errors for a fully valid variant', () => {
    expect(validateVariant(validVariant())).toHaveLength(0);
  });

  it('returns no errors for the default variant', () => {
    expect(validateVariant(createVariant())).toHaveLength(0);
  });

  // ── name ──────────────────────────────────────────────────────────────────

  it('reports an error when name is empty', () => {
    const errors = validateVariant(validVariant({ name: '' }));
    expect(errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('reports an error when name is whitespace only', () => {
    const errors = validateVariant(validVariant({ name: '   ' }));
    expect(errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('reports an error when name exceeds 50 characters', () => {
    const errors = validateVariant(validVariant({ name: 'A'.repeat(51) }));
    expect(errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('accepts a name of exactly 50 characters', () => {
    const errors = validateVariant(validVariant({ name: 'A'.repeat(50) }));
    expect(errors.some((e) => e.field === 'name')).toBe(false);
  });

  // ── playerCount ───────────────────────────────────────────────────────────

  it('reports an error when playerCount is 1 (below minimum)', () => {
    const errors = validateVariant(validVariant({ playerCount: 1 }));
    expect(errors.some((e) => e.field === 'playerCount')).toBe(true);
  });

  it('reports an error when playerCount is 7 (above maximum)', () => {
    const errors = validateVariant(validVariant({ playerCount: 7 }));
    expect(errors.some((e) => e.field === 'playerCount')).toBe(true);
  });

  it('reports an error when playerCount is not an integer', () => {
    const errors = validateVariant(validVariant({ playerCount: 3.5 }));
    expect(errors.some((e) => e.field === 'playerCount')).toBe(true);
  });

  it('accepts playerCount of 2 (minimum)', () => {
    expect(validateVariant(validVariant({ playerCount: 2 }))).toHaveLength(0);
  });

  it('accepts playerCount of 6 (maximum)', () => {
    expect(validateVariant(validVariant({ playerCount: 6, deckCount: 2 }))).toHaveLength(0);
  });

  // ── deckCount ─────────────────────────────────────────────────────────────

  it('reports an error when deckCount is 0', () => {
    const errors = validateVariant(validVariant({ deckCount: 0 }));
    expect(errors.some((e) => e.field === 'deckCount')).toBe(true);
  });

  it('reports an error when deckCount is 5 (above maximum)', () => {
    const errors = validateVariant(validVariant({ deckCount: 5 }));
    expect(errors.some((e) => e.field === 'deckCount')).toBe(true);
  });

  it('accepts deckCount of 1', () => {
    expect(validateVariant(validVariant({ deckCount: 1 }))).toHaveLength(0);
  });

  it('accepts deckCount of 4 (maximum)', () => {
    expect(validateVariant(validVariant({ deckCount: 4 }))).toHaveLength(0);
  });

  // ── powerAssignments — Jack-only forbidden ─────────────────────────────────

  it('reports an error when a Jack-only power appears in powerAssignments', () => {
    const errors = validateVariant(
      validVariant({ powerAssignments: { burn: '10', revolution: 'Q' as never } }),
    );
    expect(errors.some((e) => e.field === 'powerAssignments.revolution')).toBe(true);
  });

  it('reports errors for all Jack-only powers present in powerAssignments', () => {
    const errors = validateVariant(
      validVariant({
        powerAssignments: {
          manouche: '5' as never,
          superShifumi: '6' as never,
        },
      }),
    );
    expect(errors.some((e) => e.field === 'powerAssignments.manouche')).toBe(true);
    expect(errors.some((e) => e.field === 'powerAssignments.superShifumi')).toBe(true);
  });

  // ── powerAssignments — invalid ranks ──────────────────────────────────────

  it('reports an error when a power is assigned an invalid rank', () => {
    const errors = validateVariant(
      validVariant({ powerAssignments: { burn: 'Z' as never } }),
    );
    expect(errors.some((e) => e.field === 'powerAssignments.burn')).toBe(true);
  });

  it('reports an error for each invalid rank in a Rank[] assignment', () => {
    const errors = validateVariant(
      validVariant({ powerAssignments: { burn: ['10', 'X' as never, 'Y' as never] } }),
    );
    expect(errors.filter((e) => e.field === 'powerAssignments.burn')).toHaveLength(2);
  });

  // ── powerAssignments — rank conflicts ─────────────────────────────────────

  it('reports an error when two powers share the same rank', () => {
    const errors = validateVariant(
      validVariant({ powerAssignments: { burn: '10', reset: '10' } }),
    );
    expect(errors.some((e) => e.message.includes("'10'"))).toBe(true);
  });

  it('accepts a power assigned to multiple different ranks', () => {
    const errors = validateVariant(
      validVariant({ powerAssignments: { burn: ['10', 'Q'], reset: '2', skip: '7', mirror: '9' } }),
    );
    expect(errors).toHaveLength(0);
  });

  it('reports a conflict when a multi-rank power overlaps with another power', () => {
    const errors = validateVariant(
      validVariant({ powerAssignments: { burn: ['10', '2'], reset: '2' } }),
    );
    expect(errors.some((e) => e.message.includes("'2'"))).toBe(true);
  });

  it('accepts an empty powerAssignments (all powers disabled)', () => {
    expect(validateVariant(validVariant({ powerAssignments: {} }))).toHaveLength(0);
  });

  // ── minHandSize ────────────────────────────────────────────────────────

  it('accepts minHandSize of 1', () => {
    expect(validateVariant(validVariant({ minHandSize: 1 }))).toHaveLength(0);
  });

  it('accepts minHandSize of 5', () => {
    expect(validateVariant(validVariant({ minHandSize: 5 }))).toHaveLength(0);
  });

  it('reports an error when minHandSize is 0', () => {
    const errors = validateVariant(validVariant({ minHandSize: 0 }));
    expect(errors.some((e) => e.field === 'minHandSize')).toBe(true);
  });

  it('reports an error when minHandSize is 6', () => {
    const errors = validateVariant(validVariant({ minHandSize: 6 }));
    expect(errors.some((e) => e.field === 'minHandSize')).toBe(true);
  });

  it('reports an error when minHandSize is not an integer', () => {
    const errors = validateVariant(validVariant({ minHandSize: 2.5 }));
    expect(errors.some((e) => e.field === 'minHandSize')).toBe(true);
  });

  it('accepts variant without minHandSize (defaults to 3)', () => {
    expect(validateVariant(validVariant())).toHaveLength(0);
  });

  // ── flopSize ───────────────────────────────────────────────────────────

  it('accepts flopSize of 1', () => {
    expect(validateVariant(validVariant({ flopSize: 1 }))).toHaveLength(0);
  });

  it('accepts flopSize of 5', () => {
    const errors = validateVariant(validVariant({ flopSize: 5, deckCount: 2 }));
    expect(errors.some((e) => e.field === 'flopSize')).toBe(false);
  });

  it('reports an error when flopSize is 0', () => {
    const errors = validateVariant(validVariant({ flopSize: 0 }));
    expect(errors.some((e) => e.field === 'flopSize')).toBe(true);
  });

  it('reports an error when flopSize is 6', () => {
    const errors = validateVariant(validVariant({ flopSize: 6 }));
    expect(errors.some((e) => e.field === 'flopSize')).toBe(true);
  });

  // ── card count ─────────────────────────────────────────────────────────

  it('reports an error when not enough cards for all players', () => {
    // 6 players × (3 + 3 + 3) = 54 needed, only 52 in 1 deck
    const errors = validateVariant(validVariant({ playerCount: 6, deckCount: 1 }));
    expect(errors.some((e) => e.field === 'deckCount')).toBe(true);
  });

  it('accepts when 2 decks provide enough cards for 6 players', () => {
    // 6 players × 9 = 54; 2 decks = 104
    const errors = validateVariant(validVariant({ playerCount: 6, deckCount: 2 }));
    expect(errors.some((e) => e.field === 'deckCount')).toBe(false);
  });

  it('reports an error when large minHandSize + flopSize exceeds available cards', () => {
    // 4 players × (5 + 5 + 5) = 60 needed, only 52 in 1 deck
    const errors = validateVariant(validVariant({ minHandSize: 5, flopSize: 5, deckCount: 1 }));
    expect(errors.some((e) => e.field === 'deckCount')).toBe(true);
  });

  it('accepts when small sizes fit in a single deck', () => {
    // 6 players × (1 + 1 + 1) = 18 needed, 52 available
    const errors = validateVariant(validVariant({ playerCount: 6, minHandSize: 1, flopSize: 1, deckCount: 1 }));
    expect(errors.some((e) => e.field === 'deckCount')).toBe(false);
  });
});

// ─── assertVariantValid ───────────────────────────────────────────────────────

describe('assertVariantValid', () => {
  it('does not throw for a valid variant', () => {
    expect(() => assertVariantValid(createVariant())).not.toThrow();
  });

  it('throws TypeError listing all errors for an invalid variant', () => {
    const bad = validVariant({ name: '', playerCount: 99 });
    expect(() => assertVariantValid(bad)).toThrow(TypeError);
    expect(() => assertVariantValid(bad)).toThrow(/name/);
    expect(() => assertVariantValid(bad)).toThrow(/playerCount/);
  });
});

// ─── serializeVariant ─────────────────────────────────────────────────────────

describe('serializeVariant', () => {
  it('returns a valid JSON string', () => {
    const v = createVariant();
    const json = serializeVariant(v);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('round-trips through JSON with identical fields', () => {
    const v = createVariant({ name: 'My Variant', playerCount: 3 });
    const json = serializeVariant(v);
    const parsed = JSON.parse(json) as GameVariant;
    expect(parsed.name).toBe('My Variant');
    expect(parsed.playerCount).toBe(3);
    expect(parsed.powerAssignments).toEqual(v.powerAssignments);
  });
});

// ─── deserializeVariant ──────────────────────────────────────────────────────

describe('deserializeVariant', () => {
  it('reconstructs the original variant from its serialized form', () => {
    const v = createVariant({ name: 'Chaos', playerCount: 5, deckCount: 2 });
    const restored = deserializeVariant(serializeVariant(v));
    expect(restored).toEqual(v);
  });

  it('throws on malformed JSON', () => {
    expect(() => deserializeVariant('not json }')).toThrow(/invalid JSON/i);
  });

  it('throws when the root is not an object (array)', () => {
    expect(() => deserializeVariant('[1, 2, 3]')).toThrow(/object/i);
  });

  it('throws when name is missing', () => {
    const bad = JSON.stringify({ playerCount: 3, deckCount: 1, powerAssignments: {} });
    expect(() => deserializeVariant(bad)).toThrow(/name/i);
  });

  it('throws when playerCount is missing', () => {
    const bad = JSON.stringify({ name: 'X', deckCount: 1, powerAssignments: {} });
    expect(() => deserializeVariant(bad)).toThrow(/playerCount/i);
  });

  it('throws when powerAssignments is missing', () => {
    const bad = JSON.stringify({ name: 'X', playerCount: 3, deckCount: 1 });
    expect(() => deserializeVariant(bad)).toThrow(/powerAssignments/i);
  });

  it('throws when the deserialized variant fails validation (e.g. playerCount out of range)', () => {
    const bad = JSON.stringify({
      name: 'X',
      playerCount: 99,
      deckCount: 1,
      powerAssignments: {},
    });
    expect(() => deserializeVariant(bad)).toThrow(/playerCount/i);
  });

  it('throws when a rank conflict is present in the JSON', () => {
    const bad = JSON.stringify({
      name: 'X',
      playerCount: 4,
      deckCount: 1,
      powerAssignments: { burn: '10', reset: '10' },
    });
    expect(() => deserializeVariant(bad)).toThrow();
  });

  it('roundtrips minHandSize and flopSize', () => {
    const v = createVariant({ minHandSize: 2, flopSize: 4 });
    const restored = deserializeVariant(serializeVariant(v));
    expect(restored.minHandSize).toBe(2);
    expect(restored.flopSize).toBe(4);
  });

  it('omits minHandSize and flopSize when not present', () => {
    const v = createVariant();
    const restored = deserializeVariant(serializeVariant(v));
    expect(restored.minHandSize).toBeUndefined();
    expect(restored.flopSize).toBeUndefined();
  });
});
