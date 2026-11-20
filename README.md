# 🃏 RIVAL CARD ⚡

[![React Native](https://img.shields.io/badge/React%20Native-0.88-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo%20SDK-58-black.svg)](https://expo.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime-emerald.svg)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Rival Card** is a fast-paced, high-stakes 2D cartoon mobile card game built with **React Native**, **Expo SDK 58**, and **Supabase Realtime**. Match colors and values, unleash identical pair combos, survive a **3-minute match clock**, block or reflect incoming attacks with reactive **Shield** and **Mirror** cards, shout **RIVAL!** before opponents catch you sleeping, and climb the championship podium!

---

## 🎮 Core Gameplay Mechanics

### 1. The 112-Card Engine
- **Number Cards (`0–9`)**: Four vibrant, symbol-coded colors (**Ruby Red**, **Electric Blue**, **Emerald Green**, **Golden Yellow**).
- **Standard Action Cards**:
  - ⊘ **Skip**: Skips the next player's turn (in 1v1 duels, returns the turn right back to you).
  - ⇄ **Reverse**: Flips turn direction (acts as a Skip in 1v1 duels).
  - **+2 Draw Two**: Forces the next player to draw 2 cards and forfeit their turn (supports **+2 Stacking**).
- **Wild Cards**:
  - 🌈 **Wild Color Change**: Play anytime to switch the active table color.
  - 💥 **Wild Draw 4 (`+4`)**: Play anytime to change the active table color, force the next player to draw 4 cards, and skip them (supports **+4 Stacking**).
- **Special Power Cards** (`2` of each per deck — inspectable anytime in the Home screen **✨ Special Cards** 4-portion catalogue):
  - 🔄 **Rival Swap**: Play anytime to choose the active color and swap your entire hand using smart **3-tier targeting** (fewest cards → highest hand strength → next in turn order). If swapping leaves you with 1 card, **RIVAL!** is automatically declared so opponents cannot penalize you with a `+2` catch.
  - 🔇 **Mute**: Play anytime to change color, silence the next rival, and skip their turn for **1 round** (or **2 full rounds** when played as an identical pair!).
  - 🛡️ **Shield**: Play on your turn as a Wild color-changer, OR react within a **3-second Defense Window** to completely block any incoming `+2`, `+4`, or escalated stack (`+6`, `+8`) while keeping zero penalty cards.
  - 🪞 **Mirror**: Play on your turn as a Wild color-changer, OR react within **3 seconds** to reflect `+2`, `+4`, `Skip`, `Mute`, or `Rival Swap` back onto the attacker! Includes the **Counter-Mirror** rule (an attacker holding Mirror gets one 3s bounce-cancel window; max 1 bounce).

### 2. Identical Pair Play & Draw Card Stacking
- **Pair Play (`⚡ Play Pair (x2)`)**: Select two identical cards (same color and value) in your hand to open a compact floating quick-action pill and drop both simultaneously—or choose **Play Single** to hold one back.
- **Draw Stacking**: Chain `+2 → +4 → +6 → +8` or `+4 → +8` when an attack targets you, or choose **Take Cards**, **Use Shield**, or **Use Mirror**.

### 3. 3-Minute Match Timer & Deterministic Card-Priority Tie-Breaker
- Every match runs on a compact **3:00 (`180s`)** countdown timer in the top HUD (`02:45`, turning amber under `0:30` and pulsing red under `0:10`).
- Local modes pause the clock cleanly while Pause, How-to-Play, or Pass & Play privacy veil modals are open; Online Rooms synchronize the clock across all players via `matchStartedAt`.
- If the clock reaches `00:00` before anyone empties their hand:
  1. **Primary Rule**: The player with the **fewest remaining cards** wins.
  2. **Priority Score Tie-Breaker** (when tied on card count, higher hand priority score wins):
     - **Tier 1 (`10 pts` each)**: Special Cards (`Rival Swap`, `Mute`, `Shield`, `Mirror`), `Wild Draw 4 (+4)`, and `Wild Color Change`.
     - **Tier 2 (`5 pts` each)**: Action Cards (`Skip`, `Reverse`, `Draw 2 (+2)`).
     - **Tier 3 (`1 pt` each)**: Number Cards (`0–9`).
     - *(Remaining exact ties resolve deterministically via highest single card tier, fewest turns, then seat order.)*

### 4. 15-Second Turn Timer & 2.5s "CATCH RIVAL!" Penalty
- **15s Turn Clock (`TurnTimerBadge`)**: Players have **15 seconds** per turn before AFK auto-play (or auto-draw/pass) keeps the match moving.
- **RIVAL! Callout**: When holding **2 cards** on your turn, tap **RIVAL!** before dropping to **1 card** (re-armed each time your hand returns to 2 cards). Forget to call it and opponents get a **2.5-second window** to tap **CATCH!** for a **+2 card penalty** (bots react in `1.2s–2.2s`). *Rival Swap drops to 1 card automatically self-declare RIVAL!*

---

## 🕹️ Game Modes

| Mode | Connectivity | Description |
| :--- | :--- | :--- |
| 🤖 **Play with Bot** | **100% Offline** | Battle smart heuristic AI bots (`1v1`, `3-Player`, or `4-Player`) with reactive Shield/Mirror defense and configurable **Fast Bot Turns**. |
| 📱 **Pass & Play** | **100% Offline** | Couch multiplayer on one device with an automatic between-turn **Privacy Mask** (`PrivacyMaskModal`) so no one peeks at cards. |
| ⚡ **Quick Match** | **Online** | Instant public matchmaking queue via Supabase with 12-second fallback to RivalBot and full Career Stats recording. |
| 🌐 **Custom Rooms (5-Match Series)** | **Online** | Host or join 4-digit private lobbies featuring a **5-Match Series** leaderboard (`PrivateSeriesModal`), live taunts (`TauntBar`), host migration on leave, and automatic match reconnection (`ResumeMatchModal`). |

---

## 🎨 Menu, Catalogue, Rulebook & Store

- **Warm Arcade Home Hub (`HomeScreen.tsx`)**: Portrait cartoon home screen with custom card-corner artwork, top HUD (Profile avatar pill, Level/XP bar, **✨ Special Cards** catalogue pill, Coins, and Gems), three main play mode buttons, and bottom utility dock (**How to Play**, **Store**, **Settings**).
- **✨ Special Cards Catalogue (`SpecialCardsModal.tsx`)**: Interactive 4-portion showcase detailing **Rival Swap**, **Mute**, **Shield**, and **Mirror** side-by-side with high-res card artwork and full ability breakdowns.
- **📖 4-Page Book Rulebook (`HowToPlayModal.tsx`)**: Concise 4-chapter guide covering Basics & Combos, Action Cards, Wilds & RIVAL! Rules, and the 3-Minute Clock & Tie-Breaker.
- **🛒 Cosmetic Store (`ShopModal.tsx`) & Profile (`ProfileModal.tsx`)**: Collect Coins and Gems, unlock high-stakes emotes, customize avatars, and edit your profanity-filtered nickname (`3–16` chars with leetspeak normalization).

---

## 🔊 Dynamic Audio & Sound Effects Engine

Dual-channel audio engine powered by `expo-audio` (`audioService` & `soundService`):
- **Adaptive Background Music**: Cross-fades smoothly between Menu BGM (`background.mp3`) and Match BGM (`match-background.mp3`), with audio presets (**All Muted**, **Balanced SFX**, **Full Arcade**) in Settings.
- **Dedicated Action SFX**:
  - 📣 `rival_shout.mp3` — Broadcasted "RIVAL!" callout heard across the table.
  - 🎨 `color-change.mp3`, 💥 `plus-four.mp3`, `plus-two.mp3`, ⊘ `skip.mp3`, ⇄ `reverse.mp3`, 🔄 `swap.mp3`, 🔇 `mute.mp3`.
  - 🛡️ **Shield Block & 🪞 Mirror Reflect**: Synthesized cosmic defense and arcane deflection cues triggered cleanly once per defense event.

---

## 🔐 Authentication, Account Healing & Cloud Sync

- **Native Google Sign-In (`@react-native-google-signin/google-signin`)**: Opens the native Google Play Services bottom sheet, extracts the ID token (`response.data?.idToken` or legacy `response.idToken`), and exchanges it with Supabase `signInWithIdToken({ provider: 'google', token })`—gracefully handling `SIGN_IN_CANCELLED` / Android `12501` and restoring sticky-immersive mode afterward.
- **Email 6-Digit OTP**: Passwordless verification flow built directly into `OnboardingAuthModal.tsx`.
- **Guest-First Progress Preservation**: Playing offline or skipping onboarding starts cleanly as Guest. Linking Google or Email OTP preserves and merges local XP, level, coins, gems, and stats (`migrateAndLinkGuestAccount`) without resetting to zero. Active Supabase sessions self-heal stale guest flags on boot (`syncAuthSessionToProfile`) and inside `SettingsModal`, displaying the verified email/account ID and supporting full Google + Supabase sign-out (`signOutNativeGoogle`).

---

## 🪙 Game Economy & Reward Balancing

| Match Type | Victory Reward | Defeat Reward | Economy Rules |
| :--- | :--- | :--- | :--- |
| ⚡ **Online Quick Match** | **+100 XP** / **+50 Coins** | **+25 XP** / **+10 Coins** | Full ranked payouts; records career wins, win streaks, and leaderboard progress. |
| 🤖 **Play with Bot (Offline)** | **+20 XP** / **+10 Coins** | **+5 XP** / **+2 Coins** | Enforces a **100 Coins/day** soft cap (`@rivalcard:daily_bot_earnings`) to prevent infinite offline farming. |
| 📱 **Pass & Play / 🌐 Custom Rooms** | **0 XP** / **0 Coins** | **0 XP** / **0 Coins** | Casual & series modes excluded from currency farming. |

- **Level-Up Bonus**: Reaching each new level (`level * 100` XP threshold) awards **+100 Coins** and **+5 Gems**.

---

## 🛡️ Offline-First Resilience & Mobile UX

- **100% Offline Playable**: Offline launches skip hanging spinners and go straight into local play (`Play with Bot` and `Pass & Play`).
- **Fail-Fast Network Guards**: Online matchmaking and custom rooms validate connectivity via `networkService.isOnline()` / `ensureOnline()`.
- **Sticky-Immersive Android Fullscreen**: Configured via `expo-navigation-bar` plugin and `src/utils/immersiveMode.ts` listeners across app focus, orientation switches (Portrait Home ↔ Landscape Arena), and system sheets.
- **Global Error Boundary**: `ErrorBoundary.tsx` catches unexpected runtime errors with a cartoon recovery screen and one-tap **Restart Game** reset.

---

## 📁 Repository Structure

```text
rival-card/
├── assets/                          # Cartoon icons, backgrounds, fonts & audio
│   ├── home/                        # Redesigned Home hub artwork & icons
│   ├── icons/                       # Card action icons
│   ├── sounds/                      # Menu/match BGM & game-sounds SFX
│   ├── card_back.png                # Card back graphic
│   ├── icon.png                     # Adaptive app icon
│   └── logo.png                     # Rival Card hero logo
├── src/
│   ├── components/                  # Modals, HUD badges & card UI
│   │   ├── CardView.tsx             # 2D cartoon cards (numbers, Wilds, Reverse SVG, Shield/Mirror)
│   │   ├── DefenseReactionModal.tsx # Compact 3s reactive Shield/Mirror defense popup
│   │   ├── DraggableCard.tsx        # Drag & flick card gesture handler
│   │   ├── GameOverModal.tsx        # Winner podium, confetti & clean timeout standings
│   │   ├── HowToPlayModal.tsx       # 4-page book-style rulebook modal
│   │   ├── MatchTimerBadge.tsx      # 3:00 HUD match clock badge
│   │   ├── MultiplayerLobbyModal.tsx# Quick Match & 4-digit Custom Room hub
│   │   ├── OnboardingAuthModal.tsx  # Google Sign-In, Email OTP & Guest welcome modal
│   │   ├── PrivateSeriesModal.tsx   # 5-match private room scorecard & rematch hub
│   │   ├── ProfileModal.tsx         # Avatar picker, profanity-filtered name & career stats
│   │   ├── SettingsModal.tsx        # Audio presets, gameplay toggles & cloud/guest account UI
│   │   ├── ShopModal.tsx            # Store catalog & starter inventory
│   │   ├── SpecialCardsModal.tsx    # 4-portion interactive Special Cards catalogue
│   │   └── ...
│   ├── screens/
│   │   ├── HomeScreen.tsx           # Portrait main menu hub & Special Cards trigger
│   │   ├── GameScreen.tsx           # Landscape match arena, timers, Pair Play & sync loop
│   │   └── LoadingScreen.tsx        # Animated sunburst boot loader
│   ├── services/
│   │   ├── audioService.ts          # Dual-channel BGM & SFX engine
│   │   ├── authService.ts           # Native Google Sign-In, Email OTP & session sync
│   │   ├── matchmakingService.ts    # Quick Match queue + 12s bot fallback
│   │   ├── multiplayerService.ts    # Supabase Realtime room & state snapshot sync
│   │   ├── playerProfileService.ts  # Local/cloud profile merge, XP & economy payouts
│   │   ├── rulebookService.ts       # 4-page rulebook data & helpers
│   │   ├── specialCardsService.ts   # 4-portion Special Cards catalogue specs
│   │   ├── shopService.ts           # Store catalog & equipped cosmetics
│   │   └── ...
│   ├── utils/
│   │   ├── contentFilter.ts         # Leetspeak normalization & profanity check
│   │   └── immersiveMode.ts         # Android sticky-immersive bar helpers
│   ├── gameEngine.ts                # 112-card rules, tie-breaker, defense & bot AI
│   ├── types.ts                     # Shared TypeScript interfaces
│   └── __tests__/                   # Automated unit test suites (236+ tests)
├── App.tsx                          # Boot sequence, deep-link auth & navigation container
├── app.json                         # Expo config (com.hashir.rivalcard)
├── eas.json                         # EAS Build profiles (preview APK & production AAB)
└── package.json                     # Dependencies & npm scripts
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Expo Go](https://expo.dev/go) or a custom development build (required for native `@react-native-google-signin/google-signin`)

### Installation & Local Development
```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Run on Android / iOS / Web
npx expo start --android
npx expo start --ios
npx expo start --web
```

---

## 🧪 Testing & Verification

```bash
# Run full unit test suite (Node test runner + tsx)
npm test

# Run TypeScript typecheck
npm run typecheck

# Verify production Metro bundle export
npx expo export --no-bytecode
```

---

## 📦 Building for Android & Google Play (EAS Build)

`eas.json` defines both internal APK testing and Play Store `.aab` release profiles:

```bash
# Authenticate with Expo Application Services
npx eas-cli login

# Build internal test APK
npx eas-cli build -p android --profile preview

# Build Google Play Store Android App Bundle (.aab)
npx eas-cli build -p android --profile production
```

---

## 🛠️ Tech Stack

- **Mobile Framework**: React Native `0.88.1`, Expo SDK `58`, React `19.3.0`
- **Language**: TypeScript `6.0`
- **Animations & Gestures**: React Native Reanimated `4`, React Native Gesture Handler `3`
- **Backend & Auth**: Supabase Realtime Channels, Supabase Auth (`signInWithIdToken`, Email OTP), `@react-native-google-signin/google-signin`
- **Audio & Feedback**: `expo-audio`, `expo-haptics`, `expo-navigation-bar`
- **Testing**: `node:test` & `tsx`

---

## 📜 License
MIT License. Crafted with ❤️ for **Rival Card**.
