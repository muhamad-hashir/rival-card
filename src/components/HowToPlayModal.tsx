// src/components/HowToPlayModal.tsx - Interactive Book-Style Rulebook Modal for Rival Card
import React, { useState, useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  FONT_CARTOON_BOLD,
  FONT_CARTOON_HEAVY,
  FONT_CARTOON_REGULAR,
  FONT_CARTOON_SEMIBOLD,
} from '../styles/typography';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';
import {
  RULEBOOK_TOTAL_PAGES,
  getPageIndicatorText,
  getNextButtonLabel,
  clampRulebookPage,
} from '../services/rulebookService';

export {
  RULEBOOK_TOTAL_PAGES,
  getPageIndicatorText,
  getNextButtonLabel,
  clampRulebookPage,
};

const ICON_SKIP = require('../../assets/icons/icon_skip.png');
const ICON_REVERSE = require('../../assets/icons/icon_reverse.png');
const ICON_DRAW2 = require('../../assets/icons/icon_draw2.png');
const ICON_WILD = require('../../assets/icons/icon_wild_color_change.png');
const ICON_WILD_4 = require('../../assets/icons/icon_wild_4.png');

export interface HowToPlayModalProps {
  visible: boolean;
  onClose: () => void;
  initialPage?: number;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({
  visible,
  onClose,
  initialPage = 1,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Reset to initial page when opened
  useEffect(() => {
    if (visible) {
      setCurrentPage(initialPage);
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
    }
  }, [visible, initialPage]);

  const changePage = (newPage: number) => {
    if (newPage < 1 || newPage > RULEBOOK_TOTAL_PAGES || newPage === currentPage) return;

    hapticsService.cardSelection();
    soundService.playCardSnap();

    const direction = newPage > currentPage ? 1 : -1;

    // Slide and fade out
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: -24 * direction,
        duration: 120,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setCurrentPage(newPage);
      slideAnim.setValue(24 * direction);
      // Slide and fade in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 140,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 140,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    });
  };

  const handleNext = () => {
    if (currentPage < RULEBOOK_TOTAL_PAGES) {
      changePage(currentPage + 1);
    } else {
      hapticsService.cardSnap();
      soundService.playCardSnap();
      onClose();
    }
  };

  const handleBack = () => {
    if (currentPage > 1) {
      changePage(currentPage - 1);
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
      navigationBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.bookCard}>
          {/* Subtle Decorative Book Ribbon / Bookmark */}
          <View style={styles.bookRibbon} pointerEvents="none" />

          {/* Book Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeftGroup}>
              <Text style={styles.bookIcon}>📖</Text>
              <Text style={styles.headerTitle}>RIVAL RULEBOOK</Text>
            </View>

            {/* Page Indicator Pill */}
            <View style={styles.pagePill}>
              <Text style={styles.pagePillText}>{getPageIndicatorText(currentPage)}</Text>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close Rulebook"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Spine Binding Crease Accent */}
          <View style={styles.spineCrease} />

          {/* Paginated Content Area with Animated Slide & Fade */}
          <Animated.View
            style={[
              styles.pageContentWrapper,
              {
                opacity: fadeAnim,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {currentPage === 1 && <PageOneBasics />}
              {currentPage === 2 && <PageTwoActionCards />}
              {currentPage === 3 && <PageThreeWildsAndRival />}
              {currentPage === 4 && <PageFourMatchTimer />}
            </ScrollView>
          </Animated.View>

          {/* Interactive Navigation Footer */}
          <View style={styles.footerRow}>
            {/* Back Button */}
            <TouchableOpacity
              onPress={handleBack}
              disabled={currentPage === 1}
              style={[
                styles.backBtn,
                currentPage === 1 && styles.btnDisabled,
              ]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Previous Page"
              testID="rulebook-back-btn"
            >
              <Text style={[styles.backBtnText, currentPage === 1 && styles.textDisabled]}>
                ← Back
              </Text>
            </TouchableOpacity>

            {/* Dot Pagination Indicators */}
            <View style={styles.dotsContainer}>
              {Array.from({ length: RULEBOOK_TOTAL_PAGES }, (_, idx) => idx + 1).map((page) => {
                const isActive = page === currentPage;
                return (
                  <TouchableOpacity
                    key={page}
                    onPress={() => changePage(page)}
                    style={[styles.dot, isActive ? styles.dotActive : styles.dotInactive]}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Go to Page ${page}`}
                    testID={`rulebook-dot-${page}`}
                  />
                );
              })}
            </View>

            {/* Next / Got It Button */}
            <TouchableOpacity
              onPress={handleNext}
              style={styles.nextBtn}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={getNextButtonLabel(currentPage)}
              testID="rulebook-next-btn"
            >
              <Text style={styles.nextBtnText}>{getNextButtonLabel(currentPage)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// --- PAGE 1: Objective & Turn Basics ---
const PageOneBasics: React.FC = () => {
  return (
    <View style={styles.pageContainer}>
      {/* Chapter Subtitle Badge */}
      <View style={styles.chapterBadge}>
        <Text style={styles.chapterBadgeText}>🎯 CHAPTER 1 • OBJECTIVE & BASICS</Text>
      </View>

      {/* Rule 1: Core Goal */}
      <View style={styles.ruleCard}>
        <View style={styles.ruleHeader}>
          <Text style={styles.ruleIconEmoji}>🏆</Text>
          <Text style={styles.ruleTitle}>Core Objective</Text>
        </View>
        <Text style={styles.ruleBody}>
          Be the first player to <Text style={styles.textHighlightGreen}>empty your hand</Text> of
          all cards to win the match!
        </Text>
      </View>

      {/* Rule 2: Matching Rule */}
      <View style={styles.ruleCard}>
        <View style={styles.ruleHeader}>
          <Text style={styles.ruleIconEmoji}>🎨</Text>
          <Text style={styles.ruleTitle}>Matching Rule</Text>
        </View>
        <Text style={styles.ruleBody}>
          On your turn, play a card matching the discard pile card by:
        </Text>
        <View style={styles.matchPillsRow}>
          <View style={[styles.miniBadge, { backgroundColor: '#EF4444' }]}>
            <Text style={styles.miniBadgeText}>Color</Text>
          </View>
          <View style={[styles.miniBadge, { backgroundColor: '#2563EB' }]}>
            <Text style={styles.miniBadgeText}>0–9</Text>
          </View>
          <View style={[styles.miniBadge, { backgroundColor: '#F59E0B' }]}>
            <Text style={styles.miniBadgeText}>Symbol</Text>
          </View>
          <View style={[styles.miniBadge, { backgroundColor: '#1E293B' }]}>
            <Text style={styles.miniBadgeText}>Wilds</Text>
          </View>
        </View>
      </View>

      {/* Rule 3: Draw & Pair Combos */}
      <View style={styles.ruleCard}>
        <View style={styles.ruleHeader}>
          <Text style={styles.ruleIconEmoji}>🃏</Text>
          <Text style={styles.ruleTitle}>Draw & Pair Combos</Text>
        </View>
        <Text style={styles.ruleBody}>
          No match? Tap the deck to draw <Text style={styles.textHighlightDark}>1 card</Text> (playable immediately if valid), or play <Text style={styles.textHighlightGreen}>2 identical cards</Text> together!
        </Text>
      </View>
    </View>
  );
};

// --- PAGE 2: Action Cards ---
const PageTwoActionCards: React.FC = () => {
  return (
    <View style={styles.pageContainer}>
      {/* Chapter Subtitle Badge */}
      <View style={[styles.chapterBadge, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
        <Text style={[styles.chapterBadgeText, { color: '#1D4ED8' }]}>
          ⚡ CHAPTER 2 • ACTION CARDS
        </Text>
      </View>

      {/* Action 1: Skip */}
      <View style={styles.ruleCard}>
        <View style={styles.actionCardRow}>
          <View style={[styles.cardIconBox, { backgroundColor: '#3B82F6' }]}>
            <Image source={ICON_SKIP} style={styles.actionIconImage} resizeMode="contain" />
          </View>
          <View style={styles.actionInfoCol}>
            <Text style={styles.actionTitle}>Skip (⊘)</Text>
            <Text style={styles.ruleBodySmall}>
              Skips the next player's turn in rotation.
            </Text>
            <View style={styles.proTipBadge}>
              <Text style={styles.proTipText}>⚡ 1v1 Rule: Lets you play again immediately!</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Action 2: Reverse */}
      <View style={styles.ruleCard}>
        <View style={styles.actionCardRow}>
          <View style={[styles.cardIconBox, { backgroundColor: '#F59E0B' }]}>
            <Image source={ICON_REVERSE} style={styles.actionIconImage} resizeMode="contain" />
          </View>
          <View style={styles.actionInfoCol}>
            <Text style={styles.actionTitle}>Reverse (⇄)</Text>
            <Text style={styles.ruleBodySmall}>
              Reverses turn direction (clockwise ↔ counter-clockwise).
            </Text>
            <View style={styles.proTipBadge}>
              <Text style={styles.proTipText}>⚡ 1v1 Rule: Functions like a Skip for a free turn!</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Action 3: Draw 2 */}
      <View style={styles.ruleCard}>
        <View style={styles.actionCardRow}>
          <View style={[styles.cardIconBox, { backgroundColor: '#10B981' }]}>
            <Image source={ICON_DRAW2} style={styles.actionIconImage} resizeMode="contain" />
          </View>
          <View style={styles.actionInfoCol}>
            <Text style={styles.actionTitle}>Draw Two (+2)</Text>
            <Text style={styles.ruleBodySmall}>
              Forces next player to draw 2 cards and forfeit their turn.
            </Text>
            <View style={styles.stackingTipBadge}>
              <Text style={styles.stackingTipTitle}>⚡ +2 STACKING RULE</Text>
              <Text style={styles.stackingTipBody}>
                Hold ANY Draw 2? Counter-stack it to pass the penalty: +2 → +4 → +6 → +8!
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

// --- PAGE 3: Wilds & RIVAL! Rules ---
const PageThreeWildsAndRival: React.FC = () => {
  return (
    <View style={styles.pageContainer}>
      <View style={[styles.chapterBadge, { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' }]}>
        <Text style={[styles.chapterBadgeText, { color: '#7E22CE' }]}>
          🌈 CHAPTER 3 • WILDS & RIVAL! RULES
        </Text>
      </View>

      {/* Wild & Wild Draw 4 */}
      <View style={styles.ruleCard}>
        <View style={styles.actionCardRow}>
          <View style={[styles.cardIconBox, { backgroundColor: '#1E293B' }]}>
            <Image source={ICON_WILD} style={styles.actionIconImage} resizeMode="contain" />
          </View>
          <View style={styles.actionInfoCol}>
            <Text style={styles.actionTitle}>Wild & Wild Draw 4 (+4)</Text>
            <Text style={styles.ruleBodySmall}>
              Play anytime to change the active color. <Text style={styles.textHighlightRed}>+4</Text> forces the next player to draw 4 (or stack another +4!).
            </Text>
          </View>
          <View style={[styles.cardIconBox, { backgroundColor: '#0F172A' }]}>
            <Image source={ICON_WILD_4} style={styles.actionIconImage} resizeMode="contain" />
          </View>
        </View>
      </View>

      {/* RIVAL! Shout & Catch Window */}
      <View style={styles.ruleCard}>
        <View style={styles.ruleHeader}>
          <Text style={styles.ruleIconEmoji}>📣</Text>
          <Text style={styles.ruleTitle}>The 'RIVAL!' Call & +2 Catch</Text>
        </View>
        <Text style={styles.ruleBodySmall}>
          Tap <Text style={styles.textHighlightGreen}>'RIVAL!'</Text> when playing down to 1 card! If you forget, opponents have <Text style={styles.textHighlightDark}>2.5s</Text> to catch you for <Text style={styles.textHighlightRed}>+2 cards</Text>.
        </Text>
      </View>

      {/* Special Cards Pointer */}
      <View style={[styles.ruleCard, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}>
        <View style={styles.ruleHeader}>
          <Text style={styles.ruleIconEmoji}>✨</Text>
          <Text style={[styles.ruleTitle, { color: '#5B21B6' }]}>Special Cards Catalogue</Text>
        </View>
        <Text style={[styles.ruleBodySmall, { color: '#4C1D95' }]}>
          Open <Text style={styles.textHighlightDark}>Special Cards</Text> on the Home Screen for an interactive showcase of <Text style={styles.textHighlightDark}>Rival Swap, Mute, Shield & Mirror</Text>!
        </Text>
      </View>
    </View>
  );
};

// --- PAGE 4: 3-Minute Match Clock & Tie-Breaker ---
const PageFourMatchTimer: React.FC = () => {
  return (
    <View style={styles.pageContainer}>
      <View style={[styles.chapterBadge, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
        <Text style={[styles.chapterBadgeText, { color: '#B45309' }]}>
          ⏱️ CHAPTER 4 • 3-MINUTE CLOCK & TIE-BREAKER
        </Text>
      </View>

      <View style={styles.ruleCard}>
        <View style={styles.ruleHeader}>
          <Text style={styles.ruleIconEmoji}>⏳</Text>
          <Text style={styles.ruleTitle}>3-Minute Match Timer</Text>
        </View>
        <Text style={styles.ruleBodySmall}>
          Every match runs on a <Text style={styles.textHighlightDark}>3:00 clock</Text>. When time expires, the player with the <Text style={styles.textHighlightGreen}>fewest cards remaining</Text> wins immediately!
        </Text>
      </View>

      <View style={styles.penaltyTableCard}>
        <Text style={styles.penaltyTableTitle}>⚖️ TIED CARD COUNT PRIORITY</Text>
        <Text style={[styles.ruleBodySmall, { marginBottom: 4 }]}>
          If players tie for the fewest cards at <Text style={styles.textHighlightRed}>00:00</Text>, stronger cards left in hand decide the winner:
        </Text>
        <View style={styles.penaltyTableRow}>
          <Text style={styles.penaltyTableEvent}>Specials & Wilds (Swap, Mute, Shield, Mirror, +4, Wild)</Text>
          <View style={[styles.penaltyPillOrange, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
            <Text style={[styles.penaltyPillText, { color: '#92400E' }]}>TOP (10 PTS)</Text>
          </View>
        </View>
        <View style={styles.penaltyTableRow}>
          <Text style={styles.penaltyTableEvent}>Action Cards (Skip, Reverse, +2)</Text>
          <View style={[styles.penaltyPillGray, { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' }]}>
            <Text style={[styles.penaltyPillText, { color: '#1D4ED8' }]}>MID (5 PTS)</Text>
          </View>
        </View>
        <View style={styles.penaltyTableRow}>
          <Text style={styles.penaltyTableEvent}>Number Cards (0–9)</Text>
          <View style={styles.penaltyPillGray}>
            <Text style={styles.penaltyPillText}>BASE (1 PT)</Text>
          </View>
        </View>
      </View>
    </View>
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
  bookCard: {
    width: '100%',
    maxWidth: 390,
    maxHeight: '90%',
    backgroundColor: '#FEF6E9', // Warm cream/parchment surface matching design system
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#E2D9C8',
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 18,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 8,
    overflow: 'hidden',
  },
  bookRibbon: {
    position: 'absolute',
    top: 0,
    left: 28,
    width: 14,
    height: 18,
    backgroundColor: '#EF4444',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#E2D9C8',
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bookIcon: {
    fontSize: 18,
  },
  headerTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 15,
    color: '#0F172A',
    letterSpacing: 0.8,
  },
  pagePill: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  pagePillText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 10,
    color: '#92400E',
    letterSpacing: 0.6,
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
  spineCrease: {
    height: 1,
    backgroundColor: 'rgba(226, 217, 200, 0.6)',
    marginBottom: 10,
  },
  pageContentWrapper: {
    minHeight: 330,
    maxHeight: 420,
  },
  scrollContent: {
    paddingBottom: 6,
  },
  pageContainer: {
    gap: 10,
  },
  chapterBadge: {
    alignSelf: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 2,
  },
  chapterBadgeText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11,
    color: '#92400E',
    letterSpacing: 0.5,
  },
  ruleCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E2D9C8',
    borderTopWidth: 2.5,
    borderTopColor: '#FFFFFF',
    padding: 12,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  ruleIconEmoji: {
    fontSize: 16,
  },
  ruleTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#0F172A',
  },
  ruleBody: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  ruleBodySmall: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 16,
  },
  textHighlightGreen: {
    ...FONT_CARTOON_BOLD,
    color: '#16A34A',
  },
  textHighlightDark: {
    ...FONT_CARTOON_BOLD,
    color: '#0F172A',
  },
  textHighlightRed: {
    ...FONT_CARTOON_BOLD,
    color: '#DC2626',
  },
  textHighlightGold: {
    ...FONT_CARTOON_BOLD,
    color: '#D97706',
  },
  matchPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  miniBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  miniBadgeText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#FFFFFF',
  },
  actionCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  actionIconImage: {
    width: 28,
    height: 28,
  },
  actionInfoCol: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 13,
    color: '#0F172A',
  },
  proTipBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  proTipText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#92400E',
  },
  colorPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  specialCardRow: {
    gap: 8,
  },
  specialCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  miniIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emblemIconEmoji: {
    fontSize: 22,
  },
  specialIconImage: {
    width: 22,
    height: 22,
  },
  specialCardLabel: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 11,
    color: '#475569',
    flex: 1,
  },
  stackingTipBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 5,
  },
  stackingTipTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 10,
    color: '#047857',
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  stackingTipBody: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 10,
    color: '#065F46',
    lineHeight: 14,
  },
  penaltyTableCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E2D9C8',
    borderTopWidth: 2.5,
    borderTopColor: '#FFFFFF',
    padding: 12,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
    gap: 6,
  },
  penaltyTableTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11,
    color: '#0F172A',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  penaltyTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  penaltyTableEvent: {
    ...FONT_CARTOON_SEMIBOLD,
    fontSize: 11,
    color: '#334155',
    flex: 1,
  },
  penaltyPillRed: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  penaltyPillOrange: {
    backgroundColor: '#FFEDD5',
    borderWidth: 1.5,
    borderColor: '#FDBA74',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  penaltyPillGray: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  penaltyPillText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 10,
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#E2D9C8',
  },
  backBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderBottomWidth: 3,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#475569',
  },
  btnDisabled: {
    opacity: 0.35,
  },
  textDisabled: {
    color: '#94A3B8',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    borderRadius: 999,
  },
  dotActive: {
    width: 20,
    height: 8,
    backgroundColor: '#10B981',
  },
  dotInactive: {
    width: 8,
    height: 8,
    backgroundColor: '#CBD5E1',
  },
  nextBtn: {
    backgroundColor: '#10B981', // Modern vibrant emerald green
    borderBottomWidth: 4,
    borderColor: '#059669',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  nextBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
});
