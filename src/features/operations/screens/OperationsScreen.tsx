import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppModal } from '@/components/AppModal';
import { EmptyState } from '@/components/EmptyState';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { Screen } from '@/components/Screen';
import { ListRowsSkeleton } from '@/components/Skeleton';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { imageTransition } from '@/constants/motion';
import { elevation, layout, palette, pressFeedback, radius, typography } from '@/constants/theme';
import { operationsService } from '@/features/operations/services/operations-service';
import {
  getQueueAgeLabel,
  getQueuePriority,
  getReportPriority,
  includesNormalizedSearch,
  matchesQueueFilter,
  type QueuePriority,
} from '@/features/operations/utils/operations-workspace';
import { profilePhotoService } from '@/features/profile/services/profile-photo-service';
import { useAuthSession } from '@/hooks/use-auth-session';
import { formatDateTime } from '@/lib/intl-format';

type Section = 'overview' | 'profiles' | 'reports' | 'activity' | 'team';
type QueueFilter = 'all' | QueuePriority;
type PendingAction =
  | { kind: 'profile-reject'; id: string; name: string }
  | { kind: 'report-close' | 'report-review' | 'report-hide'; id: string; name: string };

const SECTIONS: {
  key: Section;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  masterOnly?: boolean;
}[] = [
  { key: 'overview', label: '현황', icon: 'grid-outline' },
  { key: 'profiles', label: '프로필', icon: 'images-outline' },
  { key: 'reports', label: '신고', icon: 'flag-outline' },
  { key: 'activity', label: '감사 로그', icon: 'receipt-outline', masterOnly: true },
  { key: 'team', label: '권한', icon: 'people-outline', masterOnly: true },
];

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
  const isMaster = adminRole === 'master';
  const [section, setSection] = useState<Section>('overview');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const overviewQuery = useQuery({
    queryKey: ['operations', 'overview'],
    queryFn: operationsService.getOverview,
  });
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
    enabled: isMaster,
    queryFn: operationsService.getAdminTeam,
  });
  const activityQuery = useQuery({
    queryKey: ['operations', 'activity'],
    enabled: isMaster,
    queryFn: operationsService.getModerationActivity,
  });

  const refreshWorkspace = async (...keys: string[]) => {
    await Promise.all(
      ['overview', ...keys].map((key) =>
        queryClient.invalidateQueries({ queryKey: ['operations', key] }),
      ),
    );
  };
  const reviewMutation = useMutation({
    mutationFn: ({
      decision,
      id,
      note,
    }: {
      decision: 'approved' | 'rejected';
      id: string;
      note?: string;
    }) => operationsService.reviewProfile(id, decision, note),
    onSuccess: () => refreshWorkspace('profile-reviews', 'activity'),
    onError: () => Alert.alert('처리하지 못했어요', '심사 상태를 확인하고 다시 시도해 주세요.'),
  });
  const reportMutation = useMutation({
    mutationFn: ({
      action = 'none',
      id,
      note,
      resolution,
    }: {
      action?: 'none' | 'profile_hidden';
      id: string;
      note?: string;
      resolution: 'reviewed' | 'closed';
    }) => operationsService.resolveReport(id, resolution, { action, note }),
    onSuccess: () => refreshWorkspace('reports', 'activity'),
    onError: () => Alert.alert('처리하지 못했어요', '신고 상태를 확인하고 다시 시도해 주세요.'),
  });
  const operatorMutation = useMutation({
    mutationFn: ({ active, email }: { active: boolean; email: string }) =>
      operationsService.setOperatorAccess(email, active),
    onSuccess: () => refreshWorkspace('team', 'activity'),
    onError: () => Alert.alert('권한을 변경하지 못했어요', '가입된 이메일인지 확인해 주세요.'),
  });

  const profileItems = useMemo(
    () =>
      (profileQuery.data ?? []).filter((item) => {
        const matchesSearch = includesNormalizedSearch(
          [item.display_name, item.country_code, item.bio, ...item.languages],
          search,
        );
        const priority = getQueuePriority(item.submitted_at ?? new Date().toISOString());
        return matchesSearch && matchesQueueFilter(filter, priority, item.submitted_at ?? '');
      }),
    [filter, profileQuery.data, search],
  );
  const reportItems = useMemo(
    () =>
      (reportQuery.data ?? []).filter((item) => {
        const matchesSearch = includesNormalizedSearch(
          [item.reported_display_name, item.details, ...item.reasons],
          search,
        );
        const priority = getReportPriority(item.reasons, item.created_at);
        return matchesSearch && matchesQueueFilter(filter, priority, item.created_at);
      }),
    [filter, reportQuery.data, search],
  );
  const queueCount =
    (overviewQuery.data?.pending_profiles ?? profileQuery.data?.length ?? 0) +
    (overviewQuery.data?.pending_reports ?? reportQuery.data?.length ?? 0);
  const sectionCounts: Partial<Record<Section, number>> = {
    overview: queueCount,
    profiles: overviewQuery.data?.pending_profiles ?? profileQuery.data?.length ?? 0,
    reports: overviewQuery.data?.pending_reports ?? reportQuery.data?.length ?? 0,
  };
  const activeQuery =
    section === 'overview'
      ? overviewQuery
      : section === 'profiles'
        ? profileQuery
        : section === 'reports'
          ? reportQuery
          : section === 'activity'
            ? activityQuery
            : teamQuery;
  const isBusy = reviewMutation.isPending || reportMutation.isPending;

  const changeSection = (next: Section) => {
    setSection(next);
    setSearch('');
    setFilter('all');
  };
  const submitPendingAction = (note: string) => {
    if (!pendingAction) return;
    const { id, kind } = pendingAction;
    if (kind === 'profile-reject') {
      reviewMutation.mutate({ decision: 'rejected', id, note });
    } else {
      reportMutation.mutate({
        action: kind === 'report-hide' ? 'profile_hidden' : 'none',
        id,
        note,
        resolution: kind === 'report-close' ? 'closed' : 'reviewed',
      });
    }
    setPendingAction(null);
  };

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
          <Text style={styles.eyebrow}>WICHU CONTROL</Text>
          <Text style={styles.title}>운영 센터</Text>
        </View>
        <View style={styles.headerMeta}>
          <Text style={styles.roleLabel}>{isMaster ? 'MASTER' : 'OPERATOR'}</Text>
          <View style={[styles.countPill, queueCount > 0 && styles.countPillActive]}>
            <Text style={styles.countText}>{queueCount}</Text>
            <Text style={styles.countLabel}>대기</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabRail}>
        <ScrollView
          contentContainerStyle={styles.tabs}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {SECTIONS.filter((item) => !item.masterOnly || isMaster).map((item) => (
            <Tab
              key={item.key}
              active={section === item.key}
              count={sectionCounts[item.key]}
              icon={item.icon}
              label={item.label}
              onPress={() => changeSection(item.key)}
            />
          ))}
        </ScrollView>
      </View>

      {activeQuery.isLoading ? (
        <View style={styles.loadingContent}>
          <ListRowsSkeleton count={4} height={104} />
        </View>
      ) : activeQuery.isError ? (
        <EmptyState
          actionLabel="다시 시도"
          description="연결 상태와 운영자 권한을 확인하고 다시 불러와 주세요."
          illustration={illustratedIcons.connectionError}
          onAction={() => void activeQuery.refetch()}
          title="운영 데이터를 불러오지 못했어요"
          tone="error"
        />
      ) : (
        <KeyboardAwareScrollView
          contentContainerStyle={styles.content}
          keyboardFocusOffset={24}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          {section === 'overview' ? (
            <OverviewPanel
              data={overviewQuery.data}
              onOpen={changeSection}
              recentActivity={activityQuery.data?.slice(0, 4) ?? []}
              showActivity={isMaster}
            />
          ) : section === 'profiles' ? (
            <QueuePanel
              count={profileItems.length}
              filter={filter}
              onFilter={setFilter}
              onSearch={setSearch}
              search={search}
              title="프로필·사진 심사"
            >
              {profileItems.map((item) => (
                <ReviewCard
                  key={item.id}
                  busy={reviewMutation.isPending}
                  item={item}
                  onApprove={() => reviewMutation.mutate({ decision: 'approved', id: item.id })}
                  onReject={() =>
                    setPendingAction({
                      id: item.id,
                      kind: 'profile-reject',
                      name: item.display_name,
                    })
                  }
                />
              ))}
            </QueuePanel>
          ) : section === 'reports' ? (
            <QueuePanel
              count={reportItems.length}
              filter={filter}
              onFilter={setFilter}
              onSearch={setSearch}
              search={search}
              title="신고 처리 큐"
            >
              {reportItems.map((item) => (
                <ReportCard
                  key={item.id}
                  busy={reportMutation.isPending}
                  item={item}
                  onAction={(kind) =>
                    setPendingAction({ id: item.id, kind, name: item.reported_display_name })
                  }
                  showHide={isMaster}
                />
              ))}
            </QueuePanel>
          ) : section === 'activity' ? (
            <ActivityPanel activity={activityQuery.data ?? []} />
          ) : (
            <TeamPanel
              busy={operatorMutation.isPending}
              members={teamQuery.data ?? []}
              onSetAccess={(email, active) => operatorMutation.mutate({ active, email })}
            />
          )}
        </KeyboardAwareScrollView>
      )}

      <ActionDialog
        key={pendingAction ? `${pendingAction.kind}-${pendingAction.id}` : 'closed'}
        action={pendingAction}
        busy={isBusy}
        onClose={() => setPendingAction(null)}
        onSubmit={submitPendingAction}
      />
    </Screen>
  );
}

