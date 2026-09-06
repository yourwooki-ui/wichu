import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ListRowsSkeleton } from '@/components/Skeleton';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, radius, typography } from '@/constants/theme';
import { safetyService } from '@/features/settings/services/safety-service';
import { formatDate } from '@/lib/intl-format';
import { productAnalyticsService } from '@/services/product-analytics-service';

export function SafetyCenterScreen() {
  const router = useRouter();
  const { i18n, t } = useTranslation();
  const reportsQuery = useQuery({
    queryKey: ['safety', 'my-reports'],
    queryFn: safetyService.listMyReports,
  });

  useEffect(() => {
    productAnalyticsService.track('report_status_viewed', undefined, '/safety-center');
  }, []);

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} padded={false} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={t('relationship.safetyCenter.back')}
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons color={palette.ink} name="chevron-back" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('relationship.safetyCenter.title')}</Text>
        <View style={styles.headerButton} />
      </View>

      {reportsQuery.isLoading ? (
        <View style={styles.content}>
          <ListRowsSkeleton count={3} height={118} />
        </View>
      ) : reportsQuery.isError ? (
        <EmptyState
          actionLabel={t('relationship.common.retry')}
          description={t('relationship.safetyCenter.loadErrorBody')}
          illustration={illustratedIcons.connectionError}
          onAction={() => void reportsQuery.refetch()}
          title={t('relationship.safetyCenter.loadError')}
          tone="error"
        />
      ) : reportsQuery.data?.length === 0 ? (
        <EmptyState
          description={t('relationship.safetyCenter.emptyBody')}
          illustration={illustratedIcons.safety}
          title={t('relationship.safetyCenter.emptyTitle')}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.helper}>{t('relationship.safetyCenter.helper')}</Text>
          <View style={styles.list}>
            {(reportsQuery.data ?? []).map((report) => (
              <View key={report.id} style={styles.card}>
                <View style={styles.cardHeading}>
                  <Text style={styles.reportTitle}>
                    {t(`relationship.safetyCenter.context.${report.report_context}`)}
                  </Text>
                  <View style={[styles.status, report.status === 'closed' && styles.statusClosed]}>
                    <Text
                      style={[
                        styles.statusText,
                        report.status === 'closed' && styles.statusTextClosed,
                      ]}
                    >
                      {t(`relationship.safetyCenter.status.${report.status}`)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.reasons}>
                  {report.reasons
                    .map((reason) => t(`safetySurfaces.report.reasons.${reason}`))
                    .join(' · ')}
                </Text>
                <Text style={styles.date}>
                  {formatDate(i18n.resolvedLanguage ?? 'ko-KR', new Date(report.created_at))}
                </Text>
                {report.moderation_action === 'profile_hidden' ? (
                  <View style={styles.outcome}>
                    <Ionicons color={palette.pink} name="shield-checkmark" size={16} />
                    <Text style={styles.outcomeText}>
                      {t('relationship.safetyCenter.profileHidden')}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </Screen>
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
  headerTitle: { ...typography.subheading, color: palette.ink, fontWeight: '900' },
  content: { paddingBottom: 32, paddingHorizontal: 18 },
  helper: { ...typography.caption, color: palette.inkMuted, marginBottom: 12 },
  list: { gap: 10 },
  card: { backgroundColor: palette.white, borderRadius: radius.lg, padding: 16 },
  cardHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  reportTitle: { ...typography.bodyStrong, color: palette.ink, fontWeight: '900' },
  status: {
    backgroundColor: '#FFF1D6',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusClosed: { backgroundColor: '#EAF8E8' },
  statusText: { color: '#8A5C00', fontSize: 10, fontWeight: '900' },
  statusTextClosed: { color: '#287C35' },
  reasons: { color: palette.ink, fontSize: 13, lineHeight: 19, marginTop: 10 },
  date: { color: palette.inkMuted, fontSize: 10, marginTop: 6 },
  outcome: {
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 7,
    marginTop: 12,
    padding: 10,
  },
  outcomeText: { color: palette.pinkPressed, flex: 1, fontSize: 11, fontWeight: '800' },
});
