import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModalButton } from './ModalButton';
import type { GameVariant, Power, Rank, Suit, UniquePowerType } from '@shit-head-palace/engine';
import { validateVariant, DEFAULT_UNIQUE_POWER_SUITS } from '@shit-head-palace/engine';

// ─── Types ──────────────────────────────────────────────────────────────────

type ConfigurablePower = 'burn' | 'reset' | 'under' | 'skip' | 'target' | 'mirror';
type RankPower = ConfigurablePower | 'none' | 'unique';
type UniqueMode = 'manual' | 'random';

interface UniquePowerConfig {
  mode: UniqueMode;
  suits: Record<Suit, UniquePowerType>;
}

interface PowerOption {
  key: RankPower;
  icon: string;
  label: string;
  description: string;
}

interface VariantConfig {
  playerCount: number;
  deckCount: number;
  minHandSize: number;
  flopCount: number;
  rankPowers: Record<Rank, RankPower>;
  uniquePowers: Partial<Record<Rank, UniquePowerConfig>>;
}

interface VariantConfigModalProps {
  onConfirm: (variant: GameVariant, playerCount: number) => void;
  onCancel: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ALL_RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const RANK_LABELS: Record<Rank, string> = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
  '8': '8', '9': '9', '10': '10', 'J': 'Valet', 'Q': 'Dame', 'K': 'Roi', 'A': 'As',
};

const POWER_OPTIONS: PowerOption[] = [
  { key: 'none', icon: '\u2014', label: 'Aucun pouvoir', description: '' },
  { key: 'burn', icon: '\uD83D\uDD25', label: 'Burn', description: 'Br\u00fble la pile, le lanceur rejoue' },
  { key: 'reset', icon: '\uD83D\uDD04', label: 'Reset', description: 'Remet la pile \u00e0 z\u00e9ro' },
  { key: 'under', icon: '\u2B07\uFE0F', label: 'Under', description: 'Le suivant doit jouer \u2264 cette valeur' },
  { key: 'skip', icon: '\u274C', label: 'Skip', description: 'Le joueur suivant passe son tour' },
  { key: 'target', icon: '\uD83C\uDFAF', label: 'Target', description: 'Choisir qui joue apr\u00e8s soi' },
  { key: 'mirror', icon: '\uD83E\uDE9E', label: 'Mirror', description: 'Copie la valeur de la carte accompagn\u00e9e' },
  { key: 'unique', icon: '\u2728', label: 'Pouvoirs uniques', description: 'Pouvoirs sp\u00e9ciaux par couleur' },
];

const SUIT_DISPLAY: { key: Suit; symbol: string; name: string; color: string }[] = [
  { key: 'spades', symbol: '\u2660', name: 'Pique', color: 'text-white' },
  { key: 'hearts', symbol: '\u2665', name: 'C\u0153ur', color: 'text-red-400' },
  { key: 'diamonds', symbol: '\u2666', name: 'Carreau', color: 'text-red-400' },
  { key: 'clubs', symbol: '\u2663', name: 'Tr\u00e8fle', color: 'text-white' },
];

const UNIQUE_POWER_OPTIONS: { key: UniquePowerType; label: string; description: string }[] = [
  { key: 'revolution', label: 'R\u00e9volution', description: "Inverse l'ordre des valeurs" },
  { key: 'manouche', label: 'Manouche', description: '\u00c9change de cartes avec un adversaire' },
  { key: 'flopReverse', label: 'Flop Reverse', description: '\u00c9change flop \u2194 dark flop d\'un joueur' },
  { key: 'shifumi', label: 'Shifumi', description: 'Pierre-papier-ciseaux, perdant ramasse' },
];

function makeDefaultUniquePowerConfig(): UniquePowerConfig {
  return {
    mode: 'manual',
    suits: { ...DEFAULT_UNIQUE_POWER_SUITS },
  };
}

function shuffleUniquePowers(): Record<Suit, UniquePowerType> {
  const powers: UniquePowerType[] = ['revolution', 'manouche', 'flopReverse', 'shifumi'];
  for (let i = powers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [powers[i], powers[j]] = [powers[j]!, powers[i]!];
  }
  const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
  return Object.fromEntries(suits.map((s, i) => [s, powers[i]])) as Record<Suit, UniquePowerType>;
}

