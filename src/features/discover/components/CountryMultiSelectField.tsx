import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppModal } from '@/components/AppModal';
import { CountryFlag } from '@/components/CountryFlag';
import { getCountryOptions } from '@/constants/countries';
import { palette, pressFeedback, radius } from '@/constants/theme';

type Props = {
  value: string[];
  onChange: (value: string[]) => void;
};

export function CountryMultiSelectField({ value, onChange }: Props) {
  const { i18n } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'ko';
  const countries = useMemo(() => getCountryOptions(locale), [locale]);
  const filtered = useMemo(() => {
    const normalized = normalize(query);
    if (!normalized) return countries;
    return countries.filter(
      (country) =>
        normalize(country.name).includes(normalized) ||
        normalize(country.searchAliases).includes(normalized) ||
        country.code.toLowerCase().includes(normalized),
    );
  }, [countries, query]);
  const selected = countries.filter((country) => value.includes(country.code));

  const toggle = (code: string) => {
    onChange(value.includes(code) ? value.filter((item) => item !== code) : [...value, code]);
  };

  const close = () => {
    setVisible(false);
    setQuery('');
  };

  return (
    <View>
      <Text style={styles.label}>국가</Text>
      <Text style={styles.hint}>선택하지 않으면 모든 국가의 프로필을 보여줘요.</Text>
      <Pressable onPress={() => setVisible(true)} style={styles.trigger}>
        <View style={styles.triggerCopy}>
          <Text style={styles.triggerTitle}>
            {selected.length ? `${selected.length}개 국가 선택` : '모든 국가'}
          </Text>
          <Text numberOfLines={1} style={styles.triggerValue}>
            {selected.length ? selected.map((country) => country.name).join(', ') : '전 세계'}
          </Text>
        </View>
        <Ionicons color={palette.inkMuted} name="chevron-forward" size={19} />
      </Pressable>

      <AppModal animationType="slide" onRequestClose={close} transparent visible={visible}>
        <View style={styles.overlay}>
          <Pressable onPress={close} style={StyleSheet.absoluteFill} />
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>탐색 국가</Text>
                <Text style={styles.subtitle}>여러 국가를 선택할 수 있어요.</Text>
              </View>
              <Pressable
                accessibilityLabel="국가 선택 닫기"
                hitSlop={8}
                onPress={close}
                style={({ pressed }) => [styles.close, pressed && pressFeedback.icon]}
              >
                <Ionicons color={palette.ink} name="close" size={21} />
              </Pressable>
            </View>
            <View style={styles.search}>
              <Ionicons color={palette.inkMuted} name="search" size={18} />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setQuery}
                placeholder="국가 검색"
                placeholderTextColor={palette.inkMuted}
                style={styles.searchInput}
                value={query}
              />
              {query ? (
                <Pressable onPress={() => setQuery('')}>
                  <Ionicons color={palette.inkMuted} name="close-circle" size={18} />
                </Pressable>
              ) : null}
            </View>
            <Pressable onPress={() => onChange([])} style={styles.allCountries}>
              <View style={styles.globe}>
                <Ionicons color={palette.pink} name="globe-outline" size={20} />
              </View>
              <Text style={styles.countryName}>모든 국가</Text>
              <Check selected={value.length === 0} />
            </Pressable>
            <FlatList
              contentContainerStyle={styles.list}
              data={filtered}
              initialNumToRender={18}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <Pressable onPress={() => toggle(item.code)} style={styles.countryRow}>
                  <CountryFlag compact countryCode={item.code} label={item.name} />
                  <Text style={styles.countryName}>{item.name}</Text>
                  <Text style={styles.code}>{item.code}</Text>
                  <Check selected={value.includes(item.code)} />
                </Pressable>
              )}
            />
            <Pressable
              onPress={close}
              style={({ pressed }) => [styles.done, pressed && pressFeedback.control]}
            >
              <Text style={styles.doneText}>선택 완료</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </AppModal>
    </View>
  );
}

function Check({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.check, selected && styles.checkSelected]}>
      {selected ? <Ionicons color={palette.white} name="checkmark" size={13} /> : null}
    </View>
  );
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase().normalize('NFKD');
}

const styles = StyleSheet.create({
  label: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  hint: { color: palette.inkMuted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  trigger: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 10,
    minHeight: 60,
    paddingHorizontal: 15,
  },
  triggerCopy: { flex: 1 },
  triggerTitle: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  triggerValue: { color: palette.inkMuted, fontSize: 10, marginTop: 3 },
  overlay: { backgroundColor: 'rgba(17,17,17,0.38)', flex: 1, justifyContent: 'flex-end' },
  sheet: {
    alignSelf: 'center',
    backgroundColor: '#F8F8FA',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '84%',
    maxWidth: 460,
    overflow: 'hidden',
    width: '100%',
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: palette.line,
    borderRadius: 2,
    height: 4,
    marginBottom: 15,
    marginTop: 10,
    width: 38,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  title: { color: palette.ink, fontSize: 21, fontWeight: '900' },
  subtitle: { color: palette.inkMuted, fontSize: 11, marginTop: 3 },
  close: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  search: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 18,
    minHeight: 48,
    paddingHorizontal: 13,
  },
  searchInput: { color: palette.ink, flex: 1, fontSize: 14, paddingHorizontal: 9 },
  allCountries: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: 20,
  },
  globe: {
    alignItems: 'center',
    backgroundColor: '#FFE8F0',
    borderRadius: 14,
    height: 30,
    justifyContent: 'center',
    marginRight: 11,
    width: 30,
  },
  list: { paddingBottom: 92, paddingHorizontal: 12 },
  countryRow: { alignItems: 'center', flexDirection: 'row', minHeight: 54, paddingHorizontal: 8 },
  countryName: { color: palette.ink, flex: 1, fontSize: 13, fontWeight: '800', marginLeft: 11 },
  code: { color: palette.inkMuted, fontSize: 10, fontWeight: '800', marginRight: 10 },
  check: {
    alignItems: 'center',
    borderColor: palette.line,
    borderRadius: 9,
    borderWidth: 1,
    height: 19,
    justifyContent: 'center',
    width: 19,
  },
  checkSelected: { backgroundColor: palette.pink, borderColor: palette.pink },
  done: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderRadius: radius.pill,
    bottom: 16,
    left: 20,
    minHeight: 50,
    justifyContent: 'center',
    position: 'absolute',
    right: 20,
  },
  doneText: { color: palette.white, fontSize: 13, fontWeight: '900' },
});
