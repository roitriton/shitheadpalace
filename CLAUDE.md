\xEF\xBB\xBF\# CLAUDE.md — Shit Head Palace



\## Identité du projet



Shit Head Palace est une application web de jeu de cartes multijoueur en temps réel, avec IA, chat, profils utilisateurs et variantes personnalisables. Destinée à un déploiement mobile ultérieur via Capacitor.



\## PROGRESSION DU DÉVELOPPEMENT

Étapes terminées :
- [x] Étape 1 — Monorepo init (engine, server, client configurés)
- [x] Étape 2 — Engine : modèles et utilitaires (86 tests)
- [x] Étape 3 — Engine : logique de jeu de base (340 tests)
- [x] Étape 4A — Pouvoirs simples : Burn, Reset, Under, Skip, Mirror (367 tests)
- [x] Prototype visuel jouable (serveur Express + Socket.IO, client React, 1 bot facile, localhost:5173)

Étapes terminées (suite) :
- [x] Étape 4B — Pouvoirs complexes (727 tests au total)
  - [x] Target (As) — 27 tests ajoutés
  - [x] Révolution / Super Révolution (J♦) — 48 tests ajoutés
  - [x] Manouche / Super Manouche (J♠) — 63 tests ajoutés
  - [x] Flop Reverse / Flop Remake (J♥) — 73 tests ajoutés
  - [x] Shifumi / Super Shifumi (J♣) — 58 tests ajoutés
  - [x] Shifumi 3+ joueurs pour premier joueur — 7 tests ajoutés (ready.test.ts)

Étapes terminées (suite) :
- [x] Étape 5 — Variantes — engine (693 tests au total)
  - [x] Module packages/engine/src/variant/ — createVariant, validateVariant, assertVariantValid, serializeVariant, deserializeVariant (52 tests)

Corrections et améliorations (727 tests au total) :
- [x] Fix A — Valets restent dans la pile pendant Révolution/Super Révolution (pouvoirs supprimés) — 4 tests ajoutés
- [x] Fix B — FlopRemakeModal : cartes cliquables (correction layoutId Framer Motion)
- [x] Fix C — Nouvelles règles : valets interdits sur pile vide, auto-skip joueurs bloqués, allBlockedShifumi — 29 tests ajoutés
- [x] Fix D — SuperManouchePickModal : remplacement par système clic-échange (comme SwapPhase/FlopRemakeModal)
- [x] Fix E — Modals : bordure transparente par défaut sur Card pour éviter le redimensionnement au highlight doré

Outils de debug et améliorations UI :
- [x] Debug : log détaillé, reveal hands, inspecteurs de zones, debug swap phase (DebugPanel, DebugSwapPhase)
- [x] UI : flop remake modal, skip cumulable, valets au cimetière, valets sur pile vide, système clic-échange, super manouche

Étapes terminées (suite) :
- [x] Étape 6 — Auth et comptes (765 tests au total, +38 server)
  - [x] Prisma SQLite, bcrypt coût 12, JWT, Zod validation
  - [x] Routes : POST /auth/register, POST /auth/login, GET /auth/me
  - [x] Middleware requireAuth, PrismaClient singleton

Étapes terminées (suite) :
- [x] Étape 7 — Multijoueur en ligne (Socket.IO rooms, lobby, reconnexions) (821 tests au total, +55 server)

Étapes terminées (suite) :
- [x] Étape 8 — Chat et messagerie (842 tests au total, +6 engine)
  - [x] Étape 8A — Chat en temps réel en partie (828 tests, +7 chat.test.ts)
    - ChatMessage type, addChatMessage(), addSystemMessage() dans GameRoom
    - chatSendSchema Zod validation
    - Handler chat:send + messages système (join/leave/reconnect/start)
    - ChatPanel.tsx (panneau rétractable, badge unread, auto-scroll)
    - Intégration App.tsx (state, listeners, handlers)
  - [x] Étape 8B — Messages privés entre joueurs (836 tests, +8 messages.test.ts)
    - Réutilisation du modèle DirectMessage existant (Prisma)
    - Routes REST : POST /messages/send, GET /messages/:userId, GET /messages/unread/count, PATCH /messages/read/:userId
    - Validation Zod (pmSendSchema, max 500 chars)
    - Notification temps réel Socket.IO (pm:receive)
    - createMessagesRouter(io) factory pattern
  - [x] Étape 8C — Log des actions en jeu (842 tests, +6 log-integration.test.ts)
    - ActionLog.tsx : panneau production slide-from-right, couleurs par type de pouvoir, badge unread
    - Ordre inversé (newest first), numérotation chronologique conservée
    - Extraction formatLogEntry/formatRanks depuis DebugPanel vers ActionLog
    - getLogEntryColor() : mapping couleur par type (burn=red, skip=orange, reset=cyan, etc.)
    - Suppression DebugLogPanel de DebugPanel.tsx, simplification DebugToolbar
    - Boutons toggle animés (Framer Motion) : décalage chat→droite, log→gauche à l'ouverture
    - debugBarOffset : panneaux sous la barre DEBUG en mode dev (top-8)
    - Intégration App.tsx : state actionLogOpen/actionLogUnread, tracking nouvelles entrées
    - 6 tests d'intégration engine : play, pickUp, burn, skip, swap, darkPlayFail

