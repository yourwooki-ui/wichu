import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { palette, radius } from '@/constants/theme';

type LegalDocument = {
  title: string;
  summary: string;
  sections: { title: string; body: string }[];
};

/**
 * 약관·개인정보처리방침의 시행 상태.
 *
 * ⚠️ `effective`로 바꾸는 것은 실제 법률 검토가 끝났다는 뜻이다.
 * 이 값이 `draft`인 동안에는 이 페이지 주소를 스토어 콘솔의
 * 개인정보처리방침 URL로 제출하면 안 된다.
 */
const POLICY_STATUS: 'draft' | 'effective' = 'draft';
const POLICY_EFFECTIVE_DATE = '2026.08';

const DOCUMENTS: Record<string, LegalDocument> = {
  terms: {
    title: '이용약관',
    summary: 'WICHU를 안전하고 공정하게 이용하기 위한 기본 약속입니다.',
    sections: [
      {
        title: '이용 자격',
        body: 'WICHU는 만 18세 이상만 가입할 수 있습니다. 정확한 계정 및 프로필 정보를 사용해야 하며 계정을 타인에게 양도할 수 없습니다.',
      },
      {
        title: '서비스 이용',
        body: '상대방의 동의와 안전을 존중해야 합니다. 불법 행위, 사기, 광고, 괴롭힘, 혐오 표현, 성적 착취, 타인 사칭 및 연락처 수집을 금지합니다.',
      },
      {
        title: '콘텐츠와 심사',
        body: '사용자는 게시할 권한이 있는 사진과 글만 등록해야 합니다. 운영팀은 공개 사진과 신고된 콘텐츠를 심사하고 노출 제한, 수정 요청 또는 계정 조치를 할 수 있습니다.',
      },
      {
        title: '유료 상품',
        body: 'Gold Pass와 광고 제거 상품의 가격·기간·갱신 조건은 결제 화면에 표시합니다. 실제 결제와 환불은 Apple App Store 또는 Google Play 정책을 따릅니다.',
      },
      {
        title: '계정 종료',
        body: '사용자는 설정에서 계정을 비활성화하거나 삭제를 요청할 수 있습니다. 중대한 정책 위반 또는 안전 위험이 확인되면 서비스 이용이 제한될 수 있습니다.',
      },
    ],
  },
  privacy: {
    title: '개인정보처리방침',
    summary: 'WICHU가 어떤 정보를 왜 사용하고 어떻게 보호하는지 안내합니다.',
    sections: [
      {
        title: '수집 정보',
        body: '계정 이메일, 생년월일, 프로필 정보, 사진, 언어, 관심사, 선택한 성별 및 연령 조건, 앱 사용 기록, 기기·알림 토큰과 위치 기반 거리 계산에 필요한 좌표를 처리할 수 있습니다.',
      },
      {
        title: '이용 목적',
        body: '성인 여부 확인, 계정 인증, 프로필 탐색과 거리 표시, 매치·채팅·번역, 안전 심사, 신고 처리, 알림 제공, 서비스 품질 및 부정 이용 방지에 사용합니다.',
      },
      {
        title: '공개 범위',
        body: '정확한 생년월일과 원본 위치 좌표는 다른 사용자에게 공개하지 않습니다. 프로필에는 나이, 국가, 대략적인 거리와 사용자가 공개한 항목만 표시합니다.',
      },
      {
        title: '보관과 삭제',
        body: '서비스 제공에 필요한 기간 동안 보관하며 계정 삭제 요청 시 법적 보관 의무와 안전상 필요한 최소 기록을 제외하고 삭제 절차를 진행합니다.',
      },
      {
        title: '이용자 권리',
        body: '설정에서 프로필 노출, 알림, 차단, 비활성화 및 삭제를 관리할 수 있습니다. 개인정보 관련 문의는 도움말 및 문의 메뉴를 이용해 주세요.',
      },
    ],
  },
  community: {
    title: '커뮤니티 가이드',
    summary: '가볍게 시작하되 서로의 경계와 안전은 분명하게 지켜요.',
    sections: [
      {
        title: '진짜 나로 참여하기',
        body: '본인의 최근 사진과 사실에 기반한 프로필을 사용하세요. 사칭, 도용, 오해를 유도하는 정보와 미성년자 계정은 허용하지 않습니다.',
      },
      {
        title: '동의와 존중',
        body: '거절과 답장하지 않을 권리를 존중하세요. 반복 연락, 위협, 모욕, 혐오 표현, 원치 않는 성적 메시지나 사진을 보내면 안 됩니다.',
      },
      {
        title: '안전한 만남',
        body: '금전이나 민감 정보를 요구하지 말고, 첫 만남은 공개된 장소에서 진행하세요. 불편하거나 위험하다고 느끼면 즉시 대화를 중단하고 신고·차단하세요.',
      },
      {
        title: '상업 활동 금지',
        body: '제품·서비스 홍보, 투자 권유, 성매매, 계정 판매, 외부 메신저로의 강제 유도 및 자동화 스팸을 금지합니다.',
      },
      {
        title: '운영 조치',
        body: '신고와 시스템 신호를 검토해 콘텐츠 비공개, 프로필 재심사, 기능 제한, 계정 정지 또는 삭제를 적용할 수 있습니다.',
      },
    ],
  },
};

