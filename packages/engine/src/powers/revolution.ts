import type { Card, GamePhase, GameState, GameVariant } from '../types';
import { appendLog } from '../utils/log';
import { matchesPowerRank, isUniquePowerCard } from './utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true when the given card is a Jack of Diamonds (J♦) — the card
 * that triggers Revolution and Super Revolution.
 *
 * The J♦ power is suit-specific and is not configurable via the variant.
 */
export function isRevolutionCard(card: Card): boolean {
  return card.rank === 'J' && card.suit === 'diamonds';
}

// ─── Trigger detection ────────────────────────────────────────────────────────

/**
 * Returns true when playing `playedCards` should trigger a regular Revolution.
 *
 * Conditions:
 *   - At least one J♦ is in the played cards.
 *   - No Mirror card accompanies the play (J♦ + Mirror → Super Revolution instead).
 *   - The game is not already in revolution or superRevolution phase (all
 *     card powers, including Revolution, are suppressed during those phases).
 *
 * @param playedCards - Cards being played.
 * @param variant     - Game variant (to identify which rank is Mirror).
 * @param phase       - Current game phase.
 */
export function isRevolutionTriggered(
  playedCards: Card[],
  variant: GameVariant,
  phase: GamePhase,
): boolean {
  if (phase === 'revolution' || phase === 'superRevolution') return false;
  if (!playedCards.some((c) => isUniquePowerCard(c, variant, 'revolution'))) return false;
  // Mirror present → Super Revolution, not regular Revolution
  return !playedCards.some((c) => matchesPowerRank(c.rank, variant, 'mirror'));
}

/**
 * Returns true when playing `playedCards` should trigger a Super Revolution.
 *
 * Conditions:
 *   - At least one J♦ is in the played cards.
 *   - At least one Mirror card (9 by default) accompanies the J♦.
 *   - The game is not already in revolution or superRevolution phase.
 *
 * @param playedCards - Cards being played.
 * @param variant     - Game variant (to identify which rank is Mirror).
 * @param phase       - Current game phase.
 */
export function isSuperRevolutionTriggered(
  playedCards: Card[],
  variant: GameVariant,
  phase: GamePhase,
): boolean {
  if (phase === 'revolution' || phase === 'superRevolution') return false;
  if (!playedCards.some((c) => isUniquePowerCard(c, variant, 'revolution'))) return false;
  return playedCards.some((c) => matchesPowerRank(c.rank, variant, 'mirror'));
}

// ─── Effects ──────────────────────────────────────────────────────────────────

/**
 * Applies a regular Revolution: inverts card value ordering and disables all
 * card powers until a player picks up the pile.
 *
 * Sets `phase = 'revolution'` and `revolution = true`.
 *
 * @param state     - Current game state.
 * @param playerId  - ID of the player who played J♦.
 * @param timestamp - Wall-clock ms for the log entry.
 */
export function applyRevolution(
  state: GameState,
  playerId: string,
  timestamp: number,
): GameState {
  const player = state.players.find((p) => p.id === playerId)!;
  let newState: GameState = {
    ...state,
    phase: 'revolution',
    revolution: true,
  };
  newState = appendLog(newState, 'revolution', timestamp, playerId, player.name, {}, 'power');
  newState = appendLog(newState, 'revolutionEffect', timestamp, playerId, player.name, {
    message: 'Les valeurs sont inversées',
  }, 'effect');
  return newState;
}

/**
 * Applies a Super Revolution: same effect as Revolution but permanent —
 * picking up the pile does NOT cancel it.
 *
 * Sets `phase = 'superRevolution'`, `revolution = true`, `superRevolution = true`.
 *
 * @param state     - Current game state.
 * @param playerId  - ID of the player who played J♦ + Mirror.
 * @param timestamp - Wall-clock ms for the log entry.
 */
export function applySuperRevolution(
  state: GameState,
  playerId: string,
  timestamp: number,
): GameState {
  const player = state.players.find((p) => p.id === playerId)!;
  let newState: GameState = {
    ...state,
    phase: 'superRevolution',
    revolution: true,
    superRevolution: true,
  };
  newState = appendLog(newState, 'superRevolution', timestamp, playerId, player.name, {}, 'power');
  newState = appendLog(newState, 'superRevolutionEffect', timestamp, playerId, player.name, {
    message: 'Les valeurs sont inversées définitivement',
  }, 'effect');
  return newState;
}
