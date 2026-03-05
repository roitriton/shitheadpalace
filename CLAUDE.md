# CLAUDE.md — Shit Head Palace

## Identité du projet

Shit Head Palace est une application web de jeu de cartes multijoueur en temps réel, avec IA, chat, profils utilisateurs et variantes personnalisables. Destinée à un déploiement mobile ultérieur via Capacitor.

## PROGRESSION DU DÉVELOPPEMENT

### Étapes terminées

- [x] **Étape 1** — Monorepo init (engine, server, client configurés)
- [x] **Étape 2** — Engine : modèles et utilitaires (86 tests)
- [x] **Étape 3** — Engine : logique de jeu de base (340 tests)
- [x] **Étape 4A** — Pouvoirs simples : Burn, Reset, Under, Skip, Mirror (367 tests)
- [x] **Prototype visuel** — Serveur Express + Socket.IO, client React, 1 bot facile
- [x] **Étape 4B** — Pouvoirs complexes : Target, Révolution, Manouche, Flop Reverse, Shifumi + versions Super (727 tests)
- [x] **Étape 5** — Variantes engine : createVariant, validateVariant, serialize/deserialize (693 tests)
- [x] **Fix A→E** — Valets pile/révolution, FlopRemakeModal, valets pile vide, SuperManouchePickModal, bordures Card (757 tests)
- [x] **Étape 6** — Auth et comptes : Prisma SQLite, bcrypt, JWT, Zod (765 tests)
- [x] **Étape 7** — Multijoueur en ligne : Socket.IO rooms, lobby, reconnexions (821 tests)
- [x] **Étape 8** — Chat et messagerie : chat temps réel, messages privés, log des actions (842 tests)
- [x] **Étape 9** — Layout casino + espace de jeu : fond feutre, disposition joueurs, cartes améliorées, responsive, BottomBar (842 tests)
- [x] **Étape 11A** — Feedback visuel pouvoirs : PowerOverlay, RevolutionBanner, MiniLog, PileHorizontal, GraveyardDisplay, layout 3 colonnes (852 tests)
- [x] **Étape 11B** — Uniformisation modals : ModalWrapper + ModalButton, 9 modals migrées (852 tests)
- [x] **Étape 11 (phases 3→8)** — Multi-valets engine+UI, quad burn, transit cimetière, combo main+flop, surbrillance burn (1033 tests)
- [x] **Étape 11C** — Quick fixes UI : PowerOverlay simplifié (icône seule, scale-up), bouton Jouer vert/grisé, suppression popup "pas de coup légal", symboles cartes dans log (1033 tests)
- [x] **Étape 11D** — Valets visibles dans la pile avec overlay avant popup, pendingActionDelayed flag, scheduleOverlayDelay serveur (1070 tests)
- [x] **Étape 11D-bis** — Refonte popup manouche (popup unique + skip échange), bouton Jouer désactivé si sélection illégale (1070 tests)
- [x] **Étape 11D-ter** — Skip tour pile vide (applySkipTurn), message rouge clignotant, animation flop reverse (two-face rotateX), alignement log=minilog (1070 tests)
- [x] **Étape 11E** — Animations de déplacement des cartes : CardAnimationLayer + useCardAnimations hook, 6 types de mouvement (main→pile, pioche→main, pile→main, pile→cimetière, flop→pile, darkFlop→pile), synchronisation overlay/popups, slots flop stables, PowerOverlay position fixed, blocage interactions pendant overlay, fix tour après shifumi perdant (1073 tests)
- [x] **Étape 12A** — Thèmes visuels : 4 fonds tileable (Casino, Saloon, Pirate, Love) + 4 dos de cartes, 2 sélecteurs indépendants dans TopBar, ThemeContext/ThemeProvider, fond tileable 512×512 CSS sur GameBoard, dos image dans Card.tsx (1073 tests)
- [x] **Étape 12B** — Animation Flop Remake : dégradé arc-en-ciel par carte flop (fade in → défilement → fade out, 2.5s), FlopRemakeCardOverlay Framer Motion, détection flopRemakeDone côté client, blocage interactions pendant animation, délai serveur FLOP_REMAKE_ANIM_MS=2500 avant tour bot (1073 tests)

