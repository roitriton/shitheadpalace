import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../themes/ThemeContext';
import { TABLE_BACKGROUNDS, CARD_BACKS } from '../themes/themeConfig';
import type { TableBackground, CardBack } from '../themes/themeConfig';

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
  /** Connected user's username */
  username?: string;
  /** Logout callback */
  onLogout?: () => void;
}

function ThemeDropdown<T extends { id: string; label: string; image: string }>({
  label,
  items,
  selected,
  onSelect,
}: {
  label: string;
  items: T[];
  selected: T;
  onSelect: (item: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        <span className="text-gray-400">{label}</span>
        <span className="text-[#c9a84c] font-semibold">{selected.label}</span>
        <svg className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 bg-gray-800 border border-gray-600 rounded shadow-xl z-[60] min-w-[120px]">
          {items.map((item) => (
            <button
              key={item.id}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                item.id === selected.id ? 'text-[#c9a84c] font-semibold' : 'text-gray-300'
              }`}
              onClick={() => { onSelect(item); setOpen(false); }}
            >
              <img src={item.image} alt={item.label} className="w-5 h-5 rounded object-cover" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopBar({
  gameType,
  variantName,
  isDev,
  revealHands,
  onToggleRevealHands,
  username,
  onLogout,
}: TopBarProps) {
  const { background, setBackground, cardBack, setCardBack } = useTheme();

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

      {/* Theme selectors */}
      <div className="flex items-center gap-2 mr-3">
        <ThemeDropdown<TableBackground>
          label="Table"
          items={TABLE_BACKGROUNDS}
          selected={background}
          onSelect={setBackground}
        />
        <ThemeDropdown<CardBack>
          label="Cartes"
          items={CARD_BACKS}
          selected={cardBack}
          onSelect={setCardBack}
        />
      </div>

      {/* User info + logout */}
      {username && onLogout && (
        <div className="flex items-center gap-2 mr-3">
          <span className="text-gray-300 text-xs truncate max-w-[100px]">{username}</span>
          <button
            onClick={onLogout}
            className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
          >
            Quitter
          </button>
        </div>
      )}

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
