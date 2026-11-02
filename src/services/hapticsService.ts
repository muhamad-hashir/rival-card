// src/services/hapticsService.ts - Tactile Haptic Feedback Service for Rival Card
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

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
    if (!this.isEnabled) return;
    try {
      await Haptics.selectionAsync();
    } catch {
      // Gracefully ignore if haptics is unsupported
    }
  }

  /**
   * Crisp light tap when dragging or snapping a card.
   */
  public async cardSnap(): Promise<void> {
    if (!this.isEnabled) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Gracefully ignore
    }
  }

  /**
   * Solid medium feedback when successfully playing a card.
   */
  public async validPlay(): Promise<void> {
    if (!this.isEnabled) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Gracefully ignore
    }
  }

  /**
   * Error buzz when attempting an invalid move.
   */
  public async invalidMove(): Promise<void> {
    if (!this.isEnabled) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {
      // Gracefully ignore
    }
  }

  /**
   * Heavy thump when declaring RIVAL!
   */
  public async rivalCallout(): Promise<void> {
    if (!this.isEnabled) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      // Gracefully ignore
    }
  }

  /**
   * Warning vibration when catching an opponent who forgot to declare RIVAL!
   */
  public async rivalCatch(): Promise<void> {
    if (!this.isEnabled) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      // Gracefully ignore
    }
  }

  /**
   * Celebratory success feedback when winning the game.
   */
  public async victory(): Promise<void> {
    if (!this.isEnabled) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Gracefully ignore
    }
  }
}

export const hapticsService = new HapticsService();
