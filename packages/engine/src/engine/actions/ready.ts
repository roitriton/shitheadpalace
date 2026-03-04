import type { GameState, PendingShifumiResult, ShifumiChoice } from '../../types';
import { findFirstPlayer } from '../../utils/firstPlayer';
import { buildTurnQueue } from '../turn';
import { appendLog } from '../../utils/log';

// ─── N-player shifumi resolution ──────────────────────────────────────────────

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
 * Rules:
 * - Only 1 distinct choice OR all 3 distinct choices present → draw (replay).
 * - Exactly 2 distinct choices → players whose choice beats the other survive.
 *   - 1 survivor  → winner found.
 *   - 2+ survivors → next round with only survivors.
 */
function resolveNPlayerShifumi(
  playerIds: string[],
  choices: Record<string, ShifumiChoice>,
): ShifumiResult {
  const distinctChoices = Array.from(new Set(Object.values(choices)));

  // All same, or three-way tie → redraw
  if (distinctChoices.length !== 2) {
    return { outcome: 'draw' };
  }

  // Exactly 2 distinct choices — determine which wins
  const [choiceA, choiceB] = distinctChoices as [ShifumiChoice, ShifumiChoice];
  const winningChoice = BEATS[choiceA] === choiceB ? choiceA : choiceB;

  const survivors = playerIds.filter((id) => choices[id] === winningChoice);

  if (survivors.length === 1) {
    return { outcome: 'winner', winnerId: survivors[0]! };
  }
  return { outcome: 'survivors', ids: survivors };
}

// ─── applyReady ───────────────────────────────────────────────────────────────

/**
 * Applies a 'ready' action from a player during the swapping phase.
 *
 * When the last player signals ready the engine:
 *   1. Calls findFirstPlayer to determine who starts.
 *   2. If a clear winner exists → transitions to 'playing'.
 *   3. If tied → sets pendingAction = PendingFirstPlayerShifumi and waits
 *      for shifumi choices (handled by applyShifumiChoice below).
 *
 * @param state     - Current game state (must be 'swapping').
 * @param playerId  - ID of the player signalling ready.
 * @param timestamp - Wall-clock ms for log records (pass 0 in tests).
 */
export function applyReady(state: GameState, playerId: string, timestamp = 0): GameState {
  if (state.phase !== 'swapping') {
    throw new Error(`'ready' is only valid during 'swapping' phase, not '${state.phase}'`);
  }

  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) throw new Error(`Player '${playerId}' not found`);

  // Mark the player ready
  const newPlayers = [...state.players];
  newPlayers[playerIndex] = { ...state.players[playerIndex]!, isReady: true };
  let updatedState: GameState = { ...state, players: newPlayers };
  updatedState = appendLog(
    updatedState,
    'ready',
    timestamp,
    playerId,
    state.players[playerIndex]!.name,
  );

  // Wait if not everyone is ready yet
  if (!newPlayers.every((p) => p.isReady)) return updatedState;

  // All ready — determine first player
  const result = findFirstPlayer(newPlayers);

  if (result.type === 'single') {
    const firstIdx = newPlayers.findIndex((p) => p.id === result.playerId);
    let newState: GameState = {
      ...updatedState,
      phase: 'playing',
      currentPlayerIndex: firstIdx,
      turnOrder: buildTurnQueue(newPlayers, firstIdx, state.direction),
      pendingAction: null,
    };
    newState = appendLog(newState, 'gameStart', timestamp, undefined, undefined, {
      firstPlayerId: result.playerId,
    });
    return newState;
  }

  // Tie: need first-player shifumi
  let newState: GameState = {
    ...updatedState,
    pendingAction: {
      type: 'firstPlayerShifumi',
      playerIds: result.playerIds,
      choices: {},
    },
  };
  newState = appendLog(newState, 'firstPlayerShifumiStart', timestamp, undefined, undefined, {
    playerIds: result.playerIds,
  });
  return newState;
}

/**
 * Records a shifumi choice for the first-player tiebreak.
 *
 * Supports N players via elimination rounds:
 * - All same or three-way tie → draw, reset choices.
 * - 2 distinct choices → losers eliminated; if 1 survivor → game starts;
 *   if multiple survivors → next round with survivors only.
 *
 * @param state     - Current game state with pendingAction = PendingFirstPlayerShifumi.
 * @param playerId  - ID of the choosing player.
 * @param choice    - The shifumi choice ('rock' | 'paper' | 'scissors').
 * @param timestamp - Wall-clock ms for log records (pass 0 in tests).
 */
