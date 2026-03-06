import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ModalButton } from './ModalButton';
import type { GameVariant, Power, Rank } from '@shit-head-palace/engine';
import { validateVariant } from '@shit-head-palace/engine';

// ─── Types ──────────────────────────────────────────────────────────────────

type ConfigurablePower = 'burn' | 'reset' | 'under' | 'skip' | 'target' | 'mirror';

interface PowerOption {
  key: ConfigurablePower | 'none' | 'unique';
  icon: string;
  label: string;
  description: string;
  disabled?: boolean;
  tooltip?: string;
}

interface VariantConfig {
  playerCount: number;
  deckCount: number;
  minHandSize: number;
  flopCount: number;
  /** Maps each rank to a power or 'none' */
  rankPowers: Record<Rank, ConfigurablePower | 'none'>;
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
  { key: 'none', icon: '—', label: 'Aucun pouvoir', description: '' },
  { key: 'burn', icon: '\uD83D\uDD25', label: 'Burn', description: 'Brûle la pile, le lanceur rejoue' },
  { key: 'reset', icon: '\uD83D\uDD04', label: 'Reset', description: 'Remet la pile à zéro' },
  { key: 'under', icon: '\u2B07\uFE0F', label: 'Under', description: 'Le suivant doit jouer \u2264 cette valeur' },
  { key: 'skip', icon: '\u274C', label: 'Skip', description: 'Le joueur suivant passe son tour' },
  { key: 'target', icon: '\uD83C\uDFAF', label: 'Target', description: 'Choisir qui joue après soi' },
  { key: 'mirror', icon: '\uD83E\uDE9E', label: 'Mirror', description: 'Copie la valeur de la carte accompagnée' },
  { key: 'unique', icon: '\u2728', label: 'Pouvoirs uniques', description: 'Pouvoirs spéciaux par couleur', disabled: true, tooltip: 'Bientôt disponible' },
];

const DEFAULT_CONFIG: VariantConfig = {
  playerCount: 3,
  deckCount: 1,
  minHandSize: 3,
  flopCount: 3,
  rankPowers: {
    '2': 'reset',
    '3': 'none',
    '4': 'none',
    '5': 'none',
    '6': 'none',
    '7': 'skip',
    '8': 'under',
    '9': 'mirror',
    '10': 'burn',
    'J': 'none',
    'Q': 'none',
    'K': 'none',
    'A': 'target',
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function configToVariant(config: VariantConfig): GameVariant {
  const powerAssignments: Partial<Record<Power, Rank | Rank[]>> = {};

  for (const [rank, power] of Object.entries(config.rankPowers)) {
    if (power === 'none') continue;
    const existing = powerAssignments[power as Power];
    if (existing !== undefined) {
      // Multiple ranks for same power → array
      if (Array.isArray(existing)) {
        (existing as Rank[]).push(rank as Rank);
      } else {
        powerAssignments[power as Power] = [existing as Rank, rank as Rank];
      }
    } else {
      powerAssignments[power as Power] = rank as Rank;
    }
  }

  return {
    name: 'Custom',
    playerCount: config.playerCount,
    deckCount: config.deckCount,
    powerAssignments,
  };
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
  value: ConfigurablePower | 'none';
  onChange: (power: ConfigurablePower | 'none') => void;
}) {
  const [open, setOpen] = useState(false);

  const selected = POWER_OPTIONS.find((p) => p.key === value) ?? POWER_OPTIONS[0]!;

  const handleSelect = (key: string) => {
    if (key === 'unique') return;
    onChange(key as ConfigurablePower | 'none');
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
            ▼
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
                  disabled={option.disabled}
                  onClick={() => handleSelect(option.key)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${
                    option.disabled
                      ? 'opacity-40 cursor-not-allowed'
                      : option.key === value
                        ? 'bg-amber-400/20 text-white'
                        : 'hover:bg-gray-700 text-white'
                  }`}
                  title={option.tooltip}
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

// ─── Main Modal ─────────────────────────────────────────────────────────────

export function VariantConfigModal({ onConfirm, onCancel }: VariantConfigModalProps) {
  const [config, setConfig] = useState<VariantConfig>({ ...DEFAULT_CONFIG, rankPowers: { ...DEFAULT_CONFIG.rankPowers } });
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleReset = useCallback(() => {
    setConfig({ ...DEFAULT_CONFIG, rankPowers: { ...DEFAULT_CONFIG.rankPowers } });
    setValidationError(null);
  }, []);

  const handleRankPowerChange = useCallback((rank: Rank, power: ConfigurablePower | 'none') => {
    setConfig((prev) => ({
      ...prev,
      rankPowers: { ...prev.rankPowers, [rank]: power },
    }));
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
            Configuration des règles
          </h3>
          <button
            onClick={handleReset}
            className="text-xs text-gray-400 hover:text-amber-400 transition-colors px-2 py-1 rounded border border-gray-600/50 hover:border-amber-400/50"
          >
            Règles par défaut
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto mt-4 -mx-2 px-2 space-y-5">
          {/* Section: Options générales */}
          <div>
            <h4 className="font-serif text-sm text-amber-400/80 font-semibold uppercase tracking-wide mb-2">
              Options générales
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
                max={5}
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
                <PowerDropdown
                  key={rank}
                  rank={rank}
                  value={config.rankPowers[rank]}
                  onChange={(power) => handleRankPowerChange(rank, power)}
                />
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
