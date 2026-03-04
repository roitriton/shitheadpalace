import type { GameState } from '../types';

/**
 * Appends a new LogEntry to state.log and returns the updated state.
 *
 * The entry's id is derived from its position in the log, the timestamp, and
 * the event type — giving deterministic ids in tests (where timestamp is 0).
 *
 * @param state      - Current game state.
 * @param type       - Event type string (e.g. 'play', 'pickUp', 'swap').
 * @param timestamp  - Wall-clock ms; pass 0 in tests for determinism.
 * @param playerId   - ID of the acting player, if applicable.
 * @param playerName - Display name of the acting player, if applicable.
 * @param data       - Arbitrary event payload (defaults to empty object).
 * @param entryType  - Entry category: 'action' (default), 'power', or 'effect'.
 */
export function appendLog(
  state: GameState,
  type: string,
  timestamp: number,
  playerId?: string,
  playerName?: string,
  data: Record<string, unknown> = {},
  entryType?: 'action' | 'power' | 'effect',
): GameState {
  const entry = {
    id: `${state.log.length}-${timestamp}-${type}`,
    timestamp,
    type,
    playerId,
    playerName,
    data,
    ...(entryType ? { entryType } : {}),
  };
  return { ...state, log: [...state.log, entry] };
}
