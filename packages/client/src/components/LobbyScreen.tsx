import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Socket } from 'socket.io-client';
import type { GameVariant } from '@shit-head-palace/engine';
import { useAuth } from '../auth/authContext';
import { useTheme } from '../themes/ThemeContext';
import { THEMES } from '../themes/themeConfig';
import type { Theme } from '../themes/themeConfig';
import { VariantConfigModal } from './VariantConfigModal';

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
}

// ─── ThemeSelector (extracted from TopBar pattern) ──────────────────────────

function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 border border-gray-600 text-xs text-gray-200 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-gray-400">Theme</span>
        <span className="text-[#c9a84c] font-semibold">{theme.label}</span>
        <svg className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 bg-gray-800 border border-gray-600 rounded shadow-xl z-[60] min-w-[120px]">
          {THEMES.map((t: Theme) => (
            <button
              key={t.id}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                t.id === theme.id ? 'text-[#c9a84c] font-semibold' : 'text-gray-300'
              }`}
              onClick={() => { setTheme(t); setOpen(false); }}
            >
              <img src={t.bgImage} alt={t.label} className="w-5 h-5 rounded object-cover" />
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
            className="flex-1 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={() => {
              if (!roomName.trim()) return;
              setStep('variant');
            }}
            disabled={!roomName.trim()}
            className="flex-1 py-2 rounded bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Suivant
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── LobbyScreen ────────────────────────────────────────────────────────────

export function LobbyScreen({ socket, onSoloStart, onRoomCreated, onRoomJoined }: LobbyScreenProps) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSoloConfig, setShowSoloConfig] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinCodeError, setJoinCodeError] = useState('');

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
        <h1 className="font-serif text-[#c9a84c] text-lg sm:text-xl font-bold tracking-wide">
          Shit Head Palace
        </h1>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <ThemeSelector />
          {user && (
            <>
              <span className="text-gray-300 text-xs truncate max-w-[120px]">{user.username}</span>
              <button
                onClick={logout}
                className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
              >
                Quitter
              </button>
            </>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 py-8 overflow-y-auto">
        {/* Action buttons */}
        <div className="flex gap-3 mb-8">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 rounded-full bg-green-600 hover:bg-green-500 text-white font-semibold shadow-lg transition-colors"
          >
            Creer une partie
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowSoloConfig(true)}
            className="px-6 py-3 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold shadow-lg transition-colors border border-gray-500"
          >
            Partie solo
          </motion.button>
        </div>

        {/* Join by code */}
        <div className="w-full max-w-lg mb-6">
          <div className="bg-gray-900/60 backdrop-blur rounded-lg p-4 border border-gray-700/50">
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
                className="flex-1 px-3 py-2 rounded bg-gray-800 border border-gray-600 text-gray-100 text-sm font-mono tracking-widest focus:border-[#c9a84c] focus:outline-none transition-colors uppercase"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleJoinByCode}
                disabled={joinCode.trim().length !== 6}
                className="px-4 py-2 rounded bg-[#c9a84c] hover:bg-[#d4b85c] text-gray-900 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
            <div className="bg-gray-900/60 backdrop-blur rounded-lg p-8 text-center border border-gray-700/50">
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
                  className="bg-gray-900/70 backdrop-blur rounded-lg p-4 border border-gray-700/50 flex items-center gap-4"
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
                    className="px-4 py-1.5 rounded bg-[#c9a84c] hover:bg-[#d4b85c] text-gray-900 text-sm font-semibold transition-colors"
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
