import type { GameState } from '../../types';
import { resolveAutoSkip } from '../turn';
import { appendLog } from '../../utils/log';

/**
 * Resolves a pending Target choice.
 *
 * The launcher specifies which active player should play next. The turn order
 * is rearranged so that the targeted player acts immediately, and normal
 * rotation resumes from their position afterwards.
 *
 * Algorithm:
 *  1. Build the upcoming queue: current turnOrder + launcher index at tail
 *     (the launcher did not finish, so they remain in the rotation).
 *  2. Filter out any players now marked finished.
 *  3. Find the target player's position in the upcoming queue.
 *  4. Rotate the queue so the target is first.
 *  5. Pop the first entry as the new currentPlayerIndex; the rest become turnOrder.
 *
 * @param state          - Current game state (pendingAction.type must be 'target').
 * @param playerId       - ID of the launcher submitting the choice.
 * @param targetPlayerId - ID of the player to act next.
 * @param timestamp      - Wall-clock ms for log entries (default 0 for tests).
 */
export function applyTargetChoice(
  state: GameState,
  playerId: string,
  targetPlayerId: string,
  timestamp = 0,
): GameState {
  // ── Guards ─────────────────────────────────────────────────────────────────
  if (state.pendingAction?.type !== 'target') {
    throw new Error("No pending target action");
  }
  if (state.pendingAction.launcherId !== playerId) {
    throw new Error("Only the Target launcher can make this choice");
  }

  const targetIndex = state.players.findIndex((p) => p.id === targetPlayerId);
  if (targetIndex === -1) throw new Error(`Player '${targetPlayerId}' not found`);
  if (state.players[targetIndex]!.isFinished) {
    throw new Error(`Cannot target a finished player`);
  }
  if (targetPlayerId === playerId) {
    throw new Error(`Cannot target yourself`);
  }

  // ── Build upcoming queue ───────────────────────────────────────────────────
  // Launcher (currentPlayerIndex) goes at the tail since they are not finished.
  const launcherIndex = state.currentPlayerIndex;
  const upcoming = [...state.turnOrder, launcherIndex].filter(
    (i) => !state.players[i]!.isFinished,
  );

  // ── Rotate so target is first ──────────────────────────────────────────────
  const targetPos = upcoming.indexOf(targetIndex);
  if (targetPos === -1) throw new Error(`Target player is not in the active turn queue`);

  const rotated = [...upcoming.slice(targetPos), ...upcoming.slice(0, targetPos)];
  const [nextPlayerIndex, ...rest] = rotated;

  // ── Apply ──────────────────────────────────────────────────────────────────
  const launcherName = state.players[launcherIndex]!.name;
  const targetName = state.players[targetIndex]!.name;

  let newState: GameState = {
    ...state,
    pendingAction: null,
    currentPlayerIndex: nextPlayerIndex as number,
    turnOrder: rest,
  };

  newState = appendLog(
    newState,
    'targetChoice',
    timestamp,
    playerId,
    launcherName,
    { targetPlayerId, targetPlayerName: targetName },
  );

  return resolveAutoSkip(newState);
}
