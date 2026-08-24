import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { IllustratedIcon } from '@/components/IllustratedIcon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import {
  ChatRowsSkeleton,
  ConnectionGridSkeleton,
  ListRowsSkeleton,
  Skeleton,
  SkeletonLine,
} from '@/components/Skeleton';
import { GoldBadge } from '@/components/GoldBadge';
import { StateView } from '@/components/StateView';
import { SwipeDeck } from '@/features/discover/components/SwipeDeck';
import { MatchCelebration } from '@/features/discover/components/MatchCelebration';
import { mockProfiles } from '@/features/discover/data/mock-profiles';
import { MatchesScreen } from '@/features/matches/screens/MatchesScreen';
import { ProductTutorialScreen } from '@/features/onboarding/screens/ProductTutorialScreen';
import { useAppTheme } from '@/components/ThemeProvider';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { elevation, layout, radius, spacing, typography } from '@/constants/theme';

/**
 * 개발 전용 디자인 QA 화면.
 *
 * 공유 프리미티브 대부분은 로그인 뒤 화면에서만 쓰여서 웹 프리뷰로 확인할 수 없다.
 * 이 화면은 인증 밖에서 같은 컴포넌트를 한 번에 렌더해 실제 렌더 결과를 점검하게 한다.
 * 제품 화면이 아니며 프로덕션 빌드에서는 접근되지 않는다.
 */
