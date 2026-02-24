import type { GameState } from '../../types';
import { advanceTurn, resolveAutoSkip } from '../turn';
import { appendLog } from '../../utils/log';

/**
 * Applies the target choice for Flop Reverse.
 *
 * The launcher (who played J♥ alone) picks a target player. That player's
 * `faceUp` and `faceDown` are swapped, and `faceDownRevealed` is set to `true`
 * so that the target can now play multiple dark-flop cards at once (since they
 * know what's there). The pending action is cleared and the turn advances.
 *
 * Self-targeting is allowed.
 *
 * @param state          - Current game state (pendingAction.type must be 'flopReverse').
 * @param playerId       - ID of the launcher submitting the choice.
 * @param targetPlayerId - ID of the player whose flop will be reversed.
 * @param timestamp      - Wall-clock ms for log entries (default 0 for tests).
 */
export function applyFlopReverseTarget(
  state: GameState,
  playerId: string,
  targetPlayerId: string,
  timestamp = 0,
): GameState {
  // ── Guards ─────────────────────────────────────────────────────────────────
  if (state.pendingAction?.type !== 'flopReverse') {
    throw new Error('No pending flopReverse action');
  }
  const { launcherId } = state.pendingAction;
  if (playerId !== launcherId) {
    throw new Error('Only the Flop Reverse launcher can make this choice');
  }

  const targetIdx = state.players.findIndex((p) => p.id === targetPlayerId);
  if (targetIdx === -1) throw new Error(`Player '${targetPlayerId}' not found`);
  if (state.players[targetIdx]!.isFinished) {
    throw new Error('Cannot target a finished player with Flop Reverse');
  }

  // ── Swap faceUp ↔ faceDown and mark as revealed ──────────────────────────
  const target = state.players[targetIdx]!;
  const newTarget = {
    ...target,
    faceUp: target.faceDown,
    faceDown: target.faceUp,
    faceDownRevealed: true,
  };

  const newPlayers = [...state.players];
  newPlayers[targetIdx] = newTarget;

  const launcherName = state.players[state.currentPlayerIndex]!.name;

  let newState: GameState = {
    ...state,
    players: newPlayers,
    pendingAction: null,
  };

  newState = appendLog(newState, 'flopReverseTarget', timestamp, playerId, launcherName, {
    targetPlayerId,
    targetPlayerName: target.name,
  });

  return resolveAutoSkip(advanceTurn(newState, false));
}

/**
 * Applies the target choice for Flop Remake.
 *
 * The launcher (who played J♥ + Mirror) picks a target player. The pending
 * action is updated with the target's ID. The turn does NOT advance yet —
 * it waits for the target to submit their card distribution via `applyFlopRemake`.
 *
 * Self-targeting is allowed.
 *
 * @param state          - Current game state (pendingAction.type must be 'flopRemake' without targetId).
 * @param playerId       - ID of the launcher submitting the choice.
 * @param targetPlayerId - ID of the player who will redistribute their flop + dark flop.
 * @param timestamp      - Wall-clock ms for log entries (default 0 for tests).
 */
export function applyFlopRemakeTarget(
  state: GameState,
  playerId: string,
  targetPlayerId: string,
  timestamp = 0,
): GameState {
  // ── Guards ─────────────────────────────────────────────────────────────────
  if (state.pendingAction?.type !== 'flopRemake') {
    throw new Error('No pending flopRemake action');
  }
  if (state.pendingAction.targetId !== undefined) {
    throw new Error('Flop Remake target has already been selected');
  }
  const { launcherId } = state.pendingAction;
  if (playerId !== launcherId) {
    throw new Error('Only the Flop Remake launcher can make this choice');
  }

  const targetIdx = state.players.findIndex((p) => p.id === targetPlayerId);
  if (targetIdx === -1) throw new Error(`Player '${targetPlayerId}' not found`);
  if (state.players[targetIdx]!.isFinished) {
    throw new Error('Cannot target a finished player with Flop Remake');
  }

  const launcherName = state.players[state.currentPlayerIndex]!.name;
  const targetName = state.players[targetIdx]!.name;

  let newState: GameState = {
    ...state,
    pendingAction: { type: 'flopRemake', launcherId, targetId: targetPlayerId },
  };

  newState = appendLog(newState, 'flopRemakeTarget', timestamp, playerId, launcherName, {
    targetPlayerId,
    targetPlayerName: targetName,
  });

  return newState;
}

