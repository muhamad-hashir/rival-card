// src/__tests__/tutorial.test.ts - Unit tests for Real-Game Tutorial Progression, Reward Gating, & Stat Isolation
import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  canPlayerCallRival,
  chooseWildColor,
  declareRival,
  playCard,
  resolveDefenseWithMirror,
  resolveDefenseWithShield,
} from '../gameEngine';
import {
  STANDARD_DEFENSE_BANNER_MS,
  TUTORIAL_CARDS,
  TUTORIAL_DEFENSE_BANNER_MS,
  TUTORIAL_PLAYER_ID,
  TUTORIAL_TOTAL_STEPS,
  createTutorialGameState,
  executeTutorialBotStep,
  getDefenseBannerDurationMs,
  getTutorialDefenseOutcomeExplanation,
  getTutorialStepGuide,
  isTutorialRivalCallAllowed,
} from '../constants/tutorialScenario';
import {
  TUTORIAL_REWARD_COINS,
  TUTORIAL_REWARD_GEMS,
  tutorialService,
} from '../services/tutorialService';
import {
  isEligibleCareerStatMatch,
  playerProfileService,
} from '../services/playerProfileService';

describe('Interactive Tutorial Progression, One-Time Reward & Stat Isolation', () => {
  beforeEach(async () => {
    await playerProfileService.resetProfile();
    await tutorialService.resetTutorialProgress();
  });

  test('walks smoothly through all 11 tutorial steps covering matching, +2, +4, Wild, all 4 Special Cards, RIVAL!, and winning', () => {
    let state = createTutorialGameState('Tester', 'fox');
    assert.strictEqual(state.players.length, 2);
    assert.strictEqual(state.players[0].id, TUTORIAL_PLAYER_ID);

    // Step 1: Match Color (Red 7 on Red 3)
    let guide = getTutorialStepGuide(state);
    assert.strictEqual(guide.id, 'match_color');
    assert.strictEqual(guide.stepNumber, 1);
    assert.strictEqual(guide.highlightedCardId, TUTORIAL_CARDS.pRed7.id);
    state = playCard(state, TUTORIAL_PLAYER_ID, TUTORIAL_CARDS.pRed7.id);
    state = executeTutorialBotStep(state); // CoachBot plays Yellow 7

    // Step 2: Match Number (Blue 7 on Yellow 7)
    guide = getTutorialStepGuide(state);
    assert.strictEqual(guide.id, 'match_number');
    assert.strictEqual(guide.stepNumber, 2);
    assert.strictEqual(guide.highlightedCardId, TUTORIAL_CARDS.pBlue7.id);
    state = playCard(state, TUTORIAL_PLAYER_ID, TUTORIAL_CARDS.pBlue7.id);
    state = executeTutorialBotStep(state); // CoachBot plays Blue 2

    // Step 3: Special Card #1 - Rival Swap (with color selection + CoachBot accepting swap)
    guide = getTutorialStepGuide(state);
    assert.strictEqual(guide.id, 'rival_swap');
    assert.strictEqual(guide.stepNumber, 3);
    assert.strictEqual(guide.highlightedCardId, TUTORIAL_CARDS.pSwap.id);
    state = playCard(state, TUTORIAL_PLAYER_ID, TUTORIAL_CARDS.pSwap.id, { chosenColor: 'blue' });
    // While CoachBot's swap defense reaction is pending, never flash Step 9/11 ("call_rival")!
    const swapWaitGuide = getTutorialStepGuide(state);
    assert.strictEqual(swapWaitGuide.targetControl, 'wait_bot');
    assert.strictEqual(swapWaitGuide.stepNumber, 0);
    assert.strictEqual(swapWaitGuide.title, 'CoachBot Turn');
    state = executeTutorialBotStep(state); // CoachBot declines defense -> Swap executes cleanly!
    const botWaitGuide = getTutorialStepGuide(state);
    assert.strictEqual(botWaitGuide.targetControl, 'wait_bot');
    assert.strictEqual(botWaitGuide.stepNumber, 0);
    state = executeTutorialBotStep(state); // CoachBot attacks with +2 -> triggers Shield defense!

    // Step 4: Special Card #2 - Shield reactive block vs Draw Two (+2)
    guide = getTutorialStepGuide(state);
    assert.strictEqual(guide.id, 'shield_block');
    assert.strictEqual(guide.stepNumber, 4);
    assert.strictEqual(guide.targetControl, 'defense_shield');
    state = resolveDefenseWithShield(state, TUTORIAL_PLAYER_ID);

    // Step 5: Draw Two (+2) -> CoachBot draws 2 and skips back to Human
    guide = getTutorialStepGuide(state);
    assert.strictEqual(guide.id, 'draw_two');
    assert.strictEqual(guide.stepNumber, 5);
    assert.strictEqual(guide.highlightedCardId, TUTORIAL_CARDS.cBlueDraw2.id);
    state = playCard(state, TUTORIAL_PLAYER_ID, TUTORIAL_CARDS.cBlueDraw2.id);

    // Step 6: Color Change (Wild) -> CoachBot responds with Wild +4 attack
    guide = getTutorialStepGuide(state);
    assert.strictEqual(guide.id, 'wild_color');
    assert.strictEqual(guide.stepNumber, 6);
    assert.strictEqual(guide.highlightedCardId, TUTORIAL_CARDS.cWild.id);
    state = playCard(state, TUTORIAL_PLAYER_ID, TUTORIAL_CARDS.cWild.id, { chosenColor: 'green' });
    state = executeTutorialBotStep(state); // CoachBot attacks with Wild +4 -> triggers Mirror defense!

    // Step 7: Special Card #3 - Mirror reflects Wild +4 back at CoachBot
    guide = getTutorialStepGuide(state);
    assert.strictEqual(guide.id, 'mirror_reflect');
    assert.strictEqual(guide.stepNumber, 7);
    assert.strictEqual(guide.targetControl, 'defense_mirror');
    assert.strictEqual(state.pendingDefense?.attackType, 'wild_draw4');
    assert.strictEqual(state.pendingDefense?.drawPenalty, 4);
    const coachCardsBeforeMirror = state.players[1].hand.length;
    state = resolveDefenseWithMirror(state, TUTORIAL_PLAYER_ID);
    assert.strictEqual(state.players[1].hand.length, coachCardsBeforeMirror + 4);

    // Step 8: Wild Draw 4 (+4) with color selection
    guide = getTutorialStepGuide(state);
    assert.strictEqual(guide.id, 'wild_draw4');
    assert.strictEqual(guide.stepNumber, 8);
    assert.strictEqual(guide.highlightedCardId, TUTORIAL_CARDS.cWildDraw4.id);
    state = playCard(state, TUTORIAL_PLAYER_ID, TUTORIAL_CARDS.cWildDraw4.id);
    assert.strictEqual(state.pendingColorChoice, true);
    state = chooseWildColor(state, TUTORIAL_PLAYER_ID, 'yellow');

    // Step 9: Calling RIVAL! BEFORE playing the second-to-last card (2 cards in hand)
    guide = getTutorialStepGuide(state);
    assert.strictEqual(guide.id, 'call_rival');
    assert.strictEqual(guide.stepNumber, 9);
    assert.strictEqual(guide.targetControl, 'call_rival');
    assert.strictEqual(state.players[0].hand.length, 2);
    state = declareRival(state, TUTORIAL_PLAYER_ID);

    // Step 10: Special Card #4 - Mute (second-to-last card) silences & skips CoachBot down to 1 card left
    guide = getTutorialStepGuide(state);
    assert.strictEqual(guide.id, 'mute_rival');
    assert.strictEqual(guide.stepNumber, 10);
    assert.strictEqual(guide.highlightedCardId, TUTORIAL_CARDS.cMute.id);
    state = playCard(state, TUTORIAL_PLAYER_ID, TUTORIAL_CARDS.cMute.id, { chosenColor: 'red' });

    // Step 11: Final card & win
    guide = getTutorialStepGuide(state);
    assert.strictEqual(guide.id, 'final_card');
    assert.strictEqual(guide.stepNumber, TUTORIAL_TOTAL_STEPS);
    assert.strictEqual(guide.highlightedCardId, TUTORIAL_CARDS.cFinalWild.id);
    state = playCard(state, TUTORIAL_PLAYER_ID, TUTORIAL_CARDS.cFinalWild.id, { chosenColor: 'blue' });

    assert.strictEqual(state.isGameOver, true);
    assert.strictEqual(state.winner?.id, TUTORIAL_PLAYER_ID);
    assert.strictEqual(getTutorialStepGuide(state).id, 'finished');
  });

  test('grants +100 Coins & +3 Gems strictly once on first completion and 0 on subsequent replays', async () => {
    const startStatus = await tutorialService.getTutorialStatus();
    assert.strictEqual(startStatus.hasSeenPrompt, false);
    assert.strictEqual(startStatus.hasCompleted, false);

    // Dismissing prompt persists hasSeenPrompt without completing tutorial
    await tutorialService.markTutorialPromptSeen();
    assert.strictEqual(await tutorialService.hasSeenTutorialPrompt(), true);
    assert.strictEqual(await tutorialService.hasCompletedTutorial(), false);

    const beforeProfile = await playerProfileService.getProfile();
    assert.strictEqual(beforeProfile.coins, 250);
    assert.strictEqual(beforeProfile.gems, 10);

    // First tutorial completion -> +100 Coins & +3 Gems
    const firstReward = await tutorialService.completeTutorialAndClaimReward();
    assert.strictEqual(firstReward.awarded, true);
    assert.strictEqual(firstReward.coinsAwarded, TUTORIAL_REWARD_COINS);
    assert.strictEqual(firstReward.gemsAwarded, TUTORIAL_REWARD_GEMS);

    let afterProfile = await playerProfileService.getProfile();
    assert.strictEqual(afterProfile.coins, 350);
    assert.strictEqual(afterProfile.gems, 13);
    assert.strictEqual(await tutorialService.hasCompletedTutorial(), true);

    // Replay completion -> 0 duplicate rewards
    const replayReward = await tutorialService.completeTutorialAndClaimReward();
    assert.strictEqual(replayReward.awarded, false);
    assert.strictEqual(replayReward.coinsAwarded, 0);
    assert.strictEqual(replayReward.gemsAwarded, 0);

    afterProfile = await playerProfileService.getProfile();
    assert.strictEqual(afterProfile.coins, 350);
    assert.strictEqual(afterProfile.gems, 13);
  });

  test('tutorial completion leaves online Career Stats (games_played, wins, win_streak) completely unchanged', async () => {
    assert.strictEqual(
      isEligibleCareerStatMatch({
        gameMode: 'vs_bot',
        isQuickMatch: false,
        isPrivateSeries: false,
        isTutorial: true,
        localPlayerId: TUTORIAL_PLAYER_ID,
        players: [
          { id: TUTORIAL_PLAYER_ID, isBot: false },
          { id: 'tutorial_coach', isBot: true },
        ],
      }),
      false
    );

    await tutorialService.completeTutorialAndClaimReward();
    const profile = await playerProfileService.getProfile();
    assert.strictEqual(profile.stats.gamesPlayed, 0);
    assert.strictEqual(profile.stats.wins, 0);
    assert.strictEqual(profile.stats.winStreak, 0);
  });

  test('enforces calling RIVAL before the second-to-last card (handLength === 2) in tutorial matching real matches', () => {
    // Both normal matches and Tutorial strictly require handLength === 2
    assert.strictEqual(canPlayerCallRival(1, false, true, false, false), false);
    assert.strictEqual(canPlayerCallRival(2, false, true, false, false), true);
    assert.strictEqual(isTutorialRivalCallAllowed(1, false, true, false, false), false);
    assert.strictEqual(isTutorialRivalCallAllowed(2, false, true, false, false), true);
    assert.strictEqual(isTutorialRivalCallAllowed(2, true, true, false, false), false);
    assert.strictEqual(isTutorialRivalCallAllowed(2, false, false, false, false), false);

    // Advance deterministic tutorial state to Step 9 (2 cards left, RIVAL not yet called)
    let state = createTutorialGameState('Tester', 'fox');
    state = playCard(state, TUTORIAL_PLAYER_ID, TUTORIAL_CARDS.pRed7.id);
    state = executeTutorialBotStep(state);
    state = playCard(state, TUTORIAL_PLAYER_ID, TUTORIAL_CARDS.pBlue7.id);
    state = executeTutorialBotStep(state);
    state = playCard(state, TUTORIAL_PLAYER_ID, TUTORIAL_CARDS.pSwap.id, { chosenColor: 'blue' });
    state = executeTutorialBotStep(state);
    state = executeTutorialBotStep(state);
    state = resolveDefenseWithShield(state, TUTORIAL_PLAYER_ID);
    state = playCard(state, TUTORIAL_PLAYER_ID, TUTORIAL_CARDS.cBlueDraw2.id);
    state = playCard(state, TUTORIAL_PLAYER_ID, TUTORIAL_CARDS.cWild.id, { chosenColor: 'green' });
    state = executeTutorialBotStep(state);
    assert.strictEqual(state.pendingDefense?.attackType, 'wild_draw4');
    state = resolveDefenseWithMirror(state, TUTORIAL_PLAYER_ID);
    state = playCard(state, TUTORIAL_PLAYER_ID, TUTORIAL_CARDS.cWildDraw4.id, { chosenColor: 'yellow' });

    assert.strictEqual(state.players[0].hand.length, 2);
    assert.strictEqual(state.players[0].hasDeclaredRival, false);
    assert.strictEqual(getTutorialStepGuide(state).id, 'call_rival');
    assert.strictEqual(
      isTutorialRivalCallAllowed(
        state.players[0].hand.length,
        state.players[0].hasDeclaredRival,
        state.currentTurnIndex === 0,
        false,
        state.isGameOver
      ),
      true
    );

    // Tapping RIVAL! unlocks Step 10 (second-to-last card: Mute), then Step 11 (final card)
    state = declareRival(state, TUTORIAL_PLAYER_ID);
    const step10 = getTutorialStepGuide(state);
    assert.strictEqual(step10.id, 'mute_rival');
    assert.strictEqual(step10.stepNumber, 10);
    assert.strictEqual(step10.highlightedCardId, TUTORIAL_CARDS.cMute.id);

    state = playCard(state, TUTORIAL_PLAYER_ID, TUTORIAL_CARDS.cMute.id, { chosenColor: 'red' });
    const step11 = getTutorialStepGuide(state);
    assert.strictEqual(step11.id, 'final_card');
    assert.strictEqual(step11.stepNumber, TUTORIAL_TOTAL_STEPS);
    assert.strictEqual(step11.highlightedCardId, TUTORIAL_CARDS.cFinalWild.id);
  });

  test('uses extended readable timing & explanations for Shield and Mirror in tutorial while keeping normal matches at 6s', () => {
    assert.strictEqual(STANDARD_DEFENSE_BANNER_MS, 6000);
    assert.strictEqual(TUTORIAL_DEFENSE_BANNER_MS, 12000);
    assert.strictEqual(getDefenseBannerDurationMs(false), 6000);
    assert.strictEqual(getDefenseBannerDurationMs(true), 12000);

    const shieldInfo = getTutorialDefenseOutcomeExplanation('shield');
    assert.strictEqual(shieldInfo.type, 'shield');
    assert.ok(shieldInfo.explanation.includes('0 penalty cards'));

    const mirrorInfo = getTutorialDefenseOutcomeExplanation('mirror');
    assert.strictEqual(mirrorInfo.type, 'mirror');
    assert.ok(mirrorInfo.explanation.includes('bounced'));
  });
});