### Nombre total de tests : 1073 (937 engine + 123 server + 13 client)

### Étapes à venir
- [ ] Étape 12 — Lobby, profil, variantes (client)
- [ ] Étape 13 — IA (bots intermédiaire et expert)
- [ ] Étape 14 — Son et polish
- [ ] Étape 15 — Tests d'intégration, responsive mobile et déploiement

### Bugs connus
- Le responsive mobile (portrait + paysage) nécessite un polish supplémentaire. À résoudre à l'étape 15 avec tests sur appareil réel via Capacitor.

IMPORTANT : Mettre à jour cette section DEUX FOIS par tâche — au début (marquer EN COURS) et à la fin (cocher terminé + nombre de tests). Ne jamais oublier la mise à jour de fin.

## Stack technique

- **Monorepo** structuré avec les dossiers : `packages/engine`, `packages/server`, `packages/client`
- **Engine** (packages/engine) : TypeScript pur, aucune dépendance framework. Contient TOUTE la logique de jeu, les règles, la validation des coups, les pouvoirs. Doit être 100% testable unitairement.
- **Server** (packages/server) : Node.js, Express, Socket.IO, Prisma, SQLite. Fait autorité sur l'état du jeu (source de vérité). Le client n'est jamais cru — chaque action est validée par l'engine côté serveur.
- **Client** (packages/client) : React 18+, TypeScript, Vite, Tailwind CSS, Socket.IO-client, Framer Motion.

## Conventions de code

- TypeScript strict (`strict: true`) partout, zéro `any`
- Nommage : camelCase pour variables/fonctions, PascalCase pour types/interfaces/composants React
- Toute fonction publique de l'engine doit avoir un JSDoc décrivant son comportement
- Chaque pouvoir de carte est implémenté comme un module séparé dans `packages/engine/src/powers/`
- Les tests utilisent Vitest. Chaque fichier `.ts` de l'engine a un `.test.ts` correspondant
- Messages de commit : format `type: description courte` (ex: `feat: phase 11E — animations déplacement cartes`)

## Architecture de l'engine (CRITIQUE)

L'engine est le cœur du projet. Il doit être :
- **Pur** : aucun effet de bord, aucune dépendance réseau ou BDD
- **Déterministe** : mêmes entrées = mêmes sorties (sauf shuffle initial)
- **Sérialisable** : l'état complet du jeu (GameState) doit être JSON-sérialisable pour sauvegarde/restauration

### Structure de l'état du jeu (GameState)

```typescript
interface GameState {
  id: string;
  phase: 'setup' | 'swapping' | 'playing' | 'revolution' | 'superRevolution' | 'finished';
  players: Player[];
  deck: Card[];
  pile: PileEntry[];
  graveyard: Card[];
  currentPlayerIndex: number;
  direction: 1 | -1;
  turnOrder: number[];
  finishOrder: string[];
  variant: GameVariant;
  pendingAction: PendingAction | null;
  pendingActionDelayed?: boolean; // flag pour séquencer overlay AVANT popup (valets, target)
  pendingCemeteryTransit?: boolean; // flag pour transit pile→cimetière différé
  lastPowerTriggered: { type: string; ... } | null; // pouvoir à afficher en overlay
  log: LogEntry[];
}

interface LogEntry {
  type: string;
  entryType?: 'action' | 'power' | 'effect'; // pour couleurs dans le minilog/log
  data: Record<string, any>;
  timestamp: number;
}
```

### Pouvoirs — Résumé technique des règles

| Pouvoir | Valeur par défaut | Effet |
|---------|-------------------|-------|
| Burn | 10, ou 4 cartes identiques | Brûle la pile → cimetière, lanceur rejoue |
| Reset | 2 | Pile à valeur 0 pour le suivant |
| Under | 8 | Suivant doit jouer ≤ valeur du Under |
| Skip | 7 | Suivant(s) sautent. Cumulable. |
| Target | A | Lanceur choisit qui joue après lui |
| Mirror | 9 | Prend la valeur de la carte accompagnée (jamais seul) |
| Révolution | J♦ seul | Inverse l'ordre des valeurs jusqu'à ramassage |
| Super Révolution | J♦ + Mirror | Comme Révolution mais permanent |
| Manouche | J♠ seul | Prend 1 carte adversaire, donne 1+ de même valeur (ou skip échange) |
| Super Manouche | J♠ + Mirror | Échange libre (même nombre total) |
| Flop Reverse | J♥ seul | Échange flop ↔ dark flop d'un joueur (animation rotateX) |
| Flop Remake | J♥ + Mirror | Joueur recompose son flop + dark flop |
| Shifumi | J♣ seul | Pierre-papier-ciseaux, perdant ramasse. Tour passe après le perdant. |
| Super Shifumi | J♣ + Mirror | Comme Shifumi mais perdant = shit head |

