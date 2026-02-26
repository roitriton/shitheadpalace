import React from 'react';

interface TopBarProps {
  /** Game type label (e.g. "Solo", "Multijoueur") */
  gameType: string;
  /** Variant name, if applicable */
  variantName?: string;
  /** Dev mode: show debug toggles */
  isDev?: boolean;
  /** Debug: reveal bot hands */
  revealHands?: boolean;
  onToggleRevealHands?: () => void;
}

export function TopBar({
  gameType,
  variantName,
  isDev,
  revealHands,
  onToggleRevealHands,
}: TopBarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 h-14 z-50 bg-gray-900/95 backdrop-blur border-b border-[#c9a84c]/20 flex items-center px-3 sm:px-4">
      {/* Gauche : Titre + type de partie */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-serif text-[#c9a84c] text-sm sm:text-base font-bold tracking-wide whitespace-nowrap">
          Shit Head Palace
        </span>
        <span className="text-gray-400 text-xs sm:text-sm whitespace-nowrap">{gameType}</span>
        {variantName && (
          <span className="text-gray-500 text-[10px] sm:text-xs truncate hidden sm:inline">
            — {variantName}
          </span>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Droite : Debug (dev only) */}
      {isDev && onToggleRevealHands && (
        <div className="flex items-center gap-3 text-xs select-none">
          <span className="font-mono font-bold text-[#c9a84c] tracking-wider">DEBUG</span>
          <label className="flex items-center gap-1.5 cursor-pointer text-gray-300 hover:text-white transition-colors">
            <span>Mains</span>
            <div
              className={`relative w-8 h-4 rounded-full transition-colors ${revealHands ? 'bg-[#c9a84c]' : 'bg-gray-600'}`}
              onClick={onToggleRevealHands}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${revealHands ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </div>
          </label>
        </div>
      )}
    </div>
  );
}
