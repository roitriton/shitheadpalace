import { useRef, useState, useLayoutEffect, useCallback, createContext } from 'react';
import type { GameState, Card as CardType } from '@shit-head-palace/engine';
import type { FlyingCardAnim } from '../components/CardAnimationLayer';

// ─── Context for hiding cards at destination during flight ──────────────────

export const CardAnimationContext = createContext<Set<string>>(new Set());

// ─── Card size (md = 56×80) ─────────────────────────────────────────────────

const CARD_MD_W = 56;
const CARD_MD_H = 80;

/** Scale factor relative to md card size, by zone and bot/human. */
function zoneScale(zone: string, isBot: boolean): number {
  if (zone === 'pile') return 1;
  if (zone === 'graveyard') return 36 / 56;
  if (zone === 'deck') return 44 / 56;
  if (isBot) return 36 / 56; // bot hand/flop = xs
  if (zone === 'hand') return 1; // human hand = md
  return 44 / 56; // human flop = sm
}

/** Get center position (top-left for a md-sized card) from a data-zone element. */
function getZonePos(zone: string, playerId?: string): { x: number; y: number } | null {
  // faceDown cards are rendered inside faceUp section — fall back
  const mappedZone = zone === 'faceDown' ? 'faceUp' : zone;
  const selector = playerId
    ? `[data-zone="${mappedZone}"][data-player-id="${playerId}"]`
    : `[data-zone="${mappedZone}"]`;
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - CARD_MD_W / 2,
    y: rect.top + rect.height / 2 - CARD_MD_H / 2,
  };
}

