import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ImageSource } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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

import { AppModal } from '@/components/AppModal';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { Screen } from '@/components/Screen';
import { ListRowsSkeleton } from '@/components/Skeleton';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { INTERSTITIAL_ADS_ENABLED, REWARDED_ADS_ENABLED } from '@/constants/features';
import { palette, radius, typography } from '@/constants/theme';
import { authService } from '@/features/auth/services/auth-service';
import { LanguagePickerModal } from '@/features/auth/components/LanguagePicker';
import { settingsService } from '@/features/settings/services/settings-service';
import { useAuthSession } from '@/hooks/use-auth-session';
import { getAppLanguage, getAppLanguageMetadata } from '@/i18n';

type BooleanSetting = 'discovery_enabled' | 'push_matches' | 'push_messages';
type AccountAction = 'deactivate' | 'delete' | null;

export function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { session, adminRole } = useAuthSession();
  const userId = session?.user.id;
  const [signingOut, setSigningOut] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [accountAction, setAccountAction] = useState<AccountAction>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [adPrivacyBusy, setAdPrivacyBusy] = useState(false);
  const queryKey = ['settings', userId];
  const settingsQuery = useQuery({
    enabled: Boolean(userId),
    queryKey,
    queryFn: () => settingsService.getMySettings(userId!),
  });
  const adPrivacyQuery = useQuery({
    enabled: INTERSTITIAL_ADS_ENABLED || REWARDED_ADS_ENABLED,
    queryFn: async () => {
      const { adsService } = await import('@/features/monetization/services/ads-service');
      return adsService.getPrivacyOptionsStatus();
    },
    queryKey: ['ads-privacy-options'],
    staleTime: 5 * 60_000,
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
      Alert.alert(t('settings.saveFailed'), t('settings.checkConnection'));
    },
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  const signOut = async () => {
    setSigningOut(true);
    setSignOutError(null);
    const { error } = await authService.signOut();
    if (error) {
      setSigningOut(false);
      setSignOutError(t('settings.checkConnection'));
      return;
    }
    queryClient.clear();
    setSignOutOpen(false);
    setSigningOut(false);
    router.replace('/login');
  };

  const openAccountAction = (action: Exclude<AccountAction, null>) => {
    setAccountError(null);
    setAccountAction(action);
  };

  const submitAccountAction = async () => {
    if (!accountAction) return;

    const action = accountAction;
    setAccountBusy(true);
    setAccountError(null);
    try {
      if (action === 'deactivate') {
        await settingsService.deactivateMyAccount();
        const { error } = await authService.signOut();
        if (error) throw error;
      } else {
        await settingsService.requestAccountDeletion();
        const { error } = await authService.clearLocalSession();
        if (error) throw error;
      }

      queryClient.clear();
      setAccountAction(null);
      router.replace('/login');
    } catch {
      setAccountError(
        `${t(
          action === 'deactivate' ? 'settings.deactivateFailed' : 'settings.deleteFailed',
        )} ${t('settings.checkConnection')}`,
      );
    } finally {
      setAccountBusy(false);
    }
  };

  const openAdPrivacyOptions = async () => {
    if (adPrivacyBusy) return;
    setAdPrivacyBusy(true);
    try {
      const { adsService } = await import('@/features/monetization/services/ads-service');
      const opened = await adsService.showPrivacyOptions();
      if (!opened) Alert.alert(t('settings.adPrivacyUnavailable'), t('settings.tryAgainLater'));
      await adPrivacyQuery.refetch();
    } catch {
      Alert.alert(t('settings.adPrivacyUnavailable'), t('settings.tryAgainLater'));
    } finally {
      setAdPrivacyBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right']} padded={false} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={t('settings.back')}
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons color={palette.ink} name="chevron-back" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        <View style={styles.headerButton} />
      </View>

      {settingsQuery.isLoading ? (
        <View style={styles.loadingContent}>
          <ListRowsSkeleton count={2} height={148} />
          <ListRowsSkeleton count={2} height={112} />
        </View>
      ) : settingsQuery.isError || !settingsQuery.data ? (
        <View style={styles.centered}>
          <View style={styles.stateIcon}>
            <IllustratedIcon size={58} source={illustratedIcons.connectionError} />
          </View>
          <Text style={styles.stateTitle}>{t('settings.loadFailed')}</Text>
          <Text style={styles.stateText}>{t('settings.checkConnection')}</Text>
          <Pressable
            accessibilityLabel={t('settings.retry')}
            accessibilityRole="button"
            onPress={() => settingsQuery.refetch()}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>{t('settings.retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.accountCard}>
            <View style={styles.accountMark}>
              <IllustratedIcon size={38} source={illustratedIcons.profileEdit} />
            </View>
            <View style={styles.accountCopy}>
              <Text style={styles.accountLabel}>{t('settings.account')}</Text>
              <Text numberOfLines={1} style={styles.accountEmail}>
                {session?.user.email ?? t('settings.signedInAccount')}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={t('settings.editProfile')}
              accessibilityRole="button"
              onPress={() => router.push('/profile-edit')}
              style={styles.editPill}
            >
              <Text style={styles.editPillText}>{t('settings.editProfile')}</Text>
            </Pressable>
          </View>

          <SettingSection title={t('settings.sections.discovery')}>
            <SettingToggle
              description={t('settings.discoveryVisibleHint')}
              icon="sparkles-outline"
              illustration={illustratedIcons.discoveryVisible}
              label={t('settings.discoveryVisible')}
              onValueChange={(value) => updateSetting.mutate({ key: 'discovery_enabled', value })}
              value={settingsQuery.data.discovery_enabled}
            />
          </SettingSection>

          <SettingSection title={t('settings.sections.notifications')}>
            <SettingToggle
              description={t('settings.newMatchesHint')}
              icon="people-outline"
              illustration={illustratedIcons.notification}
              label={t('settings.newMatches')}
              onValueChange={(value) => updateSetting.mutate({ key: 'push_matches', value })}
              value={settingsQuery.data.push_matches}
            />
            <SettingToggle
              description={t('settings.newMessagesHint')}
              icon="chatbubble-outline"
              illustration={illustratedIcons.notification}
              label={t('settings.newMessages')}
              onValueChange={(value) => updateSetting.mutate({ key: 'push_messages', value })}
              value={settingsQuery.data.push_messages}
            />
          </SettingSection>

          <SettingSection title={t('settings.sections.privacy')}>
            <SettingLink
              icon="ban-outline"
              illustration={illustratedIcons.safety}
              label={t('settings.blockedUsers')}
              onPress={() => router.push('/blocked-users')}
              value={t('settings.manage')}
            />
            <SettingLink
              icon="shield-checkmark-outline"
              illustration={illustratedIcons.safety}
              label={t('settings.communityGuide')}
              onPress={() => router.push('/legal/community')}
            />
            <SettingLink
              icon="document-text-outline"
              label={t('settings.privacyPolicy')}
              onPress={() => router.push('/legal/privacy')}
            />
            {adPrivacyQuery.data === 'required' ? (
              <SettingLink
                description={t('settings.adPrivacyHint')}
                icon="options-outline"
                label={t('settings.adPrivacy')}
                onPress={() => void openAdPrivacyOptions()}
                value={adPrivacyBusy ? t('settings.checking') : undefined}
              />
            ) : null}
          </SettingSection>

          {adminRole ? (
            <SettingSection title={t('settings.sections.operations')}>
              <SettingLink
                icon="shield-checkmark"
                illustration={illustratedIcons.safety}
                label={t('settings.operationsCenter')}
                onPress={() => router.push('/operations')}
                value={adminRole === 'master' ? t('settings.master') : t('settings.operator')}
              />
            </SettingSection>
          ) : null}

          <SettingSection title={t('settings.sections.account')}>
            <SettingLink
              icon="compass-outline"
              illustration={illustratedIcons.discoverySettings}
              label={t('settings.tutorial')}
              onPress={() => router.push('/tutorial')}
            />
            <SettingLink
              description={t('settings.appLanguageHint')}
              icon="language-outline"
              illustration={illustratedIcons.translation}
              label={t('settings.appLanguage')}
              onPress={() => setLanguagePickerOpen(true)}
              value={getAppLanguageMetadata(getAppLanguage()).label}
            />
            <SettingLink
              icon="help-circle-outline"
              label={t('settings.support')}
              onPress={() => router.push('/support')}
            />
            <SettingLink
              danger
              icon="pause-circle-outline"
              label={t('settings.deactivate')}
              onPress={() => openAccountAction('deactivate')}
            />
            <SettingLink
              danger
              icon="trash-outline"
              label={t('settings.delete')}
              onPress={() => openAccountAction('delete')}
            />
          </SettingSection>

          <Pressable
            accessibilityLabel={t('settings.signOut')}
            accessibilityRole="button"
            accessibilityState={{
              busy: signingOut,
              disabled: signingOut || accountBusy,
            }}
            disabled={signingOut || accountBusy}
            onPress={() => {
              setSignOutError(null);
              setSignOutOpen(true);
            }}
            style={styles.signOutButton}
          >
            {signingOut ? (
              <ActivityIndicator color={palette.danger} />
            ) : (
              <Text style={styles.signOutText}>{t('settings.signOut')}</Text>
            )}
          </Pressable>
          <Text style={styles.version}>{t('settings.version')}</Text>
        </ScrollView>
      )}
      <LanguagePickerModal
        onClose={() => setLanguagePickerOpen(false)}
        visible={languagePickerOpen}
      />
      <AppModal
        animationType="fade"
        onRequestClose={() => {
          if (!signingOut) setSignOutOpen(false);
        }}
        transparent
        visible={signOutOpen}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityLabel={t('settings.cancel')}
            accessibilityRole="button"
            disabled={signingOut}
            onPress={() => setSignOutOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={styles.signOutSheet}>
            <View style={styles.signOutIcon}>
              <Ionicons color={palette.danger} name="log-out-outline" size={25} />
            </View>
            <Text style={styles.signOutTitle}>{t('settings.signOutTitle')}</Text>
            <Text style={styles.signOutBody}>{t('settings.signOutBody')}</Text>
            {signOutError ? (
              <View style={styles.signOutErrorBox}>
                <Text style={styles.signOutErrorText}>{signOutError}</Text>
              </View>
            ) : null}
            <View style={styles.signOutActions}>
              <Pressable
                accessibilityLabel={t('settings.cancel')}
                accessibilityRole="button"
                accessibilityState={{ disabled: signingOut }}
                disabled={signingOut}
                onPress={() => setSignOutOpen(false)}
                style={[styles.modalAction, styles.cancelAction]}
              >
                <Text style={styles.cancelActionText}>{t('settings.cancel')}</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={t('settings.signOut')}
                accessibilityRole="button"
                accessibilityState={{ busy: signingOut, disabled: signingOut }}
                disabled={signingOut}
                onPress={() => void signOut()}
                style={[styles.modalAction, styles.confirmSignOutAction]}
              >
                {signingOut ? (
                  <ActivityIndicator color={palette.white} />
                ) : (
                  <Text style={styles.confirmSignOutText}>{t('settings.signOut')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </AppModal>
      <AppModal
        animationType="fade"
        onRequestClose={() => {
          if (!accountBusy) setAccountAction(null);
        }}
        transparent
        visible={accountAction !== null}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityLabel={t('settings.cancel')}
            accessibilityRole="button"
            disabled={accountBusy}
            onPress={() => setAccountAction(null)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={styles.signOutSheet}>
            <View style={styles.signOutIcon}>
              <Ionicons
                color={palette.danger}
                name={accountAction === 'delete' ? 'trash-outline' : 'pause-circle-outline'}
                size={25}
              />
            </View>
            <Text style={styles.signOutTitle}>
              {t(accountAction === 'delete' ? 'settings.deleteTitle' : 'settings.deactivateTitle')}
            </Text>
            <Text style={styles.signOutBody}>
              {t(accountAction === 'delete' ? 'settings.deleteBody' : 'settings.deactivateBody')}
            </Text>
            {accountError ? (
              <View style={styles.signOutErrorBox}>
                <Text style={styles.signOutErrorText}>{accountError}</Text>
              </View>
            ) : null}
            <View style={styles.signOutActions}>
              <Pressable
                accessibilityLabel={t('settings.cancel')}
                accessibilityRole="button"
                accessibilityState={{ disabled: accountBusy }}
                disabled={accountBusy}
                onPress={() => setAccountAction(null)}
                style={[styles.modalAction, styles.cancelAction]}
              >
                <Text style={styles.cancelActionText}>{t('settings.cancel')}</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={t(
                  accountAction === 'delete' ? 'settings.deleteRequest' : 'settings.deactivate',
                )}
                accessibilityRole="button"
                accessibilityState={{ busy: accountBusy, disabled: accountBusy }}
                disabled={accountBusy}
                onPress={() => void submitAccountAction()}
                style={[styles.modalAction, styles.confirmSignOutAction]}
              >
                {accountBusy ? (
                  <ActivityIndicator color={palette.white} />
                ) : (
                  <Text style={styles.confirmSignOutText}>
                    {t(
                      accountAction === 'delete' ? 'settings.deleteRequest' : 'settings.deactivate',
                    )}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </AppModal>
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
  illustration,
  label,
  onValueChange,
  value,
}: {
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  illustration?: ImageSource;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View accessibilityLabel={`${label}. ${description}`} style={styles.row}>
      <View style={styles.rowIcon}>
        {illustration ? (
          <IllustratedIcon size={31} source={illustration} />
        ) : (
          <Ionicons color={palette.ink} name={icon} size={19} />
        )}
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityRole="switch"
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
  description,
  icon,
  illustration,
  label,
  onPress,
  value,
}: {
  danger?: boolean;
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  illustration?: ImageSource;
  label: string;
  onPress: () => void;
  value?: string;
}) {
  const color = danger ? palette.danger : palette.ink;
  return (
    <Pressable
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        {illustration ? (
          <IllustratedIcon size={31} source={illustration} />
        ) : (
          <Ionicons color={color} name={icon} size={19} />
        )}
      </View>
      <View style={styles.rowLinkCopy}>
        <Text style={[styles.rowLabel, { color }]}>{label}</Text>
        {description ? <Text style={styles.rowDescription}>{description}</Text> : null}
      </View>
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
  stateIcon: {
    alignItems: 'center',
    backgroundColor: '#FFE7EF',
    borderRadius: 23,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  stateTitle: { ...typography.heading, color: palette.ink, marginTop: 15 },
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
  accountEmail: { color: 'rgba(255,255,255,0.68)', fontSize: 11, marginTop: 3 },
  editPill: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  editPillText: { color: palette.white, fontSize: 11, fontWeight: '900' },
  loadingContent: { gap: 22, paddingHorizontal: 16, paddingTop: 4 },
  sectionWrap: { marginBottom: 22 },
  sectionTitle: {
    ...typography.overline,
    color: palette.inkMuted,
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
  rowLinkCopy: { flex: 1, marginLeft: 11 },
  rowDescription: { color: palette.inkMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  rowValue: { color: palette.inkMuted, fontSize: 11, fontWeight: '700', marginRight: 5 },
  signOutButton: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 48,
  },
  signOutText: { color: palette.danger, fontSize: 12, fontWeight: '900' },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(17,17,19,0.18)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  signOutSheet: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 26,
    elevation: 14,
    maxWidth: 380,
    padding: 22,
    shadowColor: '#111113',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    width: '100%',
  },
  signOutIcon: {
    alignItems: 'center',
    backgroundColor: '#FFF0F2',
    borderRadius: 20,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  signOutTitle: { color: palette.ink, fontSize: 18, fontWeight: '900', marginTop: 14 },
  signOutBody: {
    color: palette.inkMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
  signOutErrorBox: {
    backgroundColor: '#FFF0F2',
    borderRadius: 12,
    marginTop: 13,
    paddingHorizontal: 12,
    paddingVertical: 9,
    width: '100%',
  },
  signOutErrorText: { color: palette.danger, fontSize: 11, fontWeight: '700' },
  signOutActions: { flexDirection: 'row', gap: 8, marginTop: 20, width: '100%' },
  modalAction: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelAction: { backgroundColor: '#F1F1F3' },
  cancelActionText: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  confirmSignOutAction: { backgroundColor: palette.danger },
  confirmSignOutText: { color: palette.white, fontSize: 13, fontWeight: '900' },
  version: { color: '#92929A', fontSize: 11, marginTop: 18, textAlign: 'center' },
  pressed: { opacity: 0.62 },
});
