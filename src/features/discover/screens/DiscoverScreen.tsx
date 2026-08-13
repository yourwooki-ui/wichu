import { Image, type ImageSource } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BrandWordmark } from '@/components/BrandWordmark';
import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/components/ThemeProvider';
import { SwipeDeck } from '@/features/discover/components/SwipeDeck';
import { DiscoveryFilterSheet } from '@/features/discover/components/DiscoveryFilterSheet';
import { NotificationsSheet } from '@/features/discover/components/NotificationsSheet';
import { useDiscoverDeck } from '@/features/discover/hooks/use-discover-deck';

const headerIcons = {
  undo: require('../../../../assets/header-icons/undo.png'),
  filter: require('../../../../assets/header-icons/filter.png'),
  notification: require('../../../../assets/header-icons/notification.png'),
} satisfies Record<string, ImageSource>;

export function DiscoverScreen() {
  const theme = useAppTheme();
  const deck = useDiscoverDeck();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <Screen edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <HeaderAction
            disabled={!deck.canUndo}
            icon={headerIcons.undo}
            label="마지막 선택 되돌리기"
            onPress={deck.undo}
          />
        </View>
        <View pointerEvents="none" style={styles.brandBlock}>
          <BrandWordmark color={theme.colors.text} size={24} />
        </View>
        <View style={[styles.headerSide, styles.headerActions]}>
          <HeaderAction
            icon={headerIcons.filter}
            label="탐색 조건 설정"
            onPress={() => setFiltersOpen(true)}
          />
          <HeaderAction
            icon={headerIcons.notification}
            label="알림 열기"
            onPress={() => setNotificationsOpen(true)}
          />
        </View>
      </View>
      <SwipeDeck
        error={deck.error}
        isLoading={deck.isLoading}
        onRetry={deck.retry}
        onSwipe={deck.swipe}
        profiles={deck.profiles}
      />
      {filtersOpen ? (
        <DiscoveryFilterSheet
          onClose={() => setFiltersOpen(false)}
          onSave={deck.savePreferences}
          saving={deck.isSavingPreferences}
          value={deck.preferences}
          visible
        />
      ) : null}
      <NotificationsSheet onClose={() => setNotificationsOpen(false)} visible={notificationsOpen} />
    </Screen>
  );
}

type HeaderActionProps = {
  badge?: boolean;
  disabled?: boolean;
  icon: ImageSource;
  label: string;
  onPress: () => void;
};

function HeaderAction({
  badge = false,
  disabled = false,
  icon,
  label,
  onPress,
}: HeaderActionProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerAction,
        { opacity: disabled ? 0.55 : pressed ? 0.62 : 1 },
      ]}
    >
      <Image contentFit="contain" source={icon} style={styles.headerActionIcon} />
      {badge ? <View style={styles.headerActionBadge} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { alignSelf: 'center', maxWidth: 620, width: '100%' },
  header: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  brandBlock: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: '50%',
    position: 'absolute',
    top: 0,
    transform: [{ translateX: -48 }],
    width: 96,
  },
  headerSide: { alignItems: 'center', flexDirection: 'row', minWidth: 96 },
  headerActions: {
    gap: 2,
    justifyContent: 'flex-end',
  },
  headerAction: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    position: 'relative',
    width: 48,
  },
  headerActionIcon: {
    height: 47,
    width: 47,
  },
  headerActionBadge: {
    backgroundColor: '#FF2D6F',
    borderColor: '#EDEDED',
    borderRadius: 5,
    borderWidth: 2,
    height: 10,
    position: 'absolute',
    right: 1,
    top: 1,
    width: 10,
  },
});
