import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../themes/ThemeContext';
import { THEMES } from '../themes/themeConfig';
import type { Theme } from '../themes/themeConfig';
import { useAuth } from '../auth/authContext';
import { SiteLogo } from './SiteLogo';

type NavScreen = 'lobby' | 'rules' | 'profile';

interface SiteHeaderProps {
  currentScreen: NavScreen;
  onNavigate: (screen: NavScreen) => void;
  /** When true, Règles/Profil are disabled and Jouer requires confirmation */
  inWaitingRoom?: boolean;
}

function ThemeDropdown() {
  const { theme, setTheme } = useTheme();
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
        <span className="text-gray-400">Thème</span>
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

const NAV_ITEMS: { screen: NavScreen; label: string; disabled?: boolean }[] = [
  { screen: 'lobby', label: 'Jouer' },
  { screen: 'rules', label: 'Règles' },
  { screen: 'profile', label: 'Profil', disabled: true },
];

export function SiteHeader({ currentScreen, onNavigate, inWaitingRoom }: SiteHeaderProps) {
  const { user, logout } = useAuth();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current); };
  }, []);

  const handleNavClick = (screen: NavScreen) => {
    if (screen === 'lobby' && inWaitingRoom) {
      if (confirmLeave) {
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
        setConfirmLeave(false);
        onNavigate(screen);
      } else {
        setConfirmLeave(true);
        confirmTimerRef.current = setTimeout(() => setConfirmLeave(false), 3000);
      }
      return;
    }
    onNavigate(screen);
  };

  return (
    <header className="relative z-20 bg-black border-b border-[#c9a84c]/20 px-3 sm:px-4 h-14 flex items-center">
      {/* Left: logo */}
      <SiteLogo size="compact" />

      {/* Center: navigation */}
      <nav className="flex-1 flex justify-center gap-1 sm:gap-2">
        {NAV_ITEMS.map(({ screen, label, disabled: staticDisabled }) => {
          const isDisabled = staticDisabled || (inWaitingRoom && screen !== 'lobby');
          const isActive = currentScreen === screen;
          const isConfirm = screen === 'lobby' && inWaitingRoom && confirmLeave;

          return (
            <button
              key={screen}
              onClick={() => !isDisabled && handleNavClick(screen)}
              disabled={isDisabled}
              className={`px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors ${
                isConfirm
                  ? 'bg-red-600 text-white'
                  : isDisabled
                    ? 'text-gray-600 cursor-not-allowed'
                    : isActive
                      ? 'bg-[#c9a84c]/20 text-[#c9a84c]'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {isConfirm ? 'Quitter la salle ?' : label}
            </button>
          );
        })}
      </nav>

      {/* Right: theme + user */}
      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeDropdown />
        {user && (
          <>
            <span className="text-gray-300 text-xs truncate max-w-[100px] hidden sm:inline">{user.username}</span>
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
  );
}
