// src/utils/tutorialEngine.ts - Scripted 11-step Real-Game Interactive Tutorial Engine
import {
  chooseWildColor,
  createGame,
  playCard,
  resolveDefenseTakeHit,
} from '../gameEngine';
import type { Card, GameState, StandardColor } from '../types';

export type TutorialTargetControl =
  | 'card'
  | 'color_picker'
  | 'defense_shield'
  | 'defense_mirror'
  | 'call_rival'
  | 'wait_bot'
  | 'complete';

export type TutorialStepId =
  | 'match_color'
  | 'match_number'
  | 'rival_swap'
  | 'shield_block'
  | 'draw_two'
  | 'wild_color'
  | 'mirror_reflect'
  | 'wild_draw4'
  | 'mute_rival'
  | 'call_rival'
  | 'final_card'
  | 'wait_bot'
  | 'finished';

export interface TutorialStepGuide {
  id: TutorialStepId;
  stepNumber: number;
  totalSteps: number;
  title: string;
  instruction: string;
  targetControl: TutorialTargetControl;
  highlightedCardId?: string;
}

export const TUTORIAL_TOTAL_STEPS = 11;
export const TUTORIAL_PLAYER_ID = 'tutorial_player';
export const TUTORIAL_COACH_ID = 'tutorial_coach';

/** Standard non-tutorial defense outcome banner duration (6 seconds). */
export const STANDARD_DEFENSE_BANNER_MS = 6000;

/** Extended tutorial defense explanation duration fallback (12 seconds, plus manual "Got it / Next ->" button). */
export const TUTORIAL_DEFENSE_BANNER_MS = 12000;

export interface TutorialDefenseOutcomeExplanation {
  type: 'shield' | 'mirror';
  badge: string;
  title: string;
  explanation: string;
}

/**
 * Returns defense outcome banner duration in milliseconds (12s in Tutorial, 6s in real matches).
 */
export function getDefenseBannerDurationMs(isTutorial: boolean): number {
  return isTutorial ? TUTORIAL_DEFENSE_BANNER_MS : STANDARD_DEFENSE_BANNER_MS;
}

/**
 * Plain-English explanation shown after Shield or Mirror triggers in Tutorial Mode.
 */
export function getTutorialDefenseOutcomeExplanation(
  defenseType: 'shield' | 'mirror' | 'counter_mirror'
): TutorialDefenseOutcomeExplanation {
  if (defenseType === 'shield') {
    return {
      type: 'shield',
      badge: 'SHIELD EXPLAINED',
      title: '🛡️ Shield Blocked the Attack!',
      explanation:
        'Shield absorbed 100% of CoachBot\'s +2 draw attack — you drew 0 penalty cards and kept your turn!',
    };
  }
  return {
    type: 'mirror',
    badge: 'MIRROR EXPLAINED',
    title: '🪞 Mirror Reflected +4!',
    explanation:
      'Mirror bounced CoachBot\'s Wild +4 right back at them — CoachBot drew 4 penalty cards and lost their turn instead of you!',
  };
}

/**
 * Tutorial RIVAL! callout eligibility: matches official match rules by requiring
 * calling RIVAL! right before playing the second-to-last card (handLength === 2).
 */
export function isTutorialRivalCallAllowed(
  handLength: number,
  hasDeclaredRival: boolean,
  isPlayerTurn: boolean,
  isDealing: boolean,
  isGameOver: boolean
): boolean {
  if (isGameOver || isDealing || !isPlayerTurn || hasDeclaredRival) {
    return false;
  }
  return handLength === 2;
}