function Tab({
  active,
  count,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  count?: number;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label}${count ? `, 대기 ${count}건` : ''}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        active && styles.tabActive,
        pressed && pressFeedback.control,
      ]}
    >
      <View style={[styles.tabIcon, active && styles.tabIconActive]}>
        <Ionicons color={active ? palette.ink : palette.inkMuted} name={icon} size={15} />
      </View>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      {count ? (
        <View style={[styles.tabCount, active && styles.tabCountActive]}>
          <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

type Overview = Awaited<ReturnType<typeof operationsService.getOverview>>;
type ModerationActivity = Awaited<
  ReturnType<typeof operationsService.getModerationActivity>
>[number];

function OverviewPanel({
  data,
  onOpen,
  recentActivity,
  showActivity,
}: {
  data: Overview | undefined;
  onOpen: (section: Section) => void;
  recentActivity: ModerationActivity[];
  showActivity: boolean;
}) {
  const total = (data?.pending_profiles ?? 0) + (data?.pending_reports ?? 0);
  return (
    <>
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroStatus}>
            <View style={[styles.heroStatusDot, total === 0 && styles.heroStatusDotClear]} />
            <Text style={styles.heroEyebrow}>LIVE QUEUE</Text>
          </View>
          <View style={styles.heroTotal}>
            <Text style={styles.heroTotalValue}>{total}</Text>
            <Text style={styles.heroTotalLabel}>대기</Text>
          </View>
        </View>
        <View style={styles.heroBottomRow}>
          <View style={styles.heroIcon}>
            <Ionicons color={palette.ink} name={total ? 'pulse' : 'checkmark'} size={22} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>
              {total ? `지금 ${total}건을 확인해야 해요` : '모든 큐가 비어 있어요'}
            </Text>
            <Text style={styles.heroBody}>긴급 신고와 24시간 초과 건이 먼저 보입니다.</Text>
          </View>
        </View>
      </View>
      <View style={styles.metricsGrid}>
        <MetricCard
          color="#FFF0F5"
          icon="images-outline"
          label="프로필 심사"
          onPress={() => onOpen('profiles')}
          value={data?.pending_profiles ?? 0}
        />
        <MetricCard
          color="#FFF4E5"
          icon="flag-outline"
          label="신고"
          onPress={() => onOpen('reports')}
          value={data?.pending_reports ?? 0}
        />
        <MetricCard
          color="#F1F2F5"
          icon="time-outline"
          label="24시간 초과"
          onPress={() => onOpen('reports')}
          value={data?.overdue_items ?? 0}
        />
      </View>
      <View style={styles.summaryStrip}>
        <SummaryStat danger label="긴급 신고" value={data?.urgent_reports ?? 0} />
        <View style={styles.summaryDivider} />
        <SummaryStat label="오늘 처리" value={data?.resolved_today ?? 0} />
      </View>
      {showActivity ? (
        <View style={styles.block}>
          <View style={styles.blockHeader}>
            <Text style={styles.sectionTitle}>최근 운영 기록</Text>
            <Pressable accessibilityRole="button" onPress={() => onOpen('activity')}>
              <Text style={styles.linkText}>전체 보기</Text>
            </Pressable>
          </View>
          <ActivityRows activity={recentActivity} compact />
        </View>
      ) : null}
    </>
  );
}

function MetricCard({
  color,
  icon,
  label,
  onPress,
  value,
}: {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  value: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.metricCard,
        { backgroundColor: color },
        pressed && pressFeedback.surface,
      ]}
    >
      <View style={styles.metricTop}>
        <Ionicons color={palette.ink} name={icon} size={19} />
        <Ionicons color={palette.inkMuted} name="chevron-forward" size={16} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </Pressable>
  );
}

