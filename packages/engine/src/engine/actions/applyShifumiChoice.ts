import type { GameState, PendingShifumi, PendingShifumiResult, ShifumiChoice } from '../../types';
import { advanceTurn, resolveAutoSkip, buildTurnQueue } from '../turn';
import { appendLog } from '../../utils/log';


// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Determines the rock-paper-scissors outcome.
 * Returns 'player1' if choice1 beats choice2, 'player2' if choice2 beats
 * choice1, or 'tie' if they are equal.
 */
function getShifumiWinner(
  c1: ShifumiChoice,
  c2: ShifumiChoice,
): 'player1' | 'player2' | 'tie' {
  if (c1 === c2) return 'tie';
  if (
    (c1 === 'rock' && c2 === 'scissors') ||
    (c1 === 'scissors' && c2 === 'paper') ||
    (c1 === 'paper' && c2 === 'rock')
  ) {
    return 'player1';
  }
  return 'player2';
}

/**
 * Finalizes the game with a Shit Head.
 *
 * All currently-active players (except the shit head) are ranked ex-aequo
 * before the loser. The loser is last in the finish order and gets
 * `isShitHead: true`. Phase transitions to 'finished'.
 */
function finalizeGameWithShitHead(
  state: GameState,
  shitHeadId: string,
  winnerId: string,
  timestamp: number,
): GameState {
  const shitHead = state.players.find((p) => p.id === shitHeadId)!;

  // All non-finished players except the shit head are ranked before them
  const activePlayers = state.players.filter((p) => !p.isFinished && p.id !== shitHeadId);
  const newFinishOrder = [
    ...state.finishOrder,
    ...activePlayers.map((p) => p.id),
    shitHeadId,
  ];

  const newPlayers = state.players.map((p) => {
    if (p.id === shitHeadId) return { ...p, isFinished: true, isShitHead: true };
    if (!p.isFinished) return { ...p, isFinished: true };
    return p;
  });

  let newState: GameState = {
    ...state,
    players: newPlayers,
    finishOrder: newFinishOrder,
    phase: 'finished' as const,
    pendingAction: null,
    turnOrder: [],
    multiJackSequence: undefined,
  };

  newState = appendLog(newState, 'superShifumiResolved', timestamp, shitHeadId, shitHead.name, {
    shitHeadId,
    winnerId,
    message: `${shitHead.name} perd le Super Shifumi — Shit Head`,
  }, 'effect');
  newState = appendLog(newState, 'gameOver', timestamp, undefined, undefined, {
    finishOrder: newState.finishOrder,
  });

  return newState;
}

/**
 * Resolves the Shifumi confrontation once both choices are known.
 *
 * Instead of applying the effect immediately, creates a PendingShifumiResult
 * so the client can display the result popup before the effect is applied.
 * The server auto-resolves the PendingShifumiResult after a 3-second delay.
 */
function resolveShifumi(state: GameState, timestamp: number): GameState {
  const pending = state.pendingAction as PendingShifumi;
  const { initiatorId, player1Id, player2Id, player1Choice, player2Choice, type } = pending;

  const result = getShifumiWinner(player1Choice!, player2Choice!);

  const p1 = state.players.find((p) => p.id === player1Id)!;
  const p2 = state.players.find((p) => p.id === player2Id)!;

  const shifumiResult: PendingShifumiResult = {
    type: 'shifumiResult',
    player1Id: player1Id!,
    player1Name: p1.name,
    player1Choice: player1Choice!,
    player2Id: player2Id!,
    player2Name: p2.name,
    player2Choice: player2Choice!,
    result,
    shifumiType: type === 'superShifumi' ? 'super' : 'normal',
    _savedPendingAction: pending,
    _savedInitiatorId: initiatorId,
  };

  return { ...state, pendingAction: shifumiResult };
}

/**
 * Applies the actual effect of a resolved Shifumi after the result popup has been shown.
 *
 * Called by the server after a 3-second delay, or directly in tests.
 *
 * @param state     - Current game state with pendingAction.type === 'shifumiResult'.
 * @param timestamp - Wall-clock ms for log entries (default 0 for tests).
 */
