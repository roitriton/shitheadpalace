import type { GameState } from '../../types';
import { advanceTurn, resolveAutoSkip } from '../turn';
import { appendLog } from '../../utils/log';

/**
 * Applies a Manouche exchange:
 *   - Launcher takes `takeCardId` from the target's hand.
 *   - Launcher gives all `giveCardIds` (from launcher's hand, all of the same
 *     rank between themselves — not necessarily matching the taken card) back
 *     to the target.
 *
 * Turn passes to the next active player after the exchange.
 *
 * @param state       - Current game state; must have pendingAction.type === 'manouche'.
 * @param playerId    - ID of the acting player (must be the launcher).
 * @param takeCardId  - ID of the card to take from the target's hand.
 * @param giveCardIds - IDs of cards (from launcher's hand) to give to the target.
 *                      All must share the same rank between themselves.
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
  const { launcherId, targetId } = state.pendingAction;
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

  // Validate takeCardId is in target's hand
  const takeCard = target.hand.find((c) => c.id === takeCardId);
  if (!takeCard) throw new Error(`Card '${takeCardId}' not found in target's hand`);

  // Validate giveCardIds are all in launcher's hand
  const giveCards = giveCardIds.map((id) => {
    const found = launcher.hand.find((c) => c.id === id);
    if (!found) throw new Error(`Card '${id}' not found in launcher's hand`);
    return found;
  });

  // Validate all given cards share the same rank between themselves
  const giveRank = giveCards[0]!.rank;
  for (const c of giveCards) {
    if (c.rank !== giveRank) {
      throw new Error(
        `All given cards must share the same rank, but '${c.id}' has rank '${c.rank}' while others have '${giveRank}'`,
      );
    }
  }

  // ── Perform exchange ────────────────────────────────────────────────────────
  const giveCardIdSet = new Set(giveCardIds);
  const newLauncherHand = [...launcher.hand.filter((c) => !giveCardIdSet.has(c.id)), takeCard];
  const newTargetHand = [...target.hand.filter((c) => c.id !== takeCardId), ...giveCards];

  const newPlayers = [...state.players];
  newPlayers[launcherIdx] = { ...launcher, hand: newLauncherHand };
  newPlayers[targetIdx] = { ...target, hand: newTargetHand };

  let newState: GameState = {
    ...state,
    players: newPlayers,
    pendingAction: null,
  };

  newState = appendLog(newState, 'manouchePick', timestamp, launcherId, launcher.name, {
    takeCardId,
    giveCardIds,
    targetId,
  });

  return resolveAutoSkip(advanceTurn(newState, false));
}

/**
 * Applies a Super Manouche exchange:
 *   - Launcher gives `giveCardIds` (from launcher's hand) to the target.
 *   - Launcher takes `takeCardIds` (from target's hand).
 *   - The count of given and taken cards must be equal (same total on each side).
 *
 * The exchange is free — no rank constraint applies.
 * Turn passes to the next active player after the exchange.
 *
 * @param state       - Current game state; must have pendingAction.type === 'superManouche'.
 * @param playerId    - ID of the acting player (must be the launcher).
 * @param giveCardIds - IDs of cards from launcher's hand to give to target.
 * @param takeCardIds - IDs of cards from target's hand to take.
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
  const { launcherId, targetId } = state.pendingAction;
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

  // Validate giveCardIds are all in launcher's hand
  const giveCards = giveCardIds.map((id) => {
    const found = launcher.hand.find((c) => c.id === id);
    if (!found) throw new Error(`Card '${id}' not found in launcher's hand`);
    return found;
  });

  // Validate takeCardIds are all in target's hand
  const takeCards = takeCardIds.map((id) => {
    const found = target.hand.find((c) => c.id === id);
    if (!found) throw new Error(`Card '${id}' not found in target's hand`);
    return found;
  });

  // ── Perform exchange ────────────────────────────────────────────────────────
  const giveCardIdSet = new Set(giveCardIds);
  const takeCardIdSet = new Set(takeCardIds);

  const newLauncherHand = [
    ...launcher.hand.filter((c) => !giveCardIdSet.has(c.id)),
    ...takeCards,
  ];
  const newTargetHand = [
    ...target.hand.filter((c) => !takeCardIdSet.has(c.id)),
    ...giveCards,
  ];

  const newPlayers = [...state.players];
  newPlayers[launcherIdx] = { ...launcher, hand: newLauncherHand };
  newPlayers[targetIdx] = { ...target, hand: newTargetHand };

  let newState: GameState = {
    ...state,
    players: newPlayers,
    pendingAction: null,
  };

  newState = appendLog(newState, 'superManouchePick', timestamp, launcherId, launcher.name, {
    giveCardIds,
    takeCardIds,
    targetId,
  });

  return resolveAutoSkip(advanceTurn(newState, false));
}
