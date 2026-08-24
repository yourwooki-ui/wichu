import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandWordmark } from '@/components/BrandWordmark';
import {
  layout,
  palette,
  pressFeedback,
  radius,
  spacing,
  touchSlop,
  typography,
} from '@/constants/theme';

const SUPPORT_EMAIL = 'support@wichu.app';

/**
 * 계정·데이터 삭제 안내 (공개 페이지).
 *
 * Google Play는 계정 생성이 가능한 앱에 대해 앱을 설치하지 않고도 접근할 수 있는
 * 웹 URL로 삭제 요청 경로를 제공하도록 요구한다. 그래서 이 라우트는 인증 밖에 둔다.
 * Play Console의 데이터 안전 섹션에 이 페이지 주소를 등록한다.
 *
 * 여기 적힌 삭제 범위는 `docs/DATABASE.md`의 실제 삭제 worker 동작과 일치해야 한다.
 */
const DELETED_ITEMS = [
  '계정과 로그인 정보',
  '프로필 정보 (이름, 생년월일, 성별, 국적, 소개, 관심사)',
  '업로드한 모든 사진',
  '주고받은 메시지와 매치 기록',
  '탐색 조건과 알림 설정',
  '등록된 푸시 알림 기기 정보',
];

export default function AccountDeletionRoute() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <BrandWordmark color={palette.ink} size={24} />
          <Text style={styles.eyebrow}>ACCOUNT & DATA DELETION</Text>
        </View>

        <Text style={styles.title}>계정과 데이터를 삭제할 수 있어요</Text>
        <Text style={styles.lede}>
          WICHU 계정을 삭제하면 프로필과 사진, 대화 내용이 서비스에서 제거됩니다. 아래 두 가지 방법
          중 편한 쪽을 이용하세요.
        </Text>

        <Section index="1" title="앱에서 삭제하기">
          <Text style={styles.body}>
            WICHU 앱에서 <Text style={styles.strong}>마이 → 설정 → 계정 삭제</Text>를 차례로
            선택하세요. 확인하면 프로필이 즉시 비공개로 전환되고 삭제가 시작됩니다.
          </Text>
        </Section>

        <Section index="2" title="이메일로 요청하기">
          <Text style={styles.body}>
            앱을 이미 삭제했거나 로그인할 수 없다면 가입에 사용한 이메일 주소로 아래 주소에 삭제를
            요청해 주세요. 본인 확인 후 처리해 드립니다.
          </Text>
          <Pressable
            accessibilityLabel={`${SUPPORT_EMAIL}로 삭제 요청 메일 보내기`}
            accessibilityRole="link"
            hitSlop={touchSlop.link}
            onPress={() =>
              Linking.openURL(
                `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('WICHU 계정 삭제 요청')}`,
              )
            }
            style={({ pressed }) => [styles.mailButton, pressed && pressFeedback.control]}
          >
            <Ionicons color={palette.white} name="mail-outline" size={17} />
            <Text style={styles.mailButtonText}>{SUPPORT_EMAIL}</Text>
          </Pressable>
        </Section>

        <Section index="3" title="삭제되는 데이터">
          {DELETED_ITEMS.map((item) => (
            <View key={item} style={styles.listRow}>
              <Ionicons color={palette.pink} name="checkmark-circle" size={16} />
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}
        </Section>

        <Section index="4" title="보존되는 정보">
          <Text style={styles.body}>
            삭제가 끝나면 계정을 특정할 수 없는 처리 기록(요청·완료 시각과 제거된 사진 수)만 감사
            목적으로 남습니다. 다른 이용자의 신고가 접수된 경우, 안전과 분쟁 대응을 위해 관련 기록이
            관련 법령이 정한 기간 동안 별도로 보존될 수 있습니다.
          </Text>
        </Section>

        <View style={styles.noticeCard}>
          <Ionicons color={palette.ink} name="alert-circle-outline" size={18} />
          <Text style={styles.noticeText}>
            삭제된 계정은 복구할 수 없습니다. 같은 이메일로 다시 가입할 수는 있지만 이전 프로필과
            대화는 되돌릴 수 없어요.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          hitSlop={touchSlop.link}
          onPress={() => router.replace('/')}
          style={({ pressed }) => [styles.homeLink, pressed && pressFeedback.control]}
        >
          <Text style={styles.homeLinkText}>WICHU 홈으로</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  children,
  index,
  title,
}: {
  children: React.ReactNode;
  index: string;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIndex}>
          <Text style={styles.sectionIndexText}>{index}</Text>
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: palette.paper, flex: 1 },
  content: {
    alignSelf: 'center',
    maxWidth: layout.maxContentWidth,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    width: '100%',
  },
  header: { gap: 6, marginBottom: spacing.lg },
  eyebrow: { ...typography.overline, color: palette.inkMuted },
  title: { ...typography.title, color: palette.ink },
  lede: { ...typography.body, color: palette.inkMuted, marginTop: spacing.xs },
  section: { marginTop: spacing.xl },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  sectionIndex: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  sectionIndexText: { ...typography.overline, color: palette.white, letterSpacing: 0 },
  sectionTitle: { ...typography.heading, color: palette.ink },
  sectionBody: { marginTop: spacing.sm, paddingLeft: 24 + spacing.xs },
  body: { ...typography.bodySm, color: palette.inkMuted },
  strong: { color: palette.ink, fontWeight: '900' },
  listRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 7, marginBottom: 7 },
  listText: { ...typography.bodySm, color: palette.ink, flex: 1 },
  mailButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 7,
    marginTop: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  mailButtonText: { ...typography.label, color: palette.white },
  noticeCard: {
    alignItems: 'flex-start',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xl,
    padding: spacing.md,
  },
  noticeText: { ...typography.caption, color: palette.ink, flex: 1 },
  homeLink: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 44,
  },
  homeLinkText: {
    ...typography.label,
    color: palette.inkMuted,
    textDecorationLine: 'underline',
  },
});
