import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppModal } from '@/components/AppModal';
import { palette, radius } from '@/constants/theme';

export const REPORT_REASONS = [
  { value: 'inappropriate_content', label: '부적절한 사진 또는 콘텐츠', icon: 'images-outline' },
  { value: 'harassment', label: '괴롭힘 또는 불쾌한 대화', icon: 'alert-circle-outline' },
  { value: 'spam', label: '스팸 또는 홍보', icon: 'megaphone-outline' },
  { value: 'fake_profile', label: '허위 또는 도용 프로필', icon: 'person-remove-outline' },
  { value: 'underage', label: '미성년자로 의심됨', icon: 'shield-outline' },
  { value: 'scam', label: '금전 요구 또는 사기 의심', icon: 'card-outline' },
  { value: 'other', label: '기타 안전 문제', icon: 'ellipsis-horizontal-circle-outline' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['value'];

type ReportReasonSheetProps = {
  busy?: boolean;
  onClose: () => void;
  onSelect: (reason: ReportReason) => void;
  visible: boolean;
};

export function ReportReasonSheet({ busy, onClose, onSelect, visible }: ReportReasonSheetProps) {
  return (
    <AppModal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="신고 창 닫기"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.eyebrow}>SAFETY FIRST</Text>
          <Text style={styles.title}>신고 이유를 알려주세요</Text>
          <Text style={styles.subtitle}>
            신고 내용은 상대에게 공개되지 않으며 운영팀이 확인합니다.
          </Text>
          <View style={styles.reasonList}>
            {REPORT_REASONS.map((reason) => (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                key={reason.value}
                onPress={() => onSelect(reason.value)}
                style={({ pressed }) => [styles.reason, pressed && styles.pressed]}
              >
                <View style={styles.reasonIcon}>
                  <Ionicons
                    color={palette.ink}
                    name={reason.icon as keyof typeof Ionicons.glyphMap}
                    size={19}
                  />
                </View>
                <Text style={styles.reasonLabel}>{reason.label}</Text>
                <Ionicons color="#A3A3AA" name="chevron-forward" size={17} />
              </Pressable>
            ))}
          </View>
          <Pressable disabled={busy} onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>{busy ? '접수 중…' : '취소'}</Text>
          </Pressable>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(10,10,14,0.46)', flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: palette.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: '#D7D7DC',
    borderRadius: 2,
    height: 4,
    marginBottom: 17,
    width: 42,
  },
  eyebrow: { color: palette.pink, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: palette.ink, fontSize: 21, fontWeight: '900', marginTop: 4 },
  subtitle: { color: palette.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  reasonList: { marginTop: 13 },
  reason: {
    alignItems: 'center',
    borderBottomColor: '#ECECEF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 52,
  },
  reasonIcon: {
    alignItems: 'center',
    backgroundColor: '#F1F1F3',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  reasonLabel: { color: palette.ink, flex: 1, fontSize: 13, fontWeight: '800', marginLeft: 11 },
  cancel: {
    alignItems: 'center',
    backgroundColor: '#F0F0F2',
    borderRadius: radius.md,
    marginTop: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  cancelText: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.58 },
});
