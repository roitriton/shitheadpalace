import type { Card, Direction, GameState, PendingAllBlockedShifumi, Player } from '../types';
import { canPlayerPlayAnything } from './validation';

/** Default target hand size during Phase 1 (while the draw pile is non-empty). */
export const TARGET_HAND_SIZE = 3;

// ─── Drawing ──────────────────────────────────────────────────────────────────

/**
 * Auto-draws cards from the deck into the player's hand until they hold
 * `targetHandSize` cards or the deck runs out. Pure function.
 *
 * Called automatically after a player plays from their hand in Phase 1.
 *
 * @param player         - The acting player.
 * @param deck           - The current draw pile (index 0 = top).
 * @param targetHandSize - Minimum hand size to draw up to (default TARGET_HAND_SIZE).
 * @returns Updated player and remaining deck (neither input is mutated).
 */
export function autoDraw(
  player: Player,
  deck: Card[],
  targetHandSize: number = TARGET_HAND_SIZE,
): { player: Player; deck: Card[] } {
  if (deck.length === 0 || player.hand.length >= targetHandSize) {
    return { player, deck };
  }

  const newDeck = [...deck];
  const newHand = [...player.hand];

  while (newHand.length < targetHandSize && newDeck.length > 0) {
    newHand.push(newDeck.shift() as Card);
  }

  return { player: { ...player, hand: newHand }, deck: newDeck };
}

// ─── Finish / game-over ───────────────────────────────────────────────────────

/**
 * Returns true when the player has no cards left in any zone
 * (hand, faceUp, and faceDown are all empty).
 */
export function isPlayerFinished(player: Player): boolean {
  return (
    player.hand.length === 0 && player.faceUp.length === 0 && player.faceDown.length === 0
  );
}

/**
 * Returns true when at most one active player remains — the game is over.
 */
export function isGameOver(state: GameState): boolean {
  return state.players.filter((p) => !p.isFinished).length <= 1;
}

// ─── Turn queue ───────────────────────────────────────────────────────────────

/**
 * Builds the ordered queue of player indices that will act AFTER firstPlayerIndex,
 * respecting the current direction. The result does NOT include firstPlayerIndex.
 *
 * Finished players are excluded.
 *
 * @param players          - All players in the game.
 * @param firstPlayerIndex - Index of the player who acts first.
 * @param direction        - 1 = clockwise, -1 = counter-clockwise.
 */
export function buildTurnQueue(
  players: Player[],
  firstPlayerIndex: number,
  direction: Direction,
): number[] {
  const active = players.map((_, i) => i).filter((i) => !players[i]!.isFinished);
  const firstPos = active.indexOf(firstPlayerIndex);
  if (firstPos === -1) throw new Error('First player index is not in the active players list');

  const queue: number[] = [];
  for (let step = 1; step < active.length; step++) {
    const pos = ((firstPos + direction * step) % active.length + active.length) % active.length;
    queue.push(active[pos] as number);
  }
  return queue;
}

/**
 * Advances to the next player after the current player's turn.
 *
 * The current player is appended to the end of the queue unless they have
 * just finished. Any players already marked as finished are stripped from the queue.
 *
 * When `skipCount > 0`, turns are skipped in circular (modulo) fashion starting
 * from the player immediately after the launcher. The launcher themselves are
 * included in the rotation, so they can replay when enough skips accumulate.
 *
 * Examples with players [B, C, A] after launcher A:
 *   skipCount = 0 → B plays (normal advance)
 *   skipCount = 1 → B skipped, C plays
 *   skipCount = 2 → B and C skipped, A replays
 *   skipCount = 3 → B, C, A skipped, B plays  (wraps around)
 *
 * @param state                  - Current game state.
 * @param currentPlayerFinished  - Whether the current player finished this turn.
 * @param skipCount              - Number of players to skip (default 0); wraps via modulo.
 */
export function advanceTurn(
  state: GameState,
  currentPlayerFinished: boolean,
  skipCount = 0,
): GameState {
  const { currentPlayerIndex, turnOrder, players } = state;

  // Rebuild: remaining queue + current player at tail (unless they finished)
  const upcoming = [...turnOrder];
  if (!currentPlayerFinished) {
    upcoming.push(currentPlayerIndex);
  }

  // Strip any player that has since been marked finished
  const active = upcoming.filter((i) => !players[i]!.isFinished);

  if (active.length === 0) {
    // No one left to play (should coincide with isGameOver === true)
    return { ...state, turnOrder: [] };
  }

  // Circular skip: the next current player is at position (skipCount % active.length)
  // in the rotation. skipCount = 0 means the first slot (normal advance).
  // Higher counts wrap around, so e.g. skip 1 in a 2-player game makes the
  // launcher replay.
  const nextIdx = skipCount % active.length;
  const nextPlayerIndex = active[nextIdx]!;
  const newTurnOrder = [
    ...active.slice(nextIdx + 1),
    ...active.slice(0, nextIdx),
  ];

  return {
    ...state,
    currentPlayerIndex: nextPlayerIndex,
    turnOrder: newTurnOrder,
  };
}

// ─── Auto-skip unplayable turns ──────────────────────────────────────────────

/**
 * After a turn advancement, checks whether the newly-current player can
 * actually play any card. When the pile is empty and the player has only
 * unplayable cards (e.g. Jacks or Mirrors only), their turn is automatically
 * skipped. This repeats until a playable player is found.
 *
 * If ALL active players are blocked (no one can play on the empty pile), a
 * `PendingAllBlockedShifumi` action is set: the blocked players must resolve
 * their finish order via rock-paper-scissors, and the game ends.
 *
 * When the pile is non-empty, or the game phase is 'finished', or a pending
 * action is already set, this function is a no-op and returns the state as-is.
 *
 * @param state - Game state after advanceTurn has been called.
 */
export function resolveAutoSkip(state: GameState): GameState {
  // Only relevant when pile is empty and game is still in progress
  if (state.pile.length > 0) return state;
  if (state.phase === 'finished') return state;
  if (state.pendingAction !== null) return state;

  // Check if the current player can play
  if (canPlayerPlayAnything(state, state.currentPlayerIndex)) return state;

  // Current player can't play — check if ALL active players are stuck
  const activePlayers = state.players
    .map((p, i) => ({ player: p, index: i }))
    .filter(({ player }) => !player.isFinished);

  const allBlocked = activePlayers.every(
    ({ index }) => !canPlayerPlayAnything(state, index),
  );

  if (allBlocked) {
    // All players stuck — trigger allBlockedShifumi to determine finish order
    const pending: PendingAllBlockedShifumi = {
      type: 'allBlockedShifumi',
      playerIds: activePlayers.map(({ player }) => player.id),
      choices: {},
      rankedIds: [],
    };
    return { ...state, pendingAction: pending };
  }

  // Skip the current player and check the next one (iterative to avoid stack overflow)
  let current = advanceTurn(state, false);
  while (!canPlayerPlayAnything(current, current.currentPlayerIndex)) {
    current = advanceTurn(current, false);
  }
  return current;
}
