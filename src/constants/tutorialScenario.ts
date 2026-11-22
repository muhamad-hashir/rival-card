// src/constants/tutorialScenario.ts - Scripted Interactive Tutorial Scenario & Timing Constants
export {
  STANDARD_DEFENSE_BANNER_MS,
  TUTORIAL_CARDS,
  TUTORIAL_COACH_ID,
  TUTORIAL_DEFENSE_BANNER_MS,
  TUTORIAL_PLAYER_ID,
  TUTORIAL_TOTAL_STEPS,
  createTutorialGameState,
  executeTutorialBotStep,
  getDefenseBannerDurationMs,
  getTutorialDefenseOutcomeExplanation,
  getTutorialStepGuide,
  isTutorialRivalCallAllowed,
} from '../utils/tutorialEngine';

export type {
  TutorialDefenseOutcomeExplanation,
  TutorialStepGuide,
  TutorialStepId,
  TutorialTargetControl,
} from '../utils/tutorialEngine';
