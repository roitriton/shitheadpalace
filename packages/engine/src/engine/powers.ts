import type { Card, GameState } from '../types';
import { isBurnTriggered } from '../powers/burn';
import { appendLog } from '../utils/log';
import { isResetTriggered, applyReset } from '../powers/reset';
import { isUnderTriggered, getUnderValue, applyUnder } from '../powers/under';
import { getSkipCount, logSkip } from '../powers/skip';
import { getMirrorEffectiveRank, applyMirror } from '../powers/mirror';
import { isTargetTriggered, applyTarget } from '../powers/target';
import {
  isRevolutionTriggered,
  isSuperRevolutionTriggered,
} from '../powers/revolution';
import { isManoucheTriggered, isSuperManoucheTriggered } from '../powers/manouche';
import {
  isFlopReverseTriggered,
  isFlopRemakeTriggered,
  applyFlopReversePower,
  applyFlopRemakePower,
} from '../powers/flopReverse';
import { isShifumiTriggered, isSuperShifumiTriggered } from '../powers/shifumi';
import { matchesPowerRank } from '../powers/utils';

export interface PowerResult {
  /** Updated game state after all power effects are applied. */
  state: GameState;
  /**
   * When true, the player who just played replays (Burn triggered).
   * The caller must NOT advance the turn.
   */
  playerReplays: boolean;
  /**
   * Number of upcoming players to skip (Skip / 7 effect).
   * Passed to advanceTurn as the `skipCount` argument.
   */
  skipCount: number;
  /**
   * When true, Target was triggered and a 'targetChoice' action is pending.
   * The caller must NOT advance the turn until the choice is resolved.
   */
  pendingTarget: boolean;
  /**
   * When non-null, a Manouche or Super Manouche was triggered and a
   * 'manouchePick' / 'superManouchePick' action is pending.
   * The caller must NOT advance the turn until the choice is resolved.
   */
  pendingManoucheType: 'manouche' | 'superManouche' | null;
  /**
   * When non-null, a Flop Reverse or Flop Remake was triggered and a
   * 'flopReverseTarget' / 'flopRemakeTarget' action is pending.
   * The caller must NOT advance the turn until the target is chosen.
   */
  pendingFlopType: 'flopReverse' | 'flopRemake' | null;
  /**
   * When non-null, a Shifumi or Super Shifumi was triggered and a
   * 'shifumiTarget' action is pending.
   * The caller must NOT advance the turn until targets and choices are resolved.
   */
  pendingShifumiType: 'shifumi' | 'superShifumi' | null;
  /**
   * When non-null, a Revolution or Super Revolution was triggered and
   * requires player confirmation before applying.
   * The caller must NOT advance the turn.
   */
  pendingRevolutionType: 'revolution' | 'superRevolution' | null;
}

/**
 * Resolves all power effects for a set of cards just placed on the pile.
 *
 * Called from `applyPlay` after cards are appended to the pile, before
 * turn advancement. Handles:
 *   - Clearing Under / Reset modifiers from the previous turn.
 *   - Early exit during revolution / superRevolution: all powers suppressed.
 *   - Mirror: updates the pile entry's `effectiveRank`.
 *   - Burn: clears the pile to the graveyard; signals the player replays.
 *     (Burn takes absolute priority — all other effects are skipped.)
 *   - Skip: returns the count of players to skip for `advanceTurn`.
 *   - Reset: sets `pileResetActive` for the next player.
 *   - Under: sets `activeUnder` for the next player.
 *   - Target: sets `pendingAction`; turn is not advanced until resolved.
 *   - Super Revolution / Revolution: changes phase and sets boolean flags.
 *
 * @param state       - State after the cards have been added to the pile.
 * @param playedCards - The cards that were just played.
 * @param playerId    - ID of the acting player.
 * @param timestamp   - Wall-clock ms for log entries.
 */
