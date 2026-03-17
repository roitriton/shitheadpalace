import type { GameState } from '../../types';
import { advanceTurn, resolveAutoSkip } from '../turn';
import { appendLog } from '../../utils/log';

/**
 * Resolves an illegal dark flop play by picking up all pile cards (including
 * the illegally played card(s)) into the player's hand.
 *
 * Called by the server after showing the cross overlay to the client.
 * The card(s) are already on the pile (placed by applyPlay); this function
 * moves them plus the rest of the pile into the player's hand.
 *
 * @param state     - Current game state (pendingAction.type must be 'illegalDarkFlop').
 * @param timestamp - Wall-clock ms for log entries (default 0 for tests).
 */
export function resolveIllegalDarkFlop(state: GameState, timestamp = 0): GameState {
  if (state.pendingAction?.type !== 'illegalDarkFlop') {
    throw new Error('No pending illegalDarkFlop action');
  }

  const { playerId, cardIds } = state.pendingAction;
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) throw new Error(`Player '${playerId}' not found`);

  const player = state.players[playerIndex]!;
  const pileCards = state.pile.flatMap((e) => e.cards);
  const newHand = [...player.hand, ...pileCards];

  const newPlayers = [...state.players];
  newPlayers[playerIndex] = { ...player, hand: newHand };

  let newState: GameState = {
    ...state,
    players: newPlayers,
    pile: [],
    pendingAction: null,
    activeUnder: null,
    pileResetActive: false,
  };

  newState = appendLog(newState, 'darkPlayFail', timestamp, playerId, player.name, {
    cardIds,
    pileCardCount: pileCards.length,
  });

  return resolveAutoSkip(advanceTurn(newState, false));
}