export default function LegalDocumentRoute() {
  const router = useRouter();
  const { document } = useLocalSearchParams<{ document: string }>();
  const content = DOCUMENTS[document] ?? DOCUMENTS.terms;

  return (
    <Screen edges={['top', 'left', 'right']} padded={false} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="뒤로"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons color={palette.ink} name="chevron-back" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>{content.title}</Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Text style={styles.kicker}>WICHU POLICY</Text>
          <Text style={styles.summary}>{content.summary}</Text>
          {POLICY_STATUS === 'effective' ? (
            <Text style={styles.date}>시행일 {POLICY_EFFECTIVE_DATE}</Text>
          ) : (
            <View style={styles.draftNotice}>
              <Ionicons color="#FFC64D" name="alert-circle" size={15} />
              <Text style={styles.draftText}>
                아직 법률 검토를 마치지 않은 내부 검토본입니다. 시행 예정일 {POLICY_EFFECTIVE_DATE}
              </Text>
            </View>
          )}
        </View>
        {content.sections.map((section, index) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionIndex}>{String(index + 1).padStart(2, '0')}</Text>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionBody}>{section.body}</Text>
            </View>
          </View>
        ))}
        <Text style={styles.notice}>
          정식 출시 전 관할 지역과 스토어 정책에 맞춰 법률 검토 후 확정합니다.
        </Text>
      </ScrollView>
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
  headerTitle: { color: palette.ink, fontSize: 16, fontWeight: '900' },
  content: { paddingBottom: 40, paddingHorizontal: 20 },
  intro: { backgroundColor: palette.ink, borderRadius: 24, marginBottom: 24, padding: 22 },
  kicker: { color: palette.pink, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  summary: { color: palette.white, fontSize: 20, fontWeight: '900', lineHeight: 28, marginTop: 8 },
  date: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 15 },
  draftNotice: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,198,77,0.12)',
    borderColor: 'rgba(255,198,77,0.4)',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    marginTop: 15,
    padding: 10,
  },
  draftText: { color: '#FFD98A', flex: 1, fontSize: 11, lineHeight: 16 },
  section: {
    borderBottomColor: '#DFDFE3',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingVertical: 19,
  },
  sectionIndex: {
    color: palette.pink,
    fontSize: 10,
    fontWeight: '900',
    marginRight: 14,
    marginTop: 3,
  },
  sectionCopy: { flex: 1 },
  sectionTitle: { color: palette.ink, fontSize: 15, fontWeight: '900' },
  sectionBody: { color: palette.inkMuted, fontSize: 12, lineHeight: 20, marginTop: 7 },
  notice: { color: '#909098', fontSize: 10, lineHeight: 16, marginTop: 20, textAlign: 'center' },
});
