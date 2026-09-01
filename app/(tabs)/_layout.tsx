import { Image } from 'expo-image';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppViewport } from '@/components/NativePreviewFrame';
import { useAppTheme } from '@/components/ThemeProvider';
import { MONETIZATION_ENABLED } from '@/constants/features';
import { tabIconSources, type TabName } from '@/constants/tab-icons';
import { layout } from '@/constants/theme';
import { hapticsService } from '@/services/haptics-service';

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
        tabBarAllowFontScaling: true,
        tabBarHideOnKeyboard: true,
        tabBarInactiveTintColor: theme.colors.tabInactive,
        tabBarButton: ({ ref: _ref, ...props }) => (
          <Pressable
            {...props}
            onPress={(event) => {
              hapticsService.selection();
              props.onPress?.(event);
            }}
            style={[props.style, styles.tabBarButton]}
          />
        ),
        tabBarStyle: {
          alignSelf: 'center',
          height: (compactWebPreview ? 70 : 90) + bottomInset,
          maxWidth: layout.maxContentWidth,
          paddingTop: compactWebPreview ? 4 : 8,
          paddingBottom: bottomInset,
          paddingHorizontal: 8,
          width: '100%',
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
          return <AnimatedTabIcon compact={compactWebPreview} focused={focused} name={name} />;
        },
      })}
    >
      <Tabs.Screen name="matches" options={{ title: t('tabs.matches') }} />
      <Tabs.Screen name="chat" options={{ title: t('tabs.chat') }} />
      <Tabs.Screen name="discover" options={{ title: t('tabs.discover') }} />
      <Tabs.Screen
        name="shop"
        options={{
          title: t('tabs.shop'),
          // 결제 연동 전에는 탭 자체를 노출하지 않는다.
          href: MONETIZATION_ENABLED ? undefined : null,
        }}
      />
      <Tabs.Screen name="me" options={{ title: t('tabs.me') }} />
    </Tabs>
  );
}

function AnimatedTabIcon({
  compact,
  focused,
  name,
}: {
  compact: boolean;
  focused: boolean;
  name: TabName;
}) {
  const reduceMotion = useReducedMotion();
  const active = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    active.set(
      reduceMotion
        ? focused
          ? 1
          : 0
        : withSpring(focused ? 1 : 0, { damping: 18, mass: 0.7, stiffness: 260 }),
    );
  }, [active, focused, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.7 + active.get() * 0.3,
    transform: [
      { translateY: -2 * active.get() },
      { scale: 1 + active.get() * (name === 'discover' ? 0.07 : 0.045) },
    ],
  }));

  return (
    <View
      style={[
        styles.iconFrame,
        compact && styles.iconFrameCompact,
        name === 'discover' && styles.discoverFrame,
        compact && name === 'discover' && styles.discoverFrameCompact,
      ]}
    >
      <Animated.View style={animatedStyle}>
        <Image
          accessibilityIgnoresInvertColors
          contentFit="contain"
          source={tabIconSources[name]}
          style={[
            styles.tabIcon,
            compact && styles.tabIconCompact,
            name === 'discover' && styles.discoverIcon,
            compact && name === 'discover' && styles.discoverIconCompact,
          ]}
        />
      </Animated.View>
    </View>
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
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.1,
    lineHeight: 15,
    marginTop: 5,
  },
});
