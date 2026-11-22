// src/services/tutorialService.ts - Persistent Tutorial Prompt & One-Time Completion Reward
import { safeStorage } from './supabase';
import { playerProfileService } from './playerProfileService';

export const TUTORIAL_PROMPT_SEEN_KEY = '@rivalcard:has_seen_tutorial_prompt';
export const TUTORIAL_COMPLETED_KEY = '@rivalcard:has_completed_tutorial';

export const TUTORIAL_REWARD_COINS = 100;
export const TUTORIAL_REWARD_GEMS = 3;

export interface TutorialStatus {
  hasSeenPrompt: boolean;
  hasCompleted: boolean;
}

export interface TutorialRewardResult {
  awarded: boolean;
  coinsAwarded: number;
  gemsAwarded: number;
}

class TutorialService {
  private rewardInFlight: Promise<TutorialRewardResult> | null = null;

  public async getTutorialStatus(): Promise<TutorialStatus> {
    try {
      const [seenRaw, completedRaw] = await Promise.all([
        safeStorage.getItem(TUTORIAL_PROMPT_SEEN_KEY),
        safeStorage.getItem(TUTORIAL_COMPLETED_KEY),
      ]);
      const hasCompleted = completedRaw === 'true';
      const hasSeenPrompt = seenRaw === 'true' || hasCompleted;
      return { hasSeenPrompt, hasCompleted };
    } catch {
      return { hasSeenPrompt: false, hasCompleted: false };
    }
  }

  public async hasSeenTutorialPrompt(): Promise<boolean> {
    const status = await this.getTutorialStatus();
    return status.hasSeenPrompt;
  }

  public async hasCompletedTutorial(): Promise<boolean> {
    const status = await this.getTutorialStatus();
    return status.hasCompleted;
  }

  public async markTutorialPromptSeen(): Promise<void> {
    try {
      await safeStorage.setItem(TUTORIAL_PROMPT_SEEN_KEY, 'true');
    } catch {
      // ignore storage errors
    }
  }

  /**
   * Marks tutorial completed and grants +100 Coins and +3 Gems strictly once on first completion.
   * Replays from How to Play return `{ awarded: false, coinsAwarded: 0, gemsAwarded: 0 }`.
   */
  public async completeTutorialAndClaimReward(): Promise<TutorialRewardResult> {
    if (this.rewardInFlight) {
      return this.rewardInFlight;
    }

    this.rewardInFlight = (async (): Promise<TutorialRewardResult> => {
      try {
        const alreadyCompleted = await this.hasCompletedTutorial();
        if (alreadyCompleted) {
          return { awarded: false, coinsAwarded: 0, gemsAwarded: 0 };
        }

        await safeStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
        await safeStorage.setItem(TUTORIAL_PROMPT_SEEN_KEY, 'true');
        await playerProfileService.addCurrency(TUTORIAL_REWARD_COINS, TUTORIAL_REWARD_GEMS);

        return {
          awarded: true,
          coinsAwarded: TUTORIAL_REWARD_COINS,
          gemsAwarded: TUTORIAL_REWARD_GEMS,
        };
      } catch {
        return { awarded: false, coinsAwarded: 0, gemsAwarded: 0 };
      } finally {
        this.rewardInFlight = null;
      }
    })();

    return this.rewardInFlight;
  }

  public async resetTutorialProgress(): Promise<void> {
    try {
      await Promise.all([
        safeStorage.removeItem(TUTORIAL_PROMPT_SEEN_KEY),
        safeStorage.removeItem(TUTORIAL_COMPLETED_KEY),
      ]);
    } catch {
      // ignore
    }
  }
}

export const tutorialService = new TutorialService();
