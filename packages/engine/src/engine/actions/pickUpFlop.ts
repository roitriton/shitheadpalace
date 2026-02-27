import type { Card, GameState, GameVariant, Player } from '../../types';
import { getActiveZone } from '../validation';
import { advanceTurn, resolveAutoSkip } from '../turn';
import { appendLog } from '../../utils/log';
import { matchesPowerRank } from '../../powers/utils';

// ─── Utility: available flop pick-up groups ─────────────────────────────────

/**
 * Returns all valid groups of flop cards that can be picked up together.
 *
 * Each group is an array of card IDs sharing the same effective rank.
 * The Mirror card (9 by default) is a joker: it can join any group or be taken alone.
 *
 * Returns an empty array if the player is not in flop phase
 * (hand non-empty OR deck non-empty OR faceUp empty).
 */
export function getAvailableFlopPickUpGroups(player: Player, variant: GameVariant): string[][] {
  if (player.hand.length > 0 || player.faceUp.length === 0) return [];

  const isMirror = (c: Card) => matchesPowerRank(c.rank, variant, 'mirror');
  const mirrors = player.faceUp.filter(isMirror);
  const nonMirrors = player.faceUp.filter((c) => !isMirror(c));

  const groups: string[][] = [];

  // Each individual non-mirror card alone
  for (const c of nonMirrors) {
    groups.push([c.id]);
  }

  // Each individual mirror alone
  for (const m of mirrors) {
    groups.push([m.id]);
  }

  // Groups of same-rank non-mirror cards (2+)
  const byRank = new Map<string, Card[]>();
  for (const c of nonMirrors) {
    const arr = byRank.get(c.rank) ?? [];
    arr.push(c);
    byRank.set(c.rank, arr);
  }

  for (const [, cards] of byRank) {
    if (cards.length >= 2) {
      // All subsets of size 2..n
      const subsets = getNonEmptySubsets(cards, 2);
      for (const subset of subsets) {
        groups.push(subset.map((c) => c.id));
      }
    }

    // Each combination of card(s) of this rank + mirror(s)
    // Single non-mirror + each mirror
    for (const c of cards) {
      for (const m of mirrors) {
        groups.push([c.id, m.id]);
      }
    }

    // Multiple non-mirrors + mirror(s)
    if (cards.length >= 2) {
      const subsets = getNonEmptySubsets(cards, 2);
      for (const subset of subsets) {
        for (const m of mirrors) {
          groups.push([...subset.map((c) => c.id), m.id]);
        }
        // With all mirrors if multiple
        if (mirrors.length >= 2) {
          groups.push([...subset.map((c) => c.id), ...mirrors.map((m) => m.id)]);
        }
      }
    }

    // Single card + all mirrors (if 2+ mirrors)
    if (mirrors.length >= 2) {
      for (const c of cards) {
        groups.push([c.id, ...mirrors.map((m) => m.id)]);
      }
    }
  }

  // Mirror-only combos (2+ mirrors if they exist)
  if (mirrors.length >= 2) {
    const mirrorSubsets = getNonEmptySubsets(mirrors, 2);
    for (const subset of mirrorSubsets) {
      groups.push(subset.map((c) => c.id));
    }
  }

  return groups;
}

/** Returns all subsets of `items` with size >= minSize. */
function getNonEmptySubsets<T>(items: T[], minSize = 1): T[][] {
  const result: T[][] = [];
  const n = items.length;
  // Bitmask approach — flop max 3 cards so this is fine
  for (let mask = 1; mask < (1 << n); mask++) {
    const subset: T[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) subset.push(items[i]!);
    }
    if (subset.length >= minSize) result.push(subset);
  }
  return result;
}

// ─── applyPickUpWithFlopCards ─────────────────────────────────────────────────

/**
 * Picks up the pile, optionally taking a group of same-rank flop cards along.
 *
 * This action is only available when the player is in flop phase:
 * - Hand is empty
 * - Deck is empty
 * - faceUp (flop) is non-empty
 *
 * The Mirror card acts as a joker and can join any rank group or be taken alone.
 *
 * If `flopCardIds` is empty, behaves like a regular pile pick-up.
 *
 * @param state       - Current game state.
 * @param playerId    - ID of the acting player.
 * @param flopCardIds - IDs of flop cards to take along (may be empty).
 * @param timestamp   - Wall-clock ms for log records (pass 0 in tests).
 */
