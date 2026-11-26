// src/components/ShopModal.tsx - Interactive Cosmetics & Currency Shop Modal for Rival Card
import React, { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
} from 'react-native';
import {
  ShopCategory,
  ShopItem,
  SHOP_CATEGORIES,
  shopService,
  PlayerInventory,
  DEFAULT_INVENTORY,
  IAP_UNAVAILABLE_MESSAGE,
  getShopItemImageSource,
} from '../services/shopService';
import {
  playerProfileService,
  PlayerProfile,
  isAvatarUnlocked,
  normalizeAnyAvatarKey,
  normalizeAvatarKey,
} from '../services/playerProfileService';
import { AvatarIcon } from './AvatarIcon';
import {
  FONT_CARTOON_BOLD,
  FONT_CARTOON_HEAVY,
  FONT_CARTOON_REGULAR,
} from '../styles/typography';
import { hapticsService } from '../services/hapticsService';
import { soundService } from '../services/soundService';
import {
  adService,
  MAX_SHOP_REWARDED_ADS_PER_DAY,
  REWARDED_AD_COIN_PAYOUT,
  RewardedAdCooldownStatus,
} from '../services/adService';

interface TactileButtonProps extends TouchableOpacityProps {
  scaleTo?: number;
}

const TactileButton: React.FC<TactileButtonProps> = ({
  children,
  style,
  scaleTo = 0.95,
  onPress,
  ...props
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: scaleTo,
      speed: 50,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      speed: 40,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={style}
        {...props}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

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
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adCooldown, setAdCooldown] = useState<RewardedAdCooldownStatus>({
    placement: 'shop',
    canWatch: true,
    watchedToday: 0,
    remainingWatches: MAX_SHOP_REWARDED_ADS_PER_DAY,
    maxPerDay: MAX_SHOP_REWARDED_ADS_PER_DAY,
    nextAvailableInMs: 0,
  });

  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const toastFadeAnim = useRef(new Animated.Value(0)).current;

  // Sync inventory, profile, and rewarded ad cooldown on open and listen to changes
  useEffect(() => {
    if (visible) {
      setSelectedCategory(initialCategory);
      shopService.getInventory().then(setInventory);
      playerProfileService.getProfile().then(setProfile);
      adService.getRewardedAdCooldownStatus('shop').then(setAdCooldown).catch(() => {});
      adService.preloadRewardedAd();
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
    }, 2600);
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
    if (item.category === 'currency') {
      hapticsService.cardSnap();
      showToast(IAP_UNAVAILABLE_MESSAGE);
      return;
    }

    if (item.isRealMoneyExclusive || item.comingSoon || item.unlockType === 'iap') {
      hapticsService.cardSnap();
      showToast('Real-money Store & VIP packs coming in the next update!');
      return;
    }

    if (item.purchasesUnavailable || item.isLocked) {
      hapticsService.cardSnap();
      showToast('Store testing mode: Premium unlocks will be available at global launch!');
      return;
    }

    if (item.unlockType === 'level_coins' && item.avatarKey) {
      if (isProcessing) return;
      const currentLevel = profile?.level ?? 1;
      const reqLevel = item.requiredLevel ?? 1;
      if (currentLevel < reqLevel) {
        hapticsService.cardSelection();
        showToast(`Reach Level ${reqLevel} to unlock ${item.name}!`);
        return;
      }

      setIsProcessing(true);
      try {
        const res = await playerProfileService.unlockAvatar(item.avatarKey);
        if (res.success) {
          hapticsService.victory();
          soundService.playWinChime();
          setProfile(res.profile);
          showToast(`Unlocked & Equipped ${item.name}! 🎉`);
        } else {
          hapticsService.cardSnap();
          showToast(res.error || 'Unable to unlock avatar.');
        }
      } catch {
        showToast('Transaction error. Please try again.');
      } finally {
        setIsProcessing(false);
      }
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

  const handleEquipProgressionAvatar = async (item: ShopItem) => {
    if (!item.avatarKey) return;
    try {
      hapticsService.cardSelection();
      soundService.playCardSnap();
      const updated = await playerProfileService.updateAvatar(item.avatarKey);
      setProfile(updated);
      showToast(`Equipped ${item.name}!`);
    } catch {
      showToast('Could not equip avatar.');
    }
  };

  const handleWatchRewardedAd = async () => {
    if (isWatchingAd) return;
    hapticsService.cardSelection();
    soundService.playCardSnap();
    setIsWatchingAd(true);
    try {
      const result = await adService.showRewardedAdForCoins('shop');
      setAdCooldown(result.cooldownStatus);
      if (result.rewarded) {
        if (result.profile) {
          setProfile(result.profile);
        }
        hapticsService.victory();
        soundService.playWinChime();
        showToast(result.message);
      } else {
        hapticsService.cardSnap();
        showToast(result.message);
      }
    } catch {
      showToast('No ad available right now. Please try again later.');
    } finally {
      setIsWatchingAd(false);
    }
  };

  const handleClose = () => {
    hapticsService.cardSelection();
    soundService.playCardSnap();
    onClose();
  };

  const categoryItems = shopService.getItemsByCategory(selectedCategory);
  const vipAvatarItems =
    selectedCategory === 'avatars'
      ? categoryItems.filter((item) => item.isRealMoneyExclusive || item.unlockType === 'iap')
      : [];
  const progressionAvatarItems =
    selectedCategory === 'avatars'
      ? categoryItems.filter((item) => item.unlockType === 'level_coins')
      : [];
  const coinPackItems =
    selectedCategory === 'currency'
      ? categoryItems.filter((item) => item.packType === 'coins')
      : [];
  const gemPackItems =
    selectedCategory === 'currency'
      ? categoryItems.filter((item) => item.packType === 'gems')
      : [];

  const currentLevel = profile?.level ?? 1;
  const currentCoins = profile?.coins ?? 250;
  const equippedAvatarKey = normalizeAvatarKey(profile?.avatarId) || 'fox';
  const unlockedAvatars = profile?.unlockedAvatars ?? ['fox', 'bot'];

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

          {/* Non-Intrusive Rewarded Ad Banner (+100 Coins, max 5/day) */}
          <TactileButton
            onPress={handleWatchRewardedAd}
            disabled={isWatchingAd}
            style={[
              styles.rewardedAdBanner,
              !adCooldown.canWatch && styles.rewardedAdBannerCooldown,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Watch Ad for +${REWARDED_AD_COIN_PAYOUT} Coins`}
            testID="shop-watch-ad-btn"
          >
            <View style={styles.rewardedAdLeft}>
              <Text style={styles.rewardedAdIcon}>🎬</Text>
              <View style={styles.rewardedAdTextCol}>
                <Text style={styles.rewardedAdTitle} numberOfLines={1}>
                  Watch Ad for +{REWARDED_AD_COIN_PAYOUT} Coins
                </Text>
                <Text style={styles.rewardedAdSub} numberOfLines={1}>
                  {adCooldown.canWatch
                    ? 'Free Coins • Watch a short video'
                    : 'No more ads available for today'}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.rewardedAdActionPill,
                !adCooldown.canWatch && styles.rewardedAdActionPillCooldown,
              ]}
            >
              {isWatchingAd ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.rewardedAdActionText}>
                  {adCooldown.canWatch ? '🪙 +100' : 'DONE'}
                </Text>
              )}
            </View>
          </TactileButton>

          {/* Store Items Scroll Container */}
          <ScrollView
            style={styles.itemsScrollContainer}
            contentContainerStyle={styles.itemsScrollWrap}
            showsVerticalScrollIndicator={false}
          >
            {selectedCategory === 'avatars' ? (
              <>
                {/* VIP Real-Money Store Exclusives (Coming Soon v1.2.0) */}
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeaderTitle}>👑 VIP STORE EXCLUSIVES</Text>
                  <View style={styles.vipSeasonPill}>
                    <Text style={styles.vipSeasonPillText}>COMING SOON • v1.2.0</Text>
                  </View>
                </View>

                <View style={styles.itemsGridContent}>
                  {vipAvatarItems.map((item) => (
                    <View
                      key={item.id}
                      style={[styles.itemCard, styles.vipItemCard]}
                      testID={`shop-item-${item.id}`}
                    >
                      <View style={styles.vipCrownTag}>
                        <Text style={styles.vipCrownTagText}>VIP EXCLUSIVE</Text>
                      </View>

                      <ItemPreviewBox item={item} />

                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.description ? (
                        <Text style={styles.itemDescription} numberOfLines={2}>
                          {item.description}
                        </Text>
                      ) : null}

                      <View style={styles.itemActionWrapper}>
                        <TactileButton
                          onPress={() => handleBuyItem(item)}
                          style={styles.comingSoonBtn}
                          accessibilityRole="button"
                          accessibilityLabel={`${item.name} Coming Soon VIP Exclusive`}
                          testID={`item-coming-soon-${item.id}`}
                        >
                          <Text style={styles.comingSoonBtnText}>COMING SOON</Text>
                        </TactileButton>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Level + Coin Unlockable Avatars (Excludes Guest Fox & Guest Bot starters) */}
                <View style={[styles.sectionHeaderRow, { marginTop: 10 }]}>
                  <Text style={styles.sectionHeaderTitle}>🪙 LEVEL + COIN AVATARS</Text>
                  <View style={styles.levelHeaderPill}>
                    <Text style={styles.levelHeaderPillText}>LVL {currentLevel} / 40</Text>
                  </View>
                </View>

                <View style={styles.itemsGridContent}>
                  {progressionAvatarItems.map((item) => {
                    const key = item.avatarKey || item.id;
                    const isUnlocked = isAvatarUnlocked(unlockedAvatars, key);
                    const isEquipped = isUnlocked && equippedAvatarKey === key;
                    const reqLevel = item.requiredLevel ?? 1;
                    const isLevelLocked = !isUnlocked && currentLevel < reqLevel;
                    const canAfford = currentCoins >= item.price.amount;

                    return (
                      <View key={item.id} style={styles.itemCard} testID={`shop-item-${item.id}`}>
                        <View style={styles.itemCardShine} pointerEvents="none" />
                        <ItemPreviewBox item={item} />

                        <Text style={styles.itemTitle} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.itemDescription} numberOfLines={2}>
                          {isLevelLocked
                            ? `Reach Level ${reqLevel} to unlock`
                            : item.description}
                        </Text>

                        <View style={styles.itemActionWrapper}>
                          {isEquipped ? (
                            <View style={styles.equippedBadge} testID={`item-equipped-${item.id}`}>
                              <Text style={styles.equippedBadgeText}>✓ EQUIPPED</Text>
                            </View>
                          ) : isUnlocked ? (
                            <TactileButton
                              onPress={() => handleEquipProgressionAvatar(item)}
                              style={styles.equipBtn}
                              accessibilityRole="button"
                              accessibilityLabel={`Equip ${item.name}`}
                              testID={`item-equip-btn-${item.id}`}
                            >
                              <Text style={styles.equipBtnText}>EQUIP</Text>
                            </TactileButton>
                          ) : isLevelLocked ? (
                            <TactileButton
                              onPress={() => handleBuyItem(item)}
                              style={styles.unavailableBadge}
                              accessibilityRole="button"
                              accessibilityLabel={`${item.name} locked until Level ${reqLevel}`}
                              testID={`item-level-locked-${item.id}`}
                            >
                              <Text style={styles.unavailableBadgeText}>🔒 LV. {reqLevel}</Text>
                            </TactileButton>
                          ) : (
                            <TactileButton
                              onPress={() => handleBuyItem(item)}
                              disabled={isProcessing}
                              style={[
                                styles.buyBtn,
                                canAfford ? styles.buyBtnCoin : styles.buyBtnInsufficient,
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel={`Unlock ${item.name} for ${item.price.amount} coins`}
                              testID={`item-buy-btn-${item.id}`}
                            >
                              <Text style={styles.buyBtnPrice}>
                                🟡 {item.price.amount.toLocaleString()}
                              </Text>
                            </TactileButton>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : selectedCategory === 'currency' ? (
              <>
                <View style={styles.treasuryNoticeBanner}>
                  <Text style={styles.treasuryNoticeTitle}>
                    🚀 GOOGLE PLAY BILLING • COMING SOON (v1.2.0)
                  </Text>
                  <Text style={styles.treasuryNoticeSubtitle}>
                    Payments enabled after launch. Preview upcoming Coin & Gem bundles below.
                  </Text>
                </View>

                {/* Coin Packs Section */}
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeaderTitle}>🪙 COIN PACKS</Text>
                  <View style={styles.vipSeasonPill}>
                    <Text style={styles.vipSeasonPillText}>COMING SOON</Text>
                  </View>
                </View>

                <View style={styles.itemsGridContent}>
                  {coinPackItems.map((item) => (
                    <View
                      key={item.id}
                      style={[styles.itemCard, styles.coinPackCard]}
                      testID={`shop-item-${item.id}`}
                    >
                      <View style={styles.comingSoonTag}>
                        <Text style={styles.comingSoonTagText}>COMING SOON</Text>
                      </View>

                      <ItemPreviewBox item={item} />

                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.description ? (
                        <Text style={styles.itemDescription} numberOfLines={2}>
                          {item.description}
                        </Text>
                      ) : null}

                      <View style={styles.itemActionWrapper}>
                        <TactileButton
                          onPress={() => handleBuyItem(item)}
                          style={styles.usdPriceBtn}
                          accessibilityRole="button"
                          accessibilityLabel={`${item.name} for ${item.usdPrice || '$0.99 USD'}, payments enabled after launch`}
                          testID={`item-iap-btn-${item.id}`}
                        >
                          <Text style={styles.usdPriceBtnText}>
                            {item.usdPrice || `$${item.price.amount.toFixed(2)} USD`}
                          </Text>
                        </TactileButton>
                        <Text style={styles.paymentsLaunchCaption}>
                          Payments enabled after launch
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Gem Packs Section */}
                <View style={[styles.sectionHeaderRow, { marginTop: 10 }]}>
                  <Text style={styles.sectionHeaderTitle}>💎 GEM PACKS</Text>
                  <View style={styles.gemPackHeaderPill}>
                    <Text style={styles.gemPackHeaderPillText}>v1.2.0</Text>
                  </View>
                </View>

                <View style={styles.itemsGridContent}>
                  {gemPackItems.map((item) => (
                    <View
                      key={item.id}
                      style={[styles.itemCard, styles.gemPackCard]}
                      testID={`shop-item-${item.id}`}
                    >
                      <View style={styles.comingSoonTagGem}>
                        <Text style={styles.comingSoonTagGemText}>COMING SOON</Text>
                      </View>

                      <ItemPreviewBox item={item} />

                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.description ? (
                        <Text style={styles.itemDescription} numberOfLines={2}>
                          {item.description}
                        </Text>
                      ) : null}

                      <View style={styles.itemActionWrapper}>
                        <TactileButton
                          onPress={() => handleBuyItem(item)}
                          style={styles.usdPriceBtnGem}
                          accessibilityRole="button"
                          accessibilityLabel={`${item.name} for ${item.usdPrice || '$0.99 USD'}, payments enabled after launch`}
                          testID={`item-iap-btn-${item.id}`}
                        >
                          <Text style={styles.usdPriceBtnText}>
                            {item.usdPrice || `$${item.price.amount.toFixed(2)} USD`}
                          </Text>
                        </TactileButton>
                        <Text style={styles.paymentsLaunchCaption}>
                          Payments enabled after launch
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.itemsGridContent}>
                {categoryItems.map((item) => {
                  const isOwned = inventory.ownedItemIds.includes(item.id);
                  const isEquipped = inventory.equippedItems[item.category] === item.id;

                  return (
                    <View key={item.id} style={styles.itemCard} testID={`shop-item-${item.id}`}>
                      {/* Glossy top shine highlight */}
                      <View style={styles.itemCardShine} pointerEvents="none" />

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
                          <TactileButton
                            onPress={() => handleEquipItem(item)}
                            style={styles.equipBtn}
                            accessibilityRole="button"
                            accessibilityLabel={`Equip ${item.name}`}
                            testID={`item-equip-btn-${item.id}`}
                          >
                            <Text style={styles.equipBtnText}>EQUIP</Text>
                          </TactileButton>
                        ) : item.purchasesUnavailable || item.isLocked ? (
                          <View style={styles.lockedItemCol}>
                            <Text style={styles.pricePlaceholderText}>
                              {item.price.currency === 'gems' ? '💎' : '🟡'}{' '}
                              {item.price.amount.toLocaleString()}
                            </Text>
                            <TactileButton
                              onPress={() => handleBuyItem(item)}
                              style={styles.unavailableBadge}
                              accessibilityRole="button"
                              accessibilityLabel="Purchases Unavailable"
                              testID={`item-unavailable-${item.id}`}
                            >
                              <Text style={styles.unavailableBadgeText}>UNAVAILABLE</Text>
                            </TactileButton>
                          </View>
                        ) : (
                          <TactileButton
                            onPress={() => handleBuyItem(item)}
                            disabled={isProcessing}
                            style={[
                              styles.buyBtn,
                              item.price.currency === 'gems' ? styles.buyBtnGem : styles.buyBtnCoin,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`Buy ${item.name} for ${item.price.amount} ${item.price.currency}`}
                            testID={`item-buy-btn-${item.id}`}
                          >
                            <Text style={styles.buyBtnPrice}>
                              {item.price.currency === 'gems' ? '💎' : '🟡'}{' '}
                              {item.price.amount.toLocaleString()}
                            </Text>
                          </TactileButton>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Item Preview Thumbnail based on Category
const ItemPreviewBox: React.FC<{ item: ShopItem }> = ({ item }) => {
  const { previewStyle, category } = item;
  const imageSource = item.image || getShopItemImageSource(item.id);

  if (category === 'avatars') {
    const knownAvatarKey = normalizeAnyAvatarKey(item.avatarKey || item.id);
    if (knownAvatarKey) {
      return (
        <AvatarIcon
          avatarId={knownAvatarKey}
          size={72}
          style={{ marginBottom: 8 }}
        />
      );
    }
    return (
      <View
        style={[
          styles.previewAvatarCircle,
          {
            backgroundColor: previewStyle.primaryColor,
            borderColor: previewStyle.borderColor || '#0F1142',
          },
        ]}
      >
        <Text style={styles.previewAvatarEmoji}>{previewStyle.emoji || '👤'}</Text>
      </View>
    );
  }

  if (category === 'card_backs') {
    if (imageSource) {
      return (
        <View style={styles.previewCardBackImageFrame}>
          <Image
            source={imageSource}
            style={styles.previewArtworkImage}
            resizeMode="contain"
            accessibilityLabel={`${item.name} card back preview`}
          />
        </View>
      );
    }

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

  if (category === 'currency') {
    const isGems = item.packType === 'gems';
    return (
      <View
        style={[
          styles.previewCurrencyBox,
          {
            backgroundColor: previewStyle.primaryColor,
            borderColor: previewStyle.borderColor || (isGems ? '#0284C7' : '#D97706'),
          },
        ]}
      >
        <Text style={styles.previewCurrencyEmoji}>{previewStyle.emoji || (isGems ? '💎' : '🪙')}</Text>
        <View
          style={[
            styles.previewCurrencyAmountPill,
            { backgroundColor: previewStyle.secondaryColor || (isGems ? '#0284C7' : '#F59E0B') },
          ]}
        >
          <Text style={styles.previewCurrencyAmountText}>
            {previewStyle.text || item.name}
          </Text>
        </View>
      </View>
    );
  }

  // Clean standard emoji + quick-chat bubble styling for Emotes
  return (
    <View style={styles.previewEmoteWrapper}>
      <View
        style={[
          styles.previewEmoteBubble,
          {
            backgroundColor: previewStyle.primaryColor,
            borderColor: previewStyle.borderColor || '#1E293B',
          },
        ]}
      >
        {previewStyle.emoji ? (
          <Text style={styles.previewEmoteEmoji}>{previewStyle.emoji}</Text>
        ) : null}
        <Text style={styles.previewEmoteText} numberOfLines={1}>
          {previewStyle.text || item.name}
        </Text>
      </View>
      <View
        style={[
          styles.previewEmoteTail,
          {
            backgroundColor: previewStyle.primaryColor,
            borderColor: previewStyle.borderColor || '#1E293B',
          },
        ]}
      />
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
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  toastText: {
    ...FONT_CARTOON_BOLD,
    fontSize: 12,
    color: '#FACC15',
    textAlign: 'center',
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
  rewardedAdBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderWidth: 2,
    borderBottomWidth: 3.5,
    borderColor: '#F59E0B',
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 8,
  },
  rewardedAdBannerCooldown: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  rewardedAdLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  rewardedAdIcon: {
    fontSize: 20,
  },
  rewardedAdTextCol: {
    flex: 1,
  },
  rewardedAdTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12.5,
    color: '#92400E',
  },
  rewardedAdSub: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 10,
    color: '#B45309',
  },
  rewardedAdActionPill: {
    backgroundColor: '#10B981',
    borderBottomWidth: 2.5,
    borderColor: '#059669',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardedAdActionPillCooldown: {
    backgroundColor: '#94A3B8',
    borderColor: '#64748B',
  },
  rewardedAdActionText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  itemsScrollContainer: {
    maxHeight: 380,
  },
  itemsScrollWrap: {
    paddingBottom: 10,
  },
  itemsGridContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionHeaderTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11.5,
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  vipSeasonPill: {
    backgroundColor: '#EDE9FE',
    borderWidth: 1.5,
    borderColor: '#C4B5FD',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  vipSeasonPillText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 9,
    color: '#5B21B6',
    letterSpacing: 0.4,
  },
  gemPackHeaderPill: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1.5,
    borderColor: '#7DD3FC',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  gemPackHeaderPillText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 9,
    color: '#0369A1',
    letterSpacing: 0.4,
  },
  levelHeaderPill: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  levelHeaderPillText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 9.5,
    color: '#15803D',
  },
  treasuryNoticeBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  treasuryNoticeTitle: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 10.5,
    color: '#92400E',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  treasuryNoticeSubtitle: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 10,
    color: '#B45309',
    textAlign: 'center',
    marginTop: 2,
  },
  vipItemCard: {
    backgroundColor: '#FFFDF5',
    borderColor: '#F59E0B',
    borderTopColor: '#FDE047',
  },
  coinPackCard: {
    backgroundColor: '#FFFDF5',
    borderColor: '#F59E0B',
    borderTopColor: '#FDE68A',
  },
  gemPackCard: {
    backgroundColor: '#F8FDFF',
    borderColor: '#38BDF8',
    borderTopColor: '#BAE6FD',
  },
  vipCrownTag: {
    backgroundColor: '#312E81',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  vipCrownTagText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 8.5,
    color: '#FDE047',
    letterSpacing: 0.6,
  },
  comingSoonTag: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  comingSoonTagText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 8.5,
    color: '#92400E',
    letterSpacing: 0.5,
  },
  comingSoonTagGem: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  comingSoonTagGemText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 8.5,
    color: '#0369A1',
    letterSpacing: 0.5,
  },
  comingSoonBtn: {
    width: '100%',
    backgroundColor: '#EDE9FE',
    borderWidth: 1.5,
    borderColor: '#C4B5FD',
    borderRadius: 999,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoonBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 10,
    color: '#5B21B6',
    letterSpacing: 0.5,
  },
  usdPriceBtn: {
    width: '100%',
    backgroundColor: '#F59E0B',
    borderBottomWidth: 3.5,
    borderColor: '#B45309',
    borderRadius: 14,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usdPriceBtnGem: {
    width: '100%',
    backgroundColor: '#0284C7',
    borderBottomWidth: 3.5,
    borderColor: '#0369A1',
    borderRadius: 14,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usdPriceBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  paymentsLaunchCaption: {
    ...FONT_CARTOON_REGULAR,
    fontSize: 8.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  buyBtnInsufficient: {
    backgroundColor: '#F87171',
    borderColor: '#B91C1C',
  },
  itemCard: {
    width: '48%',
    backgroundColor: '#FFFDF9',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E2D9C8',
    borderTopWidth: 2.5,
    borderTopColor: '#FFFFFF',
    padding: 10,
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  itemCardShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  previewCardBackImageFrame: {
    width: 72,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  previewArtworkImage: {
    width: '100%',
    height: '100%',
  },
  previewCardBack: {
    width: 64,
    height: 88,
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
    width: 48,
    height: 70,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCardBackIcon: {
    fontSize: 20,
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
  previewCurrencyBox: {
    width: '100%',
    minHeight: 74,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginBottom: 8,
    gap: 5,
  },
  previewCurrencyEmoji: {
    fontSize: 26,
  },
  previewCurrencyAmountPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  previewCurrencyAmountText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  previewEmoteWrapper: {
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  previewEmoteBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 2,
    borderBottomWidth: 3.5,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  previewEmoteEmoji: {
    fontSize: 16,
  },
  previewEmoteText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 12.5,
    color: '#FFFFFF',
  },
  previewEmoteTail: {
    width: 10,
    height: 10,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
    marginTop: -6,
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
    borderBottomWidth: 3.5,
    borderColor: '#1D4ED8',
    borderRadius: 14,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  equipBtnText: {
    ...FONT_CARTOON_HEAVY,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  buyBtn: {
    borderRadius: 14,
    borderBottomWidth: 3.5,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyBtnCoin: {
    backgroundColor: '#F59E0B',
    borderColor: '#B45309',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  buyBtnGem: {
    backgroundColor: '#0284C7',
    borderColor: '#0369A1',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
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
