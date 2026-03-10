import type { Card, ExchangeLayer, GameState, Player } from '../../types';
import { advanceTurn, resolveAutoSkip, autoDraw } from '../turn';
import { appendLog } from '../../utils/log';

// ─── Exchange layer helpers ─────────────────────────────────────────────────

/**
 * Determines the highest common card zone between launcher and target.
 * Priority: hand > faceUp > faceDown.
 */
export function getExchangeLayer(launcher: Player, target: Player): ExchangeLayer {
  if (launcher.hand.length > 0 && target.hand.length > 0) return 'hand';
  if (launcher.faceUp.length > 0 && target.faceUp.length > 0) return 'faceUp';
  if (launcher.faceDown.length > 0 && target.faceDown.length > 0) return 'faceDown';
  throw new Error('No common exchange layer between launcher and target');
}

/** Returns the card array for the given layer. */
function getLayerCards(player: Player, layer: ExchangeLayer): Card[] {
  switch (layer) {
    case 'hand': return player.hand;
    case 'faceUp': return player.faceUp;
    case 'faceDown': return player.faceDown;
  }
}

/** Returns a new player with the given layer's cards replaced. */
function setLayerCards(player: Player, layer: ExchangeLayer, cards: Card[]): Player {
  switch (layer) {
    case 'hand': return { ...player, hand: cards };
    case 'faceUp': return { ...player, faceUp: cards };
    case 'faceDown': return { ...player, faceDown: cards };
  }
}

/** French label for exchange layer (for log messages). */
function layerLabel(layer: ExchangeLayer): string {
  switch (layer) {
    case 'hand': return 'main';
    case 'faceUp': return 'flop';
    case 'faceDown': return 'dark flop';
  }
}

// ─── applyManoucheTarget ────────────────────────────────────────────────────

/**
 * Sets the target for a Manouche or Super Manouche when the target was not
 * specified at play time (multi-jack context).
 *
 * @param state          - Current game state (pendingAction.type must be 'manouche'/'superManouche'
 *                         without targetId set).
 * @param playerId       - ID of the launcher submitting the target choice.
 * @param targetPlayerId - ID of the target player.
 * @param timestamp      - Wall-clock ms for log entries (default 0 for tests).
 */
export function applyManoucheTarget(
  state: GameState,
  playerId: string,
  targetPlayerId: string,
  timestamp = 0,
): GameState {
  const pending = state.pendingAction;
  if (pending?.type !== 'manouche' && pending?.type !== 'superManouche') {
    throw new Error('No pending manouche action');
  }
  if (pending.targetId !== undefined) {
    throw new Error('Manouche target has already been selected');
  }
  if (pending.launcherId !== playerId) {
    throw new Error('Only the Manouche launcher can select a target');
  }

  const targetIdx = state.players.findIndex((p) => p.id === targetPlayerId);
  if (targetIdx === -1) throw new Error(`Player '${targetPlayerId}' not found`);
  if (state.players[targetIdx]!.isFinished) {
    throw new Error(`Target player '${targetPlayerId}' is already finished`);
  }
  if (targetPlayerId === playerId) {
    throw new Error('Cannot target yourself with Manouche');
  }

  const launcher = state.players.find((p) => p.id === playerId)!;
  const target = state.players[targetIdx]!;
  const exchangeLayer = getExchangeLayer(launcher, target);
  const launcherName = launcher.name;

  let newState: GameState = {
    ...state,
    pendingAction: { ...pending, targetId: targetPlayerId, exchangeLayer },
  };

  newState = appendLog(newState, 'manoucheTarget', timestamp, playerId, launcherName, {
    targetPlayerId,
  });

  return newState;
}

/**
 * Skips the Manouche exchange — the launcher chooses not to exchange any cards.
 * The pending action is resolved, the jack still goes to the cemetery, and the
 * turn advances normally.
 *
 * @param state     - Current game state; must have pendingAction.type === 'manouche' with targetId set.
 * @param playerId  - ID of the acting player (must be the launcher).
 * @param timestamp - Wall-clock ms for log records (pass 0 in tests).
 */
export function applyManoucheSkip(
  state: GameState,
  playerId: string,
  timestamp = 0,
): GameState {
  if (state.pendingAction?.type !== 'manouche') {
    throw new Error('No pending manouche action');
  }
  const { launcherId, targetId } = state.pendingAction;
  if (!targetId) {
    throw new Error('Manouche target has not been selected yet');
  }
  if (playerId !== launcherId) {
    throw new Error('Only the Manouche launcher can skip the exchange');
  }

  const launcher = state.players.find((p) => p.id === launcherId);

  let newState: GameState = {
    ...state,
    pendingAction: null,
    pendingCardsPlayed: undefined,
  };

  newState = appendLog(newState, 'manouchePick', timestamp, launcherId, launcher?.name ?? launcherId, {
    targetId,
    message: `${launcher?.name ?? launcherId} renonce à l'échange Manouche`,
  }, 'effect');

  if (state.multiJackSequence) {
    return newState;
  }
  return resolveAutoSkip(advanceTurn(newState, false));
}