Étapes terminées (suite) :
- [x] Étape 9 — Client : layout casino + espace de jeu (842 tests au total)
  - [x] Étape 9A — Fond de table casino (842 tests, pas de nouveaux tests)
    - Body bg quasi noir (#0a0a0f) "salle de casino" + vignette radiale sombre aux bords
    - Table ovale arrondie (rounded-[2.5rem]) avec feutre vert radial-gradient (#0d5e2e → #0a4a24 → #073d1c)
    - Double bordure : intérieure dorée (#c9a84c/30) + extérieure bois (#3d2b1f, 6px)
    - Ombre portée (inset + externe) pour profondeur
    - Titre discret "SHIT HEAD PALACE" serif doré opacité 0.6 au-dessus de la table
    - Cohérence : SwapPhase, DebugSwapPhase, loading screen mis à jour
    - Couleurs Tailwind ajoutées : casino.room, casino.wood
  - [x] Étape 9B — Disposition joueurs autour de la table (842 tests, pas de nouveaux tests)
    - PlayerAvatar.tsx : cercle 48px, dégradé par index (bleu/rouge/vert/orange), initiale, bordure dorée, glow animé au tour actif
    - getOpponentSeats() : positionnement dynamique (1 bot → top, 2 → top-left/top-right, 3 → left/top/right)
    - Grille CSS grid-cols-[1fr_2fr_1fr] grid-rows-[auto_1fr] pour adversaires + zone centrale
    - PlayerZone refactorisé : layout flex-row (avatar+nom à gauche, cartes à droite)
    - Zone humain centrée horizontalement (flex justify-center)
    - playerIndex prop ajouté à PlayerZone pour couleur avatar
  - [x] Étape 9C — Rendu des cartes amélioré (842 tests, pas de nouveaux tests)
    - Card.tsx : nouvelle taille xs (36×52px), prop noMotion pour déléguer animations au parent
    - Éventail paramétrable fanStyle(index, total, maxAngle, arcY) partagé bots/humain
    - Main humaine : éventail ±12° arc 8px, hover redresse+soulève, sélection zIndex 20
    - Main bots : éventail ±8° arc 5px combiné avec chevauchement (marginLeft négatif, max -24px)
    - Flop bots en taille xs avec gap réduit, flop humain inchangé (ligne droite)
  - [x] Étape 9D — Responsive desktop/tablette + bandeau fixe BottomBar (842 tests, pas de nouveaux tests)
    - BottomBar.tsx : bandeau fixe h-14 en bas (fixed bottom-0, z-50, bg-gray-900/95 backdrop-blur)
      - Gauche : bouton Chat (💬 + badge unread)
      - Centre : Jouer (gold + compteur) / ✕ Annuler (animé) / Ramasser (rouge)
      - Droite : bouton LOG (+ badge unread)
    - ActionBar supprimé de GameBoard — boutons migrés dans BottomBar, statut gardé au-dessus de la zone humain
    - ChatPanel / ActionLog : boutons toggle flottants supprimés, panneaux s'arrêtent au-dessus du bandeau (bottom-14)
    - Props unreadCount retirées de ChatPanel/ActionLog (badges dans BottomBar)
    - Breakpoints responsive recalibrés : base→mobile, sm:→640px, md:→768px
    - PlayerAvatar : tailles réduites (w-6 → sm:w-8 → md:w-10)
    - GameBoard : détection mobile (isMobile <640px) et landscape (isLandscape height<500px)
      - Mobile : cartes humaines sm, éventail ±6°/4px, flop gap 4px
      - Landscape : grille gaps réduits, centre compact
    - PlayerZone : prop compact pour mode mobile (card size, fan, gap)
    - CenterArea : prop compact pour paysage (gaps réduits)
    - App.tsx : pb-14 sur wrapper, calcul canPlay/canPickUp depuis game state

Bugs connus :
- Le responsive mobile (portrait + paysage) nécessite un polish supplémentaire : cartes qui débordent, swap phase non scrollable, éléments trop grands. À résoudre à l'étape 15 avec tests sur appareil réel via Capacitor.

Étapes terminées (suite) :
- [x] Étape 10 — Fusionnée avec l'étape 9 (9A-9D couvrent layout casino + espace de jeu)
- [x] Étape 11A — Feedback visuel des pouvoirs (852 tests)
  - PowerOverlay inline (colonne droite) : icône + texte toast pour chaque pouvoir, 1.5s
  - RevolutionBanner persistant (colonne gauche), fond noir
  - MiniLog : 5 dernières actions avec opacité dégressive
  - PileHorizontal : 5 derniers coups, opacité dégressive, contour vert fluo
  - GraveyardDisplay : 10 dernières cartes brûlées, fond noir, opacité dégressive
  - Layout 3 colonnes (25% pioche+révolution / 50% pile+cimetière / 25% overlay+minilog)
  - Bots jouent un tour à la fois avec délai 1.5s
  - lastPowerTriggered dans l'engine + pendingCardsPlayed pour les pouvoirs avec popup
  - Suppression des badges pouvoirs (RESET/UNDER/RÉV.)
  - Drag and drop pour réorganiser les cartes en main (Framer Motion Reorder)

Étapes à venir :
- [ ] Étape 11B — Client : UI pouvoirs et interactions spéciales (suite)
- [ ] Étape 12 — Lobby, profil, variantes (client)
- [ ] Étape 13 — IA (bots intermédiaire et expert)
- [ ] Étape 14 — Son et polish
- [ ] Étape 15 — Tests d'intégration et déploiement

IMPORTANT : Mettre à jour cette section DEUX FOIS par tâche — au début (marquer EN COURS) et à la fin (cocher terminé + nombre de tests). Ne jamais oublier la mise à jour de fin.

\## Stack technique



\- \*\*Monorepo\*\* structuré avec les dossiers : `packages/engine`, `packages/server`, `packages/client`

\- \*\*Engine\*\* (packages/engine) : TypeScript pur, aucune dépendance framework. Contient TOUTE la logique de jeu, les règles, la validation des coups, les pouvoirs. Doit être 100% testable unitairement.

\- \*\*Server\*\* (packages/server) : Node.js, Express, Socket.IO, Prisma, PostgreSQL. Fait autorité sur l'état du jeu (source de vérité). Le client n'est jamais cru — chaque action est validée par l'engine côté serveur.

\- \*\*Client\*\* (packages/client) : React 18+, TypeScript, Vite, Tailwind CSS, Socket.IO-client, react-i18next, Howler.js, Framer Motion.



\## Conventions de code



\- TypeScript strict (`strict: true`) partout, zéro `any`

\- Nommage : camelCase pour variables/fonctions, PascalCase pour types/interfaces/composants React

\- Toute fonction publique de l'engine doit avoir un JSDoc décrivant son comportement

\- Chaque pouvoir de carte est implémenté comme un module séparé dans `packages/engine/src/powers/`

\- Les tests utilisent Vitest. Chaque fichier `.ts` de l'engine a un `.test.ts` correspondant

\- Messages de commit : format conventionnel `type(scope): description` (ex: `feat(engine): implement burn power`)

\- Internationalisation : toute chaîne visible par l'utilisateur passe par i18next, jamais de texte en dur dans les composants



\## Architecture de l'engine (CRITIQUE)



L'engine est le cœur du projet. Il doit être :

\- \*\*Pur\*\* : aucun effet de bord, aucune dépendance réseau ou BDD

\- \*\*Déterministe\*\* : mêmes entrées = mêmes sorties (sauf shuffle initial)

\- \*\*Sérialisable\*\* : l'état complet du jeu (GameState) doit être JSON-sérialisable pour sauvegarde/restauration



\### Structure de l'état du jeu (GameState)



```typescript

interface GameState {

&nbsp; id: string;

&nbsp; phase: 'setup' | 'swapping' | 'playing' | 'revolution' | 'superRevolution' | 'finished';

&nbsp; players: Player\[];

&nbsp; deck: Card\[];           // pioche

&nbsp; pile: PileEntry\[];      // pile (avec historique : qui a joué quoi)

&nbsp; graveyard: Card\[];      // cimetière (cartes brûlées)

&nbsp; currentPlayerIndex: number;

&nbsp; direction: 1 | -1;      // sens de jeu (1 = horaire, -1 = anti-horaire)

&nbsp; turnOrder: number\[];     // ordre des tours restants (pour gérer skip, target)

&nbsp; finishOrder: string\[];   // IDs des joueurs ayant terminé, dans l'ordre

&nbsp; variant: GameVariant;    // config des pouvoirs assignés aux valeurs

&nbsp; pendingAction: PendingAction | null; // action en attente (choix manouche, shifumi, etc.)

&nbsp; log: LogEntry\[];         // historique des actions

}



interface Player {

&nbsp; id: string;

&nbsp; name: string;

&nbsp; hand: Card\[];

&nbsp; faceUp: Card\[];    // flop (face visible)

&nbsp; faceDown: Card\[];  // dark flop (face cachée)

&nbsp; isFinished: boolean;

&nbsp; isBot: boolean;

&nbsp; botDifficulty?: 'easy' | 'medium' | 'hard';

}



interface Card {

&nbsp; suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';

&nbsp; rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

&nbsp; // Pour les valets, le pouvoir dépend de la couleur :

&nbsp; // J♦ = Révolution, J♠ = Manouche, J♥ = Flop Reverse, J♣ = Shifumi

}



interface GameVariant {

&nbsp; name: string;

&nbsp; powerAssignments: Record<Power, CardRank | CardRank\[]>;

&nbsp; playerCount: number;

&nbsp; deckCount: number; // nombre de paquets de 52 cartes

}

```



\### Pouvoirs — Résumé technique des règles



| Pouvoir | Valeur par défaut | Jouable sur | Effet |

|---------|-------------------|-------------|-------|

| Burn | 10, ou 4 cartes identiques | Tout sauf Under si valeur > Under | Brûle la pile → cimetière, lanceur rejoue |

| Reset | 2 | Tout | Pile à valeur 0 pour le suivant |

| Under | 8 | Carte standard (valeur ≤) | Suivant doit jouer ≤ valeur du Under |

| Skip | 7 | Tout | Suivant(s) sautent. Cumulable. |

| Target | A | Carte standard (valeur ≤) | Lanceur choisit qui joue après lui |

| Mirror | 9 | Accompagnement uniquement | Prend la valeur de la carte accompagnée |

| Révolution | J♦ seul | Carte standard (valeur ≤) | Inverse l'ordre des valeurs, supprime pouvoirs jusqu'à ramassage |

| Super Révolution | J♦ + Mirror(s) | Carte standard (valeur ≤) | Comme Révolution mais permanent |

| Manouche | J♠ seul | Carte standard (valeur ≤) | Prend 1 carte à un adversaire, donne 1+ carte(s) de même valeur |

| Super Manouche | J♠ + Mirror(s) | Carte standard (valeur ≤) | Échange libre cartes entre lanceur et adversaire (même nombre total) |

| Flop Reverse | J♥ seul | Carte standard (valeur ≤) | Échange flop ↔ dark flop d'un joueur |

| Flop Remake | J♥ + Mirror(s) | Carte standard (valeur ≤) | Joueur recompose son flop + dark flop |

| Shifumi | J♣ seul | Carte standard (valeur ≤) | 2 joueurs font pierre-papier-ciseaux, perdant ramasse |

| Super Shifumi | J♣ + Mirror(s) | Carte standard (valeur ≤) | Comme Shifumi mais perdant = shit head, partie finie |



\### Règles de pioche (Phase 1)

Après avoir joué, si la main du joueur contient < 3 cartes ET que la pioche n'est pas vide, il pioche jusqu'à avoir 3 cartes (ou vide la pioche).



\### Transition Phase 1 → Phase 2

Quand la pioche est vide. Les joueurs continuent avec leurs cartes en main, puis flop, puis dark flop.



\### Dark flop

En phase 2, quand un joueur joue depuis le dark flop : il joue une carte à l'aveugle, une par une (sauf après Flop Reverse/Remake où il peut en jouer plusieurs). S'il se trompe en en choisissant plusieurs non jouables ensemble, il ramasse tout (pile + cartes choisies).



\### Détermination du premier joueur

1\. Joueur avec la carte la plus basse en main

2\. En cas d'égalité : celui qui en a le plus d'exemplaires

3\. Si encore égalité : shifumi entre les ex-aequo



\## Architecture du serveur



\### Communication Socket.IO — Events principaux



```

Client → Server :

&nbsp; 'game:play-cards'     { gameId, cardIds, targetPlayerId? }

&nbsp; 'game:pick-up-pile'   { gameId }

&nbsp; 'game:swap-cards'     { gameId, handCardId, flopCardId }

&nbsp; 'game:ready'          { gameId }

&nbsp; 'game:shifumi-choice' { gameId, choice: 'rock'|'paper'|'scissors' }

&nbsp; 'game:manouche-pick'  { gameId, takeCardId, giveCardIds }

&nbsp; 'game:flop-remake'    { gameId, faceUp: cardId\[], faceDown: cardId\[] }

&nbsp; 'chat:message'        { gameId, text }



Server → Client :

&nbsp; 'game:state-update'   GameState (filtré : chaque joueur ne voit que ses propres cartes cachées)

&nbsp; 'game:action-log'     LogEntry

&nbsp; 'game:power-animation' { power, playerId }

&nbsp; 'game:finished'        { finishOrder }

&nbsp; 'chat:message'         { playerId, playerName, text, timestamp }

&nbsp; 'error'                { message, code }

```



\### Sécurité

\- \*\*JAMAIS\*\* envoyer les cartes cachées d'un joueur aux autres joueurs

\- Toute action est validée par l'engine côté serveur avant diffusion

\- Rate limiting sur les messages de chat et les actions de jeu

\- JWT pour l'authentification, httpOnly cookies pour les sessions

\- Validation des entrées avec Zod sur chaque endpoint et event Socket.IO



\## Architecture du client



\### Composants principaux



```

App

├── AuthProvider (contexte d'authentification)

├── GameLobby (liste des salons, création de partie)

├── GameRoom

│   ├── GameBoard (espace central de jeu)

│   │   ├── PlayerArea (×n joueurs, disposés autour du tapis)

│   │   │   ├── Avatar

│   │   │   ├── HandFan (cartes en éventail)

│   │   │   ├── FlopStack (flop + dark flop empilés)

│   │   ├── CenterArea

│   │   │   ├── Deck (pioche)

│   │   │   ├── Pile (pile de jeu)

│   │   │   └── Graveyard (cimetière)

│   │   └── PowerAnimation (overlay animé des pouvoirs)

│   ├── ChatPanel (rétractable, à gauche)

│   ├── LogPanel (rétractable, à droite)

│   └── PileHistoryModal (popup consultable)

├── Profile (profil utilisateur, stats, historique)

├── VariantEditor (configuration des variantes)

└── Messaging (messages privés)

```



\### Disposition responsive

\- \*\*Desktop\*\* : Chat à gauche, jeu au centre, log à droite

\- \*\*Mobile\*\* : Jeu plein écran, chat et log en onglets overlay en bas



\### Animations (Framer Motion)

\- Déplacement de cartes entre zones : 1-2 secondes, courbe ease-in-out

\- Animation de pouvoir : icône apparaît au-dessus de la pile, grossit en devenant transparente, occupe l'espace central puis disparaît (~1.5s)



\### Son (Howler.js)

\- Contrôle du volume global + mute dans les paramètres

\- Effets : carte jouée, carte piochée, burn (flamme), skip (buzzer), ramassage pile, victoire, shifumi

\- Musique d'ambiance optionnelle (jazz lounge / casino)



\## Base de données (Prisma)



\### Modèles principaux



```prisma

model User {

&nbsp; id            String   @id @default(cuid())

&nbsp; email         String   @unique

&nbsp; username      String   @unique

&nbsp; passwordHash  String?

&nbsp; googleId      String?  @unique

&nbsp; appleId       String?  @unique

&nbsp; avatarUrl     String?

&nbsp; createdAt     DateTime @default(now())

&nbsp; gamesPlayed   GamePlayer\[]

&nbsp; variants      GameVariant\[]

&nbsp; sentMessages  DirectMessage\[] @relation("sender")

&nbsp; receivedMessages DirectMessage\[] @relation("receiver")

}



model Game {

&nbsp; id          String       @id @default(cuid())

&nbsp; status      GameStatus

&nbsp; variantData Json

&nbsp; startedAt   DateTime?

&nbsp; finishedAt  DateTime?

&nbsp; players     GamePlayer\[]

}



model GamePlayer {

&nbsp; id           String  @id @default(cuid())

&nbsp; userId       String

&nbsp; gameId       String

&nbsp; finishPlace  Int?    // 1 = premier, null = shit head ou pas fini

&nbsp; isShitHead   Boolean @default(false)

&nbsp; user         User    @relation(fields: \[userId], references: \[id])

&nbsp; game         Game    @relation(fields: \[gameId], references: \[id])

}

```



\## IA (bots)



\### 3 niveaux de difficulté



\- \*\*Facile\*\* : joue la première carte jouable trouvée, ne garde jamais ses pouvoirs, ne réfléchit pas

\- \*\*Intermédiaire\*\* : priorise les cartes faibles, garde les pouvoirs pour les moments utiles, gestion basique de la main

\- \*\*Expert\*\* : analyse l'état du jeu complet (cartes visibles, taille des mains adverses, cartes restantes possibles), minimise le risque, maximise la pression sur les adversaires, garde les burns et targets pour des moments stratégiques



L'IA est implémentée dans `packages/engine/src/ai/` avec une interface commune :

```typescript

interface BotStrategy {

&nbsp; chooseAction(state: GameState, playerId: string): GameAction;

&nbsp; chooseShifumiChoice(): 'rock' | 'paper' | 'scissors';

&nbsp; chooseManoucheCards(state: GameState, playerId: string, targetId: string): ManoucheChoice;

}

```



\## Thème visuel



\- Fond espace de jeu : texture feutre vert foncé (#1a472a)

\- Zone centrale pioche/pile/cimetière : feutre vert clair (#2d8a4e)

\- Ambiance : salon de jeu / casino élégant à l'ancienne

\- Typographie : serif élégant pour les titres (Playfair Display), sans-serif pour le contenu (Inter)

\- Bordures et décorations : dorées (#c9a84c) avec motifs subtils



\## Pièges à éviter



1\. \*\*Ne jamais faire confiance au client\*\* pour la logique de jeu

2\. \*\*Ne jamais envoyer le GameState complet\*\* au client — filtrer les cartes cachées des adversaires

3\. \*\*Le Mirror (9) ne se joue jamais seul\*\* — toujours avec une autre carte

4\. \*\*La Révolution désactive TOUS les pouvoirs\*\* y compris Under, Burn (sauf le burn par 4 cartes identiques qui reste ? NON, tous désactivés)

5\. \*\*Pendant une Révolution, l'ordre des valeurs est inversé\*\* : il faut jouer ≤ au lieu de ≥

6\. \*\*La Super Révolution est permanente\*\* jusqu'à la fin de la partie

7\. \*\*Le Burn par 4 exemplaires\*\* : si 3 cartes de même valeur sont sur la pile et qu'un joueur ajoute la 4ème, c'est un Burn

8\. \*\*Flop Remake\*\* : max 3 cartes par étage (flop et dark flop), le joueur choisit les emplacements du dark flop

9\. \*\*Super Manouche\*\* : le nombre total de cartes dans chaque main doit rester identique après l'échange

10\. \*\*Phase de swap initiale\*\* : les joueurs peuvent échanger cartes main ↔ flop AVANT que la partie commence



\## Commandes utiles



```bash

\# Développement

npm run dev          # lance client + serveur en mode dev

npm run test         # lance tous les tests

npm run test:engine  # tests du moteur de jeu uniquement

npm run lint         # vérification du code

npm run build        # build de production



\# Base de données

npx prisma migrate dev   # appliquer les migrations

npx prisma studio        # interface visuelle BDD

```



\## Idées à implémenter plus tard

\### Étape 12 — Pouvoirs uniques configurables
\- Permettre d'ajouter de nouveaux pouvoirs uniques au-delà des 4 actuels (manouche, shifumi, flop reverse, révolution)
\- Chaque pouvoir unique a un effet standard + un effet "super" (déclenché par mirror)
\- La valeur qui porte les pouvoirs uniques est configurable (ex: valets, ou une autre valeur)
\- Deux modes de sélection lors de la création de variante :
  \- \*\*Manuel\*\* : choisir dans une liste quel pouvoir unique attribuer à chaque carte
  \- \*\*Tirage au sort\*\* : bouton "random" qui pioche 4 pouvoirs au hasard dans la liste des pouvoirs uniques disponibles et les assigne aux 4 cartes de la valeur choisie
\- Implique : étendre le type Variant avec un mapping uniquePowerSlots, créer une liste availableUniquePowers, refactor du mapping pouvoir↔carte dans l'engine