export default function DesignQaScreen() {
  const theme = useAppTheme();
  const [qaProfiles, setQaProfiles] = useState(mockProfiles);
  const [matchPreviewOpen, setMatchPreviewOpen] = useState(false);

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <Screen edges={['top', 'left', 'right']} padded={false} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="Typography">
          {(Object.keys(typography) as (keyof typeof typography)[]).map((token) => (
            <Text key={token} style={[typography[token], { color: theme.colors.text }]}>
              {token} · 당신의 타입은 누구?
            </Text>
          ))}
        </Section>

        <Section title="Elevation">
          <View style={styles.row}>
            {(['sm', 'md', 'lg'] as const).map((level) => (
              <View
                key={level}
                style={[
                  styles.elevationTile,
                  { backgroundColor: theme.colors.surface },
                  elevation[level],
                ]}
              >
                <Text style={[typography.label, { color: theme.colors.text }]}>{level}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Buttons">
          <PrimaryButton label="Primary" onPress={() => {}} />
          <PrimaryButton label="Secondary" onPress={() => {}} variant="secondary" />
          <PrimaryButton label="Outline" onPress={() => {}} variant="outline" />
          <PrimaryButton label="Ghost" onPress={() => {}} variant="ghost" />
          <PrimaryButton label="Danger" onPress={() => {}} variant="danger" />
          <PrimaryButton icon="heart" label="With icon" onPress={() => {}} />
          <PrimaryButton label="Small" onPress={() => {}} size="sm" />
          <PrimaryButton label="Loading" loading onPress={() => {}} />
          <PrimaryButton disabled label="Disabled" onPress={() => {}} />
        </Section>

        <Section title="Soft illustration icons">
          <View style={styles.iconRow}>
            {(
              [
                ['프로필 수정', illustratedIcons.profileEdit],
                ['탐색 설정', illustratedIcons.discoverySettings],
                ['연결 관리', illustratedIcons.connections],
                ['설정', illustratedIcons.settings],
                ['Gold Pass', illustratedIcons.goldPremium],
                ['연결 오류', illustratedIcons.connectionError],
                ['발견 노출', illustratedIcons.discoveryVisible],
                ['사진 심사', illustratedIcons.photoReview],
                ['사진 반려', illustratedIcons.photoRejected],
                ['이용권', illustratedIcons.goldPass],
                ['검색 없음', illustratedIcons.searchEmpty],
                ['번역', illustratedIcons.translation],
                ['안전', illustratedIcons.safety],
                ['알림', illustratedIcons.notification],
                ['사진 관리', illustratedIcons.profilePhotos],
                ['위치', illustratedIcons.location],
                ['광고 제거', illustratedIcons.adFree],
                ['되돌리기', illustratedIcons.rewind],
              ] as const
            ).map(([label, source]) => (
              <View
                key={label}
                style={[styles.iconTile, { backgroundColor: theme.colors.surface }]}
              >
                <IllustratedIcon size={58} source={source} />
                <Text style={[typography.caption, { color: theme.colors.text }]}>{label}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="GoldBadge">
          <View style={[styles.row, styles.goldBed]}>
            <GoldBadge />
            <GoldBadge label="GOLD PASS" size="md" />
          </View>
        </Section>

        <Section title="StateView">
          <StateView
            actionLabel="다시 시도"
            body="저장된 연결은 그대로예요. 잠시 후 다시 확인해주세요."
            illustration={illustratedIcons.connectionError}
            onAction={() => {}}
            secondaryActionLabel="문의"
            onSecondaryAction={() => {}}
            title="연결을 불러오지 못했어요"
            tone="error"
          />
          <StateView
            actionLabel="발견하러 가기"
            body="새로운 Pick을 받으면 여기에 표시됩니다."
            container="plain"
            illustration={illustratedIcons.connections}
            onAction={() => {}}
            title="아직 새로운 연결이 없어요"
          />
        </Section>

        {/* Discover 덱도 인증 뒤라 열 수 없다. 스와이프 전환과 레이아웃을 여기서 확인한다. */}
        <Section title="Discover deck">
          <View style={styles.deckFrame}>
            <SwipeDeck
              error={null}
              isLoading={false}
              onAdjustFilters={() => {}}
              onRetry={() => setQaProfiles(mockProfiles)}
              onSwipe={() =>
                setQaProfiles((current) =>
                  current.length > 1 ? [...current.slice(1), current[0]] : current,
                )
              }
              profiles={qaProfiles}
            />
          </View>
        </Section>

        <Section title="Match moment">
          <PrimaryButton label="매치 이펙트 보기" onPress={() => setMatchPreviewOpen(true)} />
          <MatchCelebration
            onChat={() => setMatchPreviewOpen(false)}
            onContinue={() => setMatchPreviewOpen(false)}
            profile={matchPreviewOpen ? mockProfiles[0] : null}
          />
        </Section>

        <Section title="Matches screen">
          <View style={styles.matchesFrame}>
            <MatchesScreen />
          </View>
        </Section>

        {/* 튜토리얼은 인증 뒤에 있어 평소 웹 프리뷰로 열 수 없다. 여기서 실제 렌더를 확인한다. */}
        <Section title="Tutorial (onboarding)">
          <View style={styles.tutorialFrame}>
            <ProductTutorialScreen />
          </View>
        </Section>

        <Section title="Skeleton">
          <SkeletonLine height={24} width="60%" />
          <Skeleton style={styles.skeletonCard} />
          <ChatRowsSkeleton count={2} />
          <ConnectionGridSkeleton count={2} />
          <ListRowsSkeleton count={2} />
        </Section>
      </ScrollView>
    </Screen>
  );
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.section}>
      <Text style={[typography.overline, styles.sectionTitle, { color: theme.colors.textMuted }]}>
        {title}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { alignSelf: 'center', maxWidth: layout.maxContentWidth, width: '100%' },
  content: { paddingBottom: spacing.xxl, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  section: { marginBottom: spacing.xl },
  sectionTitle: { marginBottom: spacing.xs },
  sectionBody: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  iconTile: {
    alignItems: 'center',
    borderRadius: radius.md,
    gap: spacing.xxs,
    justifyContent: 'center',
    minHeight: 104,
    padding: spacing.xs,
    width: '30%',
  },
  elevationTile: {
    alignItems: 'center',
    borderRadius: radius.md,
    height: 72,
    justifyContent: 'center',
    width: 96,
  },
  skeletonCard: { borderRadius: radius.lg, height: 120 },
  goldBed: {
    alignItems: 'center',
    backgroundColor: '#2A2A30',
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  deckFrame: { height: 620 },
  matchesFrame: { borderRadius: radius.lg, height: 760, overflow: 'hidden' },
  tutorialFrame: { borderRadius: radius.lg, height: 780, overflow: 'hidden' },
});
