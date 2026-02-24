import type { GameState, PendingAllBlockedShifumi, ShifumiChoice } from '../../types';
import { appendLog } from '../../utils/log';

// ─── N-player shifumi resolution ─────────────────────────────────────────────

const BEATS: Record<ShifumiChoice, ShifumiChoice> = {
  rock: 'scissors',
  scissors: 'paper',
  paper: 'rock',
};

type ShifumiResult =
  | { outcome: 'winner'; winnerId: string }
  | { outcome: 'survivors'; ids: string[] }
  | { outcome: 'draw' };

/**
 * Resolves a round of N-player shifumi.
 *
 * - 1 distinct choice or all 3 distinct → draw (replay).
 * - 2 distinct choices → players with the winning choice survive.
 *   - 1 survivor → winner. 2+ survivors → next round with survivors only.
 */
function resolveNPlayerShifumi(
  playerIds: string[],
  choices: Record<string, ShifumiChoice>,
): ShifumiResult {
  const distinctChoices = Array.from(new Set(Object.values(choices)));

  if (distinctChoices.length !== 2) {
    return { outcome: 'draw' };
  }

  const [choiceA, choiceB] = distinctChoices as [ShifumiChoice, ShifumiChoice];
  const winningChoice = BEATS[choiceA] === choiceB ? choiceA : choiceB;
  const survivors = playerIds.filter((id) => choices[id] === winningChoice);

  if (survivors.length === 1) {
    return { outcome: 'winner', winnerId: survivors[0]! };
  }
  return { outcome: 'survivors', ids: survivors };
}

/**
 * Records a shifumi choice for the all-blocked tiebreak.
 *
 * When all active players are blocked (empty pile, no playable cards), the
 * game enters an `allBlockedShifumi` pending action. Players submit RPS
 * choices to iteratively determine their finish order:
 *
 * Each round determines a single winner who gets the next best finish position.
 * The winner is removed and the remaining players continue until only one
 * remains (the shit head). On a draw or multiple survivors, the round is
 * replayed with the same or reduced set.
 *
 * @param state     - Current game state (pendingAction.type must be 'allBlockedShifumi').
 * @param playerId  - ID of the choosing player.
 * @param choice    - The shifumi choice ('rock' | 'paper' | 'scissors').
 * @param timestamp - Wall-clock ms for log records (pass 0 in tests).
 */
export function applyAllBlockedShifumiChoice(
  state: GameState,
  playerId: string,
  choice: ShifumiChoice,
  timestamp = 0,
): GameState {
  if (state.pendingAction?.type !== 'allBlockedShifumi') {
    throw new Error('No pending allBlockedShifumi action');
  }

  const pending = state.pendingAction;
  if (!pending.playerIds.includes(playerId)) {
    throw new Error(`Player '${playerId}' is not part of the all-blocked shifumi`);
  }
  if (pending.choices[playerId] !== undefined) {
    throw new Error(`Player '${playerId}' has already submitted their all-blocked shifumi choice`);
  }

  const newChoices = { ...pending.choices, [playerId]: choice };

  const player = state.players.find((p) => p.id === playerId);
  let newState: GameState = {
    ...state,
    pendingAction: { ...pending, choices: newChoices },
  };
  newState = appendLog(newState, 'allBlockedShifumiChoice', timestamp, playerId, player?.name);

  // Wait until all current-round players have submitted
  const allChosen = pending.playerIds.every((id) => newChoices[id] !== undefined);
  if (!allChosen) return newState;

  // All choices received — resolve this round
  const result = resolveNPlayerShifumi(
    pending.playerIds,
    newChoices as Record<string, ShifumiChoice>,
  );

  if (result.outcome === 'draw') {
    // Same choice or three-way tie — replay with the same players
    newState = {
      ...newState,
      pendingAction: { ...pending, choices: {} },
    };
    newState = appendLog(newState, 'allBlockedShifumiDraw', timestamp);
    return newState;
  }

  if (result.outcome === 'survivors') {
    // Multiple survivors — next round with survivors only (still determining the same position)
    newState = {
      ...newState,
      pendingAction: { ...pending, playerIds: result.ids, choices: {} },
    };
    newState = appendLog(newState, 'allBlockedShifumiNextRound', timestamp, undefined, undefined, {
      survivors: result.ids,
    });
    return newState;
  }

  // Single winner — they get the next best finish position
  const newRankedIds = [...pending.rankedIds, result.winnerId];
  const remaining = pending.playerIds.filter((id) => id !== result.winnerId);

  if (remaining.length <= 1) {
    // Only 0 or 1 left — finalize the game
    const finalRankedIds = [...newRankedIds, ...remaining];
    return finalizeAllBlockedGame(newState, finalRankedIds, timestamp);
  }

  // More players remain — continue elimination for the next position
  newState = {
    ...newState,
    pendingAction: {
      type: 'allBlockedShifumi',
      playerIds: remaining,
      choices: {},
      rankedIds: newRankedIds,
    },
  };
  newState = appendLog(newState, 'allBlockedShifumiNextRound', timestamp, undefined, undefined, {
    winnerId: result.winnerId,
    remaining,
  });
  return newState;
}

/**
 * Ends the game with all blocked players ranked in the given order.
 * rankedIds[0] = best (first finished), last = shit head.
 */
function finalizeAllBlockedGame(
  state: GameState,
  rankedIds: string[],
  timestamp: number,
): GameState {
  const newFinishOrder = [...state.finishOrder, ...rankedIds];

  const newPlayers = state.players.map((p) => {
    if (p.isFinished) return p;
    return { ...p, isFinished: true };
  });

  let newState: GameState = {
    ...state,
    players: newPlayers,
    finishOrder: newFinishOrder,
    phase: 'finished' as const,
    pendingAction: null,
    turnOrder: [],
  };

  newState = appendLog(newState, 'allBlockedShifumiResolved', timestamp, undefined, undefined, {
    rankedIds,
  });
  newState = appendLog(newState, 'gameOver', timestamp, undefined, undefined, {
    finishOrder: newState.finishOrder,
  });

  return newState;
}