export function resolvePowers(
  state: GameState,
  playedCards: Card[],
  playerId: string,
  timestamp: number,
): PowerResult {
  // ── 1. Consume Under / Reset from the previous turn ───────────────────────
  // These modifiers were set for the current player's constraint. Now that the
  // current player has acted, clear them before setting new ones.
  let newState: GameState = { ...state, activeUnder: null, pileResetActive: false };

  // ── 2. Early exit during revolution — ALL powers are suppressed ───────────
  // The spec mandates that every card power (including Burn, Mirror, etc.) is
  // disabled during revolution and superRevolution phases. Only Under/Reset
  // cleanup (step 1) still applies. Jacks still go to graveyard even here.
  if (newState.phase === 'revolution' || newState.phase === 'superRevolution') {
    // During revolution, Jacks stay in the pile (powers suppressed) — no transit.
    newState = { ...newState, lastPowerTriggered: null };
    return { state: newState, playerReplays: false, skipCount: 0, pendingTarget: false, pendingManoucheType: null, pendingFlopType: null, pendingShifumiType: null, pendingRevolutionType: null };
  }

  // ── 3. Mirror — update effectiveRank on the top PileEntry ─────────────────
  // Skip Mirror processing when Jacks are present: the Jack (and its Mirror
  // companions) will be sent to the graveyard in step 4.5, so annotating the
  // pile entry's effectiveRank would be both wasted and misleading.
  const hasJack = playedCards.some((c) => c.rank === 'J');
  const mirrorRank = !hasJack ? getMirrorEffectiveRank(playedCards, newState.variant) : null;
  if (mirrorRank !== null) {
    newState = applyMirror(newState, mirrorRank, playerId, timestamp);
  }

  // ── 4. Burn — highest priority; short-circuits everything else ────────────
  // When Mirror accompanied other cards, use only the non-Mirror cards for Burn
  // detection so that e.g. Mirror(9) + Burn(10) correctly triggers Burn.
  const isMirrorCard = (c: Card) => matchesPowerRank(c.rank, newState.variant, 'mirror');
  const cardsForBurnCheck = mirrorRank !== null
    ? playedCards.filter((c) => !isMirrorCard(c))
    : playedCards;
  // Helper: extract card info for overlay display
  const cardsInfo = playedCards.map((c) => ({ rank: c.rank, suit: c.suit }));

  if (isBurnTriggered(cardsForBurnCheck, newState.pile, newState.variant, newState.phase, playedCards.length)) {
    const burnPlayer = newState.players.find((p) => p.id === playerId)!;
    const burnedCount = newState.pile.flatMap((e) => e.cards).length;
    newState = appendLog(newState, 'burn', timestamp, playerId, burnPlayer.name, { burnedCount }, 'power');
    newState = appendLog(newState, 'burnEffect', timestamp, playerId, burnPlayer.name, {
      message: `${burnPlayer.name} brûle la pile`,
    }, 'effect');
    newState = {
      ...newState,
      lastPowerTriggered: { type: 'burn', playerId, cardsPlayed: cardsInfo },
      pendingCemeteryTransit: true,
    };
    return { state: newState, playerReplays: true, skipCount: 0, pendingTarget: false, pendingManoucheType: null, pendingFlopType: null, pendingShifumiType: null, pendingRevolutionType: null };
  }

  // ── 4.5. Jack cards → graveyard (deferred to resolveCemeteryTransit) ─────
  // Jacks (and any accompanying Mirror cards) are never left in the pile.
  // They trigger their suit-specific power and are consumed to the graveyard.
  // The actual move is deferred: we set pendingCemeteryTransit here, and
  // resolveCemeteryTransit (called in applyPlay) performs the transfer.
  if (hasJack) {
    newState = { ...newState, pendingCemeteryTransit: true };
  }

  // ── 5. Skip ───────────────────────────────────────────────────────────────
  const skipCount = getSkipCount(playedCards, newState.variant, newState.phase);
  if (skipCount > 0) {
    newState = logSkip(newState, skipCount, playerId, timestamp);
  }

  // ── 6. Reset ──────────────────────────────────────────────────────────────
  if (isResetTriggered(playedCards, newState.variant, newState.phase)) {
    newState = applyReset(newState, playerId, timestamp);
  }

  // ── 7. Under ──────────────────────────────────────────────────────────────
  if (isUnderTriggered(playedCards, newState.variant, newState.phase)) {
    const underValue = getUnderValue(playedCards, newState.variant);
    newState = applyUnder(newState, underValue, playerId, timestamp);
  }

  // ── 8. Target — sets pendingAction; turn is not advanced until resolved ───
  // lastPowerTriggered is forced to null — it will be set in applyTargetChoice
  // after the player makes their choice, so the overlay shows only once.
  if (isTargetTriggered(playedCards, newState.variant, newState.phase)) {
    newState = applyTarget(newState, playerId, timestamp);
    newState = { ...newState, lastPowerTriggered: { type: 'target', playerId, cardsPlayed: cardsInfo }, pendingActionDelayed: true, pendingCardsPlayed: cardsInfo };
    return { state: newState, playerReplays: false, skipCount, pendingTarget: true, pendingManoucheType: null, pendingFlopType: null, pendingShifumiType: null, pendingRevolutionType: null };
  }

  // ── 9. Super Revolution / Revolution ──────────────────────────────────────
  // Super Revolution (J♦ + Mirror) is checked before regular Revolution so the
  // presence of Mirror cards selects the super variant.
  // Now deferred: sets PendingRevolutionConfirm instead of applying directly.
  if (isSuperRevolutionTriggered(playedCards, newState.variant, newState.phase)) {
    newState = { ...newState, lastPowerTriggered: { type: 'superRevolution', playerId, cardsPlayed: cardsInfo }, pendingActionDelayed: true, pendingCardsPlayed: cardsInfo };
    return { state: newState, playerReplays: false, skipCount, pendingTarget: false, pendingManoucheType: null, pendingFlopType: null, pendingShifumiType: null, pendingRevolutionType: 'superRevolution' };
  } else if (isRevolutionTriggered(playedCards, newState.variant, newState.phase)) {
    newState = { ...newState, lastPowerTriggered: { type: 'revolution', playerId, cardsPlayed: cardsInfo }, pendingActionDelayed: true, pendingCardsPlayed: cardsInfo };
    return { state: newState, playerReplays: false, skipCount, pendingTarget: false, pendingManoucheType: null, pendingFlopType: null, pendingShifumiType: null, pendingRevolutionType: 'revolution' };
  }

  // ── 10. Manouche / Super Manouche ─────────────────────────────────────────
  // Super Manouche (J♠ + Mirror) is checked before regular Manouche.
  // Note: after step 9, newState.phase may be 'revolution'/'superRevolution'
  // if J♦ was also played — in that case the Manouche checks will return false.
  // lastPowerTriggered is forced to null — it will be set in applyManouchePick /
  // applySuperManouchePick after the choice is resolved.
  if (isSuperManoucheTriggered(playedCards, newState.variant, newState.phase)) {
    newState = { ...newState, lastPowerTriggered: { type: 'superManouche', playerId, cardsPlayed: cardsInfo }, pendingActionDelayed: true, pendingCardsPlayed: cardsInfo };
    return { state: newState, playerReplays: false, skipCount, pendingTarget: false, pendingManoucheType: 'superManouche', pendingFlopType: null, pendingShifumiType: null, pendingRevolutionType: null };
  } else if (isManoucheTriggered(playedCards, newState.variant, newState.phase)) {
    newState = { ...newState, lastPowerTriggered: { type: 'manouche', playerId, cardsPlayed: cardsInfo }, pendingActionDelayed: true, pendingCardsPlayed: cardsInfo };
    return { state: newState, playerReplays: false, skipCount, pendingTarget: false, pendingManoucheType: 'manouche', pendingFlopType: null, pendingShifumiType: null, pendingRevolutionType: null };
  }

  // ── 11. Flop Reverse / Flop Remake (J♥) ──────────────────────────────────
  // Flop Remake (J♥ + Mirror) is checked before regular Flop Reverse.
  // Note: after step 9, newState.phase may be 'revolution'/'superRevolution'
  // if J♦ was also played — in that case the Flop checks will return false.
  // pendingAction is NOT set here; play.ts sets it conditionally (only when
  // the player has not finished), mirroring the Manouche pattern.
  // lastPowerTriggered is forced to null — it will be set in
  // applyFlopReverseTarget / applyFlopRemake after the choice is resolved.
  if (isFlopRemakeTriggered(playedCards, newState.variant, newState.phase)) {
    newState = { ...newState, lastPowerTriggered: { type: 'flopRemake', playerId, cardsPlayed: cardsInfo }, pendingActionDelayed: true, pendingCardsPlayed: cardsInfo };
    return { state: newState, playerReplays: false, skipCount, pendingTarget: false, pendingManoucheType: null, pendingFlopType: 'flopRemake', pendingShifumiType: null, pendingRevolutionType: null };
  } else if (isFlopReverseTriggered(playedCards, newState.variant, newState.phase)) {
    newState = { ...newState, lastPowerTriggered: { type: 'flopReverse', playerId, cardsPlayed: cardsInfo }, pendingActionDelayed: true, pendingCardsPlayed: cardsInfo };
    return { state: newState, playerReplays: false, skipCount, pendingTarget: false, pendingManoucheType: null, pendingFlopType: 'flopReverse', pendingShifumiType: null, pendingRevolutionType: null };
  }

  // ── 12. Shifumi / Super Shifumi (J♣) ──────────────────────────────────────
  // Super Shifumi (J♣ + Mirror) is checked before regular Shifumi.
  // pendingAction is NOT set here; play.ts sets it conditionally (only when
  // the player has not finished), mirroring the Manouche / Flop pattern.
  // lastPowerTriggered is forced to null — it will be set in
  // applyShifumiChoice (resolveShifumi) after the confrontation is resolved.
  if (isSuperShifumiTriggered(playedCards, newState.variant, newState.phase)) {
    newState = { ...newState, lastPowerTriggered: { type: 'superShifumi', playerId, cardsPlayed: cardsInfo }, pendingActionDelayed: true, pendingCardsPlayed: cardsInfo };
    return { state: newState, playerReplays: false, skipCount, pendingTarget: false, pendingManoucheType: null, pendingFlopType: null, pendingShifumiType: 'superShifumi', pendingRevolutionType: null };
  } else if (isShifumiTriggered(playedCards, newState.variant, newState.phase)) {
    newState = { ...newState, lastPowerTriggered: { type: 'shifumi', playerId, cardsPlayed: cardsInfo }, pendingActionDelayed: true, pendingCardsPlayed: cardsInfo };
    return { state: newState, playerReplays: false, skipCount, pendingTarget: false, pendingManoucheType: null, pendingFlopType: null, pendingShifumiType: 'shifumi', pendingRevolutionType: null };
  }

  // ── Determine lastPowerTriggered for simple powers (skip, reset, under) ──
  // Priority: skip > reset > under (only one lastPowerTriggered per play).
  // Revolution/superRevolution was already set in step 9 — don't override.
  if (skipCount > 0) {
    newState = { ...newState, lastPowerTriggered: { type: 'skip', playerId, skipCount, cardsPlayed: cardsInfo } };
  } else if (isResetTriggered(playedCards, newState.variant, newState.phase)) {
    newState = { ...newState, lastPowerTriggered: { type: 'reset', playerId, cardsPlayed: cardsInfo } };
  } else if (isUnderTriggered(playedCards, newState.variant, newState.phase)) {
    newState = { ...newState, lastPowerTriggered: { type: 'under', playerId, cardsPlayed: cardsInfo } };
  } else if (!newState.lastPowerTriggered) {
    newState = { ...newState, lastPowerTriggered: null };
  }

  return { state: newState, playerReplays: false, skipCount, pendingTarget: false, pendingManoucheType: null, pendingFlopType: null, pendingShifumiType: null, pendingRevolutionType: null };
}