/**
 * Applies a Manouche exchange on the exchange layer stored in the pending action.
 *   - Launcher takes `takeCardId` from the target's layer.
 *   - Launcher gives all `giveCardIds` (from launcher's layer) to the target.
 *   - When exchangeLayer is 'hand' or 'faceUp', all given cards must share the same rank.
 *   - When exchangeLayer is 'faceDown', the rank constraint is relaxed (blind exchange).
 *
 * Turn passes to the next active player after the exchange.
 *
 * @param state       - Current game state; must have pendingAction.type === 'manouche'.
 * @param playerId    - ID of the acting player (must be the launcher).
 * @param takeCardId  - ID of the card to take from the target's layer.
 * @param giveCardIds - IDs of cards (from launcher's layer) to give to the target.
 * @param timestamp   - Wall-clock ms for log records (pass 0 in tests).
 */
export function applyManouchePick(
  state: GameState,
  playerId: string,
  takeCardId: string,
  giveCardIds: string[],
  timestamp = 0,
): GameState {
  // ── Guards ─────────────────────────────────────────────────────────────────
  if (state.pendingAction?.type !== 'manouche') {
    throw new Error('No pending manouche action');
  }
  const { launcherId, targetId, exchangeLayer: layer } = state.pendingAction;
  const exchangeLayer: ExchangeLayer = layer ?? 'hand';
  if (!targetId) {
    throw new Error('Manouche target has not been selected yet');
  }
  if (playerId !== launcherId) {
    throw new Error('Only the Manouche launcher can make this choice');
  }
  if (giveCardIds.length === 0) {
    throw new Error('Must give at least one card in Manouche');
  }

  const launcherIdx = state.players.findIndex((p) => p.id === launcherId);
  const targetIdx = state.players.findIndex((p) => p.id === targetId);
  if (launcherIdx === -1) throw new Error(`Launcher '${launcherId}' not found`);
  if (targetIdx === -1) throw new Error(`Target '${targetId}' not found`);

  const launcher = state.players[launcherIdx]!;
  const target = state.players[targetIdx]!;

  const launcherCards = getLayerCards(launcher, exchangeLayer);
  const targetCards = getLayerCards(target, exchangeLayer);

  // Validate takeCardId is in target's layer
  const takeCard = targetCards.find((c) => c.id === takeCardId);
  if (!takeCard) throw new Error(`Card '${takeCardId}' not found in target's ${layerLabel(exchangeLayer)}`);

  // Validate giveCardIds are all in launcher's layer
  const giveCards = giveCardIds.map((id) => {
    const found = launcherCards.find((c) => c.id === id);
    if (!found) throw new Error(`Card '${id}' not found in launcher's ${layerLabel(exchangeLayer)}`);
    return found;
  });

  // Validate all given cards share the same rank between themselves
  // (relaxed for faceDown — blind exchange, cards are hidden)
  if (exchangeLayer !== 'faceDown') {
    const giveRank = giveCards[0]!.rank;
    for (const c of giveCards) {
      if (c.rank !== giveRank) {
        throw new Error(
          `All given cards must share the same rank, but '${c.id}' has rank '${c.rank}' while others have '${giveRank}'`,
        );
      }
    }
  }

  // ── Perform exchange ────────────────────────────────────────────────────────
  const giveCardIdSet = new Set(giveCardIds);
  const newLauncherLayerCards = [...launcherCards.filter((c) => !giveCardIdSet.has(c.id)), takeCard];
  const newTargetLayerCards = [...targetCards.filter((c) => c.id !== takeCardId), ...giveCards];

  const newPlayers = [...state.players];
  newPlayers[launcherIdx] = setLayerCards(launcher, exchangeLayer, newLauncherLayerCards);
  newPlayers[targetIdx] = setLayerCards(target, exchangeLayer, newTargetLayerCards);

  let newState: GameState = {
    ...state,
    players: newPlayers,
    pendingAction: null,
    pendingCardsPlayed: undefined,
  };

  // ── Auto-draw after exchange (hand layer only, Phase 1) ───────────────────
  if (exchangeLayer === 'hand') {
    const targetHandSize = state.variant.minHandSize ?? 3;
    if (newState.deck.length > 0 && newState.players[launcherIdx]!.hand.length < targetHandSize) {
      const { player: drawn, deck: newDeck } = autoDraw(
        newState.players[launcherIdx]!, newState.deck, targetHandSize,
      );
      const updPlayers = [...newState.players];
      updPlayers[launcherIdx] = drawn;
      newState = { ...newState, players: updPlayers, deck: newDeck };
    }
  }

  newState = appendLog(newState, 'manouchePick', timestamp, launcherId, launcher.name, {
    takeCardId,
    giveCardIds,
    targetId,
    exchangeLayer,
    message: `${launcher.name} vole une carte ${exchangeLayer !== 'hand' ? `(${layerLabel(exchangeLayer)}) ` : ''}à ${target.name}`,
  }, 'effect');

  if (state.multiJackSequence) {
    return newState; // Server calls continueMultiJackSequence after animation delay
  }
  return resolveAutoSkip(advanceTurn(newState, false));
}

