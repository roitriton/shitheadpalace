# CLAUDE.md — Shit Head Palace

## Identité du projet

Shit Head Palace est une application web de jeu de cartes multijoueur en temps réel, avec IA, chat, profils utilisateurs et variantes personnalisables. Destinée à un déploiement mobile ultérieur via Capacitor.

## PROGRESSION DU DÉVELOPPEMENT

### Étapes terminées

- [x] **Étape 1** — Monorepo init (engine, server, client)
- [x] **Étape 2** — Engine : modèles et utilitaires (86 tests)
- [x] **Étape 3** — Engine : logique de jeu de base (340 tests)
- [x] **Étape 4A** — Pouvoirs simples : Burn, Reset, Under, Skip, Mirror (367 tests)
- [x] **Prototype visuel** — Serveur Express + Socket.IO, client React, 1 bot facile
- [x] **Étape 4B** — Pouvoirs complexes : Target, Révolution, Manouche, Flop Reverse, Shifumi + Super (727 tests)
- [x] **Étape 5** — Variantes engine : createVariant, validateVariant, serialize/deserialize (693 tests)
- [x] **Fix A→E** — Corrections valets, modals, bordures Card (757 tests)
- [x] **Étape 6** — Auth et comptes : Prisma SQLite, bcrypt, JWT, Zod (765 tests)
- [x] **Étape 7** — Multijoueur en ligne : Socket.IO rooms, lobby, reconnexions (821 tests)
- [x] **Étape 8** — Chat et messagerie temps réel (842 tests)
- [x] **Étape 9** — Layout casino + espace de jeu responsive (842 tests)
- [x] **Étape 11A** — Feedback visuel pouvoirs : PowerOverlay, RevolutionBanner, MiniLog, layout 3 colonnes (852 tests)
- [x] **Étape 11B** — Uniformisation modals : ModalWrapper + ModalButton (852 tests)
- [x] **Étape 11 (3→8)** — Multi-valets, quad burn, transit cimetière, combo main+flop (1033 tests)
- [x] **Étape 11C** — Quick fixes UI : PowerOverlay simplifié, bouton Jouer vert/grisé (1033 tests)
- [x] **Étape 11D** — Valets visibles pile + pendingActionDelayed + scheduleOverlayDelay (1070 tests)
- [x] **Étape 11D-bis** — Refonte popup manouche, bouton Jouer désactivé si illégal (1070 tests)
- [x] **Étape 11D-ter** — Skip tour pile vide, animation flop reverse rotateX (1070 tests)
- [x] **Étape 11E** — Animations cartes : CardAnimationLayer + useCardAnimations, 6 types de mouvement (1073 tests)
- [x] **Étape 12A** — Thèmes visuels : 4 thèmes + ThemeContext (1073 tests)
- [x] **Étape 12B** — Animation Flop Remake : dégradé arc-en-ciel, FlopRemakeCardOverlay (1073 tests)
- [x] **Étape 12C-1** — Modal config variantes : VariantConfigModal, écran d'accueil, 13 pouvoirs par rang (1073 tests)
- [x] **Étape 12C-2** — Pouvoirs uniques configurables : Manuel/Tirage au sort, engine variant-aware (1073 tests)
- [x] **Étape 12D** — minHandSize et flopSize configurables dans GameVariant (1101 tests)
- [x] **Étape 12E** — Auth UI : inscription, connexion, JWT, RGPD, persistance session (1103 tests)
- [x] **Étape 12F** — Améliorations visuelles : thème Foot, sélecteur unique, effet lumière radial (1103 tests)
- [x] **Étape 12G-1** — Popup ramassage flop : timing + affichage pile complète (1103 tests)
- [x] **Étape 12G** — Animations échange Manouche + overlay shifumi perdant + séquençage 3 étapes (1107 tests)
- [x] **Étape 12H-1** — Lobby multijoueur : navigation auth→lobby→game, RoomManager, liste rooms, création avec config variantes, join (1119 tests)
- [x] **Étape 12H-2** — Salle d'attente : ready/start/kick/updateVariant, lancement partie multijoueur, retour lobby après game over, cleanup rooms déconnexion (1145 tests)
- [x] **Fix 12H-ordre** — Ordre cyclique des adversaires relatif au joueur local (1145 tests)
- [x] **Étape 12H-3** — Ajout de bots dans la salle d'attente multijoueur : addBot/removeBot, 3 niveaux difficulté, UI créateur (1158 tests)
- [x] **Étape 12H-4** — Rooms privées avec code d'invitation : joinCode pour toutes les rooms, lobby:joinByCode, UI copie code + rejoindre par code (1160 tests)
- [x] **Étape 12H-5** — Reconnexion en cours de partie + bouton quitter : grâce period 60s, lobby:checkActiveGame, game:playerDisconnected/Reconnected, indicateur visuel déconnexion, remplacement bot auto, bouton « Quitter la partie » TopBar avec confirmation (1171 tests)
- [x] **Étape 12I** — Polish lobby + fix quitter partie : fond tilé, sélecteur thème, toast room closed, feedback visuel bouton quitter (1171 tests)
- [x] **Étape 12J** — Ajustements visuels : bandeaux noirs opaques, bordure jeu gris foncé (1171 tests)
- [x] **Étape 12K-1** — SiteHeader navigation + SiteLogo doré avec cartes éventail (1171 tests)
- [x] **Étape 12K-2** — Cohérence visuelle : boutons uniformisés, blocs profondeur, scroll, salle d'attente 2 colonnes, config variantes page plein écran (1171 tests)
- [x] **Étape 12K-3** — Écran connexion : fond noir uni + SiteLogo (1171 tests)
- [x] **Étape 12K-4** — Lobby restructuré 2 colonnes + panneau joueur (1171 tests)
- [x] **Étape 12K-5** — Page Règles complète avec accents (1171 tests)
- [x] **Étape 12K-6** — Phase de préparation : 3 colonnes, dark flop chevauchement, pouvoirs compacts (1171 tests)
- [x] **Étape 12K-7** — Titres dorés cohérents + config variantes 1 colonne + boutons haut/bas (1171 tests)
- [x] **Étape 12L-1** — Fix z-index cartes main > flop > dark flop, layout 3 tiers égaux, retrait Solo TopBar, bouton Passer permanent BottomBar (1171 tests)
- [x] **Étape 12L-2** — Debug mode conditionnel (toggle solo), Ramasser bloqué si coup légal, pioche/cimetière textes compacts (1171 tests)
- [x] **Fix 12L-2b** — Animation Manouche/Super Manouche : visibilité cartes selon point de vue (1171 tests)
- [x] **Étape 12L-2c→f** — Croix supprimée, bouton Jouer texte fixe, logs manouche/shifumi filtrés, z-index flop sélection, pseudos complets, surbrillance sans décalage (1171 tests)
- [x] **Fix 12L-2g** — Zone joueur principal : hauteurs fixes, overflow contenus, 3 tiers stricts (1171 tests)
- [x] **Fix 12L-2h** — Auto-skip loggué dans engine (skipTurn visible dans log/minilog) (1176 tests)
- [x] **Fix 12L-2i** — Fond tilé uniforme sur tous les écrans (vignette + luminosité radiale) (1176 tests)

