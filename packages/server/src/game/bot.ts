import {
  applyPlay,
  applyPickUpPile,
  applyFirstPlayerShifumiChoice,
  applyTargetChoice,
  applyManoucheTarget,
  applyManouchePick,
  applySuperManouchePick,
  applyFlopReverseTarget,
  applyFlopRemakeTarget,
  applyFlopRemake,
  applyShifumiTarget,
  applyShifumiChoice,
  applyMultiJackOrder,
  applyRevolutionConfirm,
  canPlayCards,
  getActiveZone,
  getZoneCards,
  matchesPowerRank,
  isManoucheCard,
} from '@shit-head-palace/engine';
import type { GameState, ShifumiChoice, PendingShifumi, MultiJackSequenceEntry } from '@shit-head-palace/engine';

// ─── Bot facile ────────────────────────────────────────────────────────────────

/**
 * Joue la première carte valide trouvée (non-Mirror seul), ou ramasse la pile.
 * Pour les cartes J♠ (Manouche) et Target, passe un targetPlayerId aléatoire.
 * Retourne le nouvel état après l'action du bot.
 */
export function botAct(state: GameState, botId: string): GameState {
  const botIdx = state.players.findIndex((p) => p.id === botId);
  const bot = state.players[botIdx]!;
  const zone = getActiveZone(bot);

  if (!zone) return applyPickUpPile(state, botId, Date.now());

  const cards = getZoneCards(bot, zone);
  const opponents = state.players.filter((p) => !p.isFinished && p.id !== botId);

  // Essaie chaque carte non-Mirror seule
  for (const card of cards) {
    if (matchesPowerRank(card.rank, state.variant, 'mirror')) continue;
    if (canPlayCards([card], state)) {
      try {
        if (isManoucheCard(card)) {
          // Manouche : choisir un adversaire avec des cartes en main
          const viableTargets = opponents.filter((opp) => opp.hand.length > 0);
          if (viableTargets.length === 0) continue;
          const target = viableTargets[Math.floor(Math.random() * viableTargets.length)]!;
          return applyPlay(state, botId, [card.id], Date.now(), target.id);
        }
        // Les autres cartes ne nécessitent pas de target pré-play
        return applyPlay(state, botId, [card.id], Date.now());
      } catch {
        continue;
      }
    }
  }

  return applyPickUpPile(state, botId, Date.now());
}

/**
 * Returns true when a bot can resolve the current pendingAction.
 */
export function canBotActOnPendingAction(state: GameState, botIds: string[]): boolean {
  const pending = state.pendingAction;
  if (!pending) return false;

  if (pending.type === 'firstPlayerShifumi') return true;
  if (pending.type === 'target') return botIds.includes(pending.launcherId);
  if (pending.type === 'manouche') return botIds.includes(pending.launcherId);
  if (pending.type === 'superManouche') return botIds.includes(pending.launcherId);
  if (pending.type === 'flopReverse') return botIds.includes(pending.launcherId);
  if (pending.type === 'flopRemake') {
    if (!pending.targetId) return botIds.includes(pending.launcherId);
    return botIds.includes(pending.targetId);
  }
  if (pending.type === 'shifumi' || pending.type === 'superShifumi') {
    const p = pending as PendingShifumi;
    if (!p.player1Id) return botIds.includes(p.initiatorId);
    if (p.player1Id && p.player1Choice === undefined && botIds.includes(p.player1Id)) return true;
    if (p.player2Id && p.player2Choice === undefined && botIds.includes(p.player2Id)) return true;
    return false;
  }

  if (pending.type === 'PendingMultiJackOrder') {
    return botIds.includes(pending.playerId);
  }

  if (pending.type === 'PendingRevolutionConfirm') {
    return botIds.includes(pending.playerId);
  }

  return false;
}

/**
 * Tries to auto-resolve the current pendingAction when a bot can act.
 * Returns the updated state if resolution was possible, or the same state
 * reference if a human must act.
 */
