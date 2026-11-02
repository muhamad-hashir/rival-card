# Rival Card ⚡

A fast-paced, 2D cartoon mobile card game built with **React Native**, **Expo**, and **Supabase Realtime**. Match colors and values, counter opponents with tactical action cards, call **RIVAL!**, and clear your hand to achieve victory!

---

## 🎮 Core Features

* **Complete 108-Card Engine**:
  * **Number Cards**: 0–9 across 4 vibrant colors (Red, Blue, Green, Yellow).
  * **Standard Action Cards**: Skip, Reverse (acts as Skip in 1v1), and Draw 2.
  * **Wild Cards**: Wild Color Choice and Wild Draw 4.
  * **Custom Action Cards**:
    * 🔇 **Mute**: Silences a targeted player for 1 round and skips their turn.
    * 🔄 **RivalSwap**: Swaps your hand with the opponent who currently holds the fewest cards.
* **⚡ RIVAL! Callout & Catch System**:
  * Shouting **RIVAL!** when holding 1 card.
  * Opponents can tap **CATCH!** on any player who forgot to declare RIVAL! to impose a 2-card draw penalty.
* **Game Modes**:
  * 🤖 **Play vs Bot**: Instant offline matches against heuristic AI bots (1v1 or 4-player).
  * 📱 **Pass & Play**: Local hotseat mode for 2 or 3 players featuring an automated privacy shield between turns.
  * 🌐 **Online Multiplayer**: Real-time room creation and joining via 4-digit codes, powered by Supabase Realtime WebSocket channels.
* **⚡ Real-time Quick Taunt Bar**:
  * Send animated emoji reactions (🔥, 😂, 💀, 😱, 👏, ⚡) synced live across players.
* **✨ Native Mobile Polish**:
  * Drag-and-play card mechanics powered by `react-native-reanimated` and `react-native-gesture-handler`.
  * Haptic feedback via `expo-haptics` on card selections, draws, errors, and RIVAL! callouts.
  * Resilient sound effects service with Web Audio synthesis fallback for zero-dependency execution across Web, iOS, and Android.

---

## 🛠️ Tech Stack

* **Framework**: React Native 0.88, Expo SDK 58, React 19
* **Language**: TypeScript 6.0
* **Animations & Gestures**: React Native Reanimated 4, React Native Gesture Handler
* **Networking & Multiplayer**: Supabase Realtime (`@supabase/supabase-js`)
* **Audio & Haptics**: Expo AV, Web Audio API, Expo Haptics
* **Testing**: Node.js Test Runner (`node:test`) + `tsx`

---

## 🚀 Getting Started

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* [Expo Go](https://expo.dev/go) on iOS or Android (optional for mobile testing)

### 2. Installation
```bash
# Clone repository and enter directory
cd rival-card

# Install dependencies
npm install
```

### 3. Environment Configuration (Optional)
To enable custom online Supabase multiplayer backends, create a `.env` file in the project root:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```
*(The app includes built-in fallback mock and demo channel support for local offline development).*

### 4. Running the App
```bash
# Start Expo development server (interactive menu)
npx expo start

# Run directly on Web
npx expo start --web

# Run on Android emulator / connected device
npx expo start --android

# Run on iOS simulator
npx expo start --ios
```

---

## 🧪 Testing & Verification

The game engine and multiplayer services are backed by a comprehensive unit test suite:

```bash
# Run all unit tests
npm test

# Type-check TypeScript codebase
npm run typecheck
```

---

## 📁 Project Structure

```text
rival-card/
├── assets/                  # Game artwork, card graphics, and action icons
│   ├── card_back.png        # Rendered card back design
│   ├── homescreen.png       # 2D home screen background artwork
│   ├── icon.png             # Application logo icon
│   └── icons/               # Custom action card icon assets (Skip, Reverse, Draw2, Mute, Swap, etc.)
├── src/
│   ├── components/          # Reusable UI components (CardView, DraggableCard, Modals, TauntBar)
│   ├── screens/             # HomeScreen (Main Menu) and GameScreen (Main Arena)
│   ├── services/            # Haptics, SoundService, and Supabase Multiplayer client
│   ├── types.ts             # Game state, player, card, and network types
│   ├── gameEngine.ts        # Pure functional game logic, rules engine, and AI bot heuristics
│   └── __tests__/           # Test suite (deck, action cards, bot turns, 1v1, multiplayer)
├── App.tsx                  # Root navigation & gesture provider
├── app.json                 # Expo project configuration
└── package.json             # Scripts & dependencies
```

---

## 📜 License
MIT License. Created for Rival Card.
