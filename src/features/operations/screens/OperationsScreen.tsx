import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { palette, radius } from '@/constants/theme';
import { operationsService } from '@/features/operations/services/operations-service';
import { profilePhotoService } from '@/features/profile/services/profile-photo-service';
import { useAuthSession } from '@/hooks/use-auth-session';

type Section = 'profiles' | 'reports';

function useSignedPhoto(path: string | null | undefined) {
  return useQuery({
    queryKey: ['operations', 'photo', path],
    enabled: Boolean(path),
    staleTime: 45 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await profilePhotoService.createSignedPhotoUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function OperationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { adminRole } = useAuthSession();
  const [section, setSection] = useState<Section>('profiles');
  const profileQuery = useQuery({
    queryKey: ['operations', 'profile-reviews'],
    queryFn: operationsService.getProfileReviews,
  });
  const reportQuery = useQuery({
    queryKey: ['operations', 'reports'],
    queryFn: operationsService.getPendingReports,
  });
  const reviewMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approved' | 'rejected' }) =>
      operationsService.reviewProfile(
        id,
        decision,
        decision === 'rejected' ? '대표 사진 또는 공개 프로필을 수정해 주세요.' : undefined,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operations', 'profile-reviews'] }),
    onError: () => Alert.alert('처리하지 못했어요', '심사 상태를 확인하고 다시 시도해 주세요.'),
  });
  const reportMutation = useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: 'reviewed' | 'closed' }) =>
      operationsService.resolveReport(id, resolution),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operations', 'reports'] }),
    onError: () => Alert.alert('처리하지 못했어요', '신고 상태를 확인하고 다시 시도해 주세요.'),
  });
  const activeQuery = section === 'profiles' ? profileQuery : reportQuery;
  const count = useMemo(
    () => (section === 'profiles' ? profileQuery.data?.length : reportQuery.data?.length) ?? 0,
    [profileQuery.data?.length, reportQuery.data?.length, section],
  );

  return (
    <Screen edges={['top', 'left', 'right']} padded={false} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="뒤로"
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <Ionicons color={palette.ink} name="chevron-back" size={25} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>
            WICHU OPS · {adminRole === 'master' ? 'MASTER' : 'OPERATOR'}
          </Text>
          <Text style={styles.title}>운영 센터</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <Tab
          active={section === 'profiles'}
          label="프로필 심사"
          onPress={() => setSection('profiles')}
        />
        <Tab
          active={section === 'reports'}
          label="신고 처리"
          onPress={() => setSection('reports')}
        />
      </View>

      {activeQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.pink} size="large" />
        </View>
      ) : activeQuery.isError ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>운영 큐를 불러오지 못했어요</Text>
          <Pressable onPress={() => activeQuery.refetch()} style={styles.retry}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : count === 0 ? (
        <EmptyState
          icon="checkmark-done"
          title="처리할 항목이 없어요"
          description="새 요청이 들어오면 이곳에 오래된 순서부터 표시됩니다."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {section === 'profiles'
            ? profileQuery.data?.map((item) => (
                <ReviewCard
                  key={item.id}
                  item={item}
                  busy={reviewMutation.isPending}
                  onApprove={() => reviewMutation.mutate({ id: item.id, decision: 'approved' })}
                  onReject={() => reviewMutation.mutate({ id: item.id, decision: 'rejected' })}
                />
              ))
            : reportQuery.data?.map((item) => (
                <ReportCard
                  key={item.id}
                  item={item}
                  busy={reportMutation.isPending}
                  onClose={() => reportMutation.mutate({ id: item.id, resolution: 'closed' })}
                  onReview={() => reportMutation.mutate({ id: item.id, resolution: 'reviewed' })}
                />
              ))}
        </ScrollView>
      )}
    </Screen>
  );
}

