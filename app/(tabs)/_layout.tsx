import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAppTheme } from '@/components/ThemeProvider';

const icons = {
  discover: ['compass', 'compass-outline'],
  matches: ['people', 'people-outline'],
  chat: ['chatbubble-ellipses', 'chatbubble-ellipses-outline'],
  me: ['person', 'person-outline'],
} as const;

export default function TabLayout() {
  const theme = useAppTheme();
  const { t } = useTranslation();

  return (
    <Tabs
      initialRouteName="discover"
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.tabInactive,
        tabBarStyle: {
          height: 66,
          paddingTop: 6,
          paddingBottom: 8,
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIcon: ({ color, focused, size }) => {
          const pair = icons[route.name as keyof typeof icons];
          return <Ionicons name={focused ? pair[0] : pair[1]} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="discover" options={{ title: t('tabs.discover') }} />
      <Tabs.Screen name="matches" options={{ title: t('tabs.matches') }} />
      <Tabs.Screen name="chat" options={{ title: t('tabs.chat') }} />
      <Tabs.Screen name="me" options={{ title: t('tabs.me') }} />
    </Tabs>
  );
}
