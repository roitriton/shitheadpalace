import React from 'react';
import { useTheme } from '../themes/ThemeContext';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RulesScreenProps {
  onNavigate: (screen: 'lobby' | 'rules' | 'profile') => void;
}

// ─── Section helper ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-xl p-5 border border-gold/10 shadow-[inset_0_0_20px_rgba(0,0,0,0.3)]">
      <h2 className="font-serif text-lg text-[#c9a84c] mb-3">{title}</h2>
      {children}
    </div>
  );
}

// ─── Power table data ───────────────────────────────────────────────────────

const CLASSIC_POWERS = [
  { rank: '2', name: 'Reset', desc: 'Remet la valeur de la pile à zéro — tout le monde peut jouer par-dessus.' },
  { rank: '7', name: 'Skip', desc: 'Le joueur suivant passe son tour. Cumulable : 2 Skips = 2 joueurs sautés.' },
  { rank: '8', name: 'Under', desc: 'Le joueur suivant doit jouer une carte de valeur inférieure ou égale.' },
  { rank: '9', name: 'Mirror', desc: 'Copie la valeur de la carte accompagnée. Ne se joue jamais seul.' },
  { rank: '10', name: 'Burn', desc: 'Brûle la pile entière (envoyée au cimetière). Le lanceur rejoue immédiatement.' },
  { rank: 'A', name: 'Target', desc: 'Choisissez quel joueur doit jouer après vous.' },
];

const JACK_POWERS = [
  { suit: '♦', suitColor: 'text-red-400', name: 'Révolution', desc: 'Inverse l\'ordre des valeurs (les petites cartes deviennent fortes). Temporaire.', superName: 'Super Révolution', superDesc: 'Avec un Mirror : l\'inversion devient permanente.' },
  { suit: '♠', suitColor: 'text-gray-200', name: 'Manouche', desc: 'Prenez 1 carte d\'un adversaire, puis donnez-lui des cartes de même valeur.', superName: 'Super Manouche', superDesc: 'Avec un Mirror : échange libre (même nombre total de cartes).' },
  { suit: '♥', suitColor: 'text-red-400', name: 'Flop Reverse', desc: 'Un joueur échange ses cartes flop et dark flop.', superName: 'Flop Remake', superDesc: 'Avec un Mirror : recomposez librement le flop et dark flop d\'un joueur.' },
  { suit: '♣', suitColor: 'text-gray-200', name: 'Shifumi', desc: 'Pierre-papier-ciseaux contre un adversaire. Le perdant ramasse la pile.', superName: 'Super Shifumi', superDesc: 'Avec un Mirror : le perdant devient directement Shit Head.' },
];

// ─── Burn special rule ──────────────────────────────────────────────────────

const BURN_QUAD_DESC = '4 cartes de même valeur sur la pile (même jouées sur plusieurs tours) déclenchent aussi un Burn automatique.';

// ─── Component ──────────────────────────────────────────────────────────────