export function resolveShifumiResult(state: GameState, timestamp = 0): GameState {
  if (state.pendingAction?.type !== 'shifumiResult') {
    throw new Error('No pending shifumiResult action');
  }

  const pending = state.pendingAction as PendingShifumiResult;
  const { player1Id, player1Choice, player2Id, player2Choice, result, shifumiType } = pending;
  const savedPending = pending._savedPendingAction;
  const initiatorId = pending._savedInitiatorId ?? player1Id;

  // ── First-player shifumi result ─────────────────────────────────────────
  if (shifumiType === 'firstPlayer') {
    return resolveFirstPlayerShifumiResultEffect(state, pending, timestamp);
  }

  // ── Tie: reset choices, same participants play again ─────────────────────
  if (result === 'tie') {
    const originalType = savedPending?.type ?? 'shifumi';
    const newPending: PendingShifumi = { type: originalType as 'shifumi' | 'superShifumi', initiatorId, player1Id, player2Id };
    let newState: GameState = { ...state, pendingAction: newPending };
    newState = appendLog(newState, 'shifumiTie', timestamp, undefined, undefined, {
      player1Id,
      player2Id,
      player1Choice,
      player2Choice,
      message: 'Shifumi : égalité',
    }, 'effect');
    return newState;
  }

  // ── Winner determined ────────────────────────────────────────────────────
  const loserId = result === 'player1' ? player2Id : player1Id;
  const winnerId = result === 'player1' ? player1Id : player2Id;
  const isMultiJack = !!state.multiJackSequence;
  const originalType = savedPending?.type ?? 'shifumi';

  // ── Super Shifumi: loser = shit head ─────────────────────────────────────
  if (originalType === 'superShifumi') {
    let finalState: GameState = { ...state, pendingAction: null };
    finalState = finalizeGameWithShitHead(finalState, loserId, winnerId, timestamp);
    finalState = { ...finalState, pendingCardsPlayed: undefined };
    return finalState;
  }

  // ── Regular Shifumi: loser picks up the pile ─────────────────────────────
  const loserIdx = state.players.findIndex((p) => p.id === loserId);
  const loser = state.players[loserIdx]!;

  if (isMultiJack) {
    let newState: GameState = {
      ...state,
      pendingAction: null,
      pendingCardsPlayed: undefined,
      multiJackSequence: {
        ...state.multiJackSequence!,
        pendingShifumiPickup: { loserId },
      },
    };

    newState = appendLog(newState, 'shifumiResolved', timestamp, loserId, loser.name, {
      loserId,
      winnerId,
      player1Choice,
      player2Choice,
      message: `${loser.name} perd le Shifumi, ramasse la pile`,
    }, 'effect');

    return newState;
  }

  // Non-multi-jack: immediate resolution
  const pileCards = state.pile.flatMap((e) => e.cards);

  const newPlayers = [...state.players];
  newPlayers[loserIdx] = { ...loser, hand: [...loser.hand, ...pileCards] };

  let newState: GameState = {
    ...state,
    players: newPlayers,
    pile: [],
    pendingAction: null,
    activeUnder: null,
    pileResetActive: false,
    pendingCardsPlayed: undefined,
  };

  newState = appendLog(newState, 'shifumiResolved', timestamp, loserId, loser.name, {
    loserId,
    winnerId,
    player1Choice,
    player2Choice,
    message: `${loser.name} perd le Shifumi, ramasse la pile`,
  }, 'effect');

  return resolveAutoSkip(advanceTurn(newState, false));
}

/**
 * Resolves the effect of a first-player shifumi result.
 * Called internally by resolveShifumiResult when shifumiType === 'firstPlayer'.
 */
function resolveFirstPlayerShifumiResultEffect(
  state: GameState,
  pending: PendingShifumiResult,
  timestamp: number,
): GameState {
  const { player1Id, player1Choice, player2Id, player2Choice, result } = pending;

  if (result === 'tie') {
    // Reset: new PendingFirstPlayerShifumi with same players
    let newState: GameState = {
      ...state,
      pendingAction: {
        type: 'firstPlayerShifumi' as const,
        playerIds: [player1Id, player2Id],
        choices: {},
      },
    };
    newState = appendLog(newState, 'firstPlayerShifumiDraw', timestamp);
    return newState;
  }

  // Winner starts the game
  const winnerId = result === 'player1' ? player1Id : player2Id;
  const firstIdx = state.players.findIndex((p) => p.id === winnerId);

  let newState: GameState = {
    ...state,
    phase: 'playing',
    currentPlayerIndex: firstIdx,
    turnOrder: buildTurnQueue(state.players, firstIdx, state.direction),
    pendingAction: null,
  };
  newState = appendLog(newState, 'firstPlayerShifumiWin', timestamp, undefined, undefined, {
    winnerId,
  });
  newState = appendLog(newState, 'gameStart', timestamp, undefined, undefined, {
    firstPlayerId: winnerId,
  });
  return newState;
}

// ─── Public action handlers ───────────────────────────────────────────────────

/**
 * Applies the target selection for a Shifumi or Super Shifumi.
 *
 * The initiator (who played J♣) picks two players to face each other in
 * rock-paper-scissors. The two players must be different, must both exist, and
 * must not be finished. The initiator may select themselves as one of the two.
 *
 * The turn does NOT advance — it waits for both participants to submit their
 * choice via 'shifumiChoice' actions.
 *
 * @param state     - Current game state (pendingAction.type must be 'shifumi'/'superShifumi',
 *                    with player1Id/player2Id not yet set).
 * @param playerId  - ID of the initiator submitting the target choice.
 * @param player1Id - First combatant.
 * @param player2Id - Second combatant.
 * @param timestamp - Wall-clock ms for log entries (default 0 for tests).
 */
