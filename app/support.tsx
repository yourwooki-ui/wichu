import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { COMPANY_INFO, SUPPORT_EMAIL } from '@/constants/company';
import { palette, pressFeedback, radius } from '@/constants/theme';

const FAQS = [
  [
    '프로필 사진이 심사 중이에요',
    '승인 전에는 공개 사진만 다른 사용자에게 제한됩니다. 발견과 기존 연결은 계속 이용할 수 있어요.',
  ],
  [
    '위험하거나 불쾌한 사용자를 만났어요',
    '상대 프로필 또는 채팅의 안전 메뉴에서 즉시 신고·차단하세요. 긴급한 위험은 현지 긴급기관에 먼저 연락해 주세요.',
  ],
  [
    '계정을 쉬거나 삭제하고 싶어요',
    '설정의 계정 메뉴에서 비활성화 또는 삭제 요청을 진행할 수 있어요.',
  ],
] as const;

export default function SupportRoute() {
  const router = useRouter();
  const sendEmail = () => {
    const subject = encodeURIComponent('[WICHU 문의] 도움이 필요해요');
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`).catch(() => {
      Alert.alert('메일 앱을 열지 못했어요', SUPPORT_EMAIL);
    });
  };
  const openCompanyWebsite = () => {
    void Linking.openURL(COMPANY_INFO.website).catch(() => {
      Alert.alert('웹사이트를 열지 못했어요', COMPANY_INFO.website);
    });
  };

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
        <Text style={styles.headerTitle}>도움말 및 문의</Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons color={palette.pink} name="chatbubbles" size={26} />
          </View>
          <Text style={styles.heroTitle}>무엇을 도와드릴까요?</Text>
          <Text style={styles.heroBody}>계정·안전·결제 문제를 운영팀에 알려주세요.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={sendEmail}
            style={({ pressed }) => [styles.contactButton, pressed && pressFeedback.control]}
          >
            <Ionicons color={palette.white} name="mail" size={18} />
            <Text style={styles.contactText}>이메일 문의</Text>
          </Pressable>
          <Text style={styles.email}>{SUPPORT_EMAIL}</Text>
        </View>
        <Text style={styles.sectionLabel}>자주 묻는 질문</Text>
        <View style={styles.faqList}>
          {FAQS.map(([title, body]) => (
            <View key={title} style={styles.faq}>
              <Text style={styles.faqTitle}>{title}</Text>
              <Text style={styles.faqBody}>{body}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.sectionLabel}>운영 정보</Text>
        <View style={styles.companyCard}>
          <CompanyRow label="Google Play 개발자" value={COMPANY_INFO.googleDeveloperName} />
          <CompanyRow label="운영사" value={COMPANY_INFO.nameKo} />
          <CompanyRow label="대표자" value={COMPANY_INFO.representative} />
          <CompanyRow label="사업자등록번호" value={COMPANY_INFO.businessNumber} />
          <CompanyRow label="통신판매업 신고" value={COMPANY_INFO.mailOrderNumber} />
          <CompanyRow label="사업장" value={COMPANY_INFO.address} />
          <Pressable
            accessibilityLabel="무브먼트 스튜디오 웹사이트 열기"
            accessibilityRole="link"
            onPress={openCompanyWebsite}
            style={({ pressed }) => [styles.websiteButton, pressed && pressFeedback.control]}
          >
            <Ionicons color={palette.ink} name="globe-outline" size={17} />
            <Text style={styles.websiteText}>movementstudio.kr</Text>
            <Ionicons color={palette.inkMuted} name="open-outline" size={15} />
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function CompanyRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.companyRow}>
      <Text style={styles.companyLabel}>{label}</Text>
      <Text style={styles.companyValue}>{value}</Text>
    </View>
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
  content: { paddingBottom: 40, paddingHorizontal: 18 },
  hero: { alignItems: 'center', backgroundColor: palette.white, borderRadius: 26, padding: 24 },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#FFE7EF',
    borderRadius: 23,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  heroTitle: { color: palette.ink, fontSize: 21, fontWeight: '900', marginTop: 15 },
  heroBody: {
    color: palette.inkMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    textAlign: 'center',
  },
  contactButton: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  contactText: { color: palette.white, fontSize: 12, fontWeight: '900' },
  email: { color: palette.inkMuted, fontSize: 12, marginTop: 9 },
  sectionLabel: {
    color: palette.inkMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 4,
    marginTop: 24,
  },
  faqList: { backgroundColor: palette.white, borderRadius: 22, overflow: 'hidden' },
  faq: { borderBottomColor: '#ECECEF', borderBottomWidth: StyleSheet.hairlineWidth, padding: 17 },
  faqTitle: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  faqBody: { color: palette.inkMuted, fontSize: 13, lineHeight: 20, marginTop: 6 },
  companyCard: { backgroundColor: palette.white, borderRadius: 22, padding: 18 },
  companyRow: {
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  companyLabel: { color: palette.inkMuted, fontSize: 12, fontWeight: '700' },
  companyValue: {
    color: palette.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'right',
  },
  websiteButton: {
    alignItems: 'center',
    borderColor: '#E4E4E8',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  websiteText: { color: palette.ink, flex: 1, fontSize: 13, fontWeight: '900' },
});