### Règles importantes
- Après avoir joué, si la main < 3 cartes ET pioche non vide → pioche jusqu'à 3 cartes
- Transition Phase 1 → Phase 2 quand la pioche est vide
- Dark flop : une carte à l'aveugle, une par une. Si injouable → ramasse tout.
- Pile vide + main uniquement mirrors/valets → skipTurn (tour passé automatiquement)
- Après un ramassage (y compris shifumi perdu), le joueur APRÈS le ramasseur joue

## Architecture du client — Composants existants

```
App.tsx (state principal, socket handlers, animation coordination)
├── TopBar.tsx (titre, sélecteurs thème Table/Cartes, debug toggle)
├── GameBoard.tsx (plateau de jeu, fond tileable via ThemeContext)
│   ├── PlayerZone (×n joueurs, CSS Grid auto 1fr)
│   │   ├── PlayerAvatar.tsx (cercle coloré, taille bot/human)
│   │   ├── Cartes flop/dark flop (slots fixes, fuSlotRef/fdSlotRef)
│   │   └── Main en éventail (Reorder.Group, fanStyle)
│   ├── CardsColumn (zone centrale)
│   │   ├── PileHorizontal (5 derniers coups, contour vert)
│   │   ├── PowerOverlay.tsx (position: fixed, getBoundingClientRect)
│   │   ├── GraveyardDisplay (10 dernières brûlées)
│   │   └── Pioche (deck count)
│   ├── MiniLog (8 entrées, 3 types: action/power/effect)
│   ├── RevolutionBanner
│   ├── Modals (toutes via ModalWrapper + ModalButton) :
│   │   ├── TargetPickerModal, ManouchePickModal, SuperManouchePickModal
│   │   ├── ShifumiChoiceModal, ShifumiResultModal (auto-dismiss 3s)
│   │   ├── FlopRemakeModal, MultiJackOrderModal, FlopPickUpModal
│   │   └── RevolutionConfirm (inline)
│   └── Texte statut sous la main (illegalPlayReason, noLegalMove, emptyPileBlocked)
├── CardAnimationLayer.tsx (fixed z-100, ghost cards Framer Motion)
├── BottomBar.tsx (Jouer vert/grisé, Ramasser, Passer son tour jaune)
├── ChatPanel.tsx (rétractable gauche)
├── ActionLog.tsx (rétractable droite, mêmes entrées que minilog)
└── DebugPanel.tsx (dev only)
```

### Composants réutilisables
- **ModalWrapper.tsx** : overlay bg-black/60, conteneur bg-gray-800/95, titre serif doré, animation Framer Motion scale+opacity
- **ModalButton.tsx** : 3 variantes (player=dark+bordure, confirm=ambre, cancel=transparent)
- **Card.tsx** : tailles xs/sm/md, props ghost/noMotion/noLayout, intégration CardAnimationContext, dos via ThemeContext (image)

### Système de thèmes
- **src/themes/themeConfig.ts** : types TableBackground/CardBack, 4 fonds + 4 dos, bgColor par thème
- **src/themes/ThemeContext.tsx** : ThemeProvider + useTheme(), état React (pas de localStorage)
- Assets dans `public/themes/` : 4 fonds `.jpg` (1024×1024, affichés 512×512 CSS) + 4 dos `.png` (210×300)
- Sélecteurs dans TopBar : 2 dropdowns indépendants (Table + Cartes)

### Hooks custom
- **useCardAnimations.ts** : compare GameState consécutifs, détecte mouvements, crée FlyingCardAnim avec timing séquencé (play→overlay→draw)