export function applyShifumiTarget(
  state: GameState,
  playerId: string,
  player1Id: string,
  player2Id: string,
  timestamp = 0,
): GameState {
  // ── Guards ─────────────────────────────────────────────────────────────────
  if (state.pendingAction?.type !== 'shifumi' && state.pendingAction?.type !== 'superShifumi') {
    throw new Error('No pending shifumi action');
  }
  if (state.pendingAction.player1Id !== undefined) {
    throw new Error('Shifumi targets have already been selected');
  }
  const { initiatorId, type } = state.pendingAction;
  if (playerId !== initiatorId) {
    throw new Error('Only the Shifumi initiator can select targets');
  }
  if (player1Id === player2Id) {
    throw new Error('Shifumi requires two different players');
  }

  const p1Idx = state.players.findIndex((p) => p.id === player1Id);
  const p2Idx = state.players.findIndex((p) => p.id === player2Id);
  if (p1Idx === -1) throw new Error(`Player '${player1Id}' not found`);
  if (p2Idx === -1) throw new Error(`Player '${player2Id}' not found`);
  if (state.players[p1Idx]!.isFinished) {
    throw new Error(`Player '${player1Id}' is already finished`);
  }
  if (state.players[p2Idx]!.isFinished) {
    throw new Error(`Player '${player2Id}' is already finished`);
  }

  const initiatorName = state.players.find((p) => p.id === initiatorId)!.name;
  const p1Name = state.players[p1Idx]!.name;
  const p2Name = state.players[p2Idx]!.name;
  const shifumiLabel = type === 'superShifumi' ? 'un shifumi mortel' : 'à shifumi';

  let newState: GameState = {
    ...state,
    pendingAction: { type, initiatorId, player1Id, player2Id },
  };

  newState = appendLog(newState, 'shifumiTarget', timestamp, playerId, initiatorName, {
    player1Id,
    player2Id,
    message: `${p1Name} et ${p2Name} jouent ${shifumiLabel}`,
  }, 'effect');

  return newState;
}

/**
 * Applies a rock-paper-scissors choice for a Shifumi participant.
 *
 * The player submits their choice. Once both participants have chosen, the
 * confrontation is resolved automatically:
 *   - Tie: choices are reset so the same matchup replays.
 *   - Winner decided: loser picks up the pile (Shifumi) or is declared
 *     Shit Head and the game ends (Super Shifumi).
 *
 * @param state     - Current game state (pendingAction.type must be 'shifumi'/'superShifumi'
 *                    with player1Id and player2Id already set).
 * @param playerId  - ID of the participant submitting their choice.
 * @param choice    - The chosen option: 'rock', 'paper', or 'scissors'.
 * @param timestamp - Wall-clock ms for log entries (default 0 for tests).
 */
export function applyShifumiChoice(
  state: GameState,
  playerId: string,
  choice: ShifumiChoice,
  timestamp = 0,
): GameState {
  // ── Guards ─────────────────────────────────────────────────────────────────
  const pending = state.pendingAction;
  if (pending?.type !== 'shifumi' && pending?.type !== 'superShifumi') {
    throw new Error('No pending shifumi action');
  }
  const { player1Id, player2Id } = pending;
  if (player1Id === undefined || player2Id === undefined) {
    throw new Error('Shifumi targets have not been selected yet');
  }
  if (playerId !== player1Id && playerId !== player2Id) {
    throw new Error('Only the Shifumi participants can submit a choice');
  }
  if (playerId === player1Id && pending.player1Choice !== undefined) {
    throw new Error('Player has already submitted their Shifumi choice');
  }
  if (playerId === player2Id && pending.player2Choice !== undefined) {
    throw new Error('Player has already submitted their Shifumi choice');
  }

  // ── Record the choice ──────────────────────────────────────────────────────
  const playerName = state.players.find((p) => p.id === playerId)?.name ?? playerId;
  const newPending: PendingShifumi = {
    ...pending,
    ...(playerId === player1Id ? { player1Choice: choice } : { player2Choice: choice }),
  };

  let newState: GameState = { ...state, pendingAction: newPending };
  newState = appendLog(newState, 'shifumiChoice', timestamp, playerId, playerName, { choice });

  // ── Resolve if both choices are in ────────────────────────────────────────
  if (newPending.player1Choice !== undefined && newPending.player2Choice !== undefined) {
    return resolveShifumi(newState, timestamp);
  }

  return newState;
}
