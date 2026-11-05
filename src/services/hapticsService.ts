// src/services/hapticsService.ts - Tactile Haptic Feedback Service for Rival Card
let ExpoHaptics: typeof import('expo-haptics') | null = null;
try {
  ExpoHaptics = require('expo-haptics');
} catch {
  ExpoHaptics = null;
}

class HapticsService {
  private isEnabled: boolean = true;

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Subtle tick when touching a card or selecting an item.
   */
  public async cardSelection(): Promise<void> {
    if (!this.isEnabled || !ExpoHaptics) return;
    try {
      await ExpoHaptics.selectionAsync();
    } catch {
      // Gracefully ignore if haptics is unsupported
    }
  }

  /**
   * Crisp light tap when dragging or snapping a card.
   */
  public async cardSnap(): Promise<void> {
    if (!this.isEnabled || !ExpoHaptics) return;
    try {
      await ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
    } catch {
      // Gracefully ignore
    }
  }

  /**
   * Solid medium feedback when successfully playing a card.
   */
  public async validPlay(): Promise<void> {
    if (!this.isEnabled || !ExpoHaptics) return;
    try {
      await ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Gracefully ignore
    }
  }

  /**
   * Error buzz when attempting an invalid move.
   */
  public async invalidMove(): Promise<void> {
    if (!this.isEnabled || !ExpoHaptics) return;
    try {
      await ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Error);
    } catch {
      // Gracefully ignore
    }
  }

  /**
   * Heavy thump when declaring RIVAL!
   */
  public async rivalCallout(): Promise<void> {
    if (!this.isEnabled || !ExpoHaptics) return;
    try {
      await ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Heavy);
    } catch {
      // Gracefully ignore
    }
  }

  /**
   * Warning vibration when catching an opponent who forgot to declare RIVAL!
   */
  public async rivalCatch(): Promise<void> {
    if (!this.isEnabled || !ExpoHaptics) return;
    try {
      await ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning);
    } catch {
      // Gracefully ignore
    }
  }

  /**
   * Celebratory success feedback when winning the game.
   */
  public async victory(): Promise<void> {
    if (!this.isEnabled || !ExpoHaptics) return;
    try {
      await ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success);
    } catch {
      // Gracefully ignore
    }
  }
}

export const hapticsService = new HapticsService();
