import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { Screen } from '@/components/Screen';
import { palette, radius } from '@/constants/theme';
import { authService } from '@/features/auth/services/auth-service';
import { settingsService } from '@/features/settings/services/settings-service';
import { useAuthSession } from '@/hooks/use-auth-session';

type BooleanSetting = 'discovery_enabled' | 'push_matches' | 'push_messages';

export function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuthSession();
  const userId = session?.user.id;
  const [signingOut, setSigningOut] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const queryKey = ['settings', userId];
  const settingsQuery = useQuery({
    enabled: Boolean(userId),
    queryKey,
    queryFn: () => settingsService.getMySettings(userId!),
  });
  const updateSetting = useMutation({
    mutationFn: ({ key, value }: { key: BooleanSetting; value: boolean }) =>
      settingsService.updateMySettings(userId!, { [key]: value }),
    onMutate: async ({ key, value }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (current: typeof settingsQuery.data) =>
        current ? { ...current, [key]: value } : current,
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      Alert.alert('설정을 저장하지 못했어요', '연결 상태를 확인하고 다시 시도해 주세요.');
    },
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  const signOut = () => {
    Alert.alert('로그아웃할까요?', '이 기기에서 WICHU 계정 연결을 종료합니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          const { error } = await authService.signOut();
          setSigningOut(false);
          if (error) Alert.alert('로그아웃하지 못했어요', error.message);
        },
      },
    ]);
  };

  const showComingSoon = (title: string) =>
    Alert.alert(title, '운영 정책과 서버 기능을 연결한 뒤 사용할 수 있어요.');

  const confirmDeactivation = () =>
    Alert.alert(
      '계정을 비활성화할까요?',
      '내 프로필 노출과 새로운 연결이 즉시 중지되며 현재 매치도 종료됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '비활성화',
          style: 'destructive',
          onPress: async () => {
            setAccountBusy(true);
            try {
              await settingsService.deactivateMyAccount();
              await authService.signOut();
            } catch {
              Alert.alert('비활성화하지 못했어요', '잠시 후 다시 시도해주세요.');
            } finally {
              setAccountBusy(false);
            }
          },
        },
      ],
    );

  const confirmDeletion = () =>
    Alert.alert(
      '계정 삭제를 요청할까요?',
      '프로필은 즉시 비공개 처리되고 운영 삭제 작업이 시작됩니다. 이 작업은 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제 요청',
          style: 'destructive',
          onPress: async () => {
            setAccountBusy(true);
            try {
              await settingsService.requestAccountDeletion();
              await authService.signOut();
            } catch {
              Alert.alert('삭제를 요청하지 못했어요', '잠시 후 다시 시도해주세요.');
            } finally {
              setAccountBusy(false);
            }
          },
        },
      ],
    );

  return (
    <Screen edges={['top', 'left', 'right']} padded={false} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="뒤로"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons color={palette.ink} name="chevron-back" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>설정</Text>
        <View style={styles.headerButton} />
      </View>

      {settingsQuery.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.pink} />
          <Text style={styles.loadingText}>설정을 불러오는 중…</Text>
        </View>
      ) : settingsQuery.isError || !settingsQuery.data ? (
        <View style={styles.centered}>
          <View style={styles.stateIcon}>
            <Ionicons color={palette.pink} name="cloud-offline-outline" size={28} />
          </View>
          <Text style={styles.stateTitle}>설정을 불러오지 못했어요.</Text>
          <Text style={styles.stateText}>연결 상태를 확인하고 다시 시도해 주세요.</Text>
          <Pressable onPress={() => settingsQuery.refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.accountCard}>
            <View style={styles.accountMark}>
              <Ionicons color={palette.pink} name="person" size={22} />
            </View>
            <View style={styles.accountCopy}>
              <Text style={styles.accountLabel}>WICHU 계정</Text>
              <Text numberOfLines={1} style={styles.accountEmail}>
                {session?.user.email ?? '로그인된 계정'}
              </Text>
            </View>
            <Pressable onPress={() => router.push('/profile-setup')} style={styles.editPill}>
              <Text style={styles.editPillText}>프로필 수정</Text>
            </Pressable>
          </View>

          <SettingSection title="탐색">
            <SettingToggle
              description="끄면 내 프로필이 다른 사람의 Discover에 표시되지 않아요."
              icon="sparkles-outline"
              label="내 프로필 노출"
              onValueChange={(value) => updateSetting.mutate({ key: 'discovery_enabled', value })}
              value={settingsQuery.data.discovery_enabled}
            />
          </SettingSection>

          <SettingSection title="알림">
            <SettingToggle
              description="서로 Pick해 매치가 성사되면 알려드려요."
              icon="people-outline"
              label="새로운 매치"
              onValueChange={(value) => updateSetting.mutate({ key: 'push_matches', value })}
              value={settingsQuery.data.push_matches}
            />
            <SettingToggle
              description="새로운 채팅 메시지를 놓치지 않도록 알려드려요."
              icon="chatbubble-outline"
              label="새 메시지"
              onValueChange={(value) => updateSetting.mutate({ key: 'push_messages', value })}
              value={settingsQuery.data.push_messages}
            />
          </SettingSection>

          <SettingSection title="개인정보 및 안전">
            <SettingLink
              icon="ban-outline"
              label="차단한 사용자"
              onPress={() => showComingSoon('차단한 사용자')}
              value="관리"
            />
            <SettingLink
              icon="shield-checkmark-outline"
              label="커뮤니티 가이드"
              onPress={() => showComingSoon('커뮤니티 가이드')}
            />
            <SettingLink
              icon="document-text-outline"
              label="개인정보처리방침"
              onPress={() => showComingSoon('개인정보처리방침')}
            />
          </SettingSection>

          <SettingSection title="계정">
            <SettingLink
              icon="language-outline"
              label="앱 언어"
              onPress={() => Alert.alert('앱 언어', '현재 운영 언어는 한국어예요.')}
              value="한국어"
            />
            <SettingLink
              icon="help-circle-outline"
              label="도움말 및 문의"
              onPress={() => showComingSoon('도움말 및 문의')}
            />
            <SettingLink
              danger
              icon="pause-circle-outline"
              label="계정 비활성화"
              onPress={confirmDeactivation}
            />
            <SettingLink danger icon="trash-outline" label="계정 삭제" onPress={confirmDeletion} />
          </SettingSection>

          <Pressable
            disabled={signingOut || accountBusy}
            onPress={signOut}
            style={styles.signOutButton}
          >
            {signingOut ? (
              <ActivityIndicator color={palette.danger} />
            ) : (
              <Text style={styles.signOutText}>로그아웃</Text>
            )}
          </Pressable>
          <Text style={styles.version}>WICHU 1.0 · 운영 준비 버전</Text>
        </ScrollView>
      )}
    </Screen>
  );
}

function SettingSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.section}>{children}</View>
    </View>
  );
}

function SettingToggle({
  description,
  icon,
  label,
  onValueChange,
  value,
}: {
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons color={palette.ink} name={icon} size={19} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch
        ios_backgroundColor="#DADADF"
        onValueChange={onValueChange}
        thumbColor={palette.white}
        trackColor={{ false: '#DADADF', true: palette.pink }}
        value={value}
      />
    </View>
  );
}

function SettingLink({
  danger = false,
  icon,
  label,
  onPress,
  value,
}: {
  danger?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  value?: string;
}) {
  const color = danger ? palette.danger : palette.ink;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Ionicons color={color} name={icon} size={19} />
      </View>
      <Text style={[styles.rowLabel, styles.rowLinkLabel, { color }]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      <Ionicons color={palette.inkMuted} name="chevron-forward" size={17} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { alignSelf: 'center', maxWidth: 620, width: '100%' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 68,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  headerButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  headerTitle: { color: palette.ink, fontSize: 16, fontWeight: '900' },
  centered: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  loadingText: { color: palette.inkMuted, fontSize: 12, marginTop: 12 },
  stateIcon: {
    alignItems: 'center',
    backgroundColor: '#FFE7EF',
    borderRadius: 23,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  stateTitle: { color: palette.ink, fontSize: 18, fontWeight: '900', marginTop: 15 },
  stateText: { color: palette.inkMuted, fontSize: 12, marginTop: 5, textAlign: 'center' },
  retryButton: {
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryText: { color: palette.white, fontSize: 12, fontWeight: '900' },
  content: { paddingBottom: 34, paddingHorizontal: 18 },
  accountCard: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderRadius: 24,
    flexDirection: 'row',
    marginBottom: 25,
    padding: 16,
  },
  accountMark: {
    alignItems: 'center',
    backgroundColor: '#FFE4ED',
    borderRadius: 18,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  accountCopy: { flex: 1, marginLeft: 11 },
  accountLabel: { color: palette.white, fontSize: 13, fontWeight: '900' },
  accountEmail: { color: 'rgba(255,255,255,0.58)', fontSize: 10, marginTop: 3 },
  editPill: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  editPillText: { color: palette.white, fontSize: 9, fontWeight: '900' },
  sectionWrap: { marginBottom: 22 },
  sectionTitle: {
    color: palette.inkMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 4,
  },
  section: { backgroundColor: palette.white, borderRadius: 22, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    borderBottomColor: '#EBEBEE',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 66,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: '#F0F0F2',
    borderRadius: 12,
    height: 35,
    justifyContent: 'center',
    width: 35,
  },
  rowIconDanger: { backgroundColor: '#FFF0F2' },
  rowCopy: { flex: 1, marginHorizontal: 11 },
  rowLabel: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  rowLinkLabel: { flex: 1, marginLeft: 11 },
  rowDescription: { color: palette.inkMuted, fontSize: 9, lineHeight: 13, marginTop: 3 },
  rowValue: { color: palette.inkMuted, fontSize: 10, fontWeight: '700', marginRight: 5 },
  signOutButton: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 48,
  },
  signOutText: { color: palette.danger, fontSize: 12, fontWeight: '900' },
  version: { color: '#A2A2A9', fontSize: 9, marginTop: 18, textAlign: 'center' },
  pressed: { opacity: 0.62 },
});
