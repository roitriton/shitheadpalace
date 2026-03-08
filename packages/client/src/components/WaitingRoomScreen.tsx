import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Socket } from 'socket.io-client';
import type { GameVariant } from '@shit-head-palace/engine';
import { useAuth } from '../auth/authContext';
import { useTheme } from '../themes/ThemeContext';
import { VariantConfigModal } from './VariantConfigModal';
import { PowerSummary } from './PowerSummary';

// ─── Types ──────────────────────────────────────────────────────────────────

interface WaitingRoomPlayer {
  userId: string;
  username: string;
  ready: boolean;
  isBot?: boolean;
  botDifficulty?: 'easy' | 'medium' | 'hard';
}

export interface WaitingRoomData {
  id: string;
  name: string;
  status: string;
  playerCount: number;
  maxPlayers: number;
  variantName: string;
  creatorId: string;
  isPublic: boolean;
  variant: GameVariant;
  players: WaitingRoomPlayer[];
}

interface WaitingRoomScreenProps {
  socket: Socket;
  initialRoom: WaitingRoomData;
  onBackToLobby: () => void;
}

// ─── WaitingRoomScreen ──────────────────────────────────────────────────────

export function WaitingRoomScreen({ socket, initialRoom, onBackToLobby }: WaitingRoomScreenProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const userId = user?.id ?? '';
  const [room, setRoom] = useState<WaitingRoomData>(initialRoom);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');

  const isCreator = room.creatorId === userId;
  const canStart = isCreator && room.players.length >= 2;
  const roomFull = room.players.length >= room.maxPlayers;

  useEffect(() => {
    const handlePlayerJoined = (data: { room: WaitingRoomData }) => {
      setRoom(data.room);
    };
    const handlePlayerLeft = (data: { room: WaitingRoomData }) => {
      setRoom(data.room);
    };
    const handlePlayerReady = (data: { room: WaitingRoomData }) => {
      setRoom(data.room);
    };
    const handleVariantUpdated = (data: { room: WaitingRoomData }) => {
      setRoom(data.room);
      // Variant change resets ready status
      setIsReady(false);
    };
    const handleKicked = () => {
      onBackToLobby();
    };
    const handleRoomClosed = () => {
      onBackToLobby();
    };

    socket.on('lobby:playerJoined', handlePlayerJoined);
    socket.on('lobby:playerLeft', handlePlayerLeft);
    socket.on('lobby:playerReady', handlePlayerReady);
    socket.on('lobby:variantUpdated', handleVariantUpdated);
    socket.on('lobby:kicked', handleKicked);
    socket.on('lobby:roomClosed', handleRoomClosed);

    return () => {
      socket.off('lobby:playerJoined', handlePlayerJoined);
      socket.off('lobby:playerLeft', handlePlayerLeft);
      socket.off('lobby:playerReady', handlePlayerReady);
      socket.off('lobby:variantUpdated', handleVariantUpdated);
      socket.off('lobby:kicked', handleKicked);
      socket.off('lobby:roomClosed', handleRoomClosed);
    };
  }, [socket, onBackToLobby]);

  const toggleReady = () => {
    const newReady = !isReady;
    setIsReady(newReady);
    socket.emit('lobby:ready', { ready: newReady });
  };

  const handleStart = () => {
    socket.emit('lobby:start');
  };

  const handleKick = (targetUserId: string) => {
    socket.emit('lobby:kick', { userId: targetUserId });
  };

  const handleLeave = () => {
    socket.emit('lobby:leave');
    onBackToLobby();
  };

  const handleUpdateVariant = (variant: GameVariant) => {
    socket.emit('lobby:updateVariant', { variant });
    setShowVariantModal(false);
  };

  const handleAddBot = () => {
    socket.emit('lobby:addBot', { difficulty: botDifficulty });
  };

  const handleRemoveBot = (botId: string) => {
    socket.emit('lobby:removeBot', { botId });
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundImage: `url(${theme.bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: theme.bgColor,
      }}
    >
      {/* Vignette overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      {/* Header */}
      <header className="relative z-10 bg-gray-900/90 backdrop-blur border-b border-[#c9a84c]/20 px-4 py-3 flex items-center">
        <h1 className="font-serif text-[#c9a84c] text-lg sm:text-xl font-bold tracking-wide truncate">
          {room.name}
        </h1>
        <div className="flex-1" />
        <span className="text-gray-400 text-xs font-mono">
          {room.players.length}/{room.maxPlayers} joueurs
        </span>
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 py-6 overflow-y-auto gap-6">
        {/* Player list */}
        <div className="w-full max-w-md">
          <h2 className="text-gray-300 text-sm font-semibold mb-3 uppercase tracking-wider">
            Joueurs
          </h2>
          <div className="space-y-2">
            {room.players.map((player) => (
              <motion.div
                key={player.userId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-gray-900/70 backdrop-blur rounded-lg px-4 py-3 border border-gray-700/50 flex items-center gap-3"
              >
                {/* Ready indicator */}
                <div
                  className={`w-3 h-3 rounded-full flex-shrink-0 transition-colors ${
                    player.ready ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]' : 'bg-gray-600'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-100 text-sm font-semibold truncate">
                    {player.username}
                    {player.userId === room.creatorId && (
                      <span className="ml-2 text-[#c9a84c] text-xs font-normal">Hote</span>
                    )}
                    {player.isBot && (
                      <span className="ml-2 text-xs font-mono px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/40">
                        BOT
                      </span>
                    )}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {player.isBot ? 'Pret' : player.ready ? 'Pret' : 'En attente...'}
                  </p>
                </div>
                {/* Kick / Remove bot button (creator only, can't kick self) */}
                {isCreator && player.userId !== userId && (
                  <button
                    onClick={() => player.isBot ? handleRemoveBot(player.userId) : handleKick(player.userId)}
                    className="text-red-400/60 hover:text-red-400 text-xs transition-colors px-2 py-1"
                    title={player.isBot ? 'Retirer' : 'Exclure'}
                  >
                    {player.isBot ? 'Retirer' : 'Exclure'}
                  </button>
                )}
              </motion.div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: room.maxPlayers - room.players.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="bg-gray-900/30 rounded-lg px-4 py-3 border border-gray-700/30 border-dashed flex items-center gap-3"
              >
                <div className="w-3 h-3 rounded-full bg-gray-800" />
                <p className="text-gray-600 text-sm italic">En attente d'un joueur...</p>
              </div>
            ))}
          </div>

          {/* Add bot (creator only, room not full) */}
          {isCreator && !roomFull && (
            <div className="mt-3 flex items-center gap-2">
              <select
                value={botDifficulty}
                onChange={(e) => setBotDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                className="bg-gray-800 text-gray-200 text-xs rounded px-2 py-1.5 border border-gray-600 focus:outline-none focus:border-[#c9a84c]"
              >
                <option value="easy">Facile</option>
                <option value="medium">Moyen</option>
                <option value="hard">Expert</option>
              </select>
              <button
                onClick={handleAddBot}
                className="bg-blue-900/60 hover:bg-blue-800/70 text-blue-200 text-xs font-semibold px-3 py-1.5 rounded border border-blue-700/40 transition-colors"
              >
                + Ajouter un bot
              </button>
            </div>
          )}
        </div>

        {/* Variant info */}
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-gray-300 text-sm font-semibold uppercase tracking-wider">
              Configuration
            </h2>
            {isCreator && (
              <button
                onClick={() => setShowVariantModal(true)}
                className="text-[#c9a84c] hover:text-[#d4b85c] text-xs transition-colors"
              >
                Modifier
              </button>
            )}
          </div>
          <div className="bg-gray-900/70 backdrop-blur rounded-lg p-4 border border-gray-700/50">
            <div className="flex items-center gap-4 mb-3 text-sm">
              <div>
                <span className="text-gray-500">Variante : </span>
                <span className="text-gray-200 font-semibold">{room.variant.name}</span>
              </div>
              <div>
                <span className="text-gray-500">Joueurs : </span>
                <span className="text-gray-200">{room.variant.playerCount}</span>
              </div>
              <div>
                <span className="text-gray-500">Decks : </span>
                <span className="text-gray-200">{room.variant.deckCount}</span>
              </div>
            </div>
            <PowerSummary variant={room.variant} />
          </div>
        </div>

        {/* Action buttons */}
        <div className="w-full max-w-md flex flex-col gap-3 mt-2">
          {/* Ready toggle */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={toggleReady}
            className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors ${
              isReady
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-500'
            }`}
          >
            {isReady ? 'Pret !' : 'Se marquer pret'}
          </motion.button>

          {/* Start game (creator only) */}
          {isCreator && (
            <motion.button
              whileHover={canStart ? { scale: 1.02 } : undefined}
              whileTap={canStart ? { scale: 0.98 } : undefined}
              onClick={handleStart}
              disabled={!canStart}
              className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors ${
                canStart
                  ? 'bg-[#c9a84c] hover:bg-[#d4b85c] text-gray-900'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              {room.players.length < 2
                ? 'En attente de joueurs...'
                : 'Lancer la partie'}
            </motion.button>
          )}

          {/* Leave room */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLeave}
            className="w-full py-2.5 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-red-300 text-sm transition-colors border border-red-800/30"
          >
            Quitter la salle
          </motion.button>
        </div>
      </main>

      {/* Variant config modal */}
      <AnimatePresence>
        {showVariantModal && (
          <VariantConfigModal
            onConfirm={handleUpdateVariant}
            onCancel={() => setShowVariantModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
