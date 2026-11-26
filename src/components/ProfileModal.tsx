// src/components/ProfileModal.tsx - Lightweight profile editor and stats modal
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { applyImmersiveNavigationBar, scheduleImmersiveNavigationBar } from '../utils/immersiveMode';
import { StatusBar } from 'expo-status-bar';
import {
  AVATAR_OPTIONS,
  AvatarOption,
  PlayerProfile,
  getAvatarConfig,
  isAvatarUnlocked,
  normalizeAvatarKey,
  normalizePlayerStats,
  playerProfileService,
} from '../services/playerProfileService';
import { AvatarIcon } from './AvatarIcon';
import { authService } from '../services/authService';
import { errorToastService } from '../services/errorToastService';
import { networkService } from '../services/networkService';
import {
  FONT_CARTOON_BOLD,
  FONT_CARTOON_HEAVY,
  FONT_CARTOON_REGULAR,
} from '../styles/typography';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';
import { validateUsername } from '../utils/contentFilter';
import { supabase } from '../services/supabase';

export interface ProfileModalProps {
  visible: boolean;
  profile: PlayerProfile;
  onClose: () => void;
  onSave: (newNickname: string, newAvatarId: string) => Promise<void>;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  visible,
  profile,
  onClose,
  onSave,
}) => {
  // Live profile bound to playerProfileService updates + cloud/storage refresh on open
  const [liveProfile, setLiveProfile] = useState<PlayerProfile>(profile);
  // Isolated local input buffer (allows clearing freely without forcing 'Player' while typing)
  const [inputValue, setInputValue] = useState<string>(profile.nickname || 'Player');
  const [nameError, setNameError] = useState<string | null>(null);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(profile.avatarId);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [session, setSession] = useState<any>(null);

  // Native Google Sign-In state
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // 12-Avatar Unlock Flow State
  const [pendingUnlockAvatar, setPendingUnlockAvatar] = useState<AvatarOption | null>(null);
  const [isUnlockingAvatar, setIsUnlockingAvatar] = useState(false);
  const [avatarNotice, setAvatarNotice] = useState<{ text: string; tone: 'info' | 'warn' | 'success' } | null>(null);

  // Re-assert sticky-immersive mode helper
  const reassertImmersiveMode = async () => {
    await applyImmersiveNavigationBar();
    scheduleImmersiveNavigationBar([150, 450]);
  };

  // Listen to Supabase auth session changes for real-time connected state
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        setSession(data.session);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  // Subscribe to live profile/career-stats updates on mount and keep prop in sync
  useEffect(() => {
    setLiveProfile(profile);
  }, [profile]);

  useEffect(() => {
    playerProfileService.getProfile(true).then(setLiveProfile).catch(() => {});
    const unsubscribe = playerProfileService.subscribe(setLiveProfile);
    return () => unsubscribe();
  }, []);

  // Sync state & refresh latest persisted/cloud Career Statistics whenever modal opens
  useEffect(() => {
    if (visible) {
      playerProfileService
        .refreshFromCloudIfAuthenticated()
        .then((refreshed) => {
          setLiveProfile(refreshed);
        })
        .catch(() => {});
      setInputValue(liveProfile.nickname || profile.nickname || 'Player');
      setNameError(null);
      setSelectedAvatarId(liveProfile.avatarId || profile.avatarId);
      setIsSaving(false);
      setSaveStatus('idle');
      setIsSigningIn(false);
      setAuthError(null);
      setPendingUnlockAvatar(null);
      setIsUnlockingAvatar(false);
      setAvatarNotice(null);
      reassertImmersiveMode();
    }
  }, [visible]);

  const activeProfile = liveProfile || profile;
  const careerStats = normalizePlayerStats(activeProfile.stats);
  const isConnected = !activeProfile.isGuest || Boolean(session?.user);
  const connectedEmail = session?.user?.email || activeProfile.email;
  const currentLevel = activeProfile.level ?? 1;
  const currentCoins = activeProfile.coins ?? 250;
  const currentGems = activeProfile.gems ?? 10;
  const equippedAvatarKey = normalizeAvatarKey(selectedAvatarId) || normalizeAvatarKey(activeProfile.avatarId) || 'fox';
  const unlockedAvatarsList = activeProfile.unlockedAvatars ?? ['fox', 'bot'];
  const unlockedCount = AVATAR_OPTIONS.filter((a) => isAvatarUnlocked(unlockedAvatarsList, a.id)).length;

  const activeAvatar = getAvatarConfig(selectedAvatarId);
  const winRate = careerStats.winRate ?? 0;
  const losses = careerStats.losses ?? Math.max(0, careerStats.gamesPlayed - careerStats.wins);
  const bestStreak = Math.max(careerStats.bestStreak ?? 0, careerStats.winStreak);
  const rivalCalls = careerStats.rivalCalls ?? 0;

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    setAuthError(null);
    setIsSigningIn(true);
    hapticsService.cardSnap();
    soundService.playCardSnap();

    try {
      const isOnline = await networkService.isOnline();
      if (!isOnline) {
        setAuthError("You're offline! Please check your internet connection.");
        return;
      }

      const res = await authService.signInWithGoogleNative();
      if (res && !res.cancelled) {
        soundService.playWinChime();
        errorToastService.show({
          message: 'Connected with Google! Cloud save active.',
          type: 'info',
          durationMs: 3000,
        });
        await playerProfileService.getProfile(true);
      }
    } catch (err: any) {
      if (err?.code !== 'SIGN_IN_CANCELLED' && err?.message !== 'SIGN_IN_CANCELLED') {
        setAuthError(err?.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
      await reassertImmersiveMode();
    }
  };

  const handleSignOut = async () => {
    hapticsService.cardSnap();
    soundService.playCardDraw();
    try {
      await authService.signOutNativeGoogle();
      setSession(null);
      errorToastService.show({
        message: 'Signed out. Playing as Guest.',
        type: 'info',
        durationMs: 2500,
      });
      setAuthError(null);
      await playerProfileService.getProfile(true);
    } catch (err) {
      console.warn('Sign out warning:', err);
    } finally {
      await reassertImmersiveMode();
    }
  };

  // Handle tapping any of the 12 avatars (equip if unlocked, warn if level-locked, or prompt to unlock with coins)
  const handleSelectAvatar = async (item: AvatarOption) => {
    const unlocked = isAvatarUnlocked(unlockedAvatarsList, item.id);

    if (!unlocked) {
      if (currentLevel < item.requiredLevel) {
        hapticsService.cardSelection();
        soundService.playCardSnap();
        const msg = `Reach Level ${item.requiredLevel} to unlock ${item.label}!`;
        setAvatarNotice({ text: msg, tone: 'warn' });
        errorToastService.show({
          message: `Reach Level ${item.requiredLevel} to unlock!`,
          type: 'info',
          durationMs: 2200,
        });
        return;
      }

      // Level met -> open confirmation modal (handles both sufficient and insufficient coin states cleanly)
      hapticsService.cardSelection();
      soundService.playCardSnap();
      setAvatarNotice(null);
      setPendingUnlockAvatar(item);
      return;
    }

    hapticsService.cardSelection();
    soundService.playCardSnap();
    setAvatarNotice(null);
    setSelectedAvatarId(item.id);
    setSaveStatus('saving');
    try {
      const updated = await playerProfileService.updateAvatar(item.id);
      setLiveProfile(updated);
      setSaveStatus('saved');
    } catch (err) {
      console.warn('Failed to auto-save avatar:', err);
    }
  };

  const handleConfirmUnlockAvatar = async () => {
    if (!pendingUnlockAvatar || isUnlockingAvatar) return;
    setIsUnlockingAvatar(true);

    try {
      const result = await playerProfileService.unlockAvatar(pendingUnlockAvatar.id);
      if (result.success) {
        soundService.playWinChime();
        hapticsService.victory();
        setLiveProfile(result.profile);
        setSelectedAvatarId(result.profile.avatarId);
        setPendingUnlockAvatar(null);
        setSaveStatus('saved');
        setAvatarNotice({
          text: `${pendingUnlockAvatar.label} unlocked & equipped!`,
          tone: 'success',
        });
      } else {
        hapticsService.cardSelection();
        setAvatarNotice({
          text: result.error || 'Unable to unlock avatar.',
          tone: 'warn',
        });
        setPendingUnlockAvatar(null);
      }
    } catch (err) {
      console.warn('Failed to unlock avatar:', err);
      setAvatarNotice({ text: 'Could not unlock avatar. Please try again.', tone: 'warn' });
    } finally {
      setIsUnlockingAvatar(false);
    }
  };

  // Keystroke handler: updates local buffer freely without debounced overwriting to 'Player'
  const handleNameChange = (text: string) => {
    setInputValue(text);
    if (nameError) setNameError(null);
    if (saveStatus !== 'idle') setSaveStatus('idle');
  };

  // On blur handler: reverts empty input to previous name, or validates if typed
  const handleNameBlur = () => {
    const trimmed = inputValue.trim();
    if (trimmed.length === 0) {
      // If abandoned completely empty on blur, revert to previous name
      setInputValue(profile.nickname || 'Player');
      setNameError(null);
      return;
    }
    if (trimmed.length < 3) {
      setNameError('Name must be at least 3 characters');
      return;
    }
    const valResult = validateUsername(trimmed);
    if (!valResult.isValid) {
      setNameError(valResult.error || 'Invalid username');
    } else {
      setNameError(null);
    }
  };

  // Safe close: discards uncommitted nickname changes without forcing 'Player' and reasserts sticky immersive mode
  const handleClose = async () => {
    setNameError(null);
    await reassertImmersiveMode();
    onClose();
  };

  const handleSave = async () => {
    const trimmed = inputValue.trim();
    if (trimmed.length < 3) {
      setNameError('Name must be at least 3 characters');
      hapticsService.cardSelection();
      soundService.playCardSnap();
      return;
    }

    // 1. Validate username criteria (3-16 chars, profanity filter, leetspeak)
    const validation = validateUsername(trimmed);
    if (!validation.isValid) {
      setNameError(validation.error || 'Invalid username');
      hapticsService.cardSelection();
      soundService.playCardSnap();
      return;
    }

    setNameError(null);
    setIsSaving(true);
    hapticsService.cardSnap();
    soundService.playCardDraw();

    try {
      await playerProfileService.updateNickname(trimmed);
      await playerProfileService.updateAvatar(selectedAvatarId);
      setSaveStatus('saved');
      await onSave(trimmed, selectedAvatarId);
      await reassertImmersiveMode();
      onClose();
    } catch (err) {
      console.warn('Failed to save profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={handleClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <StatusBar hidden={true} />
      <View style={styles.backdrop}>
        <View style={styles.dialogCard}>
          {/* Header: Title and Close button */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerIcon}>👤</Text>
              <Text style={styles.headerTitle}>PLAYER PROFILE</Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Scrollable Modal Body */}
          <ScrollView
            style={styles.modalBodyScroll}
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Selected Avatar Preview & Guest/Verified Badge */}
            <View style={styles.previewSection}>
              <AvatarIcon
                avatarId={equippedAvatarKey}
                size={84}
                style={{ marginBottom: 6 }}
              />

              {!isConnected ? (
                <View style={styles.guestBadge}>
                  <Text style={styles.guestBadgeDot}>●</Text>
                  <Text style={styles.guestBadgeText}>Guest Account</Text>
                </View>
              ) : (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedBadgeDot}>✓</Text>
                  <Text style={styles.verifiedBadgeText}>
                    {connectedEmail || 'Cloud Account'}
                  </Text>
                </View>
              )}

              {/* Economy Currency Balances (Coins & Gems) */}
              <View style={styles.economyRow}>
                <View style={styles.coinsBadge}>
                  <Text style={styles.coinsBadgeIcon}>🪙</Text>
                  <Text style={styles.coinsBadgeText}>{currentCoins.toLocaleString()}</Text>
                </View>
                <View style={styles.gemsBadge}>
                  <Text style={styles.gemsBadgeIcon}>💎</Text>
                  <Text style={styles.gemsBadgeText}>{activeProfile.gems ?? 10}</Text>
                </View>
              </View>
            </View>

            {/* Level & XP Progression Card */}
            <View style={styles.levelCard}>
              <View style={styles.levelHeaderRow}>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeText}>⭐ LVL {currentLevel}</Text>
                </View>
                <Text style={styles.levelXpText}>
                  {activeProfile.currentXp ?? 0} / {activeProfile.xpToNextLevel ?? 100} XP
                </Text>
              </View>
              <View style={styles.xpTrack}>
                <View
                  style={[
                    styles.xpFill,
                    {
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          Math.round(
                            ((activeProfile.currentXp ?? 0) / (activeProfile.xpToNextLevel || 100)) * 100
                          )
                        )
                      )}%`,
                    },
                  ]}
                >
                  <View style={styles.xpGlintLine} />
                </View>
              </View>
            </View>

            {/* Nickname Input Field */}
            <View style={styles.inputSection}>
              <View style={styles.inputHeaderRow}>
                <Text style={styles.inputLabel}>YOUR NICKNAME</Text>
                <View style={styles.inputStatusRow}>
                  {saveStatus === 'saved' && (
                    <View style={styles.savedBadge}>
                      <Text style={styles.savedCheckmark}>✓</Text>
                      <Text style={styles.savedText}>Saved</Text>
                    </View>
                  )}
                  <Text style={styles.charCountBadge}>{inputValue.length}/16</Text>
                </View>
              </View>
              <TextInput
                style={[styles.nicknameInput, !!nameError && styles.nicknameInputError]}
                value={inputValue}
                onChangeText={handleNameChange}
                onBlur={handleNameBlur}
                onSubmitEditing={handleSave}
                placeholder="Enter name (min 3 chars)"
                placeholderTextColor="#94A3B8"
                maxLength={16}
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="done"
              />
              {nameError && (
                <View style={styles.nameErrorBanner}>
                  <Text style={styles.nameErrorIcon}>⚠️</Text>
                  <Text style={styles.nameErrorText}>{nameError}</Text>
                </View>
              )}
            </View>

            {/* Choose Avatar Grid (12 Cartoon-Arcade Avatars with Level 1–40 + Coin Progression) */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarSectionHeader}>
                <Text style={styles.sectionLabel}>CHOOSE AVATAR (LV. 1–40)</Text>
                <View style={styles.avatarCountPill}>
                  <Text style={styles.avatarCountText}>
                    {unlockedCount}/{AVATAR_OPTIONS.length} UNLOCKED
                  </Text>
                </View>
              </View>

              {avatarNotice && (
                <View
                  style={[
                    styles.avatarNoticeBanner,
                    avatarNotice.tone === 'success'
                      ? styles.avatarNoticeSuccess
                      : styles.avatarNoticeWarn,
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarNoticeText,
                      avatarNotice.tone === 'success'
                        ? styles.avatarNoticeTextSuccess
                        : styles.avatarNoticeTextWarn,
                    ]}
                  >
                    {avatarNotice.tone === 'success' ? '✨ ' : '🔒 '}
                    {avatarNotice.text}
                  </Text>
                </View>
              )}

              <View style={styles.avatarGrid}>
                {AVATAR_OPTIONS.map((item: AvatarOption) => {
                  const isUnlocked = isAvatarUnlocked(unlockedAvatarsList, item.id);
                  const isEquipped = isUnlocked && item.id === equippedAvatarKey;
                  const isLevelLocked = !isUnlocked && currentLevel < item.requiredLevel;
                  const isReadyToBuy = !isUnlocked && currentLevel >= item.requiredLevel;
                  const gemCost = item.gemCost ?? 0;
                  const canAfford =
                    currentCoins >= item.coinCost && currentGems >= gemCost;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.78}
                      onPress={() => handleSelectAvatar(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.label} avatar${
                        isEquipped
                          ? ', equipped'
                          : isUnlocked
                          ? ', unlocked'
                          : isLevelLocked
                          ? `, locked until level ${item.requiredLevel}`
                          : gemCost > 0
                          ? `, unlock for ${item.coinCost} coins and ${gemCost} gems`
                          : `, unlock for ${item.coinCost} coins`
                      }`}
                      testID={`avatar-option-${item.id}`}
                      style={[
                        styles.avatarOptionCard,
                        isEquipped && styles.avatarOptionCardSelected,
                        isLevelLocked && styles.avatarOptionCardLocked,
                        isReadyToBuy && styles.avatarOptionCardBuyable,
                      ]}
                    >
                      {isEquipped && (
                        <View style={styles.avatarSelectedBadge}>
                          <Text style={styles.avatarSelectedBadgeText}>✓</Text>
                        </View>
                      )}

                      <AvatarIcon
                        avatarId={item.id}
                        size={58}
                        dimmed={isLevelLocked}
                        style={{ marginBottom: 4 }}
                      />

                      <Text
                        style={[
                          styles.avatarOptionLabel,
                          isEquipped && styles.avatarOptionLabelSelected,
                          isLevelLocked && styles.avatarOptionLabelLocked,
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>

                      {isEquipped ? (
                        <View style={styles.avatarStatusEquippedPill}>
                          <Text style={styles.avatarStatusEquippedText}>Equipped</Text>
                        </View>
                      ) : isUnlocked ? (
                        <View style={styles.avatarStatusUnlockedPill}>
                          <Text style={styles.avatarStatusUnlockedText}>Equip</Text>
                        </View>
                      ) : isLevelLocked ? (
                        <View style={styles.avatarStatusLevelLockPill}>
                          <Text style={styles.avatarStatusLevelLockText}>
                            🔒 Lv. {item.requiredLevel}
                          </Text>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.avatarStatusPricePill,
                            !canAfford && styles.avatarStatusPricePillLow,
                          ]}
                        >
                          <Text
                            style={[
                              styles.avatarStatusPriceText,
                              !canAfford && styles.avatarStatusPriceTextLow,
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.75}
                          >
                            🪙 {item.coinCost.toLocaleString()}
                            {gemCost > 0 ? ` + 💎 ${gemCost}` : ''}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Expanded Career Stats Grid (Public Human Multiplayer Only) */}
            <View style={styles.statsCard}>
              <View style={styles.statsCardHeader}>
                <Text style={styles.statsCardHeaderIcon}>📊</Text>
                <Text style={styles.statsCardTitle}>CAREER STATISTICS</Text>
              </View>
              <View style={styles.statsGrid}>
                {/* 1. Matches */}
                <View style={styles.statBox}>
                  <View style={styles.statBoxGlint} />
                  <Text style={styles.statNumber}>{careerStats.gamesPlayed}</Text>
                  <Text style={styles.statLabel}>MATCHES</Text>
                </View>

                {/* 2. Wins */}
                <View style={styles.statBox}>
                  <View style={styles.statBoxGlint} />
                  <Text style={[styles.statNumber, styles.statWinsNumber]}>
                    {careerStats.wins}
                  </Text>
                  <Text style={styles.statLabel}>WINS 🏆</Text>
                </View>

                {/* 3. Losses */}
                <View style={styles.statBox}>
                  <View style={styles.statBoxGlint} />
                  <Text style={[styles.statNumber, styles.statLossesNumber]}>
                    {losses}
                  </Text>
                  <Text style={styles.statLabel}>LOSSES</Text>
                </View>

                {/* 4. Win Rate */}
                <View style={styles.statBox}>
                  <View style={styles.statBoxGlint} />
                  <Text style={[styles.statNumber, styles.statRateNumber]}>
                    {winRate}%
                  </Text>
                  <Text style={styles.statLabel}>WIN RATE</Text>
                </View>

                {/* 5. Current Streak */}
                <View style={styles.statBox}>
                  <View style={styles.statBoxGlint} />
                  <Text style={[styles.statNumber, styles.statStreakNumber]}>
                    {careerStats.winStreak}
                  </Text>
                  <Text style={styles.statLabel}>STREAK 🔥</Text>
                </View>

                {/* 6. Best Streak */}
                <View style={styles.statBox}>
                  <View style={styles.statBoxGlint} />
                  <Text style={[styles.statNumber, styles.statBestStreakNumber]}>
                    {bestStreak}
                  </Text>
                  <Text style={styles.statLabel}>BEST STREAK ⚡</Text>
                </View>
              </View>
              <Text style={styles.statsScopeFootnote}>
                Public Human Multiplayer • ⚡ {rivalCalls} Rival Calls
              </Text>
            </View>

            {/* Cloud Save & Account Management Card */}
            {isConnected ? (
              <View style={styles.connectedCard}>
                <Text style={styles.connectedBadge}>✓ CONNECTED</Text>
                <Text style={styles.userEmail}>{connectedEmail || profile.nickname}</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSignOut}
                  style={styles.signOutBtn}
                >
                  <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.authCard}>
                <View style={styles.authHeaderRow}>
                  <View style={styles.authHeaderTitleRow}>
                    <Text style={styles.authHeaderIcon}>⚡</Text>
                    <Text style={styles.authHeaderTitle}>SAVE PROGRESS TO CLOUD</Text>
                  </View>
                </View>

                <Text style={styles.authSubtitle}>
                  Sign in with Google to sync your XP, level, coins, and unlocked cosmetics across devices.
                </Text>

                {authError && (
                  <View style={styles.authErrorBanner}>
                    <Text style={styles.authErrorText}>{authError}</Text>
                  </View>
                )}

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleGoogleSignIn}
                  disabled={isSigningIn}
                  style={[styles.googleSignInBtn, isSigningIn && styles.googleSignInBtnDisabled]}
                >
                  {isSigningIn ? (
                    <ActivityIndicator color="#0F172A" size="small" />
                  ) : (
                    <View style={styles.googleBtnContent}>
                      <Text style={styles.googleGLogo}>G</Text>
                      <Text style={styles.googleSignInBtnText}>Sign in with Google</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Save Profile Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSave}
              disabled={isSaving}
              style={styles.saveBtn}
            >
              <Text style={styles.saveBtnText}>{isSaving ? 'Saving...' : 'Save Profile'}</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* In-Modal Avatar Unlock Confirmation Overlay */}
          {pendingUnlockAvatar && (() => {
            const pendingGemCost = pendingUnlockAvatar.gemCost ?? 0;
            const missingCoins = Math.max(0, pendingUnlockAvatar.coinCost - currentCoins);
            const missingGems = Math.max(0, pendingGemCost - currentGems);
            const hasEnoughCurrency = missingCoins === 0 && missingGems === 0;

            return (
              <View style={styles.unlockOverlay}>
                <View style={styles.unlockConfirmCard}>
                  <AvatarIcon
                    avatarId={pendingUnlockAvatar.id}
                    size={76}
                    showCircle
                    borderWidth={3}
                    style={styles.unlockPreviewAvatar}
                  />
                  <Text style={styles.unlockTitle}>UNLOCK {pendingUnlockAvatar.label.toUpperCase()}?</Text>
                  <Text style={styles.unlockSubtitle}>
                    Unlock {pendingUnlockAvatar.label} for{' '}
                    {pendingUnlockAvatar.coinCost.toLocaleString()} Coins
                    {pendingGemCost > 0 ? ` + ${pendingGemCost} Gems` : ''}?
                  </Text>

                  {!hasEnoughCurrency ? (
                    <View style={styles.unlockInsufficientBanner}>
                      <Text style={styles.unlockInsufficientText}>
                        {missingCoins > 0 && missingGems > 0
                          ? `Need ${missingCoins.toLocaleString()} more coins & ${missingGems} more gems`
                          : missingCoins > 0
                          ? `Need ${missingCoins.toLocaleString()} more coins (You have 🪙 ${currentCoins.toLocaleString()})`
                          : `Need ${missingGems} more gems (You have 💎 ${currentGems})`}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.unlockBalanceHint}>
                      Balance after unlock: 🪙{' '}
                      {(currentCoins - pendingUnlockAvatar.coinCost).toLocaleString()}
                      {pendingGemCost > 0 ? `  •  💎 ${currentGems - pendingGemCost}` : ''}
                    </Text>
                  )}

                  <View style={styles.unlockActionsRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setPendingUnlockAvatar(null)}
                      disabled={isUnlockingAvatar}
                      style={styles.unlockCancelBtn}
                    >
                      <Text style={styles.unlockCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handleConfirmUnlockAvatar}
                      disabled={isUnlockingAvatar || !hasEnoughCurrency}
                      style={[
                        styles.unlockConfirmBtn,
                        (isUnlockingAvatar || !hasEnoughCurrency) &&
                          styles.unlockConfirmBtnDisabled,
                      ]}
                      testID="confirm-unlock-avatar-btn"
                    >
                      {isUnlockingAvatar ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.unlockConfirmText}>
                          🪙 {pendingUnlockAvatar.coinCost.toLocaleString()}
                          {pendingGemCost > 0 ? ` + 💎 ${pendingGemCost}` : ''}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  dialogCard: {
    width: '90%',
    maxWidth: 480,
    maxHeight: '92%',
    alignSelf: 'center',
    backgroundColor: '#FEF6E9',
    borderRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderWidth: 3,
    borderColor: '#E2D9C8',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
    overflow: 'hidden',
  },
  modalBodyScroll: {
    width: '100%',
  },
  scrollContainer: {
    alignItems: 'center',
    paddingBottom: 24,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2D9C8',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIcon: {
    fontSize: 16,
  },
  headerTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 15,
    color: '#0F172A',
    letterSpacing: 0.8,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2D9C8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '900',
  },
  previewSection: {
    alignItems: 'center',
    marginVertical: 4,
  },
  largeAvatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    marginBottom: 6,
  },
  largeAvatarEmoji: {
    fontSize: 34,
  },
  guestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    gap: 5,
  },
  guestBadgeDot: {
    fontSize: 8,
    color: '#10B981',
  },
  guestBadgeText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#475569',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    gap: 5,
  },
  verifiedBadgeDot: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 10,
    color: '#16A34A',
  },
  verifiedBadgeText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#15803D',
  },
  economyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  coinsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  coinsBadgeIcon: {
    fontSize: 13,
  },
  coinsBadgeText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#92400E',
  },
  gemsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    borderWidth: 2,
    borderColor: '#BAE6FD',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  gemsBadgeIcon: {
    fontSize: 13,
  },
  gemsBadgeText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#0369A1',
  },
  levelCard: {
    width: '100%',
    backgroundColor: '#FFFDF7',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2D9C8',
    padding: 12,
    marginTop: 6,
    marginBottom: 4,
  },
  levelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  levelBadge: {
    backgroundColor: '#FEF6E9',
    borderWidth: 1.5,
    borderColor: '#E2D9C8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  levelBadgeText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
    color: '#0F172A',
  },
  levelXpText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#15803D',
  },
  xpTrack: {
    width: '100%',
    height: 14,
    backgroundColor: '#E2E8F0',
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  xpGlintLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  inputSection: {
    width: '100%',
    marginVertical: 8,
  },
  inputHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  inputLabel: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#64748B',
    letterSpacing: 0.6,
  },
  inputStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  charCountBadge: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#86EFAC',
    gap: 4,
  },
  savedCheckmark: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 10,
    color: '#16A34A',
  },
  savedText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#16A34A',
  },
  savingBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  savingText: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 10,
    color: '#64748B',
  },
  nicknameInput: {
    ...FONT_CARTOON_BOLD,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    color: '#0F172A',
    textAlign: 'center',
  },
  nicknameInputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  nameErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderColor: '#F87171',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 6,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  nameErrorIcon: {
    fontSize: 12,
  },
  nameErrorText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#B91C1C',
    textAlign: 'center',
  },
  avatarSection: {
    width: '100%',
    marginVertical: 6,
  },
  avatarSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionLabel: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#64748B',
    letterSpacing: 0.6,
  },
  avatarCountPill: {
    backgroundColor: '#EDE9FE',
    borderWidth: 1.5,
    borderColor: '#C4B5FD',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  avatarCountText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 9.5,
    color: '#5B21B6',
    letterSpacing: 0.4,
  },
  avatarNoticeBanner: {
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
    alignItems: 'center',
  },
  avatarNoticeWarn: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  avatarNoticeSuccess: {
    backgroundColor: '#DCFCE7',
    borderColor: '#22C55E',
  },
  avatarNoticeText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    textAlign: 'center',
  },
  avatarNoticeTextWarn: {
    color: '#92400E',
  },
  avatarNoticeTextSuccess: {
    color: '#15803D',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  avatarOptionCard: {
    width: '31.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    paddingVertical: 7,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  avatarOptionCardSelected: {
    borderColor: '#F59E0B',
    backgroundColor: '#FEF9C3',
    borderWidth: 2.5,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  avatarOptionCardLocked: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  avatarOptionCardBuyable: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FBBF24',
  },
  avatarSelectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#16A34A',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  avatarSelectedBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  avatarOptionCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#0F1142',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarOptionCircleDimmed: {
    opacity: 0.45,
  },
  avatarOptionLabelLocked: {
    color: '#64748B',
  },
  avatarStatusEquippedPill: {
    marginTop: 3,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#4ADE80',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  avatarStatusEquippedText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 8.5,
    color: '#15803D',
  },
  avatarStatusUnlockedPill: {
    marginTop: 3,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
  },
  avatarStatusUnlockedText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 8.5,
    color: '#1D4ED8',
  },
  avatarStatusLevelLockPill: {
    marginTop: 3,
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  avatarStatusLevelLockText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 8.5,
    color: '#475569',
  },
  avatarStatusPricePill: {
    marginTop: 3,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  avatarStatusPricePillLow: {
    backgroundColor: '#FEE2E2',
    borderColor: '#F87171',
  },
  avatarStatusPriceText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 8.5,
    color: '#92400E',
  },
  avatarStatusPriceTextLow: {
    color: '#B91C1C',
  },
  unlockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 40,
  },
  unlockConfirmCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFDF7',
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#0F1142',
    padding: 18,
    alignItems: 'center',
    shadowColor: '#0F1142',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  unlockPreviewAvatar: {
    marginBottom: 10,
  },
  unlockTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 17,
    color: '#0F1142',
    letterSpacing: 0.5,
    marginBottom: 4,
    textAlign: 'center',
  },
  unlockSubtitle: {
    ...FONT_CARTOON_BOLD,
    fontSize: 13,
    color: '#334155',
    textAlign: 'center',
    marginBottom: 8,
  },
  unlockBalanceHint: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 11.5,
    color: '#15803D',
    marginBottom: 14,
  },
  unlockInsufficientBanner: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 14,
  },
  unlockInsufficientText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#B91C1C',
    textAlign: 'center',
  },
  unlockActionsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  unlockCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockCancelText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 13,
    color: '#475569',
  },
  unlockConfirmBtn: {
    flex: 1.4,
    backgroundColor: '#F59E0B',
    borderWidth: 2,
    borderColor: '#0F1142',
    borderBottomWidth: 4,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockConfirmBtnDisabled: {
    backgroundColor: '#CBD5E1',
    borderColor: '#94A3B8',
    opacity: 0.75,
  },
  unlockConfirmText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#FFFFFF',
  },
  avatarOptionEmoji: {
    fontSize: 16,
  },
  avatarOptionLabel: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#64748B',
  },
  avatarOptionLabelSelected: {
    color: '#1D4ED8',
  },
  statsCard: {
    width: '100%',
    backgroundColor: '#FFFDF7',
    borderRadius: 18,
    padding: 12,
    marginVertical: 10,
    borderWidth: 2,
    borderColor: '#E2D9C8',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  statsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  statsCardHeaderIcon: {
    fontSize: 13,
  },
  statsCardTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  statBox: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  statBoxGlint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  statNumber: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 3,
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  statWinsNumber: {
    color: '#10B981',
  },
  statLossesNumber: {
    color: '#F87171',
  },
  statRateNumber: {
    color: '#38BDF8',
  },
  statStreakNumber: {
    color: '#FACC15',
  },
  statBestStreakNumber: {
    color: '#F59E0B',
  },
  statsScopeFootnote: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
  },
  statLabel: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  authCard: {
    width: '100%',
    backgroundColor: '#FFFDF7',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E2D9C8',
    padding: 14,
    marginVertical: 8,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  authHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  authHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authHeaderIcon: {
    fontSize: 14,
  },
  authHeaderTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
    color: '#334155',
    letterSpacing: 0.7,
  },
  connectedCard: {
    width: '100%',
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    borderWidth: 2.5,
    borderBottomWidth: 4,
    borderColor: '#86EFAC',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  connectedBadge: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#15803D',
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 4,
    letterSpacing: 0.8,
  },
  userEmail: {
    ...FONT_CARTOON_BOLD,
    fontSize: 13,
    color: '#1E293B',
    marginVertical: 8,
    textAlign: 'center',
  },
  signOutBtn: {
    height: 38,
    paddingHorizontal: 20,
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  signOutText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  signOutBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
    color: '#DC2626',
    letterSpacing: 0.4,
  },
  authSubtitle: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
    lineHeight: 16,
  },
  primaryAuthBtn: {
    width: '100%',
    height: 46,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#059669',
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  primaryAuthBtnDisabled: {
    backgroundColor: '#94A3B8',
    borderColor: '#64748B',
    opacity: 0.65,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryAuthBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  googleSignInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#0F172A',
    borderBottomWidth: 5,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  googleSignInBtnDisabled: {
    opacity: 0.65,
  },
  googleBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleGLogo: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 18,
    color: '#4285F4',
  },
  googleSignInBtnText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 14,
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  authErrorBanner: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  authErrorText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#B91C1C',
    textAlign: 'center',
  },
  saveBtn: {
    width: '90%',
    height: 48,
    backgroundColor: '#10B981',
    borderBottomWidth: 4,
    borderColor: '#059669',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    alignSelf: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  saveBtnText: {
    ...FONT_CARTOON_HEAVY,
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
