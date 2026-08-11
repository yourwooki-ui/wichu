import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/components/ThemeProvider';
import { radius, spacing } from '@/constants/theme';

export default function MeRoute() {
  const router = useRouter();
  const theme = useAppTheme();

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Me</Text>
      </View>
      <View
        style={[
          styles.profile,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: `${theme.colors.primary}18` }]}>
          <Ionicons name="person" size={34} color={theme.colors.primary} />
        </View>
        <View style={styles.profileCopy}>
          <Text style={[styles.profileTitle, { color: theme.colors.text }]}>
            Complete your profile
          </Text>
          <Text style={[styles.profileDescription, { color: theme.colors.textMuted }]}>
            Add photos and details to get started.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
      </View>
      <View style={styles.menu}>
        <MenuRow
          icon="settings-outline"
          label="Settings"
          onPress={() => router.push('/settings')}
        />
        <MenuRow
          icon="remove-circle-outline"
          label="Ad-Free"
          onPress={() => router.push('/ad-free')}
        />
      </View>
    </Screen>
  );
}

type MenuRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
};

function MenuRow({ icon, label, onPress }: MenuRowProps) {
  const theme = useAppTheme();
  return (
    <Pressable
      style={[styles.menuRow, { borderBottomColor: theme.colors.border }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={22} color={theme.colors.text} />
      <Text style={[styles.menuLabel, { color: theme.colors.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { height: 64, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800' },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCopy: { flex: 1, marginHorizontal: spacing.sm },
  profileTitle: { fontSize: 16, fontWeight: '800' },
  profileDescription: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  menu: { marginTop: spacing.lg },
  menuRow: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuLabel: { flex: 1, marginLeft: spacing.sm, fontSize: 16, fontWeight: '600' },
});
