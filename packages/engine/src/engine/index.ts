import type { GameAction, GameState } from '../types';
import { applyPlay } from './actions/play';
import { applyPickUpPile } from './actions/pickUp';
import { applySwap } from './actions/swap';
import { applyReady, applyFirstPlayerShifumiChoice } from './actions/ready';
import { applyTargetChoice } from './actions/applyTargetChoice';
import { applyManouchePick, applySuperManouchePick } from './actions/applyManoucheChoice';
import {
  applyFlopReverseTarget,
  applyFlopRemakeTarget,
  applyFlopRemake,
} from './actions/applyFlopReverseChoice';
import { applyShifumiTarget, applyShifumiChoice } from './actions/applyShifumiChoice';
import { applyAllBlockedShifumiChoice } from './actions/applyAllBlockedShifumiChoice';

// Re-export everything so consumers can import from '@shit-head-palace/engine'
export { applyPlay } from './actions/play';
export { applyPickUpPile } from './actions/pickUp';
export { applySwap } from './actions/swap';
export { applyReady, applyFirstPlayerShifumiChoice } from './actions/ready';
export { applyTargetChoice } from './actions/applyTargetChoice';
export { applyManouchePick, applySuperManouchePick } from './actions/applyManoucheChoice';
export {
  applyFlopReverseTarget,
  applyFlopRemakeTarget,
  applyFlopRemake,
} from './actions/applyFlopReverseChoice';
export { applyShifumiTarget, applyShifumiChoice } from './actions/applyShifumiChoice';
export { applyAllBlockedShifumiChoice } from './actions/applyAllBlockedShifumiChoice';
export { filterGameStateForPlayer } from './filter';
export { resolvePowers } from './powers';
export type { PowerResult } from './powers';
export * from './validation';
export * from './turn';

/**
 * The single engine entry point.
 *
 * Dispatches any GameAction to the appropriate handler and returns the new
 * immutable GameState. The input state is never mutated.
 *
 * Power-dependent actions (shifumiChoice for the J♣ power, manouchePick,
 * superManouchePick, flopReverseTarget, flopRemakeTarget, flopRemake,
 * targetChoice) are wired up in Step 4 once the power modules exist.
 *
 * @param state     - The current game state.
 * @param playerId  - ID of the player performing the action.
 * @param action    - The action to apply.
 * @param timestamp - Wall-clock ms for PileEntry / LogEntry records (default 0 for determinism in tests).
 */
export function applyAction(
  state: GameState,
  playerId: string,
  action: GameAction,
  timestamp = 0,
): GameState {
  switch (action.type) {
    case 'play':
      return applyPlay(state, playerId, action.cardIds, timestamp, action.targetPlayerId);

    case 'pickUp':
      return applyPickUpPile(state, playerId, timestamp);

    case 'swap':
      return applySwap(state, playerId, action.handCardId, action.flopCardId, timestamp);

    case 'ready':
      return applyReady(state, playerId, timestamp);

    case 'shifumiChoice':
      // During first-player determination (firstPlayerShifumi pendingAction)
      if (state.pendingAction?.type === 'firstPlayerShifumi') {
        return applyFirstPlayerShifumiChoice(state, playerId, action.choice, timestamp);
      }
      // During a J♣ power shifumi
      if (state.pendingAction?.type === 'shifumi' || state.pendingAction?.type === 'superShifumi') {
        return applyShifumiChoice(state, playerId, action.choice, timestamp);
      }
      // During all-blocked shifumi (no one can play on empty pile)
      if (state.pendingAction?.type === 'allBlockedShifumi') {
        return applyAllBlockedShifumiChoice(state, playerId, action.choice, timestamp);
      }
      throw new Error("'shifumiChoice' requires a pending shifumi, superShifumi, firstPlayerShifumi, or allBlockedShifumi action");

    case 'shifumiTarget':
      return applyShifumiTarget(state, playerId, action.player1Id, action.player2Id, timestamp);

    case 'targetChoice':
      return applyTargetChoice(state, playerId, action.targetPlayerId, timestamp);

    case 'manouchePick':
      return applyManouchePick(state, playerId, action.takeCardId, action.giveCardIds, timestamp);

    case 'superManouchePick':
      return applySuperManouchePick(state, playerId, action.giveCardIds, action.takeCardIds, timestamp);

    case 'flopReverseTarget':
      return applyFlopReverseTarget(state, playerId, action.targetPlayerId, timestamp);

    case 'flopRemakeTarget':
      return applyFlopRemakeTarget(state, playerId, action.targetPlayerId, timestamp);

    case 'flopRemake':
      return applyFlopRemake(state, playerId, action.faceUp, action.faceDown, timestamp);
  }
}
