import type { GameState, PendingShifumi, ShifumiChoice } from '../../types';
import { advanceTurn, resolveAutoSkip } from '../turn';
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
  });
  newState = appendLog(newState, 'gameOver', timestamp, undefined, undefined, {
    finishOrder: newState.finishOrder,
  });

  return newState;
}

/**
 * Resolves the Shifumi confrontation once both choices are known.
 *
 * On a tie: choices are reset so the same participants play again.
 * On a winner: the loser picks up the pile (regular Shifumi) or is declared
 * Shit Head and the game ends immediately (Super Shifumi).
 */
function resolveShifumi(state: GameState, timestamp: number): GameState {
  const pending = state.pendingAction as PendingShifumi;
  const { initiatorId, player1Id, player2Id, player1Choice, player2Choice, type } = pending;

  const result = getShifumiWinner(player1Choice!, player2Choice!);

  if (result === 'tie') {
    // Reset choices — same participants will have to play again
    const newPending: PendingShifumi = { type, initiatorId, player1Id, player2Id };
    let newState: GameState = { ...state, pendingAction: newPending };
    newState = appendLog(newState, 'shifumiTie', timestamp, undefined, undefined, {
      player1Id,
      player2Id,
      player1Choice,
      player2Choice,
    });
    return newState;
  }

  const loserId = result === 'player1' ? player2Id! : player1Id!;
  const winnerId = result === 'player1' ? player1Id! : player2Id!;

  const isMultiJack = !!state.multiJackSequence;

  if (type === 'superShifumi') {
    let finalState = finalizeGameWithShitHead(state, loserId, winnerId, timestamp);
    finalState = { ...finalState, lastPowerTriggered: { type: 'superShifumi', playerId: pending.initiatorId, players: [player1Id!, player2Id!], cardsPlayed: state.pendingCardsPlayed }, pendingCardsPlayed: undefined };
    return finalState;
  }

  // Regular Shifumi: loser picks up the pile
  const loserIdx = state.players.findIndex((p) => p.id === loserId);
  const loser = state.players[loserIdx]!;

  if (isMultiJack) {
    // Deferred pickup: keep the jack visible on the pile for animation.
    // The actual pile-to-hand transfer and jack-to-graveyard happen in
    // continueMultiJackSequence after the server animation delay (~1500ms).
    let newState: GameState = {
      ...state,
      pendingAction: null,
      lastPowerTriggered: {
        type: 'shifumi',
        playerId: pending.initiatorId,
        players: [player1Id!, player2Id!],
        cardsPlayed: state.pendingCardsPlayed,
      },
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
    });

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
    lastPowerTriggered: { type: 'shifumi', playerId: pending.initiatorId, players: [player1Id!, player2Id!], cardsPlayed: state.pendingCardsPlayed },
    pendingCardsPlayed: undefined,
  };

  newState = appendLog(newState, 'shifumiResolved', timestamp, loserId, loser.name, {
    loserId,
    winnerId,
    player1Choice,
    player2Choice,
  });

  // Turn advances from the initiator's position (currentPlayerIndex)
  return resolveAutoSkip(advanceTurn(newState, false));
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

  let newState: GameState = {
    ...state,
    pendingAction: { type, initiatorId, player1Id, player2Id },
  };

  newState = appendLog(newState, 'shifumiTarget', timestamp, playerId, initiatorName, {
    player1Id,
    player2Id,
  });

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
