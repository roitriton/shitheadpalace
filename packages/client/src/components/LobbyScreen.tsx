import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Socket } from 'socket.io-client';
import type { GameVariant } from '@shit-head-palace/engine';
import { useTheme } from '../themes/ThemeContext';
import { VariantConfigModal } from './VariantConfigModal';
import { SiteHeader } from './SiteHeader';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RoomSummary {
  id: string;
  name: string;
  status: string;
  playerCount: number;
  maxPlayers: number;
  variantName: string;
  creatorId: string;
  isPublic: boolean;
  variant: GameVariant;
  players: { userId: string; username: string; ready: boolean }[];
}

interface LobbyScreenProps {
  socket: Socket;
  onSoloStart: (variant: GameVariant, playerCount: number) => void;
  onRoomCreated: (room: RoomSummary) => void;
  onRoomJoined: (room: RoomSummary) => void;
  notification?: string | null;
  onClearNotification?: () => void;
  onNavigate: (screen: 'lobby' | 'rules' | 'profile') => void;
}

// ─── CreateRoomModal ────────────────────────────────────────────────────────

function CreateRoomModal({
  onCreateRoom,
  onCancel,
}: {
  onCreateRoom: (name: string, isPublic: boolean, variant: GameVariant) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<'info' | 'variant'>('info');
  const [roomName, setRoomName] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  if (step === 'variant') {
    return (
      <VariantConfigModal
        onConfirm={(variant) => {
          onCreateRoom(roomName.trim(), isPublic, variant);
        }}
        onCancel={() => setStep('info')}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-800 border border-gray-600 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-xl text-[#c9a84c] mb-4">Creer une partie</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="roomName" className="block text-xs text-gray-400 mb-1">
              Nom de la room
            </label>
            <input
              id="roomName"
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              maxLength={50}
              placeholder="Ma partie..."
              className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-600 text-gray-100 text-sm focus:border-[#c9a84c] focus:outline-none transition-colors"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Partie publique</span>
            <button
              type="button"
              onClick={() => setIsPublic((v) => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors ${isPublic ? 'bg-[#c9a84c]' : 'bg-gray-600'}`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            </button>
          </div>
          {!isPublic && (
            <p className="text-xs text-gray-500">Les joueurs devront utiliser un code pour rejoindre.</p>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-full font-semibold text-sm shadow transition-colors bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600"
          >
            Annuler
          </button>
          <button
            onClick={() => {
              if (!roomName.trim()) return;
              setStep('variant');
            }}
            disabled={!roomName.trim()}
            className="flex-1 py-2 rounded-full font-semibold text-sm shadow transition-colors bg-[#c9a84c] hover:bg-[#d4b85c] text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Suivant
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── LobbyScreen ────────────────────────────────────────────────────────────

export function LobbyScreen({ socket, onSoloStart, onRoomCreated, onRoomJoined, notification, onClearNotification, onNavigate }: LobbyScreenProps) {
  const { theme } = useTheme();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSoloConfig, setShowSoloConfig] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinCodeError, setJoinCodeError] = useState('');

  // Auto-clear notification after 4 seconds
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      onClearNotification?.();
    }, 4000);
    return () => clearTimeout(timer);
  }, [notification, onClearNotification]);

  // Fetch rooms on mount + poll every 3s
  const fetchRooms = useCallback(() => {
    socket.emit('lobby:list');
  }, [socket]);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 3000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  useEffect(() => {
    const handleRooms = (roomList: RoomSummary[]) => {
      setRooms(roomList);
    };

    const handleRoomCreated = (data: { room: RoomSummary }) => {
      setShowCreateModal(false);
      onRoomCreated(data.room);
    };

    const handleRoomJoined = (data: { room: RoomSummary }) => {
      onRoomJoined(data.room);
    };

    const handleError = (data: { message: string }) => {
      setJoinCodeError(data.message);
    };

    socket.on('lobby:rooms', handleRooms);
    socket.on('lobby:roomCreated', handleRoomCreated);
    socket.on('lobby:joined', handleRoomJoined);
    socket.on('game:error', handleError);

    return () => {
      socket.off('lobby:rooms', handleRooms);
      socket.off('lobby:roomCreated', handleRoomCreated);
      socket.off('lobby:joined', handleRoomJoined);
      socket.off('game:error', handleError);
    };
  }, [socket, onRoomCreated, onRoomJoined]);

  const handleCreateRoom = (name: string, isPublic: boolean, variant: GameVariant) => {
    socket.emit('lobby:create', { name, isPublic, variant });
  };

  const handleJoinRoom = (roomId: string) => {
    socket.emit('lobby:join', { roomId });
  };

  const handleJoinByCode = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setJoinCodeError('Le code doit contenir 6 caractères');
      return;
    }
    setJoinCodeError('');
    socket.emit('lobby:joinByCode', { code });
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundImage: `url(${theme.bgImage})`,
        backgroundRepeat: 'repeat',
        backgroundPosition: '0 0',
        backgroundSize: '512px 512px',
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

      {/* Notification toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900/95 backdrop-blur border border-[#c9a84c]/40 text-gray-200 text-sm px-5 py-3 rounded-lg shadow-xl"
          >
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <SiteHeader currentScreen="lobby" onNavigate={onNavigate} />

      {/* Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 py-8 overflow-y-auto">
        {/* Action buttons */}
        <div className="flex gap-3 mb-8">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2 rounded-full font-semibold text-sm shadow transition-colors bg-[#c9a84c] hover:bg-[#d4b85c] text-gray-900"
          >
            Creer une partie
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowSoloConfig(true)}
            className="px-5 py-2 rounded-full font-semibold text-sm shadow transition-colors bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600"
          >
            Partie solo
          </motion.button>
        </div>

        {/* Join by code */}
        <div className="w-full max-w-lg mb-6">
          <div className="bg-black/40 backdrop-blur-sm rounded-xl p-4 border border-gold/10 shadow-[inset_0_0_20px_rgba(0,0,0,0.3)]">
            <label className="block text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">
              Rejoindre par code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value.toUpperCase().slice(0, 6)); setJoinCodeError(''); }}
                placeholder="Ex : A1B2C3"
                maxLength={6}
                className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-gray-100 text-sm font-mono tracking-widest focus:border-[#c9a84c] focus:outline-none transition-colors uppercase"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleJoinByCode}
                disabled={joinCode.trim().length !== 6}
                className="px-5 py-2 rounded-full font-semibold text-sm shadow transition-colors bg-[#c9a84c] hover:bg-[#d4b85c] text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Rejoindre
              </motion.button>
            </div>
            {joinCodeError && (
              <p className="text-red-400 text-xs mt-2">{joinCodeError}</p>
            )}
          </div>
        </div>

        {/* Room list */}
        <div className="w-full max-w-lg">
          <h2 className="text-gray-300 text-sm font-semibold mb-3 uppercase tracking-wider">
            Parties en attente
          </h2>

          {rooms.length === 0 ? (
            <div className="bg-black/40 backdrop-blur-sm rounded-xl p-8 text-center border border-gold/10 shadow-[inset_0_0_20px_rgba(0,0,0,0.3)]">
              <p className="text-gray-500 text-sm">Aucune partie en attente</p>
              <p className="text-gray-600 text-xs mt-1">Creez une partie ou attendez qu'un joueur en cree une</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rooms.map((room) => (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-black/40 backdrop-blur-sm rounded-xl p-4 border border-gold/10 shadow-[inset_0_0_20px_rgba(0,0,0,0.3)] flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-100 text-sm font-semibold truncate">{room.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {room.variantName} — par {room.players[0]?.username ?? '?'}
                    </p>
                  </div>
                  <div className="text-gray-400 text-sm font-mono whitespace-nowrap">
                    {room.playerCount}/{room.maxPlayers}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleJoinRoom(room.id)}
                    className="px-5 py-1.5 rounded-full font-semibold text-sm shadow transition-colors bg-[#c9a84c] hover:bg-[#d4b85c] text-gray-900"
                  >
                    Rejoindre
                  </motion.button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateRoomModal
            onCreateRoom={handleCreateRoom}
            onCancel={() => setShowCreateModal(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showSoloConfig && (
          <VariantConfigModal
            onConfirm={(variant, playerCount) => {
              setShowSoloConfig(false);
              onSoloStart(variant, playerCount);
            }}
            onCancel={() => setShowSoloConfig(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
