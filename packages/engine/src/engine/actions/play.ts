import type { Card, GameState, PileEntry } from '../../types';
import {
  canPlayCards,
  getActiveZone,
  getZoneCards,
  setZoneCards,
  allSameRank,
} from '../validation';
import { autoDraw, isPlayerFinished, advanceTurn, isGameOver, resolveAutoSkip } from '../turn';
import { appendLog } from '../../utils/log';
import { resolvePowers } from '../powers';
import { getMirrorEffectiveRank } from '../../powers/mirror';
import { matchesPowerRank } from '../../powers/utils';

// ─── Flop helper ──────────────────────────────────────────────────────────────

/**
 * Sets a pending Flop Reverse or Flop Remake action on the state and appends
 * a log entry. Called from applyPlay when the corresponding power is triggered
 * and the launcher has not finished.
 */
function setPendingFlop(
  state: GameState,
  flopType: 'flopReverse' | 'flopRemake',
  launcherId: string,
  launcherName: string,
  timestamp: number,
): GameState {
  let newState: GameState = {
    ...state,
    pendingAction: { type: flopType, launcherId },
  };
  newState = appendLog(newState, flopType, timestamp, launcherId, launcherName, {});
  return newState;
}

// ─── Shifumi helper ───────────────────────────────────────────────────────────

/**
 * Sets a pending Shifumi or Super Shifumi action on the state and appends
 * a log entry. Called from applyPlay when the corresponding power is triggered
 * and the launcher has not finished.
 */
