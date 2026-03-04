import type { Card, GamePhase, GameState, GameVariant } from '../types';
import { matchesPowerRank } from './utils';
import { appendLog } from '../utils/log';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true when the given card is a Jack of Hearts (J♥) — the card
 * that triggers Flop Reverse and Flop Remake.
 *
 * The J♥ power is suit-specific and is not configurable via the variant.
 */
export function isFlopReverseCard(card: Card): boolean {
  return card.rank === 'J' && card.suit === 'hearts';
}

// ─── Trigger detection ────────────────────────────────────────────────────────

/**
 * Returns true when playing `playedCards` should trigger a regular Flop Reverse.
 *
 * Conditions:
 *   - At least one J♥ is in the played cards.
 *   - No Mirror card accompanies the play (J♥ + Mirror → Flop Remake instead).
 *   - The game is not already in revolution or superRevolution phase (all card
 *     powers, including Flop Reverse, are suppressed during those phases).
 *
 * @param playedCards - Cards being played.
 * @param variant     - Game variant (to identify which rank is Mirror).
 * @param phase       - Current game phase.
 */
export function isFlopReverseTriggered(
  playedCards: Card[],
  variant: GameVariant,
  phase: GamePhase,
): boolean {
  if (phase === 'revolution' || phase === 'superRevolution') return false;
  if (!playedCards.some(isFlopReverseCard)) return false;
  // Mirror present → Flop Remake, not regular Flop Reverse
  return !playedCards.some((c) => matchesPowerRank(c.rank, variant, 'mirror'));
}

/**
 * Returns true when playing `playedCards` should trigger a Flop Remake.
 *
 * Conditions:
 *   - At least one J♥ is in the played cards.
 *   - At least one Mirror card (9 by default) accompanies the J♥.
 *   - The game is not already in revolution or superRevolution phase.
 *
 * @param playedCards - Cards being played.
 * @param variant     - Game variant (to identify which rank is Mirror).
 * @param phase       - Current game phase.
 */
export function isFlopRemakeTriggered(
  playedCards: Card[],
  variant: GameVariant,
  phase: GamePhase,
): boolean {
  if (phase === 'revolution' || phase === 'superRevolution') return false;
  if (!playedCards.some(isFlopReverseCard)) return false;
  return playedCards.some((c) => matchesPowerRank(c.rank, variant, 'mirror'));
}

// ─── Power setup ──────────────────────────────────────────────────────────────

/**
 * Sets a pending 'flopReverse' action on the state.
 * The launcher must next choose a target player via a 'flopReverseTarget' action.
 *
 * @param state      - Current game state (after J♥ was played).
 * @param launcherId - ID of the player who played J♥.
 * @param timestamp  - Wall-clock ms for log records.
 */
export function applyFlopReversePower(
  state: GameState,
  launcherId: string,
  timestamp: number,
): GameState {
  const launcher = state.players.find((p) => p.id === launcherId)!;
  let newState: GameState = {
    ...state,
    pendingAction: { type: 'flopReverse', launcherId },
  };
  newState = appendLog(newState, 'flopReverse', timestamp, launcherId, launcher.name, {}, 'power');
  return newState;
}

/**
 * Sets a pending 'flopRemake' action on the state.
 * The launcher must next choose a target player via a 'flopRemakeTarget' action,
 * then the target must submit their card distribution via a 'flopRemake' action.
 *
 * @param state      - Current game state (after J♥ + Mirror were played).
 * @param launcherId - ID of the player who played J♥ + Mirror.
 * @param timestamp  - Wall-clock ms for log records.
 */
export function applyFlopRemakePower(
  state: GameState,
  launcherId: string,
  timestamp: number,
): GameState {
  const launcher = state.players.find((p) => p.id === launcherId)!;
  let newState: GameState = {
    ...state,
    pendingAction: { type: 'flopRemake', launcherId },
  };
  newState = appendLog(newState, 'flopRemake', timestamp, launcherId, launcher.name, {}, 'power');
  return newState;
}