/**
 * Applies a Super Manouche exchange on the exchange layer stored in the pending action.
 *   - Launcher gives `giveCardIds` (from launcher's layer) to the target.
 *   - Launcher takes `takeCardIds` (from target's layer).
 *   - The count of given and taken cards must be equal (same total on each side).
 *
 * The exchange is free — no rank constraint applies.
 * Turn passes to the next active player after the exchange.
 *
 * @param state       - Current game state; must have pendingAction.type === 'superManouche'.
 * @param playerId    - ID of the acting player (must be the launcher).
 * @param giveCardIds - IDs of cards from launcher's layer to give to target.
 * @param takeCardIds - IDs of cards from target's layer to take.
 * @param timestamp   - Wall-clock ms for log records (pass 0 in tests).
 */
export function applySuperManouchePick(
  state: GameState,
  playerId: string,
  giveCardIds: string[],
  takeCardIds: string[],
  timestamp = 0,
): GameState {
  // ── Guards ─────────────────────────────────────────────────────────────────
  if (state.pendingAction?.type !== 'superManouche') {
    throw new Error('No pending superManouche action');
  }
  const { launcherId, targetId, exchangeLayer: layer } = state.pendingAction;
  const exchangeLayer: ExchangeLayer = layer ?? 'hand';
  if (!targetId) {
    throw new Error('Super Manouche target has not been selected yet');
  }
  if (playerId !== launcherId) {
    throw new Error('Only the Super Manouche launcher can make this choice');
  }
  if (giveCardIds.length === 0) {
    throw new Error('Must exchange at least one card in Super Manouche');
  }
  if (giveCardIds.length !== takeCardIds.length) {
    throw new Error(
      `Super Manouche requires equal card counts: giving ${giveCardIds.length}, taking ${takeCardIds.length}`,
    );
  }

  const launcherIdx = state.players.findIndex((p) => p.id === launcherId);
  const targetIdx = state.players.findIndex((p) => p.id === targetId);
  if (launcherIdx === -1) throw new Error(`Launcher '${launcherId}' not found`);
  if (targetIdx === -1) throw new Error(`Target '${targetId}' not found`);

  const launcher = state.players[launcherIdx]!;
  const target = state.players[targetIdx]!;

  const launcherCards = getLayerCards(launcher, exchangeLayer);
  const targetCards = getLayerCards(target, exchangeLayer);

  // Validate giveCardIds are all in launcher's layer
  const giveCards = giveCardIds.map((id) => {
    const found = launcherCards.find((c) => c.id === id);
    if (!found) throw new Error(`Card '${id}' not found in launcher's ${layerLabel(exchangeLayer)}`);
    return found;
  });

  // Validate takeCardIds are all in target's layer
  const takeCards = takeCardIds.map((id) => {
    const found = targetCards.find((c) => c.id === id);
    if (!found) throw new Error(`Card '${id}' not found in target's ${layerLabel(exchangeLayer)}`);
    return found;
  });

  // ── Perform exchange ────────────────────────────────────────────────────────
  const giveCardIdSet = new Set(giveCardIds);
  const takeCardIdSet = new Set(takeCardIds);

  const newLauncherLayerCards = [
    ...launcherCards.filter((c) => !giveCardIdSet.has(c.id)),
    ...takeCards,
  ];
  const newTargetLayerCards = [
    ...targetCards.filter((c) => !takeCardIdSet.has(c.id)),
    ...giveCards,
  ];

  const newPlayers = [...state.players];
  newPlayers[launcherIdx] = setLayerCards(launcher, exchangeLayer, newLauncherLayerCards);
  newPlayers[targetIdx] = setLayerCards(target, exchangeLayer, newTargetLayerCards);

  let newState: GameState = {
    ...state,
    players: newPlayers,
    pendingAction: null,
    pendingCardsPlayed: undefined,
  };

  // ── Auto-draw after exchange (hand layer only, Phase 1) ───────────────────
  if (exchangeLayer === 'hand') {
    const targetHandSize = state.variant.minHandSize ?? 3;
    if (newState.deck.length > 0 && newState.players[launcherIdx]!.hand.length < targetHandSize) {
      const { player: drawn, deck: newDeck } = autoDraw(
        newState.players[launcherIdx]!, newState.deck, targetHandSize,
      );
      const updPlayers = [...newState.players];
      updPlayers[launcherIdx] = drawn;
      newState = { ...newState, players: updPlayers, deck: newDeck };
    }
  }

  newState = appendLog(newState, 'superManouchePick', timestamp, launcherId, launcher.name, {
    giveCardIds,
    takeCardIds,
    targetId,
    exchangeLayer,
    message: `${launcher.name} échange des cartes ${exchangeLayer !== 'hand' ? `(${layerLabel(exchangeLayer)}) ` : ''}avec ${target.name}`,
  }, 'effect');

  if (state.multiJackSequence) {
    return newState; // Server calls continueMultiJackSequence after animation delay
  }
  return resolveAutoSkip(advanceTurn(newState, false));
}