export function RulesScreen({ onNavigate }: RulesScreenProps) {
  const { theme } = useTheme();

  return (
    <div
      className="h-screen flex flex-col overflow-y-auto shadow-[inset_0_0_40px_rgba(0,0,0,0.4)] md:shadow-[inset_0_0_80px_rgba(0,0,0,0.4)]"
      style={{
        backgroundImage: `url(${theme.bgImage})`,
        backgroundRepeat: 'repeat',
        backgroundPosition: '0 0',
        backgroundSize: '512px 512px',
        backgroundColor: theme.bgColor,
      }}
    >
      {/* Vignette */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.9) 100%)',
        }}
      />

      <SiteHeader currentScreen="rules" onNavigate={onNavigate} />

      <main className="relative z-10 flex-1 flex flex-col items-center px-4 py-6 overflow-y-auto min-h-0">
        {/* Page title */}
        <h1 className="font-serif text-3xl text-[#c9a84c] mb-4 text-center">Règles du jeu</h1>

        <div className="w-full max-w-3xl flex flex-col gap-4 pb-8">

          {/* 1. Objectif */}
          <Section title="Objectif du jeu">
            <p className="text-gray-300 text-sm leading-relaxed">
              Débarrassez-vous de toutes vos cartes — main, flop et dark flop — avant les autres joueurs.
              Le dernier joueur en lice est déclaré <span className="text-[#c9a84c] font-semibold">Shit Head</span>.
            </p>
          </Section>

          {/* 2. Mise en place */}
          <Section title="Mise en place">
            <ul className="text-gray-300 text-sm leading-relaxed space-y-1.5 list-disc list-inside">
              <li>Chaque joueur reçoit <span className="text-gray-100 font-semibold">3 cartes en main</span>, <span className="text-gray-100 font-semibold">3 cartes face visible</span> (flop) et <span className="text-gray-100 font-semibold">3 cartes face cachée</span> (dark flop).</li>
              <li>Pendant la phase de préparation, vous pouvez échanger des cartes entre votre main et votre flop pour optimiser votre jeu.</li>
              <li>Le reste des cartes forme la pioche.</li>
            </ul>
          </Section>

          {/* 3. Déroulement d'un tour */}
          <Section title="Déroulement d'un tour">
            <ul className="text-gray-300 text-sm leading-relaxed space-y-1.5 list-disc list-inside">
              <li>Jouez une ou plusieurs cartes <span className="text-gray-100 font-semibold">de même valeur</span> sur la pile.</li>
              <li>La carte jouée doit être <span className="text-gray-100 font-semibold">supérieure ou égale</span> à la carte du dessus de la pile (sauf pouvoirs spéciaux).</li>
              <li>Si vous ne pouvez pas jouer, vous <span className="text-red-400 font-semibold">ramassez toute la pile</span>.</li>
              <li>Tant que la pioche n'est pas vide, votre main remonte automatiquement à 3 cartes minimum.</li>
            </ul>
          </Section>

          {/* 4. Phases de jeu */}
          <Section title="Phases de jeu">
            <div className="space-y-2">
              <div className="flex gap-3 items-start">
                <span className="text-[#c9a84c] font-bold text-sm min-w-[4.5rem]">Phase 1</span>
                <p className="text-gray-300 text-sm">Jouez depuis votre <span className="text-gray-100 font-semibold">main</span>. La pioche est disponible pour compléter.</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="text-[#c9a84c] font-bold text-sm min-w-[4.5rem]">Phase 2</span>
                <p className="text-gray-300 text-sm">Main vide + pioche vide : jouez vos cartes <span className="text-gray-100 font-semibold">flop</span> (face visible).</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="text-[#c9a84c] font-bold text-sm min-w-[4.5rem]">Phase 3</span>
                <p className="text-gray-300 text-sm">Flop vide : jouez vos cartes <span className="text-gray-100 font-semibold">dark flop</span> à l'aveugle. Si la carte est injouable, vous ramassez la pile.</p>
              </div>
            </div>
          </Section>

          {/* 5. Pouvoirs spéciaux */}
          <Section title="Pouvoirs spéciaux">
            <p className="text-gray-400 text-xs mb-3 italic">
              Valeurs par défaut — les pouvoirs peuvent être réassignés dans la configuration de variante.
            </p>

            {/* Classic powers */}
            <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">Pouvoirs classiques</h3>
            <div className="space-y-2 mb-4">
              {CLASSIC_POWERS.map((p) => (
                <div key={p.rank} className="flex gap-3 items-start">
                  <span className="text-gray-100 font-bold text-sm min-w-[2rem] text-right font-mono">{p.rank}</span>
                  <div>
                    <span className="text-[#c9a84c] font-semibold text-sm">{p.name}</span>
                    <span className="text-gray-400 text-sm"> — {p.desc}</span>
                  </div>
                </div>
              ))}
              <div className="flex gap-3 items-start mt-1">
                <span className="text-gray-100 font-bold text-sm min-w-[2rem] text-right font-mono">x4</span>
                <div>
                  <span className="text-[#c9a84c] font-semibold text-sm">Burn auto</span>
                  <span className="text-gray-400 text-sm"> — {BURN_QUAD_DESC}</span>
                </div>
              </div>
            </div>

            {/* Jack powers */}
            <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">Pouvoirs de Valets</h3>
            <p className="text-gray-400 text-xs mb-2">
              Chaque couleur de Valet a un pouvoir unique. Jouer un Valet avec un Mirror (9) déclenche la version Super.
            </p>
            <div className="space-y-3">
              {JACK_POWERS.map((p) => (
                <div key={p.suit} className="flex gap-3 items-start">
                  <span className={`font-bold text-base min-w-[2rem] text-right ${p.suitColor}`}>J{p.suit}</span>
                  <div>
                    <div>
                      <span className="text-[#c9a84c] font-semibold text-sm">{p.name}</span>
                      <span className="text-gray-400 text-sm"> — {p.desc}</span>
                    </div>
                    <div className="mt-0.5">
                      <span className="text-purple-400 font-semibold text-xs">{p.superName}</span>
                      <span className="text-gray-500 text-xs"> — {p.superDesc}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* 6. Fin de partie */}
          <Section title="Fin de partie">
            <ul className="text-gray-300 text-sm leading-relaxed space-y-1.5 list-disc list-inside">
              <li>Le premier joueur à se débarrasser de toutes ses cartes <span className="text-gray-100 font-semibold">gagne</span>.</li>
              <li>Les joueurs suivants sont classés dans l'ordre où ils terminent.</li>
              <li>Le dernier joueur est le <span className="text-[#c9a84c] font-semibold">Shit Head</span> !</li>
            </ul>
          </Section>

        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