export function tryResolveBotPendingAction(state: GameState, botIds: string[]): GameState {
  const pending = state.pendingAction;
  if (!pending) return state;
  const now = Date.now();

  // ── Target: bot launcher picks who plays next
  if (pending.type === 'target') {
    if (!botIds.includes(pending.launcherId)) return state;
    const targets = state.players.filter((p) => !p.isFinished && p.id !== pending.launcherId);
    if (targets.length === 0) return state;
    const target = targets[Math.floor(Math.random() * targets.length)]!;
    return applyTargetChoice(state, pending.launcherId, target.id, now);
  }

  // ── Manouche: bot takes any card from target, gives lowest-rank card(s)
  if (pending.type === 'manouche') {
    if (!botIds.includes(pending.launcherId)) return state;
    // Multi-jack context: targetId may be undefined — select target first
    if (!pending.targetId) {
      const targets = state.players.filter((p) => !p.isFinished && p.id !== pending.launcherId && p.hand.length > 0);
      if (targets.length === 0) return state;
      const target = targets[Math.floor(Math.random() * targets.length)]!;
      return applyManoucheTarget(state, pending.launcherId, target.id, now);
    }
    const target = state.players.find((p) => p.id === pending.targetId);
    const bot = state.players.find((p) => p.id === pending.launcherId)!;
    if (!target || target.hand.length === 0 || bot.hand.length === 0) return state;
    const takeCard = target.hand[Math.floor(Math.random() * target.hand.length)]!;
    const giveCard = bot.hand[Math.floor(Math.random() * bot.hand.length)]!;
    return applyManouchePick(state, pending.launcherId, takeCard.id, [giveCard.id], now);
  }

  // ── Super Manouche: bot launcher picks random exchange
  if (pending.type === 'superManouche') {
    if (!botIds.includes(pending.launcherId)) return state;
    // Multi-jack context: targetId may be undefined — select target first
    if (!pending.targetId) {
      const targets = state.players.filter((p) => !p.isFinished && p.id !== pending.launcherId && p.hand.length > 0);
      if (targets.length === 0) return state;
      const target = targets[Math.floor(Math.random() * targets.length)]!;
      return applyManoucheTarget(state, pending.launcherId, target.id, now);
    }
    const target = state.players.find((p) => p.id === pending.targetId);
    const bot = state.players.find((p) => p.id === pending.launcherId)!;
    if (!target || target.hand.length === 0 || bot.hand.length === 0) return state;
    const takeCard = target.hand[Math.floor(Math.random() * target.hand.length)]!;
    const giveCard = bot.hand[Math.floor(Math.random() * bot.hand.length)]!;
    return applySuperManouchePick(state, pending.launcherId, [giveCard.id], [takeCard.id], now);
  }

  // ── Flop Reverse: bot launcher picks target
  if (pending.type === 'flopReverse') {
    if (!botIds.includes(pending.launcherId)) return state;
    const targets = state.players.filter((p) => !p.isFinished);
    if (targets.length === 0) return state;
    const target = targets[Math.floor(Math.random() * targets.length)]!;
    return applyFlopReverseTarget(state, pending.launcherId, target.id, now);
  }

  // ── Flop Remake: two-step
  if (pending.type === 'flopRemake') {
    if (!pending.targetId) {
      if (!botIds.includes(pending.launcherId)) return state;
      const targets = state.players.filter((p) => !p.isFinished);
      if (targets.length === 0) return state;
      const target = targets[Math.floor(Math.random() * targets.length)]!;
      return applyFlopRemakeTarget(state, pending.launcherId, target.id, now);
    }
    if (!botIds.includes(pending.targetId)) return state;
    const target = state.players.find((p) => p.id === pending.targetId)!;
    const allCards = [...target.faceUp, ...target.faceDown];
    const faceUpIds = allCards.slice(0, Math.min(3, allCards.length)).map((c) => c.id);
    const faceDownIds = allCards.slice(Math.min(3, allCards.length)).map((c) => c.id);
    return applyFlopRemake(state, pending.targetId, faceUpIds, faceDownIds, now);
  }

  // ── Shifumi / Super Shifumi: multi-step
  if (pending.type === 'shifumi' || pending.type === 'superShifumi') {
    const p = pending as PendingShifumi;
    if (!p.player1Id) {
      if (!botIds.includes(p.initiatorId)) return state;
      const activePlayers = state.players.filter((pl) => !pl.isFinished);
      if (activePlayers.length < 2) return state;
      const shuffled = [...activePlayers].sort(() => Math.random() - 0.5);
      return applyShifumiTarget(state, p.initiatorId, shuffled[0]!.id, shuffled[1]!.id, now);
    }
    const choices: ShifumiChoice[] = ['rock', 'paper', 'scissors'];
    if (p.player1Choice === undefined && botIds.includes(p.player1Id)) {
      return applyShifumiChoice(state, p.player1Id, choices[Math.floor(Math.random() * 3)]!, now);
    }
    if (p.player2Id && p.player2Choice === undefined && botIds.includes(p.player2Id)) {
      return applyShifumiChoice(state, p.player2Id, choices[Math.floor(Math.random() * 3)]!, now);
    }
    return state;
  }

  // ── PendingRevolutionConfirm: bot auto-confirms
  if (pending.type === 'PendingRevolutionConfirm') {
    if (!botIds.includes(pending.playerId)) return state;
    return applyRevolutionConfirm(state, pending.playerId, now);
  }

  // ── PendingMultiJackOrder: bot picks default order (as-is), mirror on first jack
  if (pending.type === 'PendingMultiJackOrder') {
    if (!botIds.includes(pending.playerId)) return state;
    const { jacks, mirrors } = pending;
    const sequence: MultiJackSequenceEntry[] = jacks.map((jack, i) => ({
      jackCard: jack,
      mirrorCard: i === 0 && mirrors.length > 0 ? mirrors[0] : undefined,
    }));
    return applyMultiJackOrder(state, pending.playerId, sequence, Date.now());
  }

  return state;
}

