// src/components/SettingsModal.tsx - Interactive Settings Modal with Audio/Gameplay Toggles & Account Management
import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  UserSettings,
  DEFAULT_SETTINGS,
  settingsService,
} from '../services/settingsService';
import {
  playerProfileService,
  PlayerProfile,
} from '../services/playerProfileService';
import {
  FONT_CARTOON_BOLD,
  FONT_CARTOON_HEAVY,
  FONT_CARTOON_REGULAR,
  FONT_CARTOON_SEMIBOLD,
} from '../styles/typography';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';
import { audioService } from '../services/audioService';

export interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<'sign_out' | 'delete_account' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const toastFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      settingsService.getSettings().then(setSettings);
      playerProfileService.getProfile().then(setProfile);
      setPendingConfirmation(null);
    }
  }, [visible]);

  useEffect(() => {
    const unsubSettings = settingsService.subscribe((s) => setSettings(s));
    const unsubProfile = playerProfileService.subscribe((p) => setProfile(p));
    return () => {
      unsubSettings();
      unsubProfile();
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = (message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(message);
    toastFadeAnim.setValue(0);
    Animated.timing(toastFadeAnim, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();

    toastTimerRef.current = setTimeout(() => {
      Animated.timing(toastFadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => setToastMessage(null));
    }, 2200);
  };

  const handleToggle = async <K extends keyof UserSettings>(key: K) => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    const nextVal = !settings[key];
    const updated = await settingsService.updateSetting(key, nextVal);
    setSettings(updated);

    if (key === 'bgmEnabled') {
      if (nextVal) {
        audioService.resumeBgm();
      } else {
        audioService.pauseBgm();
        audioService.playMuteSfx(true);
      }
    } else if (key === 'sfxEnabled') {
      if (!nextVal) {
        audioService.playMuteSfx(true);
      }
    }
  };

  const handleCopyId = () => {
    if (!profile) return;
    hapticsService.cardSelection();
    soundService.playCardSnap();

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(profile.id);
      }
    } catch {
      // ignore
    }

    showToast('Player ID copied to clipboard!');
  };

  const handleSignOutConfirm = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    hapticsService.cardSnap();
    soundService.playCardSnap();

    try {
      const freshGuest = await playerProfileService.signOut();
      setProfile(freshGuest);
      setPendingConfirmation(null);
      showToast('Signed out. Local session reset to Guest.');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch {
      showToast('Error during sign out. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteAccountConfirm = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    hapticsService.cardSnap();
    soundService.playCardSnap();

    try {
      const freshGuest = await playerProfileService.deleteAccount();
      await settingsService.resetSettings();
      setProfile(freshGuest);
      setPendingConfirmation(null);
      showToast('Account deleted. Clean guest state created.');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch {
      showToast('Error deleting account. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    onClose();
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerIcon}>⚙️</Text>
              <Text style={styles.headerTitle}>SETTINGS</Text>
            </View>

            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close Settings"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Toast Notification Banner */}
          {toastMessage && (
            <Animated.View style={[styles.toastBanner, { opacity: toastFadeAnim }]}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </Animated.View>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            {/* Section 1: Audio & Haptics */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionBadge}>🔊 AUDIO & HAPTICS</Text>
              </View>

              {/* Row 1: Sound Effects */}
              <View style={styles.settingRow}>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingLabel}>Sound Effects (SFX)</Text>
                  <Text style={styles.settingSubtext}>Card snaps, draw audio & game chimes</Text>
                </View>
                <CartoonToggle
                  value={settings.sfxEnabled}
                  onValueChange={() => handleToggle('sfxEnabled')}
                  testID="toggle-sfx"
                  accessibilityLabel="Sound Effects"
                />
              </View>

              {/* Row 2: Background Music */}
              <View style={styles.settingRow}>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingLabel}>Background Music (BGM)</Text>
                  <Text style={styles.settingSubtext}>Ambient soundtrack during matches</Text>
                </View>
                <CartoonToggle
                  value={settings.bgmEnabled}
                  onValueChange={() => handleToggle('bgmEnabled')}
                  testID="toggle-bgm"
                  accessibilityLabel="Background Music"
                />
              </View>

              {/* Row 3: Vibration / Haptics */}
              <View style={[styles.settingRow, styles.lastRow]}>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingLabel}>Vibration / Haptics</Text>
                  <Text style={styles.settingSubtext}>Tactile feel when dragging and playing cards</Text>
                </View>
                <CartoonToggle
                  value={settings.hapticsEnabled}
                  onValueChange={() => handleToggle('hapticsEnabled')}
                  testID="toggle-haptics"
                  accessibilityLabel="Vibration Haptics"
                />
              </View>
            </View>

            {/* Section 2: Gameplay */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionBadge}>⚡ GAMEPLAY</Text>
              </View>

              {/* Row 4: Fast Bot Turns */}
              <View style={styles.settingRow}>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingLabel}>Fast Bot Turns</Text>
                  <Text style={styles.settingSubtext}>Shorten bot thinking delays for rapid matches</Text>
                </View>
                <CartoonToggle
                  value={settings.fastBots}
                  onValueChange={() => handleToggle('fastBots')}
                  testID="toggle-fast-bots"
                  accessibilityLabel="Fast Bot Turns"
                />
              </View>

              {/* Row 5: Auto-Pass on Draw */}
              <View style={[styles.settingRow, styles.lastRow]}>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingLabel}>Auto-Pass on Draw</Text>
                  <Text style={styles.settingSubtext}>Automatically pass if drawn card is unplayable</Text>
                </View>
                <CartoonToggle
                  value={settings.autoPass}
                  onValueChange={() => handleToggle('autoPass')}
                  testID="toggle-auto-pass"
                  accessibilityLabel="Auto-Pass on Draw"
                />
              </View>
            </View>

            {/* Section 3: Account & Session */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionBadge}>👤 ACCOUNT & SESSION</Text>
              </View>

              {/* Player ID & Copy Chip */}
              <View style={styles.accountCard}>
                <View style={styles.accountInfoCol}>
                  <Text style={styles.accountName}>
                    {profile?.nickname || 'Player'}
                    <Text style={styles.guestBadgeText}> (Guest Account)</Text>
                  </Text>
                  <Text style={styles.accountIdText} numberOfLines={1}>
                    ID: {profile?.id || '—'}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleCopyId}
                  style={styles.copyChip}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Copy Player ID"
                  testID="copy-id-chip"
                >
                  <Text style={styles.copyChipText}>📋 Copy ID</Text>
                </TouchableOpacity>
              </View>

              {/* Action Buttons Row */}
              <View style={styles.accountActionCol}>
                {/* Sign Out Button */}
                <TouchableOpacity
                  onPress={() => setPendingConfirmation('sign_out')}
                  style={styles.signOutBtn}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Sign Out"
                  testID="sign-out-btn"
                >
                  <Text style={styles.signOutBtnText}>Sign Out</Text>
                </TouchableOpacity>

                {/* Delete Account Button */}
                <TouchableOpacity
                  onPress={() => setPendingConfirmation('delete_account')}
                  style={styles.deleteAccountBtn}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Delete Account"
                  testID="delete-account-btn"
                >
                  <Text style={styles.deleteAccountBtnText}>Delete Account</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          {/* In-Modal Confirmation Overlay */}
          {pendingConfirmation && (
            <View style={styles.confirmationOverlay}>
              <View style={styles.confirmationCard}>
                <Text style={styles.confirmationTitle}>
                  {pendingConfirmation === 'sign_out' ? 'SIGN OUT' : 'DELETE ACCOUNT'}
                </Text>
                <Text style={styles.confirmationBody}>
                  {pendingConfirmation === 'sign_out'
                    ? 'Sign out of your account? Your local session will revert to a fresh guest profile.'
                    : 'Delete your account? This action cannot be undone and will permanently wipe all your progression, inventory, and stats.'}
                </Text>

                <View style={styles.confirmationBtnRow}>
                  <TouchableOpacity
                    onPress={() => setPendingConfirmation(null)}
                    disabled={isProcessing}
                    style={styles.confirmCancelBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.confirmCancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={
                      pendingConfirmation === 'sign_out'
                        ? handleSignOutConfirm
                        : handleDeleteAccountConfirm
                    }
                    disabled={isProcessing}
                    style={[
                      styles.confirmActionBtn,
                      pendingConfirmation === 'delete_account'
                        ? styles.confirmActionBtnDanger
                        : styles.confirmActionBtnPrimary,
                    ]}
                    activeOpacity={0.8}
                    testID="confirm-action-btn"
                  >
                    <Text style={styles.confirmActionText}>
                      {pendingConfirmation === 'sign_out' ? 'Sign Out' : 'Delete Permanently'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

// Styled Cartoon Toggle Switch Component
interface CartoonToggleProps {
  value: boolean;
  onValueChange: (val: boolean) => void;
  testID?: string;
  accessibilityLabel: string;
}

const CartoonToggle: React.FC<CartoonToggleProps> = ({
  value,
  onValueChange,
  testID,
  accessibilityLabel,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        styles.toggleTrack,
        value ? styles.toggleTrackOn : styles.toggleTrackOff,
      ]}
    >
      <View
        style={[
          styles.toggleThumb,
          value ? styles.toggleThumbOn : styles.toggleThumbOff,
        ]}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    backgroundColor: '#FEF6E9', // Warm cream surface matching design system
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#E2D9C8',
    padding: 18,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 8,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#E2D9C8',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: 18,
  },
  headerTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 16,
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
  toastBanner: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  toastText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#FACC15',
  },
  scrollContent: {
    paddingVertical: 8,
    gap: 12,
  },
  sectionCard: {
    backgroundColor: '#FFFDF7',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E2D9C8',
    padding: 12,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeader: {
    marginBottom: 8,
  },
  sectionBadge: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11,
    color: '#92400E',
    letterSpacing: 0.5,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 217, 200, 0.5)',
  },
  lastRow: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  settingTextCol: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    ...FONT_CARTOON_BOLD,
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 2,
  },
  settingSubtext: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  toggleTrack: {
    width: 52,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleTrackOn: {
    backgroundColor: '#22C55E',
    borderColor: '#15803D',
  },
  toggleTrackOff: {
    backgroundColor: '#E2E8F0',
    borderColor: '#CBD5E1',
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  toggleThumbOff: {
    alignSelf: 'flex-start',
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF6E9',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2D9C8',
    padding: 10,
    marginBottom: 10,
  },
  accountInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  accountName: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#0F172A',
  },
  guestBadgeText: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 10,
    color: '#64748B',
  },
  accountIdText: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 10,
    color: '#475569',
    marginTop: 2,
  },
  copyChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  copyChipText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 11,
    color: '#475569',
  },
  accountActionCol: {
    gap: 8,
  },
  signOutBtn: {
    backgroundColor: '#E0F2FE',
    borderWidth: 2,
    borderColor: '#BAE6FD',
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#0369A1',
    letterSpacing: 0.4,
  },
  deleteAccountBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderColor: '#FCA5A5',
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#DC2626',
    letterSpacing: 0.4,
  },
  confirmationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 24,
  },
  confirmationCard: {
    width: '100%',
    backgroundColor: '#FEF6E9',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#E2D9C8',
    padding: 16,
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  confirmationTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  confirmationBody: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 14,
  },
  confirmationBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#475569',
  },
  confirmActionBtn: {
    flex: 1.2,
    borderBottomWidth: 3,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmActionBtnPrimary: {
    backgroundColor: '#0284C7',
    borderColor: '#0369A1',
  },
  confirmActionBtnDanger: {
    backgroundColor: '#DC2626',
    borderColor: '#B91C1C',
  },
  confirmActionText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