/**
 * Applies a Flop Remake distribution.
 *
 * The targeted player takes all their flop + dark flop cards and redistributes
 * them freely: up to 3 cards in faceUp, up to 3 cards in faceDown. All cards
 * from the original faceUp + faceDown must be accounted for (no cards lost or
 * added). The pending action is cleared and the turn advances.
 *
 * @param state       - Current game state (pendingAction.type must be 'flopRemake' with targetId set).
 * @param playerId    - ID of the targeted player submitting their distribution.
 * @param faceUpIds   - Card IDs to place face-up (max 3).
 * @param faceDownIds - Card IDs to place face-down (max 3).
 * @param timestamp   - Wall-clock ms for log entries (default 0 for tests).
 */
export function applyFlopRemake(
  state: GameState,
  playerId: string,
  faceUpIds: string[],
  faceDownIds: string[],
  timestamp = 0,
): GameState {
  // ── Guards ─────────────────────────────────────────────────────────────────
  if (state.pendingAction?.type !== 'flopRemake') {
    throw new Error('No pending flopRemake action');
  }
  const { targetId, launcherId } = state.pendingAction;
  if (targetId === undefined) {
    throw new Error('Flop Remake target has not been selected yet');
  }
  if (playerId !== targetId) {
    throw new Error('Only the Flop Remake target can redistribute their cards');
  }
  if (faceUpIds.length > 3) {
    throw new Error('Flop Remake: at most 3 cards may be placed face-up');
  }
  if (faceDownIds.length > 3) {
    throw new Error('Flop Remake: at most 3 cards may be placed face-down');
  }

  const targetIdx = state.players.findIndex((p) => p.id === targetId);
  if (targetIdx === -1) throw new Error(`Target player '${targetId}' not found`);
  const target = state.players[targetIdx]!;

  // Combine original faceUp + faceDown
  const allCards = [...target.faceUp, ...target.faceDown];
  const allCardIds = new Set(allCards.map((c) => c.id));
  const allProvided = [...faceUpIds, ...faceDownIds];
  const allProvidedSet = new Set(allProvided);

  // Check for duplicate IDs in the submission
  if (allProvidedSet.size !== allProvided.length) {
    throw new Error('Flop Remake: duplicate card IDs in distribution');
  }

  // All submitted IDs must belong to the original faceUp + faceDown
  for (const id of allProvidedSet) {
    if (!allCardIds.has(id)) {
      throw new Error(`Card '${id}' is not in the target's flop or dark flop`);
    }
  }

  // All original cards must be redistributed (no card left out)
  for (const id of allCardIds) {
    if (!allProvidedSet.has(id)) {
      throw new Error(`Card '${id}' from target's flop/dark flop was not redistributed`);
    }
  }

  // ── Build new card arrays ──────────────────────────────────────────────────
  const cardMap = new Map(allCards.map((c) => [c.id, c]));
  const newFaceUp = faceUpIds.map((id) => cardMap.get(id)!);
  const newFaceDown = faceDownIds.map((id) => cardMap.get(id)!);

  const newPlayers = [...state.players];
  newPlayers[targetIdx] = { ...target, faceUp: newFaceUp, faceDown: newFaceDown };

  // Launcher name for log (current player is still the launcher at this point)
  const launcherName = state.players.find((p) => p.id === launcherId)?.name ?? launcherId;

  let newState: GameState = {
    ...state,
    players: newPlayers,
    pendingAction: null,
  };

  newState = appendLog(newState, 'flopRemakeDone', timestamp, playerId, launcherName, {
    faceUpIds,
    faceDownIds,
  });

  return resolveAutoSkip(advanceTurn(newState, false));
}
