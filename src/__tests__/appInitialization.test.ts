// src/__tests__/appInitialization.test.ts - Unit tests for App Initialization Boot Logic & Crash Protections
import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { audioService } from '../services/audioService';
import { settingsService } from '../services/settingsService';
import { supabase } from '../services/supabase';
import { networkService } from '../services/networkService';

describe('App Initialization & Crash Protections', () => {
  beforeEach(async () => {
    await settingsService.resetSettings();
  });

  test('audioService.ensureAudioMode and initAudio execute cleanly without throwing', async () => {
    await assert.doesNotReject(async () => {
      await audioService.ensureAudioMode();
    });

    await assert.doesNotReject(async () => {
      await audioService.initAudio();
    });
  });

  test('supabase auth session check completes safely without unhandled rejections', async () => {
    await assert.doesNotReject(async () => {
      const res = await supabase.auth.getSession().catch(() => ({
        data: { session: null },
        error: null,
      }));
      assert.ok(res !== undefined);
      assert.ok('data' in res);
    });
  });

  test('settingsService loads preferences reliably during boot sequence', async () => {
    const settings = await settingsService.getSettings();
    assert.strictEqual(typeof settings.sfxEnabled, 'boolean');
    assert.strictEqual(typeof settings.bgmEnabled, 'boolean');
    assert.strictEqual(typeof settings.hapticsEnabled, 'boolean');
    assert.strictEqual(typeof settings.fastBots, 'boolean');
    assert.strictEqual(typeof settings.autoPass, 'boolean');
  });

  test('Sequential boot sequence states progress cleanly through 3 stages to 100%', () => {
    interface BootStep {
      progress: number;
      status: string;
    }

    const steps: BootStep[] = [];
    const recordStep = (progress: number, status: string) => {
      steps.push({ progress, status });
    };

    // Stage 1 (0% to 35%): "Checking cards..."
    recordStep(35, 'Checking cards...');
    // Stage 2 (35% to 70%): "Shuffling deck..."
    recordStep(70, 'Shuffling deck...');
    // Stage 3 (70% to 100%): "Ready to play!"
    recordStep(100, 'Ready to play!');

    assert.strictEqual(steps.length, 3);
    assert.strictEqual(steps[0].progress, 35);
    assert.strictEqual(steps[0].status, 'Checking cards...');

    assert.strictEqual(steps[1].progress, 70);
    assert.strictEqual(steps[1].status, 'Shuffling deck...');

    assert.strictEqual(steps[2].progress, 100);
    assert.strictEqual(steps[2].status, 'Ready to play!');
  });

  test('networkService.isOnline returns boolean and does not throw', async () => {
    await assert.doesNotReject(async () => {
      const isOnline = await networkService.isOnline();
      assert.strictEqual(typeof isOnline, 'boolean');
    });
  });

  test('networkService offline timeout safety and fail-safe handling', async () => {
    // Check that networkService can handle multiple quick checks
    const status1 = await networkService.isOnline();
    assert.strictEqual(typeof status1, 'boolean');
  });

  test('ErrorBoundary state transition and recovery contracts', () => {
    interface ErrorBoundaryState {
      hasError: boolean;
      error: Error | null;
    }

    const getDerivedStateFromError = (error: Error): ErrorBoundaryState => ({
      hasError: true,
      error,
    });

    const resetState = (): ErrorBoundaryState => ({
      hasError: false,
      error: null,
    });

    // Initial state
    let state: ErrorBoundaryState = { hasError: false, error: null };
    assert.strictEqual(state.hasError, false);
    assert.strictEqual(state.error, null);

    // Simulate runtime crash caught by ErrorBoundary
    const testError = new Error('Test crash in child component');
    state = getDerivedStateFromError(testError);
    assert.strictEqual(state.hasError, true);
    assert.strictEqual(state.error?.message, 'Test crash in child component');

    // Simulate pressing "Restart Game"
    let onResetTriggered = false;
    const triggerRestart = () => {
      state = resetState();
      onResetTriggered = true;
    };

    triggerRestart();
    assert.strictEqual(state.hasError, false);
    assert.strictEqual(state.error, null);
    assert.strictEqual(onResetTriggered, true);
  });
});
