import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Socket } from 'socket.io-client';
import type { GameVariant } from '@shit-head-palace/engine';
import { useAuth } from '../auth/authContext';
import { useTheme } from '../themes/ThemeContext';
import { VariantConfigModal } from './VariantConfigModal';
import { PowerSummary } from './PowerSummary';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';

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
  joinCode: string | null;
  variant: GameVariant;
  players: WaitingRoomPlayer[];
}

interface WaitingRoomScreenProps {
  socket: Socket;
  initialRoom: WaitingRoomData;
  onBackToLobby: () => void;
  onNavigate: (screen: 'lobby' | 'rules' | 'profile') => void;
}

// ─── WaitingRoomScreen ──────────────────────────────────────────────────────

export function WaitingRoomScreen({ socket, initialRoom, onBackToLobby, onNavigate }: WaitingRoomScreenProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const userId = user?.id ?? '';
  const [room, setRoom] = useState<WaitingRoomData>(initialRoom);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [codeCopied, setCodeCopied] = useState(false);

  const isCreator = room.creatorId === userId;
  const canStart = isCreator && room.players.length >= 2;
  const roomFull = room.players.length >= room.maxPlayers;

  const handleCopyCode = () => {
    if (!room.joinCode) return;
    navigator.clipboard.writeText(room.joinCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

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

    socket.on('lobby:playerJoined', handlePlayerJoined);
    socket.on('lobby:playerLeft', handlePlayerLeft);
    socket.on('lobby:playerReady', handlePlayerReady);
    socket.on('lobby:variantUpdated', handleVariantUpdated);

    return () => {
      socket.off('lobby:playerJoined', handlePlayerJoined);
      socket.off('lobby:playerLeft', handlePlayerLeft);
      socket.off('lobby:playerReady', handlePlayerReady);
      socket.off('lobby:variantUpdated', handleVariantUpdated);
    };
  }, [socket]);

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

  // Full-page variant config (early return)
  if (showVariantModal) {
    return (
      <VariantConfigModal
        onConfirm={handleUpdateVariant}
        onCancel={() => setShowVariantModal(false)}
      />
    );
  }

  const handleAddBot = () => {
    socket.emit('lobby:addBot', { difficulty: botDifficulty });
  };

  const handleRemoveBot = (botId: string) => {
    socket.emit('lobby:removeBot', { botId });
  };

  return (
    <div className="h-screen flex flex-col bg-casino-room">
      {/* Header */}
      <SiteHeader currentScreen="lobby" onNavigate={(screen) => { handleLeave(); onNavigate(screen); }} inWaitingRoom />

      {/* Table surface */}
      <div
        className="flex-1 min-h-0 relative flex flex-col overflow-hidden
          rounded-xl sm:rounded-[2rem] md:rounded-[2.5rem]
          mx-1 my-1 sm:mx-2 sm:my-1.5 md:mx-3 md:my-2
          border-4 sm:border-[5px] md:border-[6px] border-[#333333]
          shadow-[inset_0_0_40px_rgba(0,0,0,0.4),0_4px_16px_rgba(0,0,0,0.7)] md:shadow-[inset_0_0_80px_rgba(0,0,0,0.4),0_8px_32px_rgba(0,0,0,0.7)]"
        style={{
          backgroundImage: `url(${theme.bgImage})`,
          backgroundRepeat: 'repeat',
          backgroundPosition: '0 0',
          backgroundSize: '512px 512px',
          backgroundColor: theme.bgColor,
        }}
      >
        {/* Bordure dorée intérieure */}
        <div className="absolute inset-0 rounded-lg sm:rounded-[1.5rem] md:rounded-[2rem] border border-gold/30 pointer-events-none" />
        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none z-[1]"
          style={{ background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.9) 100%)' }}
        />

        {/* Content */}
        <main className="relative z-[2] flex-1 flex flex-col items-center px-4 overflow-y-auto min-h-0">
        <div className="w-full max-w-xl flex-1 flex flex-col items-center justify-evenly py-2">
        {/* Page title */}
        <h1 className="font-serif text-3xl text-[#c9a84c] text-center">Salle d'attente</h1>
        <div className="flex items-center gap-2">
          <span className="text-gray-300 text-sm">{room.name}</span>
          {!room.isPublic && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700/40 font-mono">
              Privée
            </span>
          )}
          <span className="text-gray-500 text-sm">—</span>
          <span className="text-gray-400 text-sm font-mono">
            {room.players.length}/{room.maxPlayers} joueurs
          </span>
        </div>

        {/* Players */}
        <div className="w-full">
          <h2 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-1.5">
            Joueurs
          </h2>
          <div className="space-y-1.5">
            {room.players.map((player) => (
              <motion.div
                key={player.userId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2 border border-gold/10 shadow-[inset_0_0_20px_rgba(0,0,0,0.3)] flex items-center gap-2"
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors ${
                    player.ready ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]' : 'bg-gray-600'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-100 text-xs font-semibold truncate">
                    {player.username}
                    {player.userId === room.creatorId && (
                      <span className="ml-1.5 text-[#c9a84c] text-[10px] font-normal">Hote</span>
                    )}
                    {player.isBot && (
                      <span className="ml-1.5 text-[10px] font-mono px-1 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/40">
                        BOT
                      </span>
                    )}
                  </p>
                  <p className="text-gray-500 text-[10px]">
                    {player.isBot ? 'Pret' : player.ready ? 'Pret' : 'En attente...'}
                  </p>
                </div>
                {isCreator && player.userId !== userId && (
                  <button
                    onClick={() => player.isBot ? handleRemoveBot(player.userId) : handleKick(player.userId)}
                    className="text-red-400/60 hover:text-red-400 text-[10px] transition-colors px-1.5 py-0.5"
                    title={player.isBot ? 'Retirer' : 'Exclure'}
                  >
                    {player.isBot ? 'Retirer' : 'Exclure'}
                  </button>
                )}
              </motion.div>
            ))}

            {Array.from({ length: room.maxPlayers - room.players.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="bg-black/20 rounded-lg px-3 py-2 border border-gray-700/30 border-dashed flex items-center gap-2"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-gray-800" />
                <p className="text-gray-600 text-xs italic">En attente...</p>
              </div>
            ))}
          </div>

          {/* Add bot */}
          {isCreator && !roomFull && (
            <div className="flex items-center gap-2 mt-2">
              <select
                value={botDifficulty}
                onChange={(e) => setBotDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                className="bg-gray-800 text-gray-200 text-[10px] rounded px-1.5 py-1 border border-gray-600 focus:outline-none focus:border-[#c9a84c]"
              >
                <option value="easy">Facile</option>
                <option value="medium">Moyen</option>
                <option value="hard">Expert</option>
              </select>
              <button
                onClick={handleAddBot}
                className="px-3 py-1 rounded-full font-semibold text-xs shadow transition-colors bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600"
              >
                + Bot
              </button>
            </div>
          )}
        </div>

        {/* Configuration */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-gray-300 text-xs font-semibold uppercase tracking-wider">
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
          <div className="bg-black/40 backdrop-blur-sm rounded-lg p-3 border border-gold/10 shadow-[inset_0_0_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-3 mb-2 text-xs">
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

        {/* Invite code */}
        {room.joinCode && (
          <div className="w-full">
            <h2 className="text-gray-300 text-xs font-semibold mb-1.5 uppercase tracking-wider">
              Code d'invitation
            </h2>
            <div className="bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2 border border-gold/10 shadow-[inset_0_0_20px_rgba(0,0,0,0.3)] flex items-center gap-2">
              <span className="font-mono text-base text-[#c9a84c] tracking-[0.3em] font-bold select-all">
                {room.joinCode}
              </span>
              <div className="flex-1" />
              <button
                onClick={handleCopyCode}
                className="px-3 py-1 rounded-full font-semibold text-xs shadow transition-colors bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600"
              >
                {codeCopied ? 'Copie !' : 'Copier'}
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="w-full flex flex-col gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={toggleReady}
            className={`w-full py-2 rounded-full font-semibold text-sm shadow transition-colors ${
              isReady
                ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600'
            }`}
          >
            {isReady ? 'Pret !' : 'Se marquer pret'}
          </motion.button>

          {isCreator && (
            <motion.button
              whileHover={canStart ? { scale: 1.02 } : undefined}
              whileTap={canStart ? { scale: 0.98 } : undefined}
              onClick={handleStart}
              disabled={!canStart}
              className={`w-full py-2 rounded-full font-semibold text-sm shadow transition-colors ${
                canStart
                  ? 'bg-[#c9a84c] hover:bg-[#d4b85c] text-gray-900'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              {room.players.length < 2 ? 'En attente de joueurs...' : 'Lancer la partie'}
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLeave}
            className="w-full py-2 rounded-full font-semibold text-sm shadow transition-colors bg-red-800 hover:bg-red-700 text-white"
          >
            Quitter la salle
          </motion.button>
        </div>
        </div>
      </main>
      </div>

      <SiteFooter />
    </div>
  );
}