### Système d'animation
- CardAnimationLayer : overlay fixed, ghost cards avec cubic bezier
- Séquence par coup : cartes volent (800ms) → overlay pouvoir (1500ms) → popups → pioche (600ms)
- pendingActionDelayed bloque les popups pendant vol+overlay
- isAnimating / currentPower bloque les interactions joueur pendant les animations
- Slots flop stables (Map<cardId, slotIndex>) : les cartes ne bougent pas quand une voisine est jouée

## Architecture du serveur

### Timing et séquençage
- OVERLAY_DELAY_MS = 1500ms : délai avant de clear pendingActionDelayed
- BOT_DELAY_MS = 1500ms : délai avant action bot (+ OVERLAY_DELAY_MS si lastPowerTriggered)
- CEMETERY_TRANSIT_DELAY_MS = 2250ms : délai transit pile→cimetière
- SHIFUMI_RESULT_DELAY_MS = 3000ms : auto-dismiss popup résultat shifumi
- pendingCemeteryTransit ne se résout QUE si !state.pendingAction (guard sur 9 locations)

### Communication Socket.IO

```
Client → Server :
  'solo:action'         { type, ...payload }
  'game:action'         { gameId, type, ...payload }
  'chat:send'           { gameId, text }

Server → Client :
  'game:state'          GameState (filtré par joueur)
  'chat:message'        { playerId, playerName, text, timestamp }
  'error'               { message }
```

### Sécurité
- JAMAIS envoyer les cartes cachées d'un joueur aux autres joueurs
- Toute action validée par l'engine côté serveur avant diffusion
- JWT pour l'authentification, Zod pour validation des entrées

## Base de données (Prisma + SQLite)

Modèles : User, DirectMessage, Game, GamePlayer. Voir `packages/server/prisma/schema.prisma`.

## IA (bots)

3 niveaux : Facile (première carte jouable), Intermédiaire (priorise faibles, garde pouvoirs), Expert (analyse complète). Interface commune BotStrategy dans `packages/engine/src/ai/`.

## Pièges à éviter

1. **Ne jamais faire confiance au client** pour la logique de jeu
2. **Le Mirror (9) ne se joue jamais seul** — toujours avec une autre carte
3. **La Révolution désactive TOUS les pouvoirs** y compris Under, Burn
4. **Le Burn par 4 exemplaires** fonctionne par accumulation inter-tours
5. **Super Manouche** : nombre total de cartes identique après échange
6. **Après rebuild engine, tuer le port serveur** (`npx kill-port 3456`) et relancer
7. **pendingActionDelayed** doit être true pour TOUS les pouvoirs avec overlay (valets ET target)
8. **pendingCemeteryTransit** ne doit se résoudre QUE quand pendingAction est null
9. **Tour après shifumi** : avanceTurn depuis le PERDANT, pas le lanceur

## Commandes utiles

```bash
npm run dev          # lance client + serveur en mode dev
npm run test         # lance tous les tests (engine + server + client)
npm run test:engine  # tests du moteur de jeu uniquement
npm run build        # build de production
npx kill-port 3456   # si port serveur bloqué
```

## Vision & contraintes futures
- Déploiement mobile prévu via Capacitor (garder le client léger, pas de dépendances desktop-only)
- Internationalisation prévue via i18next (ne pas hardcoder de textes côté composants)
- Son prévu via Howler.js (étape 14)
- Lobby, profil, variantes côté client prévus (étape 12)
- Bots intermédiaire et expert à implémenter (étape 13)
- Responsive mobile à finaliser avec tests sur appareil réel (étape 15)

## Idées à implémenter plus tard

### Étape 12 — Pouvoirs uniques configurables
- Permettre d'ajouter de nouveaux pouvoirs uniques au-delà des 4 actuels
- Chaque pouvoir unique a un effet standard + un effet "super" (déclenché par mirror)
- Deux modes de sélection : Manuel ou Tirage au sort

### Thèmes visuels (terminé — étape 12A)
- 4 thèmes : Casino (défaut), Saloon, Pirate, Love
- Fond tileable (1024×1024 affiché 512×512 CSS) + dos de cartes (210×300) par thème
- 2 sélecteurs indépendants dans la TopBar (Table + Cartes)