/** Get the position of a specific card by its data-card-id attribute in the pile. */
function getCardPos(cardId: string): { x: number; y: number } | null {
  const el = document.querySelector(`[data-card-id="${cardId}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - CARD_MD_W / 2,
    y: rect.top + rect.height / 2 - CARD_MD_H / 2,
  };
}

// ─── Max ghost cards per animation group (performance) ──────────────────────

const MAX_GHOST_CARDS = 5;

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useCardAnimations(game: GameState | null, humanId: string) {
  const prevRef = useRef<GameState | null>(null);
  const [animations, setAnimations] = useState<FlyingCardAnim[]>([]);
  const [hiddenCardIds, setHiddenCardIds] = useState<Set<string>>(new Set());

  useLayoutEffect(() => {
    const prev = prevRef.current;
    prevRef.current = game;
    if (!prev || !game || prev === game) return;

    // Don't animate during initial setup or phase transitions
    if (prev.phase !== game.phase && (prev.phase === 'swapping' || game.phase === 'swapping')) return;

    const newLogEntries = game.log.slice(prev.log.length);
    if (newLogEntries.length === 0 && game.graveyard.length === prev.graveyard.length && game.deck.length === prev.deck.length) return;

    const newAnims: FlyingCardAnim[] = [];
    const newHidden = new Set<string>();
    const handledCardIds = new Set<string>(); // avoid double-animating

    // Track max end time of play animations for sequencing draw after play
    let playPhaseEndTime = 0;

    // ── 1. Play / Dark play → pile ──────────────────────────────────────
    for (const entry of newLogEntries) {
      if (entry.type === 'play' && entry.playerId) {
        const cardIds = entry.data.cardIds as string[] | undefined;
        const zone = (entry.data.zone as string) ?? 'hand';
        if (!cardIds) continue;

        const isBot = entry.playerId !== humanId;
        const from = getZonePos(zone, entry.playerId);
        if (!from) continue;

        const allPileCards = game.pile.flatMap((e) => e.cards);
        const cards = cardIds
          .map((id) => allPileCards.find((c) => c.id === id))
          .filter((c): c is CardType => !!c);

        cards.forEach((card, i) => {
          if (handledCardIds.has(card.id)) return;
          handledCardIds.add(card.id);
          newHidden.add(card.id);
          const to = getCardPos(card.id) ?? getZonePos('pile');
          if (!to) return;
          const delay = i * 50;
          const endTime = delay + 800;
          if (endTime > playPhaseEndTime) playPhaseEndTime = endTime;
          newAnims.push({
            id: `play-${entry.id}-${card.id}`,
            card,
            faceDown: false,
            from: { ...from, scale: zoneScale(zone, isBot) },
            to: { ...to, scale: 1 },
            duration: 800,
            delay,
          });
        });
      }

      if (entry.type === 'darkPlay' && entry.playerId) {
        const cardId = entry.data.cardId as string | undefined;
        const cardIds = entry.data.cardIds as string[] | undefined;
        const ids = cardIds ?? (cardId ? [cardId] : []);

        const from = getZonePos('faceDown', entry.playerId);
        if (!from) continue;

        const allPileCards = game.pile.flatMap((e) => e.cards);
        ids.forEach((id) => {
          if (handledCardIds.has(id)) return;
          const card = allPileCards.find((c) => c.id === id);
          if (!card) return;
          handledCardIds.add(id);
          newHidden.add(id);
          const to = getCardPos(card.id) ?? getZonePos('pile');
          if (!to) return;
          const endTime = 800;
          if (endTime > playPhaseEndTime) playPhaseEndTime = endTime;
          newAnims.push({
            id: `dark-${entry.id}-${id}`,
            card,
            faceDown: true,
            from: { ...from, scale: 44 / 56 },
            to: { ...to, scale: 1 },
            duration: 800,
            flipDuringFlight: true,
          });
        });
      }

      // ── 2. Pickup → hand ────────────────────────────────────────────────
      if ((entry.type === 'pickUp' || entry.type === 'darkPlayFail') && entry.playerId) {
        const prevPileCards = prev.pile.flatMap((e) => e.cards);
        if (prevPileCards.length === 0) continue;

        const isBot = entry.playerId !== humanId;
        const from = getZonePos('pile');
        const to = getZonePos('hand', entry.playerId);
        if (!from || !to) continue;

        const cardsToAnimate = prevPileCards.slice(0, MAX_GHOST_CARDS);
        cardsToAnimate.forEach((card, i) => {
          if (handledCardIds.has(card.id)) return;
          handledCardIds.add(card.id);
          newHidden.add(card.id);
          newAnims.push({
            id: `pickup-${entry.id}-${card.id}`,
            card,
            faceDown: isBot,
            from: { ...from, scale: 1 },
            to: { ...to, scale: zoneScale('hand', isBot) },
            duration: 1000,
            delay: i * 80,
          });
        });
      }
    }

    // ── 3. Burn: pile → graveyard (compare graveyards) ──────────────────
    if (game.graveyard.length > prev.graveyard.length) {
      const prevGraveyardIds = new Set(prev.graveyard.map((c) => c.id));
      const newGraveyardCards = game.graveyard.filter((c) => !prevGraveyardIds.has(c.id));

      if (newGraveyardCards.length > 0) {
        const from = getZonePos('pile');
        const to = getZonePos('graveyard');
        if (from && to) {
          newGraveyardCards.slice(0, MAX_GHOST_CARDS).forEach((card, i) => {
            if (handledCardIds.has(card.id)) return;
            handledCardIds.add(card.id);
            newHidden.add(card.id);
            newAnims.push({
              id: `burn-${card.id}`,
              card,
              faceDown: false,
              from: { ...from, scale: 1 },
              to: { ...to, scale: 36 / 56 },
              duration: 800,
              delay: i * 40,
            });
          });
        }
      }
    }

    // ── 4. Draw: deck → hand (compare deck lengths + hand contents) ─────
    if (game.deck.length < prev.deck.length) {
      for (const player of game.players) {
        const prevPlayer = prev.players.find((p) => p.id === player.id);
        if (!prevPlayer) continue;

        const prevHandIds = new Set(prevPlayer.hand.map((c) => c.id));
        const prevPileIds = new Set(prev.pile.flatMap((e) => e.cards).map((c) => c.id));
        const drawnCards = player.hand.filter(
          (c) => !prevHandIds.has(c.id) && !prevPileIds.has(c.id) && !handledCardIds.has(c.id),
        );

        if (drawnCards.length === 0) continue;

        const isBot = player.id !== humanId;
        const from = getZonePos('deck');
        const to = getZonePos('hand', player.id);
        if (!from || !to) continue;

        drawnCards.forEach((card, i) => {
          handledCardIds.add(card.id);
          newHidden.add(card.id);
          newAnims.push({
            id: `draw-${card.id}`,
            card,
            faceDown: isBot,
            from: { ...from, scale: 44 / 56 },
            to: { ...to, scale: zoneScale('hand', isBot) },
            duration: 600,
            delay: playPhaseEndTime + i * 100,
          });
        });
      }
    }

    // ── Queue animations ────────────────────────────────────────────────
    if (newAnims.length > 0) {
      setAnimations((prev) => [...prev, ...newAnims]);
      setHiddenCardIds((prev) => {
        const next = new Set(prev);
        newHidden.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [game, humanId]);

  /** Called when a ghost card animation completes. */
  const onAnimationComplete = useCallback((animId: string) => {
    setAnimations((prev) => {
      const anim = prev.find((a) => a.id === animId);
      if (anim) {
        setHiddenCardIds((prevHidden) => {
          const next = new Set(prevHidden);
          next.delete(anim.card.id);
          return next;
        });
      }
      return prev.filter((a) => a.id !== animId);
    });
  }, []);

  const isAnimating = animations.length > 0;

  return { animations, hiddenCardIds, onAnimationComplete, isAnimating };
}
