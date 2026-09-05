import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ListRowsSkeleton } from '@/components/Skeleton';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, pressFeedback, radius } from '@/constants/theme';
import { operationsService } from '@/features/operations/services/operations-service';
import { profilePhotoService } from '@/features/profile/services/profile-photo-service';
import { useAuthSession } from '@/hooks/use-auth-session';
import { formatDateTime } from '@/lib/intl-format';

type Section = 'profiles' | 'reports' | 'team';

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
  const teamQuery = useQuery({
    queryKey: ['operations', 'team'],
    enabled: adminRole === 'master',
    queryFn: operationsService.getAdminTeam,
  });
  const activityQuery = useQuery({
    queryKey: ['operations', 'activity'],
    enabled: adminRole === 'master',
    queryFn: operationsService.getModerationActivity,
  });
  const reviewMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approved' | 'rejected' }) =>
      operationsService.reviewProfile(
        id,
        decision,
        decision === 'rejected' ? '사진 기준을 확인한 뒤 해당 사진을 교체해 주세요.' : undefined,
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['operations', 'profile-reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['operations', 'activity'] }),
      ]);
    },
    onError: () => Alert.alert('처리하지 못했어요', '심사 상태를 확인하고 다시 시도해 주세요.'),
  });
  const reportMutation = useMutation({
    mutationFn: ({
      action,
      id,
      resolution,
    }: {
      action?: 'none' | 'profile_hidden';
      id: string;
      resolution: 'reviewed' | 'closed';
    }) => operationsService.resolveReport(id, resolution, { action }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['operations', 'reports'] }),
        queryClient.invalidateQueries({ queryKey: ['operations', 'activity'] }),
      ]);
    },
    onError: () => Alert.alert('처리하지 못했어요', '신고 상태를 확인하고 다시 시도해 주세요.'),
  });
  const operatorMutation = useMutation({
    mutationFn: ({ active, email }: { active: boolean; email: string }) =>
      operationsService.setOperatorAccess(email, active),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['operations', 'team'] }),
        queryClient.invalidateQueries({ queryKey: ['operations', 'activity'] }),
      ]);
    },
    onError: () =>
      Alert.alert('권한을 변경하지 못했어요', '가입된 이메일인지 확인하고 다시 시도해 주세요.'),
  });
  const activeQuery =
    section === 'profiles' ? profileQuery : section === 'reports' ? reportQuery : teamQuery;
  const count = useMemo(
    () =>
      (section === 'profiles'
        ? profileQuery.data?.length
        : section === 'reports'
          ? reportQuery.data?.length
          : teamQuery.data?.length) ?? 0,
    [profileQuery.data?.length, reportQuery.data?.length, section, teamQuery.data?.length],
  );

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} padded={false} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="뒤로"
          accessibilityRole="button"
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
        {adminRole === 'master' ? (
          <Tab active={section === 'team'} label="운영 권한" onPress={() => setSection('team')} />
        ) : null}
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
      ) : section !== 'team' && count === 0 ? (
        <EmptyState
          illustration={illustratedIcons.safety}
          title="처리할 항목이 없어요"
          description="새 요청이 들어오면 이곳에 오래된 순서부터 표시됩니다."
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          {section === 'profiles' ? (
            profileQuery.data?.map((item) => (
              <ReviewCard
                key={item.id}
                item={item}
                busy={reviewMutation.isPending}
                onApprove={() => reviewMutation.mutate({ id: item.id, decision: 'approved' })}
                onReject={() => reviewMutation.mutate({ id: item.id, decision: 'rejected' })}
              />
            ))
          ) : section === 'reports' ? (
            reportQuery.data?.map((item) => (
              <ReportCard
                key={item.id}
                item={item}
                busy={reportMutation.isPending}
                onClose={() => reportMutation.mutate({ id: item.id, resolution: 'closed' })}
                onHide={
                  adminRole === 'master'
                    ? () =>
                        confirmProfileHide(item.reported_display_name, () =>
                          reportMutation.mutate({
                            action: 'profile_hidden',
                            id: item.id,
                            resolution: 'reviewed',
                          }),
                        )
                    : undefined
                }
                onReview={() => reportMutation.mutate({ id: item.id, resolution: 'reviewed' })}
              />
            ))
          ) : (
            <TeamPanel
              activity={activityQuery.data ?? []}
              busy={operatorMutation.isPending}
              members={teamQuery.data ?? []}
              onSetAccess={(email, active) => operatorMutation.mutate({ active, email })}
            />
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function Tab({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
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
      <Image
        cachePolicy="memory-disk"
        contentFit="cover"
        source={{ uri: photo.data }}
        style={styles.photo}
        transition={140}
      />
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
  onHide,
  onReview,
}: {
  item: PendingReport;
  busy: boolean;
  onClose: () => void;
  onHide?: () => void;
  onReview: () => void;
}) {
  const photo = useSignedPhoto(item.reported_photo_path);
  return (
    <View style={styles.card}>
      {photo.data ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          source={{ uri: photo.data }}
          style={styles.photo}
          transition={140}
        />
      ) : (
        <View style={[styles.photo, styles.photoEmpty]}>
          <Ionicons color={palette.inkMuted} name="flag" size={28} />
        </View>
      )}
      <View style={styles.cardCopy}>
        <Text style={styles.cardTitle}>{item.reported_display_name}</Text>
        <Text style={styles.contextBadge}>
          {item.report_context === 'chat' ? '채팅 신고' : '프로필 신고'}
        </Text>
        <View style={styles.reasonWrap}>
          {item.reasons.map((reason) => (
            <Text key={reason} style={styles.reason}>
              {getReportReasonLabel(reason)}
            </Text>
          ))}
        </View>
        <Text numberOfLines={3} style={styles.body}>
          {item.details || '상세 내용 없음'}
        </Text>
        <Text style={styles.time}>{formatDateTime('ko-KR', new Date(item.created_at))}</Text>
        <View style={styles.actions}>
          <Action disabled={busy} label="문제 없음" onPress={onClose} />
          <Action primary disabled={busy} label="처리 완료" onPress={onReview} />
        </View>
        {onHide ? (
          <Pressable
            accessibilityLabel={`${item.reported_display_name} 프로필 노출 중지`}
            accessibilityRole="button"
            disabled={busy}
            onPress={onHide}
            style={({ pressed }) => [
              styles.hideAction,
              busy && styles.disabled,
              pressed && !busy && pressFeedback.control,
            ]}
          >
            <Ionicons color="#B3263F" name="eye-off-outline" size={18} />
            <Text style={styles.hideActionText}>프로필 노출 중지</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

type AdminTeamMember = Awaited<ReturnType<typeof operationsService.getAdminTeam>>[number];
type ModerationActivity = Awaited<
  ReturnType<typeof operationsService.getModerationActivity>
>[number];

function TeamPanel({
  activity,
  busy,
  members,
  onSetAccess,
}: {
  activity: ModerationActivity[];
  busy: boolean;
  members: AdminTeamMember[];
  onSetAccess: (email: string, active: boolean) => void;
}) {
  const [email, setEmail] = useState('');
  const normalizedEmail = email.trim().toLowerCase();
  const canSubmit = normalizedEmail.includes('@') && !busy;

  return (
    <View style={styles.teamPanel}>
      <View style={styles.teamIntro}>
        <Text style={styles.sectionTitle}>운영자 권한 관리</Text>
        <Text style={styles.sectionBody}>
          가입된 계정만 운영자로 지정할 수 있어요. 운영자는 심사와 신고 처리만 가능하며, 권한 변경과
          노출 중지는 마스터만 실행합니다.
        </Text>
        <View style={styles.operatorForm}>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            editable={!busy}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="가입 이메일"
            placeholderTextColor="#96969E"
            style={styles.operatorInput}
            value={email}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
            disabled={!canSubmit}
            onPress={() => {
              onSetAccess(normalizedEmail, true);
              setEmail('');
            }}
            style={({ pressed }) => [
              styles.operatorSubmit,
              !canSubmit && styles.disabled,
              pressed && canSubmit && pressFeedback.control,
            ]}
          >
            <Text style={styles.operatorSubmitText}>운영자 지정</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.sectionTitle}>현재 운영팀</Text>
      <View style={styles.teamList}>
        {members.map((member) => (
          <View key={member.user_id} style={styles.teamRow}>
            <View style={styles.teamAvatar}>
              <Ionicons
                color={member.active ? palette.ink : palette.inkMuted}
                name={member.role === 'master' ? 'key-outline' : 'shield-checkmark-outline'}
                size={21}
              />
            </View>
            <View style={styles.teamCopy}>
              <Text numberOfLines={1} style={styles.teamEmail}>
                {member.email}
              </Text>
              <Text style={styles.teamMeta}>
                {member.role === 'master' ? 'MASTER' : 'OPERATOR'} ·{' '}
                {member.active ? '활성' : '중지'}
              </Text>
            </View>
            {member.role === 'operator' ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => onSetAccess(member.email, !member.active)}
                style={({ pressed }) => [
                  styles.teamToggle,
                  member.active && styles.teamToggleDanger,
                  pressed && pressFeedback.control,
                ]}
              >
                <Text style={[styles.teamToggleText, member.active && styles.teamToggleDangerText]}>
                  {member.active ? '권한 중지' : '다시 활성화'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>

      <Text style={[styles.sectionTitle, styles.activityTitle]}>최근 운영 기록</Text>
      {activity.length ? (
        <View style={styles.activityList}>
          {activity.map((item) => (
            <View key={item.id} style={styles.activityRow}>
              <View style={styles.activityDot} />
              <View style={styles.teamCopy}>
                <Text style={styles.activityAction}>{getActivityLabel(item.action)}</Text>
                <Text style={styles.teamMeta}>
                  {item.actor_email || '삭제된 운영자'}
                  {item.subject_display_name ? ` · ${item.subject_display_name}` : ''}
                </Text>
                <Text style={styles.time}>
                  {formatDateTime('ko-KR', new Date(item.created_at))}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyInline}>기록된 운영 작업이 아직 없어요.</Text>
      )}
    </View>
  );
}

function confirmProfileHide(name: string, onConfirm: () => void) {
  Alert.alert(
    `${name} 프로필 노출을 중지할까요?`,
    '발견과 매치 화면에서 즉시 숨겨집니다. 마스터 권한이 필요한 조치이며 운영 기록에 남습니다.',
    [
      { text: '취소', style: 'cancel' },
      { text: '노출 중지', style: 'destructive', onPress: onConfirm },
    ],
  );
}

function getReportReasonLabel(reason: string) {
  return (
    {
      fake_profile: '허위·도용 프로필',
      harassment: '괴롭힘·불쾌한 대화',
      inappropriate_content: '부적절한 콘텐츠',
      other: '기타',
      scam: '금전 요구·사기 의심',
      spam: '스팸·홍보',
      underage: '미성년자 의심',
    }[reason] ?? reason
  );
}

function getActivityLabel(action: string) {
  return (
    {
      operator_disabled: '운영자 권한 중지',
      operator_enabled: '운영자 권한 활성화',
      profile_approved: '프로필 승인',
      profile_rejected: '프로필 반려',
      report_closed: '신고 문제 없음 종결',
      report_reviewed: '신고 검토 완료',
    }[action] ?? action
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
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
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
  scroll: { flex: 1, minHeight: 0 },
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
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  contextBadge: {
    color: palette.inkMuted,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
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
  hideAction: {
    alignItems: 'center',
    backgroundColor: '#FFF1F3',
    borderRadius: radius.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 40,
  },
  hideActionText: { color: '#B3263F', fontSize: 11, fontWeight: '900', marginLeft: 7 },
  teamPanel: { gap: 12 },
  teamIntro: {
    backgroundColor: palette.white,
    borderRadius: 22,
    padding: 16,
  },
  sectionTitle: { color: palette.ink, fontSize: 15, fontWeight: '900', letterSpacing: -0.3 },
  sectionBody: { color: palette.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 6 },
  operatorForm: { flexDirection: 'row', gap: 7, marginTop: 13 },
  operatorInput: {
    backgroundColor: '#F3F3F5',
    borderColor: '#E4E4E8',
    borderRadius: 14,
    borderWidth: 1,
    color: palette.ink,
    flex: 1,
    fontSize: 12,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  operatorSubmit: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 13,
  },
  operatorSubmitText: { color: palette.white, fontSize: 11, fontWeight: '900' },
  teamList: { backgroundColor: palette.white, borderRadius: 22, overflow: 'hidden' },
  teamRow: {
    alignItems: 'center',
    borderBottomColor: '#ECECEF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 68,
    paddingHorizontal: 13,
  },
  teamAvatar: {
    alignItems: 'center',
    backgroundColor: '#F0F0F3',
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  teamCopy: { flex: 1, marginLeft: 10, minWidth: 0 },
  teamEmail: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  teamMeta: { color: palette.inkMuted, fontSize: 10, marginTop: 3 },
  teamToggle: {
    backgroundColor: '#EEF8F1',
    borderRadius: radius.pill,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  teamToggleDanger: { backgroundColor: '#FFF1F3' },
  teamToggleText: { color: '#197143', fontSize: 10, fontWeight: '900' },
  teamToggleDangerText: { color: '#B3263F' },
  activityTitle: { marginTop: 6 },
  activityList: { backgroundColor: palette.white, borderRadius: 22, overflow: 'hidden' },
  activityRow: {
    alignItems: 'flex-start',
    borderBottomColor: '#ECECEF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 66,
    padding: 13,
  },
  activityDot: {
    backgroundColor: palette.pink,
    borderRadius: 5,
    height: 9,
    marginTop: 5,
    width: 9,
  },
  activityAction: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  emptyInline: {
    backgroundColor: palette.white,
    borderRadius: 18,
    color: palette.inkMuted,
    fontSize: 11,
    padding: 16,
  },
  disabled: { opacity: 0.45 },
});
