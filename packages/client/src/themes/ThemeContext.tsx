import React, { createContext, useContext, useState } from 'react';
import type { TableBackground, CardBack } from './themeConfig';
import { DEFAULT_BACKGROUND, DEFAULT_CARD_BACK } from './themeConfig';

interface ThemeContextValue {
  background: TableBackground;
  setBackground: (bg: TableBackground) => void;
  cardBack: CardBack;
  setCardBack: (cb: CardBack) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [background, setBackground] = useState<TableBackground>(DEFAULT_BACKGROUND);
  const [cardBack, setCardBack] = useState<CardBack>(DEFAULT_CARD_BACK);

  return (
    <ThemeContext.Provider value={{ background, setBackground, cardBack, setCardBack }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