function SummaryStat({
  danger = false,
  label,
  value,
}: {
  danger?: boolean;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.summaryStat}>
      <Text style={[styles.summaryValue, danger && styles.dangerText]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function QueuePanel({
  children,
  count,
  filter,
  onFilter,
  onSearch,
  search,
  title,
}: {
  children: React.ReactNode;
  count: number;
  filter: QueueFilter;
  onFilter: (value: QueueFilter) => void;
  onSearch: (value: string) => void;
  search: string;
  title: string;
}) {
  return (
    <>
      <View style={styles.queueToolbar}>
        <View style={styles.queueHeader}>
          <View>
            <Text style={styles.queueEyebrow}>WORK QUEUE</Text>
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
          <View style={styles.queueTotalBadge}>
            <Text style={styles.queueTotalValue}>{count}</Text>
            <Text style={styles.queueTotalLabel}>건</Text>
          </View>
        </View>
        <Text style={styles.queueCount}>검색과 우선순위 필터로 처리 대상을 좁혀보세요.</Text>
        <View style={styles.searchBox}>
          <Ionicons color={palette.inkMuted} name="search" size={18} />
          <TextInput
            autoCapitalize="none"
            onChangeText={onSearch}
            placeholder="이름, 국가, 사유 검색"
            placeholderTextColor="#96969E"
            style={styles.searchInput}
            value={search}
          />
          {search ? (
            <Pressable
              accessibilityLabel="검색어 지우기"
              accessibilityRole="button"
              onPress={() => onSearch('')}
            >
              <Ionicons color={palette.inkMuted} name="close-circle" size={18} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView
          contentContainerStyle={styles.filters}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <FilterChip active={filter === 'all'} label="전체" onPress={() => onFilter('all')} />
          <FilterChip
            active={filter === 'urgent'}
            label="긴급"
            onPress={() => onFilter('urgent')}
          />
          <FilterChip
            active={filter === 'overdue'}
            label="24시간 초과"
            onPress={() => onFilter('overdue')}
          />
          <FilterChip
            active={filter === 'normal'}
            label="일반"
            onPress={() => onFilter('normal')}
          />
        </ScrollView>
      </View>
      {count ? children : <InlineEmpty />}
    </>
  );
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </Pressable>
  );
}

function InlineEmpty() {
  return (
    <View style={styles.inlineEmpty}>
      <Ionicons color={palette.inkMuted} name="checkmark-circle-outline" size={30} />
      <Text style={styles.inlineEmptyTitle}>조건에 맞는 항목이 없어요</Text>
      <Text style={styles.inlineEmptyBody}>검색어나 필터를 바꾸거나 새 요청을 기다려 주세요.</Text>
    </View>
  );
}

type ProfileReview = Awaited<ReturnType<typeof operationsService.getProfileReviews>>[number];

function ReviewCard({
  busy,
  item,
  onApprove,
  onReject,
}: {
  busy: boolean;
  item: ProfileReview;
  onApprove: () => void;
  onReject: () => void;
}) {
  const submittedAt = item.submitted_at ?? new Date().toISOString();
  const priority = getQueuePriority(submittedAt);
  return (
    <View style={styles.card}>
      <QueueBadge priority={priority} timestamp={submittedAt} />
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
        <Text numberOfLines={3} style={styles.body}>
          {item.bio || '소개 없음'}
        </Text>
        <Text style={styles.photoCount}>신규·변경 사진 {item.photo_paths.length}장</Text>
        <View style={styles.actions}>
          <Action disabled={busy} label="사유 입력 후 반려" onPress={onReject} />
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
        transition={imageTransition.thumbnail}
      />
      <Text style={styles.reviewPhotoIndex}>{index + 1}</Text>
    </View>
  ) : (
    <PhotoPlaceholder icon="person" />
  );
}

type PendingReport = Awaited<ReturnType<typeof operationsService.getPendingReports>>[number];

function ReportCard({
  busy,
  item,
  onAction,
  showHide,
}: {
  busy: boolean;
  item: PendingReport;
  onAction: (kind: 'report-close' | 'report-review' | 'report-hide') => void;
  showHide: boolean;
}) {
  const photo = useSignedPhoto(item.reported_photo_path);
  const priority = getReportPriority(item.reasons, item.created_at);
  return (
    <View style={styles.card}>
      <QueueBadge priority={priority} timestamp={item.created_at} />
      <View style={styles.subjectRow}>
        {photo.data ? (
          <Image
            cachePolicy="memory-disk"
            contentFit="cover"
            source={{ uri: photo.data }}
            style={styles.avatar}
            transition={imageTransition.thumbnail}
          />
        ) : (
          <PhotoPlaceholder avatar icon="flag" />
        )}
        <View style={styles.subjectCopy}>
          <Text style={styles.cardTitle}>{item.reported_display_name}</Text>
          <Text style={styles.contextBadge}>
            {item.report_context === 'chat' ? '채팅 신고' : '프로필 신고'}
          </Text>
        </View>
      </View>
      <View style={styles.reasonWrap}>
        {item.reasons.map((reason) => (
          <Text
            key={reason}
            style={[styles.reason, ['underage', 'scam'].includes(reason) && styles.reasonUrgent]}
          >
            {getReportReasonLabel(reason)}
          </Text>
        ))}
      </View>
      <Text numberOfLines={5} style={styles.body}>
        {item.details || '상세 내용 없음'}
      </Text>
      <View style={styles.actions}>
        <Action disabled={busy} label="문제 없음" onPress={() => onAction('report-close')} />
        <Action
          primary
          disabled={busy}
          label="검토 완료"
          onPress={() => onAction('report-review')}
        />
      </View>
      {showHide ? (
        <DangerAction
          disabled={busy}
          label="프로필 노출 중지"
          onPress={() => onAction('report-hide')}
        />
      ) : null}
    </View>
  );
}

function QueueBadge({
  priority,
  timestamp,
  urgentLabel = '긴급',
}: {
  priority: QueuePriority;
  timestamp: string;
  urgentLabel?: string;
}) {
  return (
    <View style={styles.queueBadgeRow}>
      <View
        style={[
          styles.priorityBadge,
          priority === 'urgent' && styles.priorityUrgent,
          priority === 'overdue' && styles.priorityOverdue,
        ]}
      >
        <Text style={[styles.priorityText, priority !== 'normal' && styles.priorityTextEmphasis]}>
          {priority === 'urgent' ? urgentLabel : priority === 'overdue' ? 'SLA 초과' : '일반'}
        </Text>
      </View>
      <Text style={styles.waitTime}>{getQueueAgeLabel(timestamp)}</Text>
    </View>
  );
}

function PhotoPlaceholder({
  avatar = false,
  icon,
}: {
  avatar?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[avatar ? styles.avatar : styles.photo, styles.photoEmpty]}>
      <Ionicons color={palette.inkMuted} name={icon} size={avatar ? 24 : 32} />
    </View>
  );
}

type AdminTeamMember = Awaited<ReturnType<typeof operationsService.getAdminTeam>>[number];

function TeamPanel({
  busy,
  members,
  onSetAccess,
}: {
  busy: boolean;
  members: AdminTeamMember[];
  onSetAccess: (email: string, active: boolean) => void;
}) {
  const [email, setEmail] = useState('');
  const normalizedEmail = email.trim().toLowerCase();
  const canSubmit = normalizedEmail.includes('@') && !busy;
  return (
    <>
      <View style={styles.block}>
        <Text style={styles.sectionTitle}>운영자 권한 관리</Text>
        <Text style={styles.sectionBody}>
          운영자는 심사·신고·안전 신호를 처리하고, 마스터만 권한 변경과 프로필 노출 중지를
          실행합니다.
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
            disabled={!canSubmit}
            onPress={() => {
              onSetAccess(normalizedEmail, true);
              setEmail('');
            }}
            style={[styles.operatorSubmit, !canSubmit && styles.disabled]}
          >
            <Text style={styles.operatorSubmitText}>운영자 지정</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.sectionTitle}>현재 운영팀 · {members.length}명</Text>
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
                style={[styles.teamToggle, member.active && styles.teamToggleDanger]}
              >
                <Text style={[styles.teamToggleText, member.active && styles.teamToggleDangerText]}>
                  {member.active ? '권한 중지' : '활성화'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
    </>
  );
}

function ActivityPanel({ activity }: { activity: ModerationActivity[] }) {
  return (
    <>
      <View style={styles.queueHeader}>
        <View>
          <Text style={styles.sectionTitle}>감사 로그</Text>
          <Text style={styles.queueCount}>최근 특권 작업 {activity.length}건</Text>
        </View>
      </View>
      <ActivityRows activity={activity} />
    </>
  );
}

function ActivityRows({
  activity,
  compact = false,
}: {
  activity: ModerationActivity[];
  compact?: boolean;
}) {
  if (!activity.length)
    return <Text style={styles.emptyInline}>기록된 운영 작업이 아직 없어요.</Text>;
  return (
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
            {compact ? null : (
              <Text style={styles.time}>{formatDateTime('ko-KR', new Date(item.created_at))}</Text>
            )}
          </View>
          <Text style={styles.activityTime}>
            {compact ? getQueueAgeLabel(item.created_at) : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ActionDialog({
  action,
  busy,
  onClose,
  onSubmit,
}: {
  action: PendingAction | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  if (!action) return null;
  const isHide = action.kind.endsWith('-hide');
  const requiresNote = action.kind === 'profile-reject' || isHide;
  const presets = getActionPresets(action.kind);
  const canSubmit = !busy && (!requiresNote || note.trim().length >= 3);
  return (
    <AppModal animationType="fade" onRequestClose={onClose} transparent visible>
      <View accessibilityViewIsModal style={styles.modalLayer}>
        <Pressable
          accessibilityLabel="닫기"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <KeyboardAwareScrollView
          contentContainerStyle={styles.dialogScrollContent}
          keyboardFocusOffset={20}
          showsVerticalScrollIndicator={false}
          style={styles.dialogScroll}
        >
          <View style={styles.dialog}>
            <View style={styles.dialogHeader}>
              <View style={[styles.dialogIcon, isHide && styles.dialogIconDanger]}>
                <Ionicons
                  color={isHide ? '#B3263F' : palette.ink}
                  name={isHide ? 'eye-off-outline' : 'create-outline'}
                  size={21}
                />
              </View>
              <Pressable accessibilityLabel="닫기" accessibilityRole="button" onPress={onClose}>
                <Ionicons color={palette.inkMuted} name="close" size={23} />
              </Pressable>
            </View>
            <Text style={styles.dialogTitle}>{getActionTitle(action)}</Text>
            <Text style={styles.dialogBody}>
              {isHide
                ? `${action.name}의 프로필이 즉시 비활성화되고 감사 로그에 남습니다.`
                : '판단 근거를 남기면 이후 이의 제기와 운영 품질 검토에 도움이 됩니다.'}
            </Text>
            <View style={styles.presetWrap}>
              {presets.map((preset) => (
                <Pressable
                  key={preset}
                  accessibilityRole="button"
                  onPress={() => setNote(preset)}
                  style={styles.preset}
                >
                  <Text style={styles.presetText}>{preset}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              maxLength={1000}
              multiline
              onChangeText={setNote}
              placeholder={requiresNote ? '조치 사유를 입력해 주세요 (필수)' : '운영 메모 (선택)'}
              placeholderTextColor="#96969E"
              style={styles.noteInput}
              textAlignVertical="top"
              value={note}
            />
            <Text style={styles.noteCount}>{note.length}/1000</Text>
            <View style={styles.dialogActions}>
              <Action disabled={busy} label="취소" onPress={onClose} />
              <Action
                danger={isHide}
                disabled={!canSubmit}
                label={isHide ? '노출 중지' : '처리 확정'}
                onPress={() => onSubmit(note.trim())}
                primary
              />
            </View>
          </View>
        </KeyboardAwareScrollView>
      </View>
    </AppModal>
  );
}

function Action({
  danger = false,
  disabled,
  label,
  onPress,
  primary = false,
}: {
  danger?: boolean;
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
        danger && styles.actionDanger,
        disabled && styles.disabled,
        pressed && !disabled && pressFeedback.control,
      ]}
    >
      <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

function DangerAction({
  disabled,
  label,
  onPress,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.hideAction,
        disabled && styles.disabled,
        pressed && pressFeedback.control,
      ]}
    >
      <Ionicons color="#B3263F" name="eye-off-outline" size={18} />
      <Text style={styles.hideActionText}>{label}</Text>
    </Pressable>
  );
}

function getActionTitle(action: PendingAction) {
  if (action.kind === 'profile-reject') return `${action.name} 프로필을 반려할까요?`;
  if (action.kind.endsWith('-hide')) return `${action.name} 프로필 노출을 중지할까요?`;
  if (action.kind.endsWith('-close')) return '문제없음으로 종결할까요?';
  return '검토 완료로 처리할까요?';
}

function getActionPresets(kind: PendingAction['kind']) {
  if (kind === 'profile-reject') {
    return [
      '얼굴 식별이 어려워요',
      '타인·저작물 사진이 포함됐어요',
      '부적절한 콘텐츠가 포함됐어요',
    ];
  }
  if (kind.endsWith('-hide')) {
    return ['반복 신고와 증거를 확인했어요', '안전 정책 위반이 확인됐어요'];
  }
  return ['신고 내용을 확인했어요', '현재 정책 위반을 확인하지 못했어요'];
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
      safety_closed: '안전 신호 종결',
      safety_reviewed: '안전 신호 검토 완료',
    }[action] ?? action
  );
}

const styles = StyleSheet.create({
  screen: { alignSelf: 'center', maxWidth: layout.maxContentWidth, width: '100%' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 82,
    paddingHorizontal: layout.compactGutter,
  },
  iconButton: {
    alignItems: 'center',
    height: layout.minTouchTarget,
    justifyContent: 'center',
    width: layout.minTouchTarget,
  },
  headerCopy: { flex: 1, marginLeft: 4 },
  eyebrow: { ...typography.overline, color: palette.pink },
  title: { ...typography.title, color: palette.ink, marginTop: 2 },
  headerMeta: { alignItems: 'flex-end', gap: 5 },
  roleLabel: { ...typography.overline, color: palette.inkMuted, letterSpacing: 1 },
  countPill: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minWidth: 37,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  countPillActive: { backgroundColor: palette.pink },
  countText: { color: palette.white, fontSize: 12, fontWeight: '900' },
  countLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 11, fontWeight: '800' },
  tabRail: {
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabs: { gap: 8, paddingHorizontal: layout.compactGutter, paddingVertical: 10 },
  tab: {
    alignItems: 'center',
    backgroundColor: '#F0F0F3',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: 11,
  },
  tabActive: { backgroundColor: palette.ink },
  tabIcon: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 13,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  tabIconActive: { backgroundColor: palette.lime },
  tabText: { ...typography.label, color: palette.inkMuted, fontWeight: '800' },
  tabTextActive: { color: palette.white },
  tabCount: {
    alignItems: 'center',
    backgroundColor: '#DCDCE2',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minWidth: 21,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  tabCountActive: { backgroundColor: palette.pink },
  tabCountText: { color: palette.inkMuted, fontSize: 10, fontWeight: '900' },
  tabCountTextActive: { color: palette.white },
  scroll: { flex: 1, minHeight: 0 },
  content: {
    gap: layout.compactGutter,
    paddingBottom: layout.scrollEndPadding + 12,
    paddingHorizontal: layout.compactGutter,
    paddingTop: layout.compactGutter,
  },
  loadingContent: {
    gap: 12,
    paddingHorizontal: layout.compactGutter,
    paddingTop: layout.compactGutter,
  },
  heroCard: {
    ...elevation.md,
    backgroundColor: palette.ink,
    borderRadius: 24,
    padding: 18,
  },
  heroTopRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  heroStatus: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  heroStatusDot: { backgroundColor: palette.pink, borderRadius: 4, height: 8, width: 8 },
  heroStatusDotClear: { backgroundColor: palette.lime },
  heroTotal: { alignItems: 'baseline', flexDirection: 'row', gap: 4 },
  heroTotalValue: { color: palette.white, fontSize: 24, fontWeight: '900', letterSpacing: -0.8 },
  heroTotalLabel: { color: '#9999A2', fontSize: 10, fontWeight: '800' },
  heroBottomRow: { alignItems: 'center', flexDirection: 'row', marginTop: 18 },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: palette.lime,
    borderRadius: 18,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  heroCopy: { flex: 1, marginLeft: 13 },
  heroEyebrow: { color: palette.lime, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: {
    color: palette.white,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 4,
  },
  heroBody: { color: '#C5C5CC', fontSize: 12, lineHeight: 17, marginTop: 4 },
  metricsGrid: { flexDirection: 'row', gap: 8 },
  metricCard: { borderRadius: 20, flex: 1, minHeight: 122, minWidth: 0, padding: 13 },
  metricTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  metricValue: {
    color: palette.ink,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: 14,
  },
  metricLabel: { color: palette.inkMuted, fontSize: 11, fontWeight: '800', marginTop: 1 },
  summaryStrip: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 20,
    flexDirection: 'row',
    paddingVertical: 15,
  },
  summaryStat: { alignItems: 'center', flex: 1 },
  summaryValue: { color: palette.ink, fontSize: 20, fontWeight: '900' },
  summaryLabel: { color: palette.inkMuted, fontSize: 11, fontWeight: '700', marginTop: 3 },
  summaryDivider: { backgroundColor: palette.line, height: 32, width: StyleSheet.hairlineWidth },
  dangerText: { color: '#B3263F' },
  block: { backgroundColor: palette.white, borderRadius: 22, padding: 16 },
  blockHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: { color: palette.ink, fontSize: 15, fontWeight: '900', letterSpacing: -0.3 },
  sectionBody: { ...typography.caption, color: palette.inkMuted, marginTop: 6 },
  linkText: { ...typography.label, color: palette.pink, fontWeight: '900' },
  queueToolbar: {
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    padding: layout.cardPadding,
  },
  queueHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  queueEyebrow: {
    color: palette.pink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  queueTotalBadge: {
    alignItems: 'baseline',
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  queueTotalValue: { color: palette.white, fontSize: 14, fontWeight: '900' },
  queueTotalLabel: { color: '#AFAFB7', fontSize: 10, fontWeight: '800' },
  queueCount: { ...typography.caption, color: palette.inkMuted, marginTop: 3 },
  searchBox: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#E5E5E8',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 48,
    paddingHorizontal: 13,
  },
  searchInput: {
    color: palette.ink,
    flex: 1,
    fontSize: 14,
    marginHorizontal: 9,
    paddingVertical: 10,
  },
  filters: { gap: 7 },
  filterChip: {
    alignItems: 'center',
    backgroundColor: '#E7E7EA',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: layout.minTouchTarget,
    paddingHorizontal: 12,
  },
  filterChipActive: { backgroundColor: palette.ink },
  filterText: { ...typography.label, color: palette.inkMuted, fontWeight: '800' },
  filterTextActive: { color: palette.white },
  inlineEmpty: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 22,
    padding: 28,
  },
  inlineEmptyTitle: { color: palette.ink, fontSize: 13, fontWeight: '900', marginTop: 9 },
  inlineEmptyBody: {
    ...typography.caption,
    color: palette.inkMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    ...elevation.sm,
    backgroundColor: palette.white,
    borderRadius: 22,
    overflow: 'hidden',
    padding: layout.cardPadding,
  },
  queueBadgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  priorityBadge: {
    backgroundColor: '#EFEFF2',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  priorityUrgent: { backgroundColor: '#FFE3E7' },
  priorityOverdue: { backgroundColor: '#FFF0D7' },
  priorityText: { color: palette.inkMuted, fontSize: 10, fontWeight: '900' },
  priorityTextEmphasis: { color: '#A63628' },
  waitTime: { color: '#A0A0A7', fontSize: 10, fontWeight: '700' },
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
  subjectRow: { alignItems: 'center', flexDirection: 'row' },
  avatar: { backgroundColor: '#E5E5E8', borderRadius: 17, height: 58, width: 58 },
  subjectCopy: { flex: 1, marginLeft: 11 },
  cardCopy: { marginTop: 13, minWidth: 0 },
  cardTitle: { color: palette.ink, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  meta: { ...typography.caption, color: palette.inkMuted, fontWeight: '700', marginTop: 4 },
  contextBadge: {
    ...typography.caption,
    color: palette.inkMuted,
    fontWeight: '800',
    marginTop: 4,
  },
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 11 },
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
  reasonUrgent: { backgroundColor: '#FFE0D9', color: '#A63628' },
  body: { ...typography.bodySm, color: palette.inkMuted, marginTop: 8 },
  time: { color: '#A0A0A7', fontSize: 10, marginTop: 5 },
  photoCount: { color: palette.pink, fontSize: 11, fontWeight: '900', marginTop: 6 },
  actions: { flexDirection: 'row', gap: 7, marginTop: 11 },
  action: {
    alignItems: 'center',
    borderColor: palette.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: layout.minTouchTarget,
    paddingHorizontal: 10,
  },
  actionPrimary: { backgroundColor: palette.ink, borderColor: palette.ink },
  actionDanger: { backgroundColor: '#B3263F', borderColor: '#B3263F' },
  actionText: { ...typography.label, color: palette.ink, fontWeight: '900' },
  actionTextPrimary: { color: palette.white },
  hideAction: {
    alignItems: 'center',
    backgroundColor: '#FFF1F3',
    borderRadius: radius.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: layout.minTouchTarget,
  },
  hideActionText: { color: '#B3263F', fontSize: 11, fontWeight: '900', marginLeft: 7 },
  operatorForm: { flexDirection: 'row', gap: 7, marginTop: 13 },
  operatorInput: {
    backgroundColor: '#F3F3F5',
    borderColor: '#E4E4E8',
    borderRadius: 14,
    borderWidth: 1,
    color: palette.ink,
    flex: 1,
    fontSize: 12,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: 12,
  },
  operatorSubmit: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: layout.minTouchTarget,
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
    justifyContent: 'center',
    minHeight: layout.minTouchTarget,
    paddingHorizontal: 10,
  },
  teamToggleDanger: { backgroundColor: '#FFF1F3' },
  teamToggleText: { color: '#197143', fontSize: 11, fontWeight: '900' },
  teamToggleDangerText: { color: '#B3263F' },
  activityList: { backgroundColor: palette.white, borderRadius: 18, overflow: 'hidden' },
  activityRow: {
    alignItems: 'flex-start',
    borderBottomColor: '#ECECEF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 64,
    padding: 12,
  },
  activityDot: {
    backgroundColor: palette.pink,
    borderRadius: 5,
    height: 9,
    marginTop: 5,
    width: 9,
  },
  activityAction: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  activityTime: { color: palette.inkMuted, fontSize: 10, marginTop: 3 },
  emptyInline: {
    backgroundColor: palette.white,
    borderRadius: 18,
    color: palette.inkMuted,
    fontSize: 11,
    padding: 16,
  },
  modalLayer: {
    backgroundColor: 'rgba(12,12,16,0.52)',
    flex: 1,
  },
  dialogScroll: { flex: 1 },
  dialogScrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  dialog: {
    ...elevation.lg,
    backgroundColor: palette.white,
    borderRadius: 26,
    maxWidth: 480,
    padding: 19,
    width: '100%',
  },
  dialogHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  dialogIcon: {
    alignItems: 'center',
    backgroundColor: '#EFEFF2',
    borderRadius: 15,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  dialogIconDanger: { backgroundColor: '#FFF1F3' },
  dialogTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 14,
  },
  dialogBody: { ...typography.caption, color: palette.inkMuted, marginTop: 6 },
  presetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 13 },
  preset: {
    alignItems: 'center',
    backgroundColor: '#EFEFF2',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 10,
  },
  presetText: { color: palette.ink, fontSize: 11, fontWeight: '800' },
  noteInput: {
    backgroundColor: '#F5F5F7',
    borderColor: palette.line,
    borderRadius: 16,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 11,
    minHeight: 104,
    padding: 12,
  },
  noteCount: { color: palette.inkMuted, fontSize: 10, marginTop: 4, textAlign: 'right' },
  dialogActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  disabled: { opacity: 0.45 },
});