/**
 * Auto-résout le pendingAction firstPlayerShifumi avec des choix aléatoires.
 */
export function resolveFirstPlayerShifumi(state: GameState): GameState {
  let s = state;
  let safety = 0;
  while (s.pendingAction?.type === 'firstPlayerShifumi' && safety++ < 100) {
    const pending = s.pendingAction;
    const choices: ShifumiChoice[] = ['rock', 'paper', 'scissors'];
    const next = pending.playerIds.find((pid) => !pending.choices[pid]);
    if (!next) break;
    s = applyFirstPlayerShifumiChoice(
      s,
      next,
      choices[Math.floor(Math.random() * 3)]!,
      Date.now(),
    );
  }
  return s;
}

/**
 * Exécute le(s) tour(s) des bots en boucle (gère les replays après Burn,
 * les enchaînements entre bots, et auto-résout les pendingActions dont
 * un bot est le lanceur ou participant).
 * Returns the updated GameState.
 */
export function runBotTurns(state: GameState, botIds: string[], humanIds: string[]): GameState {
  let s = state;
  let safety = 0;

  while (safety++ < 50) {
    if (s.phase === 'finished') break;

    // Auto-résoudre shifumi de premier joueur si besoin
    if (s.pendingAction?.type === 'firstPlayerShifumi') {
      s = resolveFirstPlayerShifumi(s);
      continue;
    }

    // Auto-résoudre tout pendingAction qu'un bot peut résoudre
    if (s.pendingAction) {
      const prev = s;
      try {
        s = tryResolveBotPendingAction(s, botIds);
      } catch (err) {
        console.error('[bot] Error resolving pending action:', (err as Error).message);
        break;
      }
      if (s !== prev) continue;
      // Un humain doit agir — arrêt
      break;
    }

    const currentPlayer = s.players[s.currentPlayerIndex];
    if (!currentPlayer) break;
    if (humanIds.includes(currentPlayer.id)) break; // tour d'un humain
    if (!botIds.includes(currentPlayer.id)) break;

    try {
      s = botAct(s, currentPlayer.id);
    } catch (err) {
      console.error('[bot] Error in botAct:', (err as Error).message);
      try {
        s = applyPickUpPile(s, currentPlayer.id, Date.now());
      } catch {
        break;
      }
    }
  }

  if (safety >= 50) {
    console.warn('[bot] Safety counter reached in runBotTurns');
  }

  return s;
}

/**
 * Executes exactly ONE bot action (play, pending action resolution, etc.).
 * Returns the updated state, or the same reference if no bot can act.
 * Used by solo mode to insert a delay between each bot action.
 */
export function botActOnce(state: GameState, botIds: string[], humanIds: string[]): GameState {
  if (state.phase === 'finished') return state;

  // Auto-resolve firstPlayerShifumi immediately (no visual needed)
  if (state.pendingAction?.type === 'firstPlayerShifumi') {
    return resolveFirstPlayerShifumi(state);
  }

  // Auto-resolve one pending action if a bot can handle it
  if (state.pendingAction) {
    try {
      return tryResolveBotPendingAction(state, botIds);
    } catch (err) {
      console.error('[bot] Error resolving pending action:', (err as Error).message);
      return state;
    }
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) return state;
  if (humanIds.includes(currentPlayer.id)) return state;
  if (!botIds.includes(currentPlayer.id)) return state;

  try {
    return botAct(state, currentPlayer.id);
  } catch (err) {
    console.error('[bot] Error in botAct:', (err as Error).message);
    try {
      return applyPickUpPile(state, currentPlayer.id, Date.now());
    } catch {
      return state;
    }
  }
}