export const TUTORIAL_CARDS = {
  pRed7: { id: 'tut_p_red_7', color: 'red', value: '7', scoreValue: 7 } as Card,
  pBlue7: { id: 'tut_p_blue_7', color: 'blue', value: '7', scoreValue: 7 } as Card,
  pSwap: { id: 'tut_p_swap', color: 'wild', value: 'rival_swap', scoreValue: 50 } as Card,
  pBotDraw2: { id: 'tut_p_bot_draw2', color: 'blue', value: 'draw2', scoreValue: 20 } as Card,
  pBotWildDraw4: { id: 'tut_p_bot_wild4', color: 'wild', value: 'wild_draw4', scoreValue: 50 } as Card,
  cYellow7: { id: 'tut_c_yellow_7', color: 'yellow', value: '7', scoreValue: 7 } as Card,
  cBlue2: { id: 'tut_c_blue_2', color: 'blue', value: '2', scoreValue: 2 } as Card,
  cBlueDraw2: { id: 'tut_c_blue_draw2', color: 'blue', value: 'draw2', scoreValue: 20 } as Card,
  cWild: { id: 'tut_c_wild', color: 'wild', value: 'wild', scoreValue: 50 } as Card,
  cWildDraw4: { id: 'tut_c_wild_draw4', color: 'wild', value: 'wild_draw4', scoreValue: 50 } as Card,
  cMute: { id: 'tut_c_mute', color: 'wild', value: 'mute', scoreValue: 50 } as Card,
  cShield: { id: 'tut_c_shield', color: 'wild', value: 'shield', scoreValue: 50 } as Card,
  cMirror: { id: 'tut_c_mirror', color: 'wild', value: 'mirror', scoreValue: 50 } as Card,
  cFinalWild: { id: 'tut_c_final_wild', color: 'wild', value: 'wild', scoreValue: 50 } as Card,
} as const;

function makeDeckFillerCards(): Card[] {
  const fillers: Card[] = [];
  const colors: StandardColor[] = ['red', 'blue', 'green', 'yellow'];
  let idx = 0;
  for (let round = 0; round < 6; round++) {
    for (const c of colors) {
      const n = String((idx % 9) + 1) as Card['value'];
      fillers.push({
        id: `tut_deck_${idx++}`,
        color: c,
        value: n,
        scoreValue: Number(n),
      });
    }
  }
  return fillers;
}

/**
 * Builds a deterministic real GameState tailored to teach every Rival Card mechanic sequentially.
 */
export function createTutorialGameState(
  playerName: string = 'You',
  playerAvatarId: string = 'fox'
): GameState {
  const base = createGame(
    [
      { id: TUTORIAL_PLAYER_ID, name: playerName, isBot: false, avatarId: playerAvatarId },
      { id: TUTORIAL_COACH_ID, name: 'CoachBot', isBot: true, avatarId: 'bot' },
    ],
    'vs_bot',
    { allowStacking: true }
  );

  const initialTopDiscard: Card = {
    id: 'tut_discard_red_3',
    color: 'red',
    value: '3',
    scoreValue: 3,
  };

  return {
    ...base,
    players: [
      {
        ...base.players[0],
        hand: [
          TUTORIAL_CARDS.pRed7,
          TUTORIAL_CARDS.pBlue7,
          TUTORIAL_CARDS.pSwap,
          TUTORIAL_CARDS.pBotDraw2,
          TUTORIAL_CARDS.pBotWildDraw4,
        ],
      },
      {
        ...base.players[1],
        hand: [
          TUTORIAL_CARDS.cYellow7,
          TUTORIAL_CARDS.cBlue2,
          TUTORIAL_CARDS.cBlueDraw2,
          TUTORIAL_CARDS.cWild,
          TUTORIAL_CARDS.cWildDraw4,
          TUTORIAL_CARDS.cMute,
          TUTORIAL_CARDS.cShield,
          TUTORIAL_CARDS.cMirror,
          TUTORIAL_CARDS.cFinalWild,
        ],
      },
    ],
    discardPile: [initialTopDiscard],
    deck: makeDeckFillerCards(),
    activeColor: 'red',
    currentTurnIndex: 0,
    direction: 1,
    pendingDrawCount: 0,
    pendingColorChoice: false,
    pendingWildCard: null,
    pendingDefense: null,
    winner: null,
    isGameOver: false,
    turnCount: 1,
  };
}

/**
 * Computes the active tutorial coach-mark instruction and highlighted UI target
 * directly from the current live GameState.
 */