function Tab({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

type ProfileReview = Awaited<ReturnType<typeof operationsService.getProfileReviews>>[number];

function ReviewCard({
  item,
  busy,
  onApprove,
  onReject,
}: {
  item: ProfileReview;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const photo = useSignedPhoto(item.photo_paths[0]);
  return (
    <View style={styles.card}>
      {photo.data ? (
        <Image contentFit="cover" source={{ uri: photo.data }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.photoEmpty]}>
          <Ionicons color={palette.inkMuted} name="person" size={32} />
        </View>
      )}
      <View style={styles.cardCopy}>
        <Text style={styles.cardTitle}>
          {item.display_name}, {item.age}
        </Text>
        <Text style={styles.meta}>
          {item.country_code} · {item.gender} · {item.languages.join(', ')}
        </Text>
        <Text numberOfLines={2} style={styles.body}>
          {item.bio || '소개 없음'}
        </Text>
        <Text style={styles.time}>
          {item.submitted_at
            ? new Date(item.submitted_at).toLocaleString('ko-KR')
            : '제출 시간 없음'}
        </Text>
        <View style={styles.actions}>
          <Action disabled={busy} label="반려" onPress={onReject} />
          <Action primary disabled={busy} label="승인" onPress={onApprove} />
        </View>
      </View>
    </View>
  );
}

type PendingReport = Awaited<ReturnType<typeof operationsService.getPendingReports>>[number];

function ReportCard({
  item,
  busy,
  onClose,
  onReview,
}: {
  item: PendingReport;
  busy: boolean;
  onClose: () => void;
  onReview: () => void;
}) {
  const photo = useSignedPhoto(item.reported_photo_path);
  return (
    <View style={styles.card}>
      {photo.data ? (
        <Image contentFit="cover" source={{ uri: photo.data }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.photoEmpty]}>
          <Ionicons color={palette.inkMuted} name="flag" size={28} />
        </View>
      )}
      <View style={styles.cardCopy}>
        <Text style={styles.cardTitle}>{item.reported_display_name}</Text>
        <Text style={styles.reason}>{item.reason}</Text>
        <Text numberOfLines={3} style={styles.body}>
          {item.details || '상세 내용 없음'}
        </Text>
        <Text style={styles.time}>{new Date(item.created_at).toLocaleString('ko-KR')}</Text>
        <View style={styles.actions}>
          <Action disabled={busy} label="종결" onPress={onClose} />
          <Action primary disabled={busy} label="검토 완료" onPress={onReview} />
        </View>
      </View>
    </View>
  );
}

function Action({
  disabled,
  label,
  onPress,
  primary = false,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, primary && styles.actionPrimary, disabled && styles.disabled]}
    >
      <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { alignSelf: 'center', maxWidth: 620, width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', minHeight: 82, paddingHorizontal: 15 },
  iconButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  headerCopy: { flex: 1, marginLeft: 4 },
  eyebrow: { color: palette.pink, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: palette.ink, fontSize: 23, fontWeight: '900', letterSpacing: -0.7, marginTop: 3 },
  countPill: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minWidth: 37,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  countText: { color: palette.white, fontSize: 11, fontWeight: '900' },
  tabs: {
    backgroundColor: '#DDDDE1',
    borderRadius: radius.pill,
    flexDirection: 'row',
    marginHorizontal: 18,
    padding: 4,
  },
  tab: { alignItems: 'center', borderRadius: radius.pill, flex: 1, paddingVertical: 11 },
  tabActive: { backgroundColor: palette.white },
  tabText: { color: palette.inkMuted, fontSize: 11, fontWeight: '800' },
  tabTextActive: { color: palette.ink },
  content: { gap: 12, padding: 18, paddingBottom: 40 },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 28 },
  errorTitle: { color: palette.ink, fontSize: 16, fontWeight: '900' },
  retry: {
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    marginTop: 15,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryText: { color: palette.white, fontSize: 11, fontWeight: '900' },
  card: {
    backgroundColor: palette.white,
    borderRadius: 22,
    flexDirection: 'row',
    overflow: 'hidden',
    padding: 12,
  },
  photo: { backgroundColor: '#E5E5E8', borderRadius: 16, height: 132, width: 98 },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, marginLeft: 13, minWidth: 0 },
  cardTitle: { color: palette.ink, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  meta: { color: palette.inkMuted, fontSize: 9, fontWeight: '700', marginTop: 4 },
  reason: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFE7EF',
    borderRadius: radius.pill,
    color: palette.pink,
    fontSize: 9,
    fontWeight: '900',
    marginTop: 5,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  body: { color: palette.inkMuted, fontSize: 10, lineHeight: 14, marginTop: 7 },
  time: { color: '#A0A0A7', fontSize: 8, marginTop: 5 },
  actions: { flexDirection: 'row', gap: 7, marginTop: 9 },
  action: {
    alignItems: 'center',
    borderColor: palette.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 8,
  },
  actionPrimary: { backgroundColor: palette.ink, borderColor: palette.ink },
  actionText: { color: palette.ink, fontSize: 9, fontWeight: '900' },
  actionTextPrimary: { color: palette.white },
  disabled: { opacity: 0.45 },
});