const DEFAULT_CONFIG: VariantConfig = {
  playerCount: 3,
  deckCount: 1,
  minHandSize: 3,
  flopCount: 3,
  rankPowers: {
    '2': 'reset', '3': 'none', '4': 'none', '5': 'none', '6': 'none',
    '7': 'skip', '8': 'under', '9': 'mirror', '10': 'burn',
    'J': 'unique', 'Q': 'none', 'K': 'none', 'A': 'target',
  },
  uniquePowers: {
    'J': makeDefaultUniquePowerConfig(),
  },
};

function deepCopyConfig(config: VariantConfig): VariantConfig {
  const uniquePowers: Partial<Record<Rank, UniquePowerConfig>> = {};
  for (const [rank, uc] of Object.entries(config.uniquePowers)) {
    uniquePowers[rank as Rank] = { mode: uc!.mode, suits: { ...uc!.suits } };
  }
  return {
    ...config,
    rankPowers: { ...config.rankPowers },
    uniquePowers,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function configToVariant(config: VariantConfig): GameVariant {
  const powerAssignments: Partial<Record<Power, Rank | Rank[]>> = {};

  for (const [rank, power] of Object.entries(config.rankPowers)) {
    if (power === 'none' || power === 'unique') continue;
    const existing = powerAssignments[power as Power];
    if (existing !== undefined) {
      if (Array.isArray(existing)) {
        (existing as Rank[]).push(rank as Rank);
      } else {
        powerAssignments[power as Power] = [existing as Rank, rank as Rank];
      }
    } else {
      powerAssignments[power as Power] = rank as Rank;
    }
  }

  // Build uniquePowerAssignments from ranks with 'unique'
  const uniquePowerAssignments: Partial<Record<Rank, Record<Suit, UniquePowerType>>> = {};
  for (const [rank, power] of Object.entries(config.rankPowers)) {
    if (power === 'unique') {
      const uc = config.uniquePowers[rank as Rank];
      if (uc) {
        uniquePowerAssignments[rank as Rank] = { ...uc.suits };
      }
    }
  }

  const variant: GameVariant = {
    name: 'Custom',
    playerCount: config.playerCount,
    deckCount: config.deckCount,
    powerAssignments,
  };

  if (config.minHandSize !== 3) {
    variant.minHandSize = config.minHandSize;
  }
  if (config.flopCount !== 3) {
    variant.flopSize = config.flopCount;
  }

  if (Object.keys(uniquePowerAssignments).length > 0) {
    variant.uniquePowerAssignments = uniquePowerAssignments;
  }

  return variant;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function NumberSelector({ label, value, min, max, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const options = [];
  for (let i = min; i <= max; i++) options.push(i);

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-gray-200 text-sm">{label}</span>
      <div className="flex gap-1">
        {options.map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
              n === value
                ? 'bg-amber-400/90 text-gray-900'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function PowerDropdown({ rank, value, onChange }: {
  rank: Rank;
  value: RankPower;
  onChange: (power: RankPower) => void;
}) {
  const [open, setOpen] = useState(false);

  const selected = POWER_OPTIONS.find((p) => p.key === value) ?? POWER_OPTIONS[0]!;

  const handleSelect = (key: string) => {
    onChange(key as RankPower);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-12 text-center font-mono text-lg text-white font-bold shrink-0">
        {RANK_LABELS[rank]}
      </span>
      <div className="relative flex-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-700 border border-gray-500/50 hover:border-gray-400/50 transition-colors text-left"
        >
          <span className="text-lg shrink-0">{selected.icon}</span>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-white text-sm">{selected.label}</span>
            {selected.description && (
              <span className="text-gray-400 text-xs ml-1.5">({selected.description})</span>
            )}
          </div>
          <span className={`text-gray-400 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>
            {'\u25BC'}
          </span>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
            <div className="absolute left-0 right-0 top-full mt-1 z-[101] bg-gray-800 border border-gray-600/50 rounded-lg shadow-xl max-h-72 overflow-y-auto">
              {POWER_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handleSelect(option.key)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${
                    option.key === value
                      ? 'bg-amber-400/20 text-white'
                      : 'hover:bg-gray-700 text-white'
                  }`}
                >
                  <span className="text-lg shrink-0">{option.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm">{option.label}</span>
                    {option.description && (
                      <span className="text-gray-400 text-xs ml-1.5">({option.description})</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SuitPowerDropdown({ suit, value, onChange, readOnly }: {
  suit: typeof SUIT_DISPLAY[number];
  value: UniquePowerType;
  onChange: (power: UniquePowerType) => void;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = UNIQUE_POWER_OPTIONS.find((p) => p.key === value)!;

  return (
    <div className="flex items-center gap-2 py-1">
      <span className={`text-lg w-7 text-center shrink-0 ${suit.color}`}>
        {suit.symbol}
      </span>
      <span className="text-gray-300 text-xs w-16 shrink-0">{suit.name}</span>
      <div className="relative flex-1">
        {readOnly ? (
          <div className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded bg-gray-800/60 text-left">
            <span className="font-semibold text-amber-300 text-xs">{selected.label}</span>
            <span className="text-gray-500 text-xs hidden sm:inline">({selected.description})</span>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded bg-gray-800/80 border border-gray-600/40 hover:border-gray-500/50 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-amber-300 text-xs">{selected.label}</span>
                <span className="text-gray-500 text-xs ml-1 hidden sm:inline">({selected.description})</span>
              </div>
              <span className={`text-gray-500 text-[10px] transition-transform ${open ? 'rotate-180' : ''}`}>
                {'\u25BC'}
              </span>
            </button>
            {open && (
              <>
                <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
                <div className="absolute left-0 right-0 top-full mt-0.5 z-[101] bg-gray-800 border border-gray-600/50 rounded-lg shadow-xl overflow-hidden">
                  {UNIQUE_POWER_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => { onChange(option.key); setOpen(false); }}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 text-left transition-colors ${
                        option.key === value
                          ? 'bg-amber-400/20 text-white'
                          : 'hover:bg-gray-700 text-white'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-xs">{option.label}</span>
                        <span className="text-gray-400 text-xs ml-1">({option.description})</span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function UniquePowersPanel({ config, onChange }: {
  config: UniquePowerConfig;
  onChange: (config: UniquePowerConfig) => void;
}) {
  const [overflowVisible, setOverflowVisible] = useState(false);

  const handleModeChange = useCallback((mode: UniqueMode) => {
    if (mode === 'random') {
      onChange({ mode: 'random', suits: shuffleUniquePowers() });
    } else {
      onChange({ ...config, mode: 'manual' });
    }
  }, [config, onChange]);

  const handleSuitChange = useCallback((suit: Suit, power: UniquePowerType) => {
    onChange({ ...config, suits: { ...config.suits, [suit]: power } });
  }, [config, onChange]);

  const handleReshuffle = useCallback(() => {
    onChange({ mode: 'random', suits: shuffleUniquePowers() });
  }, [onChange]);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      style={{ overflow: overflowVisible ? 'visible' : 'hidden' }}
      onAnimationStart={() => setOverflowVisible(false)}
      onAnimationComplete={() => setOverflowVisible(true)}
    >
      <div className="ml-12 mr-0 mt-1 mb-2 bg-gray-700/60 rounded-lg border-l-2 border-amber-400/60 p-3">
        {/* Mode toggle */}
        <div className="flex gap-1.5 mb-3">
          <button
            type="button"
            onClick={() => handleModeChange('manual')}
            className={`flex-1 py-1.5 rounded text-xs font-semibold transition-colors ${
              config.mode === 'manual'
                ? 'bg-amber-400/90 text-gray-900'
                : 'bg-gray-600/80 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Manuel
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('random')}
            className={`flex-1 py-1.5 rounded text-xs font-semibold transition-colors ${
              config.mode === 'random'
                ? 'bg-amber-400/90 text-gray-900'
                : 'bg-gray-600/80 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Tirage au sort
          </button>
        </div>

        {/* Random mode: reshuffle button */}
        {config.mode === 'random' && (
          <button
            type="button"
            onClick={handleReshuffle}
            className="w-full mb-2 py-1.5 rounded bg-amber-400/20 border border-amber-400/30 text-amber-300 text-xs font-semibold hover:bg-amber-400/30 transition-colors"
          >
            {'\uD83C\uDFB2'} Tirer au sort
          </button>
        )}

        {/* Suit assignments */}
        <div className="space-y-0">
          {SUIT_DISPLAY.map((suit) => (
            <SuitPowerDropdown
              key={suit.key}
              suit={suit}
              value={config.suits[suit.key]}
              onChange={(power) => handleSuitChange(suit.key, power)}
              readOnly={config.mode === 'random'}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Modal ─────────────────────────────────────────────────────────────

export function VariantConfigModal({ onConfirm, onCancel }: VariantConfigModalProps) {
  const [config, setConfig] = useState<VariantConfig>(() => deepCopyConfig(DEFAULT_CONFIG));
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleReset = useCallback(() => {
    setConfig(deepCopyConfig(DEFAULT_CONFIG));
    setValidationError(null);
  }, []);

  const handleRankPowerChange = useCallback((rank: Rank, power: RankPower) => {
    setConfig((prev) => {
      const newConfig = deepCopyConfig(prev);
      newConfig.rankPowers[rank] = power;
      if (power === 'unique' && !newConfig.uniquePowers[rank]) {
        newConfig.uniquePowers[rank] = makeDefaultUniquePowerConfig();
      }
      return newConfig;
    });
    setValidationError(null);
  }, []);

  const handleUniquePowerChange = useCallback((rank: Rank, uniqueConfig: UniquePowerConfig) => {
    setConfig((prev) => {
      const newConfig = deepCopyConfig(prev);
      newConfig.uniquePowers[rank] = uniqueConfig;
      return newConfig;
    });
    setValidationError(null);
  }, []);

  const handleConfirm = useCallback(() => {
    const variant = configToVariant(config);
    const errors = validateVariant(variant);
    if (errors.length > 0) {
      setValidationError(errors.map((e) => e.message).join('. '));
      return;
    }
    onConfirm(variant, config.playerCount);
  }, [config, onConfirm]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center bg-black/60 z-50"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-gray-800/95 backdrop-blur border border-gray-600/50 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-serif text-xl text-amber-400 font-bold">
            Configuration des r&egrave;gles
          </h3>
          <button
            onClick={handleReset}
            className="text-xs text-gray-400 hover:text-amber-400 transition-colors px-2 py-1 rounded border border-gray-600/50 hover:border-amber-400/50"
          >
            R&egrave;gles par d&eacute;faut
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto mt-4 -mx-2 px-2 space-y-5">
          {/* Section: Options g&eacute;n&eacute;rales */}
          <div>
            <h4 className="font-serif text-sm text-amber-400/80 font-semibold uppercase tracking-wide mb-2">
              Options g&eacute;n&eacute;rales
            </h4>
            <div className="space-y-1 bg-gray-900/40 rounded-lg p-3">
              <NumberSelector
                label="Nombre de joueurs"
                value={config.playerCount}
                min={2}
                max={6}
                onChange={(v) => { setConfig((p) => ({ ...p, playerCount: v })); setValidationError(null); }}
              />
              <NumberSelector
                label="Paquets de cartes"
                value={config.deckCount}
                min={1}
                max={4}
                onChange={(v) => { setConfig((p) => ({ ...p, deckCount: v })); setValidationError(null); }}
              />
              <NumberSelector
                label="Cartes min. en main"
                value={config.minHandSize}
                min={1}
                max={5}
                onChange={(v) => setConfig((p) => ({ ...p, minHandSize: v }))}
              />
              <NumberSelector
                label="Cartes flop / dark flop"
                value={config.flopCount}
                min={1}
                max={5}
                onChange={(v) => setConfig((p) => ({ ...p, flopCount: v }))}
              />
            </div>
          </div>

          {/* Section: Attribution des pouvoirs */}
          <div>
            <h4 className="font-serif text-sm text-amber-400/80 font-semibold uppercase tracking-wide mb-2">
              Attribution des pouvoirs
            </h4>
            <div className="bg-gray-900/40 rounded-lg p-3 space-y-0.5">
              {ALL_RANKS.map((rank) => (
                <React.Fragment key={rank}>
                  <PowerDropdown
                    rank={rank}
                    value={config.rankPowers[rank]}
                    onChange={(power) => handleRankPowerChange(rank, power)}
                  />
                  <AnimatePresence>
                    {config.rankPowers[rank] === 'unique' && config.uniquePowers[rank] && (
                      <UniquePowersPanel
                        key={`unique-${rank}`}
                        config={config.uniquePowers[rank]!}
                        onChange={(uc) => handleUniquePowerChange(rank, uc)}
                      />
                    )}
                  </AnimatePresence>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Validation error */}
        {validationError && (
          <div className="mt-3 text-red-400 text-sm text-center">
            {validationError}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 flex gap-3">
          <div className="flex-1">
            <ModalButton variant="cancel" onClick={onCancel}>
              Annuler
            </ModalButton>
          </div>
          <div className="flex-1">
            <ModalButton variant="confirm" onClick={handleConfirm}>
              Lancer la partie
            </ModalButton>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