export function getTutorialStepGuide(state: GameState): TutorialStepGuide {
  if (state.isGameOver) {
    return {
      id: 'finished',
      stepNumber: TUTORIAL_TOTAL_STEPS,
      totalSteps: TUTORIAL_TOTAL_STEPS,
      title: 'Tutorial Complete!',
      instruction: 'Awesome job! You mastered every Rival Card mechanic.',
      targetControl: 'complete',
    };
  }

  const human = state.players[0];
  const defense = state.pendingDefense;

  if (defense && defense.targetIndex === 0) {
    if (human.hand.some((c) => c.id === TUTORIAL_CARDS.cShield.id) && defense.attackType === 'draw2') {
      return {
        id: 'shield_block',
        stepNumber: 4,
        totalSteps: TUTORIAL_TOTAL_STEPS,
        title: 'Special Card: Shield 🛡️',
        instruction: `Incoming +${defense.drawPenalty} attack! Tap SHIELD to block 100% of the penalty and draw 0 cards.`,
        targetControl: 'defense_shield',
      };
    }
    if (human.hand.some((c) => c.id === TUTORIAL_CARDS.cMirror.id)) {
      return {
        id: 'mirror_reflect',
        stepNumber: 7,
        totalSteps: TUTORIAL_TOTAL_STEPS,
        title: 'Special Card: Mirror 🪞',
        instruction: 'CoachBot played Wild +4! Tap MIRROR to reflect all +4 cards straight back at CoachBot!',
        targetControl: 'defense_mirror',
      };
    }
  }

  // While CoachBot is resolving a reactive defense (e.g. accepting Rival Swap in Step 3),
  // hold on a clean CoachBot Turn indicator so subsequent hand-length steps never flash early.
  if (defense && defense.targetIndex === 1) {
    return {
      id: 'wait_bot',
      stepNumber: 0,
      totalSteps: TUTORIAL_TOTAL_STEPS,
      title: 'CoachBot Turn',
      instruction: 'CoachBot is responding to your Rival Swap...',
      targetControl: 'wait_bot',
    };
  }

  if (state.pendingColorChoice) {
    return {
      id: 'wild_color',
      stepNumber: 6,
      totalSteps: TUTORIAL_TOTAL_STEPS,
      title: 'Choose Color 🎨',
      instruction: 'Pick any color for the table to continue!',
      targetControl: 'color_picker',
    };
  }

  const currentPlayer = state.players[state.currentTurnIndex];
  if (!currentPlayer || currentPlayer.id !== TUTORIAL_PLAYER_ID) {
    return {
      id: 'wait_bot',
      stepNumber: 0,
      totalSteps: TUTORIAL_TOTAL_STEPS,
      title: 'CoachBot Turn',
      instruction: 'Watch how CoachBot responds...',
      targetControl: 'wait_bot',
    };
  }

  const has = (card: Card) => human.hand.some((c) => c.id === card.id);

  if (has(TUTORIAL_CARDS.pRed7)) {
    return {
      id: 'match_color',
      stepNumber: 1,
      totalSteps: TUTORIAL_TOTAL_STEPS,
      title: 'Match by Color',
      instruction: 'Top card is Red 3. Tap the glowing Red 7 in your hand to match Red!',
      targetControl: 'card',
      highlightedCardId: TUTORIAL_CARDS.pRed7.id,
    };
  }

  if (has(TUTORIAL_CARDS.pBlue7)) {
    return {
      id: 'match_number',
      stepNumber: 2,
      totalSteps: TUTORIAL_TOTAL_STEPS,
      title: 'Match by Number',
      instruction: 'Top card is Yellow 7! You can match numbers across colors — play Blue 7!',
      targetControl: 'card',
      highlightedCardId: TUTORIAL_CARDS.pBlue7.id,
    };
  }

  if (has(TUTORIAL_CARDS.pSwap)) {
    return {
      id: 'rival_swap',
      stepNumber: 3,
      totalSteps: TUTORIAL_TOTAL_STEPS,
      title: 'Special Card: Rival Swap 🔄',
      instruction: 'Play Rival Swap and pick a color to trade your entire hand with CoachBot!',
      targetControl: 'card',
      highlightedCardId: TUTORIAL_CARDS.pSwap.id,
    };
  }

  if (has(TUTORIAL_CARDS.cBlueDraw2)) {
    return {
      id: 'draw_two',
      stepNumber: 5,
      totalSteps: TUTORIAL_TOTAL_STEPS,
      title: 'Draw Two (+2) ➕',
      instruction: 'Play Blue +2 to force CoachBot to draw 2 cards and skip their turn!',
      targetControl: 'card',
      highlightedCardId: TUTORIAL_CARDS.cBlueDraw2.id,
    };
  }

  if (has(TUTORIAL_CARDS.cWild)) {
    return {
      id: 'wild_color',
      stepNumber: 6,
      totalSteps: TUTORIAL_TOTAL_STEPS,
      title: 'Color Change (Wild) 🎨',
      instruction: 'Play Color Change anytime on your turn, then pick a new color!',
      targetControl: 'card',
      highlightedCardId: TUTORIAL_CARDS.cWild.id,
    };
  }

  if (has(TUTORIAL_CARDS.cWildDraw4)) {
    return {
      id: 'wild_draw4',
      stepNumber: 8,
      totalSteps: TUTORIAL_TOTAL_STEPS,
      title: 'Wild Draw 4 (+4) ⚡',
      instruction: 'Play Wild +4 and pick a color to make CoachBot draw 4 cards and lose their turn!',
      targetControl: 'card',
      highlightedCardId: TUTORIAL_CARDS.cWildDraw4.id,
    };
  }

  if (human.hand.length === 2 && !human.hasDeclaredRival) {
    return {
      id: 'call_rival',
      stepNumber: 9,
      totalSteps: TUTORIAL_TOTAL_STEPS,
      title: 'Call Last Card! ⚡',
      instruction: 'Down to 2 cards! Always tap RIVAL! right BEFORE playing your second-to-last card!',
      targetControl: 'call_rival',
    };
  }

  if (has(TUTORIAL_CARDS.cMute)) {
    return {
      id: 'mute_rival',
      stepNumber: 10,
      totalSteps: TUTORIAL_TOTAL_STEPS,
      title: 'Special Card: Mute 🔇',
      instruction: 'Play Mute (your second-to-last card) and pick a color to silence CoachBot and skip their turn!',
      targetControl: 'card',
      highlightedCardId: TUTORIAL_CARDS.cMute.id,
    };
  }

  const finalCard = human.hand[0];
  return {
    id: 'final_card',
    stepNumber: 11,
    totalSteps: TUTORIAL_TOTAL_STEPS,
    title: 'Play Final Card & Win! 🏆',
    instruction: 'Play your final Wild card (pick any color) to win the Tutorial!',
    targetControl: 'card',
    highlightedCardId: finalCard?.id,
  };
}

