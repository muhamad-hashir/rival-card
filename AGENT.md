# AGENT.md - Rival Card (Master Execution & Blueprint Document)

## 1. Project Identity & Target Stack
- **Project Name:** Rival Card
- **Game Concept:** Fast-paced UNO-inspired card game with custom action cards, local pass-and-play, offline CPU bots, and real-time online multiplayer.
- **Framework & Runtime:** React Native with Expo (SDK 58, Managed Workflow)
- **Primary Language:** TypeScript
- **Target Deliverable:** Android APK via EAS Build (`eas build -p android --profile preview`)
- **Key Libraries:**
  - `react-native-reanimated` & `react-native-gesture-handler` (Smooth card movement and drag interactions)
  - `expo-haptics` (Tactile button and card feedback)
  - `expo-av` (Card snap, penalty, and taunt sound effects)
  - `@supabase/supabase-js` (Future online multiplayer state sync)

---

## 2. Strict AI Agent Operating Rules
1. **Direct Work Delivery:** The agent writes, edits, and updates codebase files directly. Do not spit out huge raw code dumps in chat unless explicitly requested.
2. **One Step at a Time:** Work through roadmap items systematically without skipping ahead or dropping multi-step structural changes in a single output.
3. **Engine Logic First, UI Second:** Ensure state transitions, turn turns, card draws, penalty stacks, and win checks are 100% functional before adding visual polish.
4. **Zero Structural Regression:** Never overwrite existing working code without maintaining previously integrated features.

---

## 3. Deck Architecture & Game Mechanics (108 Cards)

### Card Suit & Value Distribution
- **4 Suits/Colors:** Red (`#EF4444`), Blue (`#3B82F6`), Green (`#10B981`), Yellow (`#F59E0B`)
- **Number Cards (76 Cards total):**
  - `0`: 1 card per color (4 cards)
  - `1–9`: 2 cards per color (72 cards)
- **Standard Action Cards (24 Cards total):**
  - `Skip`: 2 per color (8 cards) — Skips next player's turn.
  - `Reverse`: 2 per color (8 cards) — Inverts rotation direction (`1` <-> `-1`).
  - `Draw2`: 2 per color (8 cards) — Forces next player to draw 2 cards and skip their turn.
- **Wild & Rival Action Cards (8 Cards total - Black Suit `#1E293B`):**
  - `Wild`: 2 cards — Player chooses active color.
  - `WildDraw4`: 2 cards — Player chooses active color, next player draws 4 cards and skips.
  - `Mute`: 2 cards — Forces targeted player to skip turn and disables their chat/reactions for 1 round.
  - `RivalSwap`: 2 cards — Swaps hand with the player who currently has the fewest cards in hand.

---

## 4. Phase-by-Phase Roadmap

### Phase 1: Local Game Engine & State Machine (COMPLETED ✅)
- [x] Create core game engine file (`src/gameEngine.ts`):
  - 108-card deck generator, shuffle algorithm (Fisher-Yates), initial hand dealing (7 cards/player).
  - Top card validation (`isValidMove` checking active color OR value match OR Wild).
  - Turn rotation state manager (`currentTurnIndex`, `direction: 1 | -1`).
  - Pass-and-play local screen masking ("Pass phone to Player X" prompt to prevent hand peeking).
  - Bot AI engine (`makeBotMove` evaluating valid moves or drawing from deck).
  - Win condition detection (first player with empty hand) and draw-deck empty reshuffle from discard pile.

### Phase 2: React Native UI Setup & Controls (COMPLETED ✅)
- [x] Build clean, light-themed screen layouts inside `App.tsx` / `src/screens/`:
  - Player hand horizontal card layout.
  - Active color indicator and discard pile stack visual.
  - Draw deck tap interaction.
  - Pass-and-Play privacy overlay screen.
  - RIVAL! callout action button (triggers penalty if player with 1 card forgot to declare RIVAL within 3s).

### Phase 3: Mobile Native Polish (Haptics, Audio & Gestures) (COMPLETED ✅)
- [x] Integrate `expo-haptics` for card selection, error triggers, and penalty button hits.
- [x] Integrate `expo-av` for audio sound effects (card shuffle, play card, penalty, win chime).
- [x] Add drag-and-play card mechanics using `react-native-reanimated` and `gesture-handler`.

### Phase 4: Supabase Integration (Online Multiplayer) (COMPLETED ✅)
- [x] Set up Supabase Client (`src/services/supabase.ts`).
- [x] Create lobby state management and room code generation.
- [x] Real-time game state broadcasts (`supabase.channel`) for card plays, turn sync, and quick taunt emotes.

### Phase 5: Asset Integration & UI Skinning (COMPLETED ✅)
- [x] Edge-to-edge `homescreen.png` layout with invisible percentage touch overlays (`Play vs Bot`, `Pass & Play`, `Online Multiplayer`).
- [x] Integrate 7 action card PNG icons (`icon_skip`, `icon_reverse`, `icon_draw2`, `icon_wild_4`, `icon_wild_color_change`, `icon_mute`, `icon_swap`) with dynamic suit backgrounds and fallback.
- [x] Integrate `card_back.png` for face-down cards and interactive draw deck pile.
- [x] Replace text header with skinned `logo.png` image and home navigation.

---

## 5. Build Configuration (`eas.json`)

```json
{
  "build": {
    "preview": {
      "developmentClient": false,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    }
  }
}