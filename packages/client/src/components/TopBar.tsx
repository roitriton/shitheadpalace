import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../themes/ThemeContext';
import { THEMES } from '../themes/themeConfig';
import type { Theme } from '../themes/themeConfig';

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
  /** Leave current game and return to lobby */
  onLeaveGame?: () => void;
}

function ThemeDropdown<T extends { id: string; label: string; bgImage: string }>({
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
              <img src={item.bgImage} alt={item.label} className="w-5 h-5 rounded object-cover" />
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
  onLeaveGame,
}: TopBarProps) {
  const { theme, setTheme } = useTheme();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLeaveClick = () => {
    if (!onLeaveGame) return;
    if (confirmLeave) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirmLeave(false);
      onLeaveGame();
    } else {
      setConfirmLeave(true);
      confirmTimerRef.current = setTimeout(() => setConfirmLeave(false), 3000);
    }
  };

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 h-14 z-50 bg-black border-b border-[#c9a84c]/20 flex items-center px-3 sm:px-4">
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

      {/* Quitter la partie */}
      {onLeaveGame && (
        <button
          onClick={handleLeaveClick}
          className={`ml-3 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            confirmLeave
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-400 hover:text-gray-200'
          }`}
        >
          {confirmLeave ? 'Confirmer ?' : 'Quitter la partie'}
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Theme selector */}
      <div className="flex items-center gap-2 mr-3">
        <ThemeDropdown<Theme>
          label="Thème"
          items={THEMES}
          selected={theme}
          onSelect={setTheme}
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
