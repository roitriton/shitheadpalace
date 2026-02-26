import type { GameState } from '../types';

/**
 * Resolves a pending cemetery transit — moves cards from the pile to the
 * graveyard based on the trigger type.
 *
 * - **Burn transit** (`lastPowerTriggered.type === 'burn'`): the entire pile
 *   is moved to the graveyard and the pile is cleared.
 * - **Jack transit** (any other trigger or null): only the top pile entry
 *   is moved to the graveyard; the rest of the pile stays.
 *
 * Called automatically in `applyPlay` after `resolvePowers`. This function is
 * a no-op when `pendingCemeteryTransit` is falsy, so it's safe to call
 * unconditionally.
 *
 * @param state - Game state potentially flagged for cemetery transit.
 * @returns Updated game state with transit resolved (or unchanged if no transit pending).
 */
export function resolveCemeteryTransit(state: GameState): GameState {
  if (!state.pendingCemeteryTransit) return state;

  if (state.lastPowerTriggered?.type === 'burn') {
    // Burn transit: entire pile → graveyard
    const burned = state.pile.flatMap((e) => e.cards);
    return {
      ...state,
      pile: [],
      graveyard: [...state.graveyard, ...burned],
      pendingCemeteryTransit: false,
    };
  }

  // Jack transit: top pile entry → graveyard, rest stays
  if (state.pile.length === 0) {
    return { ...state, pendingCemeteryTransit: false };
  }

  const topIdx = state.pile.length - 1;
  const topEntry = state.pile[topIdx]!;
  const topCards = topEntry.cards;

  return {
    ...state,
    pile: state.pile.slice(0, topIdx),
    graveyard: [...state.graveyard, ...topCards],
    pendingCemeteryTransit: false,
  };
}
