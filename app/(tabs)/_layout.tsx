import { Image } from 'expo-image';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppViewport } from '@/components/NativePreviewFrame';
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
  const { height } = useAppViewport();
  const compactWebPreview = Platform.OS === 'web' && height < 720;
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'web' ? 18 : 8);

  return (
    <Tabs
      initialRouteName="discover"
      screenOptions={({ route }) => ({
        detachInactiveScreens: true,
        freezeOnBlur: true,
        headerShown: false,
        lazy: true,
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarAllowFontScaling: false,
        tabBarHideOnKeyboard: true,
        tabBarInactiveTintColor: theme.colors.tabInactive,
        tabBarButton: ({ ref: _ref, ...props }) => (
          <Pressable {...props} style={[props.style, styles.tabBarButton]} />
        ),
        tabBarStyle: {
          height: (compactWebPreview ? 70 : 90) + bottomInset,
          paddingTop: compactWebPreview ? 4 : 8,
          paddingBottom: bottomInset,
          paddingHorizontal: 8,
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          ...Platform.select({
            web: { boxShadow: '0 -6px 18px rgba(17,17,17,0.045)' },
            default: {
              elevation: 8,
              shadowColor: '#111111',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.045,
              shadowRadius: 10,
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
    height: 46,
    justifyContent: 'center',
    width: 50,
  },
  discoverFrame: {
    height: 52,
    width: 54,
  },
  iconFrameCompact: { height: 36, width: 44 },
  discoverFrameCompact: { height: 41, width: 47 },
  tabIcon: {
    height: 42,
    width: 42,
  },
  discoverIcon: {
    height: 50,
    width: 50,
  },
  tabIconCompact: { height: 34, width: 34 },
  discoverIconCompact: { height: 40, width: 40 },
  tabBarItem: {
    paddingHorizontal: 1,
  },
  tabBarButton: {
    ...Platform.select({ web: { outlineWidth: 0 } }),
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.1,
    lineHeight: 13,
    marginTop: 4,
  },
});
