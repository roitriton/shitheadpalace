import type { Card, GameState, PendingManouche } from '../types';

/**
 * Creates an opaque placeholder card that preserves position in a zone array
 * without revealing the actual rank or suit to an unauthorized viewer.
 *
 * @param index - Zero-based position of the card within its zone array.
 */
function hiddenCard(index: number): Card {
  return { id: `hidden-${index}`, suit: 'hearts', rank: '2', hidden: true };
}

/**
 * Returns a filtered copy of the game state for a specific viewer.
 *
 * Security guarantees:
 * - The viewer's own cards (hand, faceDown, faceUp) are fully visible.
 * - Each opponent's `hand` cards are replaced with hidden placeholders of
 *   equal count — the viewer knows how many cards they hold, not what they are.
 * - Each opponent's `faceDown` cards are replaced with hidden placeholders of
 *   equal count.
 * - Each opponent's `faceUp` cards are preserved as-is (face-up = public info).
 *
 * The server MUST call this before broadcasting a state update to any client.
 *
 * @param state    - Full (unfiltered) game state.
 * @param viewerId - ID of the client player receiving the state.
 */
export function filterGameStateForPlayer(state: GameState, viewerId: string): GameState {
  // During a pending Manouche or Super Manouche, the launcher needs to see
  // the target's hand in order to choose which card to take.
  const pending = state.pendingAction;
  const isManouchePending =
    pending?.type === 'manouche' || pending?.type === 'superManouche';
  const manouche: PendingManouche | null = isManouchePending
    ? (pending as PendingManouche)
    : null;

  const exchangeLayer = manouche?.exchangeLayer ?? 'hand';

  const players = state.players.map((player) => {
    if (player.id === viewerId) return player;

    // Launcher sees target's exchange-layer cards during Manouche:
    // - hand: reveal target's hand (faceDown stays hidden)
    // - faceUp: already public, no special handling needed
    // - faceDown: blind exchange, no reveal
    if (
      manouche !== null &&
      viewerId === manouche.launcherId &&
      player.id === manouche.targetId &&
      exchangeLayer === 'hand'
    ) {
      return {
        ...player,
        // hand is intentionally left visible
        faceDown: player.faceDown.map((_, i) => hiddenCard(i)),
      };
    }

    return {
      ...player,
      hand: player.hand.map((_, i) => hiddenCard(i)),
      faceDown: player.faceDown.map((_, i) => hiddenCard(i)),
    };
  });
  return { ...state, players };
}