export function applyFirstPlayerShifumiChoice(
  state: GameState,
  playerId: string,
  choice: ShifumiChoice,
  timestamp = 0,
): GameState {
  if (state.pendingAction?.type !== 'firstPlayerShifumi') {
    throw new Error('No first-player shifumi is pending');
  }

  const pending = state.pendingAction;
  if (!pending.playerIds.includes(playerId)) {
    throw new Error(`Player '${playerId}' is not part of the first-player shifumi`);
  }
  if (pending.choices[playerId] !== undefined) {
    throw new Error(`Player '${playerId}' has already submitted their first-player shifumi choice`);
  }

  const newChoices = { ...pending.choices, [playerId]: choice };

  // Log that this player submitted (choice value is NOT revealed until resolution)
  const player = state.players.find((p) => p.id === playerId);
  let newState: GameState = {
    ...state,
    pendingAction: { ...pending, choices: newChoices },
  };
  newState = appendLog(newState, 'firstPlayerShifumiChoice', timestamp, playerId, player?.name);

  // Wait until all tied players have submitted
  const allChosen = pending.playerIds.every((id) => newChoices[id] !== undefined);
  if (!allChosen) return newState;

  // ── 2-player case: produce PendingShifumiResult for popup ────────────────
  if (pending.playerIds.length === 2) {
    const [p1Id, p2Id] = pending.playerIds as [string, string];
    const p1 = state.players.find((p) => p.id === p1Id)!;
    const p2 = state.players.find((p) => p.id === p2Id)!;
    const c1 = newChoices[p1Id]!;
    const c2 = newChoices[p2Id]!;

    // Determine winner using same logic as getShifumiWinner
    let result: 'tie' | 'player1' | 'player2';
    if (c1 === c2) {
      result = 'tie';
    } else if (
      (c1 === 'rock' && c2 === 'scissors') ||
      (c1 === 'scissors' && c2 === 'paper') ||
      (c1 === 'paper' && c2 === 'rock')
    ) {
      result = 'player1';
    } else {
      result = 'player2';
    }

    const shifumiResult: PendingShifumiResult = {
      type: 'shifumiResult',
      player1Id: p1Id,
      player1Name: p1.name,
      player1Choice: c1,
      player2Id: p2Id,
      player2Name: p2.name,
      player2Choice: c2,
      result,
      shifumiType: 'firstPlayer',
    };

    return { ...newState, pendingAction: shifumiResult };
  }

  // ── 3+ player case: resolve immediately (N-player elimination) ───────────
  const result = resolveNPlayerShifumi(
    pending.playerIds,
    newChoices as Record<string, ShifumiChoice>,
  );

  if (result.outcome === 'draw') {
    // Same choice or three-way tie — play again, reset choices
    newState = {
      ...newState,
      pendingAction: { ...pending, choices: {} },
    };
    newState = appendLog(newState, 'firstPlayerShifumiDraw', timestamp);
    return newState;
  }

  if (result.outcome === 'survivors') {
    // Some players eliminated — next round with survivors only
    newState = {
      ...newState,
      pendingAction: { ...pending, playerIds: result.ids, choices: {} },
    };
    newState = appendLog(newState, 'firstPlayerShifumiNextRound', timestamp, undefined, undefined, {
      survivors: result.ids,
    });
    return newState;
  }

  // Single winner — start the game
  const firstIdx = state.players.findIndex((p) => p.id === result.winnerId);
  newState = {
    ...newState,
    phase: 'playing',
    currentPlayerIndex: firstIdx,
    turnOrder: buildTurnQueue(state.players, firstIdx, state.direction),
    pendingAction: null,
  };
  newState = appendLog(newState, 'firstPlayerShifumiWin', timestamp, undefined, undefined, {
    winnerId: result.winnerId,
  });
  newState = appendLog(newState, 'gameStart', timestamp, undefined, undefined, {
    firstPlayerId: result.winnerId,
  });
  return newState;
}
