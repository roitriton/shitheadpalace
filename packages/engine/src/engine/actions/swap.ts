import type { GameState } from '../../types';
import { appendLog } from '../../utils/log';

/**
 * Applies a swap action during the swapping phase: exchanges one card from the
 * player's hand with one card from their faceUp (flop) zone.
 *
 * Multiple swaps are allowed per player before they signal 'ready'.
 * The action has no turn-advancement effect (all players swap concurrently).
 *
 * @param state       - Current game state (must be in 'swapping' phase).
 * @param playerId    - ID of the acting player.
 * @param handCardId  - ID of the card currently in hand to move to faceUp.
 * @param flopCardId  - ID of the card currently in faceUp to move to hand.
 * @param timestamp   - Wall-clock ms for log records (pass 0 in tests).
 */
export function applySwap(
  state: GameState,
  playerId: string,
  handCardId: string,
  flopCardId: string,
  timestamp = 0,
): GameState {
  if (state.phase !== 'swapping') {
    throw new Error(`Swap is only allowed during 'swapping' phase, not '${state.phase}'`);
  }

  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) throw new Error(`Player '${playerId}' not found`);

  const player = state.players[playerIndex]!;

  const handCard = player.hand.find((c) => c.id === handCardId);
  if (!handCard) throw new Error(`Card '${handCardId}' not found in hand`);

  const flopCard = player.faceUp.find((c) => c.id === flopCardId);
  if (!flopCard) throw new Error(`Card '${flopCardId}' not found in faceUp`);

  const newHand = player.hand.map((c) => (c.id === handCardId ? flopCard : c));
  const newFaceUp = player.faceUp.map((c) => (c.id === flopCardId ? handCard : c));

  const newPlayers = [...state.players];
  newPlayers[playerIndex] = { ...player, hand: newHand, faceUp: newFaceUp };

  let newState: GameState = { ...state, players: newPlayers };
  newState = appendLog(newState, 'swap', timestamp, player.id, player.name, {
    handCardId,
    flopCardId,
  });

  return newState;
}
