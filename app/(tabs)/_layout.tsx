import { Image } from 'expo-image';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/components/ThemeProvider';

const tabIconSources = {
  matches: require('../../assets/tab-icons/matches.png'),
  chat: require('../../assets/tab-icons/chat.png'),
  discover: require('../../assets/tab-icons/discover.png'),
  shop: require('../../assets/tab-icons/shop.png'),
  me: require('../../assets/tab-icons/me.png'),
} as const;

type TabName = keyof typeof tabIconSources;

export default function TabLayout() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compactWebPreview = Platform.OS === 'web' && height < 720;
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'web' ? 18 : 8);

  return (
    <Tabs
      initialRouteName="discover"
      screenOptions={({ route }) => ({
        detachInactiveScreens: false,
        freezeOnBlur: true,
        headerShown: false,
        lazy: false,
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarAllowFontScaling: false,
        tabBarHideOnKeyboard: true,
        tabBarInactiveTintColor: theme.colors.tabInactive,
        tabBarButton: ({ ref: _ref, ...props }) => (
          <Pressable {...props} style={[props.style, styles.tabBarButton]} />
        ),
        tabBarStyle: {
          height: (compactWebPreview ? 74 : 98) + bottomInset,
          paddingTop: compactWebPreview ? 5 : 10,
          paddingBottom: bottomInset,
          paddingHorizontal: 12,
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          ...Platform.select({
            web: { boxShadow: '0 -8px 24px rgba(17,17,17,0.06)' },
            default: {
              elevation: 8,
              shadowColor: '#111111',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
            },
          }),
        },
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: [
          styles.tabBarLabel,
          route.name === 'discover' ? { color: theme.colors.primary } : null,
        ],
        tabBarIcon: ({ focused }) => {
          const name = route.name as TabName;
          return (
            <View
              style={[
                styles.iconFrame,
                compactWebPreview && styles.iconFrameCompact,
                name === 'discover' && styles.discoverFrame,
                compactWebPreview && name === 'discover' && styles.discoverFrameCompact,
              ]}
            >
              <Image
                accessibilityIgnoresInvertColors
                contentFit="contain"
                source={tabIconSources[name]}
                style={[
                  styles.tabIcon,
                  compactWebPreview && styles.tabIconCompact,
                  name === 'discover' && styles.discoverIcon,
                  compactWebPreview && name === 'discover' && styles.discoverIconCompact,
                  { opacity: focused ? 1 : 0.7 },
                ]}
              />
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="matches" options={{ title: t('tabs.matches') }} />
      <Tabs.Screen name="chat" options={{ title: t('tabs.chat') }} />
      <Tabs.Screen name="discover" options={{ title: t('tabs.discover') }} />
      <Tabs.Screen name="shop" options={{ title: t('tabs.shop') }} />
      <Tabs.Screen name="me" options={{ title: t('tabs.me') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconFrame: {
    alignItems: 'center',
    height: 50,
    justifyContent: 'center',
    width: 54,
  },
  discoverFrame: {
    height: 56,
    width: 58,
  },
  iconFrameCompact: { height: 38, width: 46 },
  discoverFrameCompact: { height: 43, width: 48 },
  tabIcon: {
    height: 46,
    width: 46,
  },
  discoverIcon: {
    height: 54,
    width: 54,
  },
  tabIconCompact: { height: 36, width: 36 },
  discoverIconCompact: { height: 42, width: 42 },
  tabBarItem: {
    paddingHorizontal: 3,
  },
  tabBarButton: {
    ...Platform.select({ web: { outlineWidth: 0 } }),
  },
  tabBarLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.1,
    lineHeight: 13,
    marginTop: 6,
  },
});
