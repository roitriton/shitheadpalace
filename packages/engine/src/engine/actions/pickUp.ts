import type { GameState } from '../../types';
import { advanceTurn, resolveAutoSkip } from '../turn';
import { appendLog } from '../../utils/log';

/**
 * Applies a pick-up-pile action: the current player takes every card from the
 * active play pile into their hand, emptying the pile.
 *
 * Under / Reset modifiers set for the current player's turn are consumed
 * (cleared) regardless of whether the pile was empty.
 *
 * Turn passes to the next active player. Picking up never finishes a player.
 *
 * @param state     - Current game state.
 * @param playerId  - ID of the acting player.
 * @param timestamp - Wall-clock ms for log records (pass 0 in tests).
 */
export function applyPickUpPile(state: GameState, playerId: string, timestamp = 0): GameState {
  if (
    state.phase !== 'playing' &&
    state.phase !== 'revolution' &&
    state.phase !== 'superRevolution'
  ) {
    throw new Error(`Cannot pick up the pile in phase '${state.phase}'`);
  }

  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) throw new Error(`Player '${playerId}' not found`);
  if (playerIndex !== state.currentPlayerIndex) throw new Error("Not this player's turn");

  const player = state.players[playerIndex]!;
  const pileCards = state.pile.flatMap((e) => e.cards);

  // Reset lastPowerTriggered at the start of each new action
  state = { ...state, lastPowerTriggered: null };

  const newPlayers = [...state.players];
  newPlayers[playerIndex] = { ...player, hand: [...player.hand, ...pileCards] };

  // Regular Revolution ends when any player picks up the pile.
  // Super Revolution is permanent — it survives pick-ups indefinitely.
  const isSuperRev = state.superRevolution === true;
  const nextPhase = state.phase === 'revolution' && !isSuperRev ? 'playing' : state.phase;
  const nextRevolution = isSuperRev ? true : (nextPhase === 'playing' ? false : (state.revolution ?? false));

  // Clear Under / Reset — the current player's constraint is consumed
  let newState: GameState = {
    ...state,
    players: newPlayers,
    pile: [],
    activeUnder: null,
    pileResetActive: false,
    phase: nextPhase,
    revolution: nextRevolution,
  };

  newState = appendLog(newState, 'pickUp', timestamp, player.id, player.name, {
    cardCount: pileCards.length,
  });

  return resolveAutoSkip(advanceTurn(newState, false));
}
