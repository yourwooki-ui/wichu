import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ListRowsSkeleton } from '@/components/Skeleton';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, pressFeedback, radius } from '@/constants/theme';
import { operationsService } from '@/features/operations/services/operations-service';
import { profilePhotoService } from '@/features/profile/services/profile-photo-service';
import { useAuthSession } from '@/hooks/use-auth-session';
import { formatDateTime } from '@/lib/intl-format';

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
        decision === 'rejected' ? '사진 기준을 확인한 뒤 해당 사진을 교체해 주세요.' : undefined,
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
        <View style={styles.loadingContent}>
          <ListRowsSkeleton count={4} height={104} />
        </View>
      ) : activeQuery.isError ? (
        <EmptyState
          actionLabel="다시 시도"
          description="연결 상태를 확인하고 다시 불러와 주세요."
          illustration={illustratedIcons.connectionError}
          onAction={() => void activeQuery.refetch()}
          title="운영 큐를 불러오지 못했어요"
          tone="error"
        />
      ) : count === 0 ? (
        <EmptyState
          illustration={illustratedIcons.safety}
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
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        active && styles.tabActive,
        pressed && pressFeedback.control,
      ]}
    >
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
  return (
    <View style={styles.card}>
      <ScrollView
        contentContainerStyle={styles.reviewPhotos}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {item.photo_paths.map((path, index) => (
          <ReviewPhoto key={path} index={index} path={path} />
        ))}
      </ScrollView>
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
            ? formatDateTime('ko-KR', new Date(item.submitted_at))
            : '제출 시간 없음'}
        </Text>
        <Text style={styles.photoCount}>이번 심사 사진 {item.photo_paths.length}장</Text>
        <View style={styles.actions}>
          <Action disabled={busy} label="반려" onPress={onReject} />
          <Action primary disabled={busy} label="승인" onPress={onApprove} />
        </View>
      </View>
    </View>
  );
}

function ReviewPhoto({ index, path }: { index: number; path: string }) {
  const photo = useSignedPhoto(path);
  return photo.data ? (
    <View style={styles.reviewPhotoWrap}>
      <Image contentFit="cover" source={{ uri: photo.data }} style={styles.photo} />
      <Text style={styles.reviewPhotoIndex}>{index + 1}</Text>
    </View>
  ) : (
    <View style={[styles.photo, styles.photoEmpty]}>
      <Ionicons color={palette.inkMuted} name="person" size={32} />
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
        <Text style={styles.time}>{formatDateTime('ko-KR', new Date(item.created_at))}</Text>
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
      style={({ pressed }) => [
        styles.action,
        primary && styles.actionPrimary,
        disabled && styles.disabled,
        pressed && !disabled && pressFeedback.control,
      ]}
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
  eyebrow: { color: palette.pink, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
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
  loadingContent: { gap: 12, paddingHorizontal: 18, paddingTop: 6 },
  card: {
    backgroundColor: palette.white,
    borderRadius: 22,
    flexDirection: 'column',
    overflow: 'hidden',
    padding: 12,
  },
  reviewPhotos: { gap: 8 },
  reviewPhotoWrap: { position: 'relative' },
  reviewPhotoIndex: {
    backgroundColor: 'rgba(0,0,0,0.68)',
    borderRadius: radius.pill,
    color: palette.white,
    fontSize: 10,
    fontWeight: '900',
    left: 7,
    minWidth: 22,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 4,
    position: 'absolute',
    textAlign: 'center',
    top: 7,
  },
  photo: { backgroundColor: '#E5E5E8', borderRadius: 16, height: 160, width: 120 },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardCopy: { marginTop: 13, minWidth: 0 },
  cardTitle: { color: palette.ink, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  meta: { color: palette.inkMuted, fontSize: 10, fontWeight: '700', marginTop: 4 },
  reason: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFE7EF',
    borderRadius: radius.pill,
    color: palette.pink,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 5,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  body: { color: palette.inkMuted, fontSize: 10, lineHeight: 14, marginTop: 7 },
  time: { color: '#A0A0A7', fontSize: 10, marginTop: 5 },
  photoCount: { color: palette.pink, fontSize: 10, fontWeight: '900', marginTop: 5 },
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
  actionText: { color: palette.ink, fontSize: 10, fontWeight: '900' },
  actionTextPrimary: { color: palette.white },
  disabled: { opacity: 0.45 },
});
