import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { LEGAL_DOCUMENTS, POLICY_EFFECTIVE_DATE, POLICY_STATUS } from '@/constants/legal-documents';
import { palette, radius } from '@/constants/theme';

export default function LegalDocumentRoute() {
  const router = useRouter();
  const { document } = useLocalSearchParams<{ document: string }>();
  const content = LEGAL_DOCUMENTS[document] ?? LEGAL_DOCUMENTS.terms;

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
        <Text style={styles.notice}>정책 문의 · support@wichu.app</Text>
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