function setPendingShifumi(
  state: GameState,
  shifumiType: 'shifumi' | 'superShifumi',
  launcherId: string,
  launcherName: string,
  timestamp: number,
): GameState {
  let newState: GameState = {
    ...state,
    pendingAction: { type: shifumiType, initiatorId: launcherId },
  };
  newState = appendLog(newState, shifumiType, timestamp, launcherId, launcherName, {});
  return newState;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function markPlayerFinished(
  state: GameState,
  playerIndex: number,
  timestamp: number,
): GameState {
  const player = state.players[playerIndex]!;
  const newPlayers = [...state.players];
  newPlayers[playerIndex] = { ...player, isFinished: true };
  const newFinishOrder = [...state.finishOrder, player.id];
  const place = newFinishOrder.length;
  let newState: GameState = { ...state, players: newPlayers, finishOrder: newFinishOrder };
  newState = appendLog(newState, 'playerFinished', timestamp, player.id, player.name, { place });
  return newState;
}

function finalizeGame(state: GameState, timestamp: number): GameState {
  const lastActive = state.players.find((p) => !p.isFinished);
  const newPlayers = state.players.map((p) => (p.isFinished ? p : { ...p, isFinished: true }));
  const finishOrder = lastActive
    ? [...state.finishOrder, lastActive.id]
    : state.finishOrder;

  let newState: GameState = {
    ...state,
    players: newPlayers,
    finishOrder,
    phase: 'finished',
    turnOrder: [],
  };

  if (lastActive) {
    newState = appendLog(newState, 'playerFinished', timestamp, lastActive.id, lastActive.name, {
      place: newState.finishOrder.length,
    });
  }

  newState = appendLog(newState, 'gameOver', timestamp, undefined, undefined, {
    finishOrder: newState.finishOrder,
  });

  return newState;
}

// ─── Manouche helper ──────────────────────────────────────────────────────────

/**
 * Validates the Manouche target and sets the pendingAction on the state.
 * Throws if `targetPlayerId` is missing, invalid, finished, or is the launcher.
 */
function setPendingManouche(
  state: GameState,
  manoucheType: 'manouche' | 'superManouche',
  launcherId: string,
  targetPlayerId: string | undefined,
  timestamp: number,
  launcherName: string,
): GameState {
  if (!targetPlayerId) {
    throw new Error(
      `targetPlayerId is required when playing a ${manoucheType} card (J\u2660)`,
    );
  }
  const targetIdx = state.players.findIndex((p) => p.id === targetPlayerId);
  if (targetIdx === -1) throw new Error(`Target player '${targetPlayerId}' not found`);
  const target = state.players[targetIdx]!;
  if (target.isFinished) {
    throw new Error(`Target player '${targetPlayerId}' is already finished`);
  }
  if (targetPlayerId === launcherId) {
    throw new Error('Cannot target yourself with Manouche');
  }

  let newState: GameState = {
    ...state,
    pendingAction: { type: manoucheType, launcherId, targetId: targetPlayerId },
  };
  newState = appendLog(newState, manoucheType, timestamp, launcherId, launcherName, {
    targetId: targetPlayerId,
  });
  return newState;
}

// ─── applyPlay ────────────────────────────────────────────────────────────────

/**
 * Applies a play-cards action.
 *
 * Covers all three zones (hand → faceUp → faceDown) and integrates power effects:
 *   - Burn (rank or 4-identical): pile → graveyard, player replays.
 *   - Reset: next player can play any card.
 *   - Under: next player must play ≤ Under value.
 *   - Skip: next N players lose their turn.
 *   - Mirror: accompanied card's rank becomes the effective pile value.
 *   - Manouche / Super Manouche: sets pendingAction; turn is not advanced
 *     until the launcher resolves the exchange via manouchePick / superManouchePick.
 *
 * @param state          - Current game state.
 * @param playerId       - ID of the acting player.
 * @param cardIds        - IDs of the cards to play (must all be from the active zone).
 * @param timestamp      - Wall-clock time for log/pile records (pass 0 in tests).
 * @param targetPlayerId - Required when playing a Manouche (J♠) card: ID of the
 *                         player to exchange cards with.
 */
export function applyPlay(
  state: GameState,
  playerId: string,
  cardIds: string[],
  timestamp = 0,
  targetPlayerId?: string,
): GameState {
  // ── Phase guard ────────────────────────────────────────────────────────────
  if (
    state.phase !== 'playing' &&
    state.phase !== 'revolution' &&
    state.phase !== 'superRevolution'
  ) {
    throw new Error(`Cannot play cards in phase '${state.phase}'`);
  }

  // ── Player / turn guard ────────────────────────────────────────────────────
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) throw new Error(`Player '${playerId}' not found`);
  if (playerIndex !== state.currentPlayerIndex) throw new Error("Not this player's turn");
  if (cardIds.length === 0) throw new Error('Must specify at least one card to play');

  const player = state.players[playerIndex]!;
  const zone = getActiveZone(player);
  if (zone === null) throw new Error(`Player '${playerId}' has no cards left to play`);

  // Reset lastPowerTriggered at the start of each new action
  state = { ...state, lastPowerTriggered: null };

  // ── Locate the cards in the active zone (with combo detection) ─────────────
  const zoneCards = getZoneCards(player, zone);
  const cardsToPlay: Card[] = [];
  let comboFlopCards: Card[] = [];   // faceUp cards pulled into a hand+flop combo
  let comboDarkCards: Card[] = [];   // faceDown cards pulled into a flop+dark combo
  let isHandFlopCombo = false;
  let isFlopDarkCombo = false;

  for (const id of cardIds) {
    const found = zoneCards.find((c) => c.id === id);
    if (found) {
      cardsToPlay.push(found);
    } else if (zone === 'hand') {
      const flopCard = player.faceUp.find((c) => c.id === id);
      if (flopCard) {
        comboFlopCards.push(flopCard);
        cardsToPlay.push(flopCard);
        isHandFlopCombo = true;
      } else {
        throw new Error(`Card '${id}' not found in player's ${zone}`);
      }
    } else if (zone === 'faceUp' && player.hasSeenDarkFlop) {
      const darkCard = player.faceDown.find((c) => c.id === id);
      if (darkCard) {
        comboDarkCards.push(darkCard);
        cardsToPlay.push(darkCard);
        isFlopDarkCombo = true;
      } else {
        throw new Error(`Card '${id}' not found in player's ${zone}`);
      }
    } else {
      throw new Error(`Card '${id}' not found in player's ${zone}`);
    }
  }

  // Validate combo conditions: must play ALL cards from the active zone
  if (isHandFlopCombo) {
    if (state.deck.length > 0) {
      throw new Error('Combo hand+flop is only allowed when the deck is empty');
    }
    const remainingHand = player.hand.filter((c) => !cardIds.includes(c.id));
    if (remainingHand.length > 0) {
      throw new Error('Combo hand+flop requires playing ALL remaining hand cards');
    }
  }
  if (isFlopDarkCombo) {
    const remainingFlop = player.faceUp.filter((c) => !cardIds.includes(c.id));
    if (remainingFlop.length > 0) {
      throw new Error('Combo flop+dark requires playing ALL remaining flop cards');
    }
  }

  // Shared helper — used in both the revealed dark-flop path and the normal path
  const isMirrorCard = (c: Card) => matchesPowerRank(c.rank, state.variant, 'mirror');

  // ═══════════════════════════════════════════════════════════════════════════
  // Dark flop path
  // ═══════════════════════════════════════════════════════════════════════════
  if (zone === 'faceDown') {
    // ── Known dark flop (after Flop Reverse / Flop Remake) ──────────────────
    // The player knows their cards; multi-card play is allowed.
    // Invalid combinations result in pickup (pile + all attempted cards),
    // matching the "attempt and fail" dark-flop mechanic.
    if (player.hasSeenDarkFlop) {
      // Validate the combination; any failure → pickup
      let isInvalid = false;
      const mirrorRankRevealed = getMirrorEffectiveRank(cardsToPlay, state.variant);

      if (cardsToPlay.some(isMirrorCard) && cardsToPlay.every(isMirrorCard)) {
        // Mirror alone is never valid
        isInvalid = true;
      } else if (mirrorRankRevealed !== null) {
        const nonMirrors = cardsToPlay.filter((c) => !isMirrorCard(c));
        if (!allSameRank(nonMirrors) || !canPlayCards(nonMirrors, state, cardsToPlay.length)) {
          isInvalid = true;
        }
      } else {
        if (!allSameRank(cardsToPlay) || !canPlayCards(cardsToPlay, state)) {
          isInvalid = true;
        }
      }

      if (isInvalid) {
        // Invalid known dark-flop play: player picks up pile + all attempted cards
        const pileCards = state.pile.flatMap((e) => e.cards);
        const newHand = [...player.hand, ...pileCards, ...cardsToPlay];
        const remaining = player.faceDown.filter((c) => !cardIds.includes(c.id));
        const newPlayers = [...state.players];
        newPlayers[playerIndex] = { ...player, hand: newHand, faceDown: remaining };
        let newState: GameState = {
          ...state,
          players: newPlayers,
          pile: [],
          activeUnder: null,
          pileResetActive: false,
        };
        newState = appendLog(newState, 'darkPlayFail', timestamp, player.id, player.name, {
          cardIds,
          ranks: cardsToPlay.map((c) => c.rank),
          pileCardCount: pileCards.length,
        });
        return resolveAutoSkip(advanceTurn(newState, false));
      }

      // Valid known dark-flop play
      const remaining = player.faceDown.filter((c) => !cardIds.includes(c.id));
      const updatedPlayerRevealed = { ...player, faceDown: remaining };
      const entryRevealed: PileEntry = {
        cards: cardsToPlay,
        playerId: player.id,
        playerName: player.name,
        timestamp,
      };
      const newPlayersRevealed = [...state.players];
      newPlayersRevealed[playerIndex] = updatedPlayerRevealed;
      let newStateRevealed: GameState = {
        ...state,
        players: newPlayersRevealed,
        pile: [...state.pile, entryRevealed],
      };
      newStateRevealed = appendLog(
        newStateRevealed,
        'play',
        timestamp,
        player.id,
        player.name,
        { cardIds, ranks: cardsToPlay.map((c) => c.rank), suits: cardsToPlay.map((c) => c.suit), zone },
      );

      const {
        state: poweredRevealed,
        playerReplays: prRevealed,
        skipCount: scRevealed,
        pendingTarget: ptRevealed,
        pendingManoucheType: pmRevealed,
        pendingFlopType: pfRevealed,
        pendingShifumiType: psRevealed,
      } = resolvePowers(newStateRevealed, cardsToPlay, playerId, timestamp);
      newStateRevealed = poweredRevealed;

      const finishedRevealed = isPlayerFinished(newStateRevealed.players[playerIndex]!);
      if (finishedRevealed) newStateRevealed = markPlayerFinished(newStateRevealed, playerIndex, timestamp);
      if (isGameOver(newStateRevealed)) return finalizeGame(newStateRevealed, timestamp);
      if (prRevealed && !finishedRevealed) return newStateRevealed;
      if (ptRevealed && !finishedRevealed) return newStateRevealed;
      if (pmRevealed !== null && !finishedRevealed) {
        return setPendingManouche(newStateRevealed, pmRevealed, playerId, targetPlayerId, timestamp, player.name);
      }
      if (pfRevealed !== null && !finishedRevealed) {
        return setPendingFlop(newStateRevealed, pfRevealed, playerId, player.name, timestamp);
      }
      if (psRevealed !== null && !finishedRevealed) {
        return setPendingShifumi(newStateRevealed, psRevealed, playerId, player.name, timestamp);
      }
      return resolveAutoSkip(advanceTurn(newStateRevealed, finishedRevealed, scRevealed));
    }

    // ── Blind dark flop: one card at a time ─────────────────────────────────
    if (cardsToPlay.length !== 1) {
      throw new Error('Only one dark-flop card may be played at a time');
    }
    const revealedCard = cardsToPlay[0]!;
    const newFaceDown = player.faceDown.filter((c) => c.id !== revealedCard.id);
    const playerWithoutCard: typeof player = { ...player, faceDown: newFaceDown };

    if (!canPlayCards([revealedCard], state)) {
      // Invalid blind play: player picks up the pile AND the revealed card
      const pileCards = state.pile.flatMap((e) => e.cards);
      const newHand = [...player.hand, ...pileCards, revealedCard];
      const newPlayers = [...state.players];
      newPlayers[playerIndex] = { ...playerWithoutCard, hand: newHand };
      // Clear Under/Reset (current player's constraint consumed)
      let newState: GameState = {
        ...state,
        players: newPlayers,
        pile: [],
        activeUnder: null,
        pileResetActive: false,
      };
      newState = appendLog(newState, 'darkPlayFail', timestamp, player.id, player.name, {
        cardId: revealedCard.id,
        rank: revealedCard.rank,
        pileCardCount: pileCards.length,
      });
      return resolveAutoSkip(advanceTurn(newState, false));
    }

    // Valid blind play — place card on pile
    const entry: PileEntry = {
      cards: [revealedCard],
      playerId: player.id,
      playerName: player.name,
      timestamp,
    };
    const newPlayers = [...state.players];
    newPlayers[playerIndex] = playerWithoutCard;
    let newState: GameState = { ...state, players: newPlayers, pile: [...state.pile, entry] };
    newState = appendLog(newState, 'darkPlay', timestamp, player.id, player.name, {
      cardId: revealedCard.id,
      rank: revealedCard.rank,
      ranks: [revealedCard.rank],
      suits: [revealedCard.suit],
    });

    // Resolve power effects (Mirror is a no-op for a single dark-flop card)
    const {
      state: powered,
      playerReplays,
      skipCount,
      pendingTarget,
      pendingManoucheType,
      pendingFlopType,
      pendingShifumiType,
    } = resolvePowers(newState, [revealedCard], playerId, timestamp);
    newState = powered;

    const finished = isPlayerFinished(newState.players[playerIndex]!);
    if (finished) newState = markPlayerFinished(newState, playerIndex, timestamp);
    if (isGameOver(newState)) return finalizeGame(newState, timestamp);
    if (playerReplays && !finished) return newState;
    if (pendingTarget && !finished) return newState;
    if (pendingManoucheType !== null && !finished) {
      return setPendingManouche(newState, pendingManoucheType, playerId, targetPlayerId, timestamp, player.name);
    }
    if (pendingFlopType !== null && !finished) {
      return setPendingFlop(newState, pendingFlopType, playerId, player.name, timestamp);
    }
    if (pendingShifumiType !== null && !finished) {
      return setPendingShifumi(newState, pendingShifumiType, playerId, player.name, timestamp);
    }
    return resolveAutoSkip(advanceTurn(newState, finished, skipCount));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Normal play path — hand or faceUp (+ optional combo)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Flop + dark flop combo: invalid rank mix → pickup ─────────────────────
  if (isFlopDarkCombo) {
    const mirrorCheck = getMirrorEffectiveRank(cardsToPlay, state.variant);
    const nonMirrors = mirrorCheck !== null
      ? cardsToPlay.filter((c) => !isMirrorCard(c))
      : cardsToPlay;
    if (!allSameRank(nonMirrors)) {
      // Invalid combo: dark flop cards don't match — player picks up pile + all attempted cards
      const pileCards = state.pile.flatMap((e) => e.cards);
      const newHand = [...player.hand, ...pileCards, ...cardsToPlay];
      const remainingFaceUp = player.faceUp.filter((c) => !cardIds.includes(c.id));
      const remainingFaceDown = player.faceDown.filter((c) => !cardIds.includes(c.id));
      const newPlayers = [...state.players];
      newPlayers[playerIndex] = { ...player, hand: newHand, faceUp: remainingFaceUp, faceDown: remainingFaceDown };
      let newState: GameState = {
        ...state,
        players: newPlayers,
        pile: [],
        activeUnder: null,
        pileResetActive: false,
      };
      newState = appendLog(newState, 'comboFail', timestamp, player.id, player.name, {
        cardIds,
        ranks: cardsToPlay.map((c) => c.rank),
      });
      return resolveAutoSkip(advanceTurn(newState, false));
    }
  }

  // ── Mirror play validation ─────────────────────────────────────────────────

  // Mirror-alone: every card is a Mirror (getMirrorEffectiveRank returns null in this case)
  if (cardsToPlay.some(isMirrorCard) && cardsToPlay.every(isMirrorCard)) {
    throw new Error('Mirror cannot be played alone — it must accompany another card');
  }

  const mirrorRank = getMirrorEffectiveRank(cardsToPlay, state.variant);

  if (mirrorRank !== null) {
    // Mirror play: validate non-Mirror cards
    const nonMirrors = cardsToPlay.filter((c) => !isMirrorCard(c));

    if (!allSameRank(nonMirrors)) {
      throw new Error('Non-Mirror cards in a Mirror play must all share the same rank');
    }
    // Validate using the effective rank (the non-Mirror card's rank)
    if (!canPlayCards(nonMirrors, state, cardsToPlay.length)) {
      throw new Error('These cards cannot be played on the current pile (value too low)');
    }
  } else {
    // Standard play: all cards must be the same rank
    if (!allSameRank(cardsToPlay)) {
      throw new Error('All played cards must share the same rank');
    }
    if (!canPlayCards(cardsToPlay, state)) {
      throw new Error('These cards cannot be played on the current pile (value too low)');
    }
  }

  // ── Remove played cards from zone(s), build pile entry ────────────────────
  const remaining = zoneCards.filter((c) => !cardIds.includes(c.id));
  let updatedPlayer = setZoneCards(player, zone, remaining);
  // For combos, also remove cards from the secondary zone
  if (isHandFlopCombo) {
    const remainingFlop = player.faceUp.filter((c) => !cardIds.includes(c.id));
    updatedPlayer = { ...updatedPlayer, faceUp: remainingFlop };
  }
  if (isFlopDarkCombo) {
    const remainingDark = player.faceDown.filter((c) => !cardIds.includes(c.id));
    updatedPlayer = { ...updatedPlayer, faceDown: remainingDark };
  }

  const entry: PileEntry = {
    cards: cardsToPlay,
    playerId: player.id,
    playerName: player.name,
    timestamp,
  };

  let newPlayers = [...state.players];
  newPlayers[playerIndex] = updatedPlayer;
  let newState: GameState = { ...state, players: newPlayers, pile: [...state.pile, entry] };

  // Log the play action
  newState = appendLog(newState, 'play', timestamp, player.id, player.name, {
    cardIds,
    ranks: cardsToPlay.map((c) => c.rank),
    suits: cardsToPlay.map((c) => c.suit),
    zone,
  });

  // ── Auto-draw (Phase 1 only) ───────────────────────────────────────────────
  if (zone === 'hand' && newState.deck.length > 0) {
    const { player: drawn, deck: newDeck } = autoDraw(updatedPlayer, newState.deck);
    newPlayers = [...newState.players];
    newPlayers[playerIndex] = drawn;
    newState = { ...newState, players: newPlayers, deck: newDeck };
  }

  // ── Resolve power effects ──────────────────────────────────────────────────
  const {
    state: powered,
    playerReplays,
    skipCount,
    pendingTarget,
    pendingManoucheType,
    pendingFlopType,
    pendingShifumiType,
  } = resolvePowers(newState, cardsToPlay, playerId, timestamp);
  newState = powered;

  // ── Finish / game-over detection ───────────────────────────────────────────
  const finished = isPlayerFinished(newState.players[playerIndex]!);
  if (finished) newState = markPlayerFinished(newState, playerIndex, timestamp);
  if (isGameOver(newState)) return finalizeGame(newState, timestamp);

  // ── Turn advancement ───────────────────────────────────────────────────────
  if (playerReplays && !finished) {
    // Burn triggered and player still has cards → they play again
    return newState;
  }
  if (pendingTarget && !finished) {
    // Target triggered: wait for launcher's targetChoice before advancing
    return newState;
  }
  if (pendingManoucheType !== null && !finished) {
    // Manouche triggered: validate target and set pendingAction; turn waits
    return setPendingManouche(newState, pendingManoucheType, playerId, targetPlayerId, timestamp, player.name);
  }
  if (pendingFlopType !== null && !finished) {
    // Flop Reverse / Remake triggered: wait for launcher's target choice
    return setPendingFlop(newState, pendingFlopType, playerId, player.name, timestamp);
  }
  if (pendingShifumiType !== null && !finished) {
    // Shifumi triggered: set pendingAction; initiator will pick two targets
    return setPendingShifumi(newState, pendingShifumiType, playerId, player.name, timestamp);
  }
  return resolveAutoSkip(advanceTurn(newState, finished, skipCount));
}
