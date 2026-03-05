import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface BottomBarProps {
  onChatToggle: () => void;
  chatUnread: number;
  canPlay: boolean;
  canPickUp: boolean;
  selectedCount: number;
  onPlay: () => void;
  onPickUp: () => void;
  onClearSelection: () => void;
  onActionLogToggle: () => void;
  actionLogUnread: number;
  /** When true, the current card selection is a legal play */
  isSelectionLegal?: boolean;
  /** When true, an overlay animation is playing — disable action buttons */
  overlayActive?: boolean;
  /** When true, player is blocked on empty pile — show skip turn button */
  emptyPileBlocked?: boolean;
  /** Skip turn callback */
  onSkipTurn?: () => void;
}

export function BottomBar({
  onChatToggle,
  chatUnread,
  canPlay,
  canPickUp,
  selectedCount,
  onPlay,
  onPickUp,
  onClearSelection,
  onActionLogToggle,
  actionLogUnread,
  isSelectionLegal,
  overlayActive,
  emptyPileBlocked,
  onSkipTurn,
}: BottomBarProps) {
  const effectiveCanPlay = canPlay && !overlayActive && isSelectionLegal;
  const effectiveCanPickUp = canPickUp && !overlayActive;
  return (
    <div className="fixed bottom-0 left-0 right-0 h-14 z-50 bg-gray-900/95 backdrop-blur border-t border-[#c9a84c]/20 flex items-center px-3 sm:px-4">
      {/* Gauche : Chat */}
      <div className="flex-none">
        <button
          type="button"
          onClick={onChatToggle}
          className="relative w-10 h-10 rounded-full bg-gray-800 border border-[#c9a84c]/30 flex items-center justify-center hover:bg-gray-700 transition-colors"
        >
          <span className="text-lg" role="img" aria-label="Chat">💬</span>
          {chatUnread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {chatUnread > 99 ? '99+' : chatUnread}
            </span>
          )}
        </button>
      </div>

      {/* Centre : Actions */}
      <div className="flex-1 flex items-center justify-center gap-2">
        {emptyPileBlocked && onSkipTurn && !overlayActive ? (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onSkipTurn}
            className="px-3 sm:px-5 py-1.5 rounded-full font-semibold text-xs sm:text-sm shadow transition-colors bg-amber-400 text-gray-900 hover:bg-amber-300"
          >
            Passer son tour
          </motion.button>
        ) : (
          <>
            <motion.button
              whileHover={effectiveCanPlay ? { scale: 1.05 } : {}}
              whileTap={effectiveCanPlay ? { scale: 0.95 } : {}}
              onClick={onPlay}
              disabled={!effectiveCanPlay}
              className={`px-3 sm:px-5 py-1.5 rounded-full font-semibold text-xs sm:text-sm shadow transition-colors ${
                effectiveCanPlay
                  ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                  : 'bg-gray-600 text-gray-500 opacity-50 cursor-not-allowed'
              }`}
            >
              Jouer{selectedCount > 0 ? ` (${selectedCount})` : ''}
            </motion.button>

            <AnimatePresence>
              {selectedCount > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClearSelection}
                  className="px-2.5 py-1.5 rounded-full text-xs bg-gray-700 text-gray-300 hover:bg-gray-600"
                >
                  ✕
                </motion.button>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={effectiveCanPickUp ? { scale: 1.05 } : {}}
              whileTap={effectiveCanPickUp ? { scale: 0.95 } : {}}
              onClick={onPickUp}
              disabled={!effectiveCanPickUp}
              className={`px-3 sm:px-5 py-1.5 rounded-full font-semibold text-xs sm:text-sm shadow transition-colors ${
                effectiveCanPickUp
                  ? 'bg-red-800 text-white hover:bg-red-700'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              Ramasser
            </motion.button>
          </>
        )}
      </div>

      {/* Droite : Log */}
      <div className="flex-none">
        <button
          type="button"
          onClick={onActionLogToggle}
          className="relative w-10 h-10 rounded-full bg-gray-800 border border-[#c9a84c]/30 flex items-center justify-center hover:bg-gray-700 transition-colors"
        >
          <span className="text-[10px] font-mono font-bold text-gray-300">LOG</span>
          {actionLogUnread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {actionLogUnread > 99 ? '99+' : actionLogUnread}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