### Nombre total de tests : 1176 (974 engine + 189 server + 13 client)

### Étapes à venir
- [ ] Étape 13 — IA (bots intermédiaire et expert)
- [ ] Étape 14 — Son (Howler.js) et polish
- [ ] Étape 15 — Tests d'intégration, responsive mobile (Capacitor) et déploiement

### Bugs connus

- Responsive mobile (portrait + paysage) → à résoudre étape 15 avec Capacitor.

IMPORTANT : Mettre à jour cette section DEUX FOIS par tâche — au début (marquer EN COURS) et à la fin (cocher terminé + nombre de tests).

## Stack technique

- **Monorepo** : `packages/engine`, `packages/server`, `packages/client`
- **Engine** : TypeScript pur, logique de jeu complète, 100% testable unitairement
- **Server** : Node.js, Express, Socket.IO, Prisma, SQLite — source de vérité (le client n'est jamais cru)
- **Client** : React 18+, TypeScript, Vite, Tailwind CSS, Socket.IO-client, Framer Motion
- **Auth** : `.env` requis avec `DATABASE_URL` et `JWT_SECRET`
- **i18n** : prévu via i18next (ne pas hardcoder de textes côté composants)

## Conventions de code

- TypeScript strict (`strict: true`) partout, zéro `any`
- Nommage : camelCase variables/fonctions, PascalCase types/interfaces/composants
- JSDoc sur toute fonction publique de l'engine
- Pouvoirs dans `packages/engine/src/powers/` (un module par pouvoir)
- Tests Vitest, chaque `.ts` de l'engine a un `.test.ts`
- Commits : `type: description courte`

## Architecture engine

Pur, déterministe, sérialisable (JSON). Aucun effet de bord.

### GameState

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
  pendingActionDelayed?: boolean;
  pendingCemeteryTransit?: boolean;
  lastPowerTriggered: { type: string; ... } | null;
  log: LogEntry[];
}
```

### Pouvoirs

| Pouvoir | Défaut | Effet |
|---------|--------|-------|
| Burn | 10 / 4 identiques | Pile → cimetière, lanceur rejoue |
| Reset | 2 | Pile à valeur 0 |
| Under | 8 | Suivant joue ≤ valeur |
| Skip | 7 | Saute suivant(s), cumulable |
| Target | A | Choisit le prochain joueur |
| Mirror | 9 | Copie la carte accompagnée (jamais seul) |
| Révolution | J♦ | Inverse ordre valeurs (temporaire) |
| Super Révolution | J♦+Mirror | Inverse ordre valeurs (permanent) |
| Manouche | J♠ | Prend 1 carte adversaire, donne 1+ même valeur |
| Super Manouche | J♠+Mirror | Échange libre (même nombre total) |
| Flop Reverse | J♥ | Échange flop ↔ dark flop |
| Flop Remake | J♥+Mirror | Recompose flop + dark flop |
| Shifumi | J♣ | Pierre-papier-ciseaux, perdant ramasse |
| Super Shifumi | J♣+Mirror | Perdant = shit head |

### Règles clés

- Main < minHandSize (défaut 3) + pioche non vide → pioche auto
- Pioche vide → phase 2 (flop/dark flop)
- Dark flop injouable → ramasse tout
- Pile vide + que mirrors/valets → skipTurn auto
- Après ramassage → joueur APRÈS le ramasseur joue

## Architecture client

```
App.tsx
├── VariantConfigModal.tsx
├── TopBar.tsx (thème, debug toggle)
├── GameBoard.tsx (fond tileable ThemeContext)
│   ├── PlayerZone ×n (PlayerAvatar, flop/dark flop, main en éventail)
│   ├── CardsColumn (PileHorizontal, PowerOverlay, GraveyardDisplay, Pioche)
│   ├── MiniLog, RevolutionBanner
│   ├── Modals (ModalWrapper+ModalButton) : Target, Manouche, SuperManouche,
│   │   ShifumiChoice, ShifumiResult, FlopRemake, MultiJackOrder, FlopPickUp
│   └── ShifumiLoserOverlay
├── CardAnimationLayer.tsx (ghost cards Framer Motion)
├── BottomBar.tsx (Jouer, Ramasser, Passer)
├── ChatPanel.tsx / ActionLog.tsx (panneaux rétractables)
└── DebugPanel.tsx
```

- **Thèmes** : 5 thèmes (Casino, Saloon, Pirate, Love, Foot) dans `src/themes/`, sélecteur unique TopBar
- **Animations** : useCardAnimations détecte mouvements entre GameState consécutifs, CardAnimationLayer anime
- **Séquence** : cartes volent → overlay pouvoir → popups → pioche (pendingActionDelayed bloque les popups)

## Architecture serveur

### Constantes de timing

| Constante | Valeur | Usage |
|-----------|--------|-------|
| OVERLAY_DELAY_MS | 1500 | Clear pendingActionDelayed |
| BOT_DELAY_MS | 1500 | Délai avant action bot |
| CEMETERY_TRANSIT_DELAY_MS | 2250 | Transit pile→cimetière |
| SHIFUMI_RESULT_DELAY_MS | 3000 | Auto-dismiss résultat shifumi |
| SHIFUMI_LOSER_OVERLAY_MS | 2000 | Overlay perdant sur avatar |
| MANOUCHE_ANIM_MS | 1600 | Animation échange cartes |
| FLOP_REMAKE_ANIM_MS | 2500 | Animation flop remake |

### Socket.IO

```
Client → Server :  solo:action, game:action, chat:send
Server → Client :  game:state (filtré par joueur), chat:message, error
```

### Sécurité

- JAMAIS envoyer les cartes cachées aux autres joueurs
- Actions validées par l'engine côté serveur
- JWT auth, Zod validation

## Base de données (Prisma + SQLite)

Modèles : User, DirectMessage, Game, GamePlayer. Voir `packages/server/prisma/schema.prisma`.

## IA (bots)

3 niveaux : Facile (première jouable), Intermédiaire (priorise faibles), Expert (analyse complète).
Interface BotStrategy dans `packages/engine/src/ai/`.

## Pièges à éviter

1. **Ne jamais faire confiance au client** pour la logique de jeu
2. **Mirror (9) ne se joue jamais seul** — toujours avec une autre carte
3. **Révolution désactive TOUS les pouvoirs** y compris Under, Burn
4. **Burn par 4 exemplaires** fonctionne par accumulation inter-tours
5. **Super Manouche** : nombre total de cartes identique après échange
6. **Après rebuild engine, tuer le port serveur** (`npx kill-port 3456`)
7. **pendingActionDelayed** = true pour TOUS les pouvoirs avec overlay (valets ET target)
8. **pendingCemeteryTransit** ne se résout QUE quand pendingAction est null
9. **Tour après shifumi** : avanceTurn depuis le PERDANT, pas le lanceur

## Commandes utiles

```bash
npm run dev          # client + serveur en mode dev
npm run test         # tous les tests
npm run test:engine  # tests engine uniquement
npm run build        # build production
npx kill-port 3456   # port serveur bloqué
```