/**
 * Resolves CoachBot's deterministic response in Tutorial mode so every lesson lands cleanly.
 */
export function executeTutorialBotStep(state: GameState): GameState {
  if (state.isGameOver) return state;

  // If Rival Swap triggered a pendingDefense window on CoachBot, CoachBot accepts the swap cleanly
  if (state.pendingDefense && state.pendingDefense.targetIndex === 1) {
    return resolveDefenseTakeHit(state, TUTORIAL_COACH_ID);
  }

  if (state.pendingColorChoice && state.currentTurnIndex === 1) {
    return chooseWildColor(state, TUTORIAL_COACH_ID, 'blue');
  }

  if (state.currentTurnIndex !== 1) return state;
  const coach = state.players[1];

  // Scripted CoachBot plays matching their tutorial cue
  const priorityOrder: Array<{ cardId: string; chosenColor?: StandardColor }> = [
    { cardId: TUTORIAL_CARDS.cYellow7.id },
    { cardId: TUTORIAL_CARDS.cBlue2.id },
    { cardId: TUTORIAL_CARDS.pBotDraw2.id },
    { cardId: TUTORIAL_CARDS.pBotWildDraw4.id, chosenColor: 'red' },
  ];

  for (const candidate of priorityOrder) {
    if (coach.hand.some((c) => c.id === candidate.cardId)) {
      return playCard(state, TUTORIAL_COACH_ID, candidate.cardId, {
        chosenColor: candidate.chosenColor,
      });
    }
  }

  return state;
}