export function applyPickUpWithFlopCards(
  state: GameState,
  playerId: string,
  flopCardIds: string[],
  timestamp = 0,
): GameState {
  // ── Phase guard ──────────────────────────────────────────────────────────
  if (
    state.phase !== 'playing' &&
    state.phase !== 'revolution' &&
    state.phase !== 'superRevolution'
  ) {
    throw new Error(`Cannot pick up in phase '${state.phase}'`);
  }

  // ── Player / turn guard ──────────────────────────────────────────────────
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) throw new Error(`Player '${playerId}' not found`);
  if (playerIndex !== state.currentPlayerIndex) throw new Error("Not this player's turn");

  const player = state.players[playerIndex]!;

  // ── Flop phase guard ─────────────────────────────────────────────────────
  if (player.hand.length > 0) {
    throw new Error('Player still has hand cards — cannot use flop pick-up');
  }
  if (state.deck.length > 0) {
    throw new Error('Deck is not empty — cannot use flop pick-up');
  }
  if (player.faceUp.length === 0) {
    throw new Error('Player has no flop cards');
  }

  // Reset lastPowerTriggered at the start of each new action
  state = { ...state, lastPowerTriggered: null };

  // ── Empty flopCardIds → regular pile pick-up ─────────────────────────────
  if (flopCardIds.length === 0) {
    const pileCards = state.pile.flatMap((e) => e.cards);
    const newPlayers = [...state.players];
    newPlayers[playerIndex] = { ...player, hand: [...pileCards] };

    const isSuperRev = state.superRevolution === true;
    const nextPhase = state.phase === 'revolution' && !isSuperRev ? 'playing' : state.phase;
    const nextRevolution = isSuperRev ? true : (nextPhase === 'playing' ? false : (state.revolution ?? false));

    let newState: GameState = {
      ...state,
      players: newPlayers,
      pile: [],
      activeUnder: null,
      pileResetActive: false,
      phase: nextPhase,
      revolution: nextRevolution,
    };
    newState = appendLog(newState, 'pickUp', timestamp, player.id, player.name, {
      cardCount: pileCards.length,
    });
    return resolveAutoSkip(advanceTurn(newState, false));
  }

  // ── Validate flop card IDs ───────────────────────────────────────────────
  const flopCards: Card[] = [];
  for (const id of flopCardIds) {
    const found = player.faceUp.find((c) => c.id === id);
    if (!found) throw new Error(`Card '${id}' not found in player's flop`);
    flopCards.push(found);
  }

  // ── Validate same-rank constraint (mirrors are jokers) ───────────────────
  const isMirror = (c: Card) => matchesPowerRank(c.rank, state.variant, 'mirror');
  const nonMirrors = flopCards.filter((c) => !isMirror(c));

  if (nonMirrors.length > 0) {
    const baseRank = nonMirrors[0]!.rank;
    if (!nonMirrors.every((c) => c.rank === baseRank)) {
      throw new Error('All selected flop cards must share the same rank (Mirror acts as joker)');
    }
  }
  // If all cards are mirrors, that's valid too (mirrors alone)

  // ── Apply: move pile + selected flop cards into hand ─────────────────────
  const pileCards = state.pile.flatMap((e) => e.cards);
  const flopIdSet = new Set(flopCardIds);
  const remainingFlop = player.faceUp.filter((c) => !flopIdSet.has(c.id));
  const newHand = [...pileCards, ...flopCards];

  const newPlayers = [...state.players];
  newPlayers[playerIndex] = { ...player, hand: newHand, faceUp: remainingFlop };

  const isSuperRev = state.superRevolution === true;
  const nextPhase = state.phase === 'revolution' && !isSuperRev ? 'playing' : state.phase;
  const nextRevolution = isSuperRev ? true : (nextPhase === 'playing' ? false : (state.revolution ?? false));

  let newState: GameState = {
    ...state,
    players: newPlayers,
    pile: [],
    activeUnder: null,
    pileResetActive: false,
    phase: nextPhase,
    revolution: nextRevolution,
  };

  newState = appendLog(newState, 'pickUpWithFlop', timestamp, player.id, player.name, {
    pileCardCount: pileCards.length,
    flopCardIds,
    flopRanks: flopCards.map((c) => c.rank),
  });

  return resolveAutoSkip(advanceTurn(newState, false));
}
