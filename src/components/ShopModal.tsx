// src/components/ShopModal.tsx - Interactive Cosmetics & Currency Shop Modal for Rival Card
import React, { useState, useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ShopCategory,
  ShopItem,
  SHOP_CATEGORIES,
  shopService,
  PlayerInventory,
  DEFAULT_INVENTORY,
} from '../services/shopService';
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

export interface ShopModalProps {
  visible: boolean;
  onClose: () => void;
  initialCategory?: ShopCategory;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  visible,
  onClose,
  initialCategory = 'card_backs',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ShopCategory>(initialCategory);
  const [inventory, setInventory] = useState<PlayerInventory>(DEFAULT_INVENTORY);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const toastFadeAnim = useRef(new Animated.Value(0)).current;

  // Sync inventory and profile on open and listen to changes
  useEffect(() => {
    if (visible) {
      setSelectedCategory(initialCategory);
      shopService.getInventory().then(setInventory);
      playerProfileService.getProfile().then(setProfile);
    }
  }, [visible, initialCategory]);

  useEffect(() => {
    const unsubShop = shopService.subscribe((inv) => setInventory(inv));
    const unsubProfile = playerProfileService.subscribe((p) => setProfile(p));
    return () => {
      unsubShop();
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
      duration: 180,
      useNativeDriver: true,
    }).start();

    toastTimerRef.current = setTimeout(() => {
      Animated.timing(toastFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setToastMessage(null));
    }, 2400);
  };

