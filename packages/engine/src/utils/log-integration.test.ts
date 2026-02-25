import { describe, it, expect } from 'vitest';
import { applyPlay } from '../engine/actions/play';
import { applyPickUpPile } from '../engine/actions/pickUp';
import { applySwap } from '../engine/actions/swap';
import type { Card, GameState, PileEntry, Player } from '../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function card(rank: Card['rank'], suit: Card['suit'] = 'hearts', idx = 0): Card {
  return { id: `${rank}-${suit}-${idx}`, suit, rank };
}

function pile(...ranks: Card['rank'][]): PileEntry[] {
  return ranks.map((r) => ({
    cards: [card(r)],
    playerId: 'px',
    playerName: 'PX',
    timestamp: 0,
  }));
}

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    hand: [],
    faceUp: [],
    faceDown: [],
    isFinished: false,
    isBot: false,
    ...overrides,
  };
}

function makeState(
  p0: Partial<Player>,
  pileEntries: PileEntry[] = [],
  deck: Card[] = [],
  p1: Partial<Player> = {},
): GameState {
  const players = [makePlayer('p0', p0), makePlayer('p1', p1)];
  return {
    id: 'g1',
    phase: 'playing',
    players,
    deck,
    pile: pileEntries,
    graveyard: [],
    currentPlayerIndex: 0,
    direction: 1,
    turnOrder: [1],
    finishOrder: [],
    variant: { name: 'S', powerAssignments: {}, playerCount: 2, deckCount: 1 },
    pendingAction: null,
    log: [],
  };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('log integration — actions generate correct log entries', () => {
  it('play generates a "play" log entry with ranks and zone', () => {
    const c5 = card('5');
    const state = makeState({ hand: [c5, card('K'), card('Q')] }, pile('3'));
    const next = applyPlay(state, 'p0', [c5.id]);

    const playLog = next.log.find((e) => e.type === 'play');
    expect(playLog).toBeDefined();
    expect(playLog!.playerId).toBe('p0');
    expect(playLog!.data.ranks).toEqual(['5']);
    expect(playLog!.data.zone).toBe('hand');
  });

  it('pickUp generates a "pickUp" log entry with cardCount', () => {
    const state = makeState(
      { hand: [card('3')] },
      pile('5', '7', 'K'),
    );
    const next = applyPickUpPile(state, 'p0');

    const pickUpLog = next.log.find((e) => e.type === 'pickUp');
    expect(pickUpLog).toBeDefined();
    expect(pickUpLog!.playerId).toBe('p0');
    expect(pickUpLog!.data.cardCount).toBe(3);
  });

  it('burn card generates "play" + "burn" log entries with burnedCount', () => {
    const c10 = card('10');
    const state = makeState(
      { hand: [c10, card('K'), card('Q')] },
      pile('3'),
    );
    // Default variant has no powerAssignments, so 10 won't trigger burn via power.
    // Use the standard variant assignment for burn.
    state.variant.powerAssignments = { burn: '10' };

    const next = applyPlay(state, 'p0', [c10.id]);

    const playLog = next.log.find((e) => e.type === 'play');
    expect(playLog).toBeDefined();

    const burnLog = next.log.find((e) => e.type === 'burn');
    expect(burnLog).toBeDefined();
    expect(burnLog!.data.burnedCount).toBeGreaterThan(0);
  });

  it('skip card generates "play" + "skip" log entries with skipCount', () => {
    const c7 = card('7');
    const state = makeState(
      { hand: [c7, card('K'), card('Q')] },
      pile('3'),
    );
    state.variant.powerAssignments = { skip: '7' };

    const next = applyPlay(state, 'p0', [c7.id]);

    const playLog = next.log.find((e) => e.type === 'play');
    expect(playLog).toBeDefined();

    const skipLog = next.log.find((e) => e.type === 'skip');
    expect(skipLog).toBeDefined();
    expect(skipLog!.data.skipCount).toBe(1);
  });

  it('swap generates a "swap" log entry with handCardId and flopCardId', () => {
    const hCard = card('5');
    const fCard = card('K');
    const state: GameState = {
      ...makeState({ hand: [hCard, card('3'), card('Q')], faceUp: [fCard, card('7'), card('9')] }),
      phase: 'swapping',
    };

    const next = applySwap(state, 'p0', hCard.id, fCard.id);

    const swapLog = next.log.find((e) => e.type === 'swap');
    expect(swapLog).toBeDefined();
    expect(swapLog!.playerId).toBe('p0');
    expect(swapLog!.data.handCardId).toBe(hCard.id);
    expect(swapLog!.data.flopCardId).toBe(fCard.id);
  });

  it('dark flop fail generates a "darkPlayFail" log entry with rank and pileCardCount', () => {
    // Player has only faceDown cards (no hand, no faceUp) → dark flop play
    const darkCard = card('3');
    const state = makeState(
      { hand: [], faceUp: [], faceDown: [darkCard] },
      pile('K'), // K > 3 → the 3 cannot be played on K → darkPlayFail
    );

    const next = applyPlay(state, 'p0', [darkCard.id]);

    const failLog = next.log.find((e) => e.type === 'darkPlayFail');
    expect(failLog).toBeDefined();
    expect(failLog!.playerId).toBe('p0');
    expect(failLog!.data.rank).toBe('3');
    expect(failLog!.data.pileCardCount).toBeGreaterThan(0);
  });
});