  const handleSelectCategory = (category: ShopCategory) => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    setSelectedCategory(category);
  };

  const handleEquipItem = async (item: ShopItem) => {
    try {
      hapticsService.cardSelection();
      soundService.playCardSnap();
      const updated = await shopService.equipItem(item.category, item.id);
      setInventory(updated);
      showToast(`Equipped ${item.name}!`);
    } catch (err: any) {
      showToast(err?.message || 'Could not equip item');
    }
  };

  const handleBuyItem = async (item: ShopItem) => {
    if (item.purchasesUnavailable || item.isLocked) {
      hapticsService.cardSnap();
      showToast('Store testing mode: Premium unlocks will be available at global launch!');
      return;
    }

    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const res = await shopService.buyItem(item.id);
      if (res.success && res.inventory) {
        hapticsService.cardSnap();
        soundService.playCardSnap();
        setInventory(res.inventory);
        showToast(`Unlocked & Equipped ${item.name}! 🎉`);
      } else {
        hapticsService.cardSnap();
        showToast(res.error || `Not enough ${item.price.currency}!`);
      }
    } catch {
      showToast('Transaction error. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    onClose();
  };

  const categoryItems = shopService.getItemsByCategory(selectedCategory);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.shopCard}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerIcon}>🛍️</Text>
              <Text style={styles.headerTitle}>RIVAL SHOP</Text>
            </View>

            {/* Currency Pill Cluster */}
            <View style={styles.currencyHeaderCluster}>
              <View style={styles.headerCoinPill}>
                <Text style={styles.currencyIcon}>🟡</Text>
                <Text style={styles.headerCoinText}>
                  {(profile?.coins ?? 250).toLocaleString()}
                </Text>
              </View>
              <View style={styles.headerGemPill}>
                <Text style={styles.currencyIcon}>💎</Text>
                <Text style={styles.headerGemText}>
                  {(profile?.gems ?? 10).toLocaleString()}
                </Text>
              </View>

              {/* Close Button */}
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Close Shop"
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Toast Notification Banner */}
          {toastMessage && (
            <Animated.View style={[styles.toastBanner, { opacity: toastFadeAnim }]}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </Animated.View>
          )}

          {/* Category Selection Row */}
          <View style={styles.categoryRowWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScrollContent}
            >
              {SHOP_CATEGORIES.map((cat) => {
                const isActive = cat.key === selectedCategory;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    onPress={() => handleSelectCategory(cat.key)}
                    activeOpacity={0.8}
                    style={[
                      styles.categoryBox,
                      isActive ? styles.categoryBoxActive : styles.categoryBoxInactive,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={cat.label}
                    testID={`shop-category-${cat.key}`}
                  >
                    <Text style={styles.categoryIcon}>{cat.icon}</Text>
                    <Text
                      style={[
                        styles.categoryLabel,
                        isActive ? styles.categoryLabelActive : styles.categoryLabelInactive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* 2-Column Items Grid */}
          <ScrollView
            style={styles.itemsScrollContainer}
            contentContainerStyle={styles.itemsGridContent}
            showsVerticalScrollIndicator={false}
          >
            {categoryItems.map((item) => {
              const isOwned = inventory.ownedItemIds.includes(item.id);
              const isEquipped = inventory.equippedItems[item.category] === item.id;

              return (
                <View key={item.id} style={styles.itemCard} testID={`shop-item-${item.id}`}>
                  {/* Item Preview Box */}
                  <ItemPreviewBox item={item} />

                  {/* Title & Description */}
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.description ? (
                    <Text style={styles.itemDescription} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}

                  {/* Dynamic Action Button */}
                  <View style={styles.itemActionWrapper}>
                    {isEquipped ? (
                      <View style={styles.equippedBadge} testID={`item-equipped-${item.id}`}>
                        <Text style={styles.equippedBadgeText}>✓ EQUIPPED</Text>
                      </View>
                    ) : isOwned ? (
                      <TouchableOpacity
                        onPress={() => handleEquipItem(item)}
                        style={styles.equipBtn}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`Equip ${item.name}`}
                        testID={`item-equip-btn-${item.id}`}
                      >
                        <Text style={styles.equipBtnText}>EQUIP</Text>
                      </TouchableOpacity>
                    ) : item.purchasesUnavailable || item.isLocked ? (
                      <View style={styles.lockedItemCol}>
                        <Text style={styles.pricePlaceholderText}>
                          {item.price.currency === 'gems' ? '💎' : '🟡'} {item.price.amount.toLocaleString()}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleBuyItem(item)}
                          style={styles.unavailableBadge}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel="Purchases Unavailable"
                          testID={`item-unavailable-${item.id}`}
                        >
                          <Text style={styles.unavailableBadgeText}>UNAVAILABLE</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleBuyItem(item)}
                        disabled={isProcessing}
                        style={[
                          styles.buyBtn,
                          item.price.currency === 'gems' ? styles.buyBtnGem : styles.buyBtnCoin,
                        ]}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`Buy ${item.name} for ${item.price.amount} ${item.price.currency}`}
                        testID={`item-buy-btn-${item.id}`}
                      >
                        <Text style={styles.buyBtnPrice}>
                          {item.price.currency === 'gems' ? '💎' : '🟡'}{' '}
                          {item.price.amount.toLocaleString()}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Item Preview Thumbnail based on Category
const ItemPreviewBox: React.FC<{ item: ShopItem }> = ({ item }) => {
  const { previewStyle, category } = item;

  if (category === 'card_backs') {
    return (
      <View
        style={[
          styles.previewCardBack,
          {
            backgroundColor: previewStyle.primaryColor,
            borderColor: previewStyle.borderColor || '#CBD5E1',
          },
        ]}
      >
        <View style={styles.previewCardInner}>
          <Text style={styles.previewCardBackIcon}>🎴</Text>
        </View>
      </View>
    );
  }

  if (category === 'sceneries') {
    return (
      <View
        style={[
          styles.previewScenery,
          {
            backgroundColor: previewStyle.primaryColor,
            borderColor: previewStyle.borderColor || '#CBD5E1',
          },
        ]}
      >
        <Text style={styles.previewSceneryIcon}>🏞️</Text>
        <View style={styles.previewSceneryFelt} />
      </View>
    );
  }

  if (category === 'avatars') {
    return (
      <View
        style={[
          styles.previewAvatarCircle,
          {
            backgroundColor: previewStyle.primaryColor,
            borderColor: previewStyle.borderColor || '#FFFFFF',
          },
        ]}
      >
        <Text style={styles.previewAvatarEmoji}>{previewStyle.emoji || '👤'}</Text>
      </View>
    );
  }

  if (category === 'cards') {
    return (
      <View
        style={[
          styles.previewCardFace,
          {
            backgroundColor: previewStyle.primaryColor,
            borderColor: previewStyle.borderColor || '#E2D9C8',
          },
        ]}
      >
        <Text style={styles.previewCardFaceNumber}>7</Text>
        <View style={styles.previewCardColorBar} />
      </View>
    );
  }

  // Emotes / Quick Chat
  return (
    <View
      style={[
        styles.previewEmoteBubble,
        {
          backgroundColor: previewStyle.primaryColor,
          borderColor: previewStyle.borderColor || '#CBD5E1',
        },
      ]}
    >
      <Text style={styles.previewEmoteText}>{previewStyle.text || '💬'}</Text>
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
  shopCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    backgroundColor: '#FEF6E9', // Warm cream matching design system
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#E2D9C8',
    padding: 16,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#E2D9C8',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIcon: {
    fontSize: 18,
  },
  headerTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 16,
    color: '#0F172A',
    letterSpacing: 0.6,
  },
  currencyHeaderCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerCoinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 3,
  },
  headerCoinText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11,
    color: '#92400E',
  },
  headerGemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 3,
  },
  headerGemText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11,
    color: '#0369A1',
  },
  currencyIcon: {
    fontSize: 11,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2D9C8',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
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
  categoryRowWrapper: {
    marginVertical: 10,
  },
  categoryScrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  categoryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
  },
  categoryBoxInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
  },
  categoryBoxActive: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
    borderBottomWidth: 4,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  categoryIcon: {
    fontSize: 14,
  },
  categoryLabel: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
  },
  categoryLabelInactive: {
    color: '#475569',
  },
  categoryLabelActive: {
    color: '#FFFFFF',
  },
  itemsScrollContainer: {
    maxHeight: 380,
  },
  itemsGridContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 8,
  },
  itemCard: {
    width: '48%',
    backgroundColor: '#FFFDF7',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E2D9C8',
    padding: 10,
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  previewCardBack: {
    width: 60,
    height: 84,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  previewCardInner: {
    width: 44,
    height: 68,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCardBackIcon: {
    fontSize: 20,
  },
  previewScenery: {
    width: 78,
    height: 64,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  previewSceneryIcon: {
    fontSize: 22,
  },
  previewSceneryFelt: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  previewAvatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  previewAvatarEmoji: {
    fontSize: 28,
  },
  previewCardFace: {
    width: 58,
    height: 80,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewCardFaceNumber: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 28,
    color: '#0F172A',
  },
  previewCardColorBar: {
    position: 'absolute',
    bottom: 4,
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  previewEmoteBubble: {
    width: 78,
    height: 54,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewEmoteText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 14,
    color: '#FFFFFF',
  },
  itemTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 2,
  },
  itemDescription: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    minHeight: 26,
    marginBottom: 6,
  },
  itemActionWrapper: {
    width: '100%',
    marginTop: 4,
  },
  equippedBadge: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 999,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equippedBadgeText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11,
    color: '#15803D',
    letterSpacing: 0.4,
  },
  equipBtn: {
    backgroundColor: '#2563EB',
    borderBottomWidth: 3,
    borderColor: '#1D4ED8',
    borderRadius: 14,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  buyBtn: {
    borderRadius: 14,
    borderBottomWidth: 3,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyBtnCoin: {
    backgroundColor: '#F59E0B',
    borderColor: '#D97706',
  },
  buyBtnGem: {
    backgroundColor: '#0284C7',
    borderColor: '#0369A1',
  },
  buyBtnPrice: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  lockedItemCol: {
    width: '100%',
    alignItems: 'center',
  },
  pricePlaceholderText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 10,
    color: '#94A3B8',
    marginBottom: 3,
    textAlign: 'center',
  },
  unavailableBadge: {
    width: '100%',
    backgroundColor: '#E2E8F0',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailableBadgeText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 10,
    color: '#64748B',
    letterSpacing: 0.4,
  },
});
