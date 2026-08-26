import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  BottomSheetCloseButton,
  InteractiveBottomSheet,
} from '@/components/InteractiveBottomSheet';
import { CountryFlag } from '@/components/CountryFlag';
import { getCountryOptions, type CountryOption } from '@/constants/countries';
import { palette, radius } from '@/constants/theme';

type CountryPickerFieldProps = {
  value: string;
  onSelect: (countryCode: string) => void;
};

export function CountryPickerField({ value, onSelect }: CountryPickerFieldProps) {
  const { t, i18n } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const countries = useMemo(() => getCountryOptions(locale), [locale]);
  const selectedCountry = countries.find((country) => country.code === value);
  const normalizedQuery = normalize(query);
  const filteredCountries = useMemo(
    () =>
      normalizedQuery
        ? countries.filter(
            (country) =>
              normalize(country.name).includes(normalizedQuery) ||
              country.code.toLowerCase().includes(normalizedQuery) ||
              normalize(country.searchAliases).includes(normalizedQuery),
          )
        : countries,
    [countries, normalizedQuery],
  );

  function closePicker() {
    setVisible(false);
    setQuery('');
  }

  function selectCountry(country: CountryOption) {
    onSelect(country.code);
    closePicker();
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{t('profileSetup.country')}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('profileSetup.countryPicker.open')}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        {selectedCountry ? (
          <>
            <CountryFlag
              key={selectedCountry.code}
              countryCode={selectedCountry.code}
              label={selectedCountry.name}
              style={styles.flagSpacing}
            />
            <View style={styles.selectedCopy}>
              <Text numberOfLines={1} style={styles.selectedName}>
                {selectedCountry.name}
              </Text>
              <Text style={styles.countryCode}>{selectedCountry.code}</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.globeIcon}>
              <Ionicons color={palette.inkMuted} name="globe-outline" size={20} />
            </View>
            <Text style={styles.placeholder}>{t('profileSetup.countryPicker.placeholder')}</Text>
          </>
        )}
        <Ionicons color={palette.inkMuted} name="chevron-down" size={20} />
      </Pressable>

      <InteractiveBottomSheet
        accessibilityLabel={t('profileSetup.countryPicker.title')}
        onClose={closePicker}
        sheetStyle={styles.sheet}
        visible={visible}
      >
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>{t('profileSetup.countryPicker.title')}</Text>
            <Text style={styles.sheetSubtitle}>{t('profileSetup.countryPicker.subtitle')}</Text>
          </View>
          <BottomSheetCloseButton
            accessibilityLabel={t('profileSetup.countryPicker.close')}
            accessibilityRole="button"
            hitSlop={10}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Ionicons color={palette.ink} name="close" size={22} />
          </BottomSheetCloseButton>
        </View>

        <View style={styles.searchBox}>
          <Ionicons color={palette.inkMuted} name="search" size={20} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            clearButtonMode="while-editing"
            onChangeText={setQuery}
            placeholder={t('profileSetup.countryPicker.searchPlaceholder')}
            placeholderTextColor={palette.inkMuted}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
          {query ? (
            <Pressable
              accessibilityLabel={t('profileSetup.countryPicker.clearSearch')}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setQuery('')}
            >
              <Ionicons color={palette.inkMuted} name="close-circle" size={19} />
            </Pressable>
          ) : null}
        </View>

        <FlatList
          contentContainerStyle={
            filteredCountries.length === 0 ? styles.emptyList : styles.listContent
          }
          data={filteredCountries}
          initialNumToRender={18}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(country) => country.code}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons color={palette.inkMuted} name="search-outline" size={26} />
              <Text style={styles.emptyTitle}>{t('profileSetup.countryPicker.empty')}</Text>
              <Text style={styles.emptyBody}>{t('profileSetup.countryPicker.emptyHint')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const selected = item.code === value;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => selectCountry(item)}
                style={({ pressed }) => [
                  styles.countryRow,
                  selected && styles.countryRowSelected,
                  pressed && styles.pressed,
                ]}
              >
                <CountryFlag
                  compact
                  countryCode={item.code}
                  label={item.name}
                  style={styles.flagSpacing}
                />
                <Text numberOfLines={1} style={styles.rowName}>
                  {item.name}
                </Text>
                <Text style={styles.rowCode}>{item.code}</Text>
                <View style={[styles.check, selected && styles.checkSelected]}>
                  {selected ? <Ionicons color={palette.black} name="checkmark" size={14} /> : null}
                </View>
              </Pressable>
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      </InteractiveBottomSheet>
    </View>
  );
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase().normalize('NFKD');
}

const styles = StyleSheet.create({
  field: {
    gap: 9,
  },
  label: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  trigger: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  globeIcon: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    marginRight: 10,
    width: 28,
  },
  flagSpacing: {
    marginRight: 12,
  },
  selectedCopy: {
    flex: 1,
  },
  selectedName: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  countryCode: {
    color: palette.inkMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  placeholder: {
    color: palette.inkMuted,
    flex: 1,
    fontSize: 15,
  },
  pressed: {
    opacity: 0.72,
  },
  sheet: {
    backgroundColor: '#F8F8FA',
    borderColor: palette.line,
    borderWidth: 1,
    height: '84%',
    maxWidth: 460,
  },
  sheetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  sheetTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  sheetSubtitle: {
    color: palette.inkMuted,
    fontSize: 13,
    marginTop: 4,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: palette.ink,
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 10,
    paddingVertical: 13,
  },
  listContent: {
    paddingBottom: 20,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  countryRow: {
    alignItems: 'center',
    borderRadius: radius.lg,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 12,
  },
  countryRowSelected: {
    backgroundColor: 'rgba(255, 45, 111, 0.08)',
  },
  rowName: {
    color: palette.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  rowCode: {
    color: palette.inkMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginRight: 12,
  },
  check: {
    alignItems: 'center',
    borderColor: palette.line,
    borderRadius: 10,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  checkSelected: {
    backgroundColor: palette.pink,
    borderColor: palette.pink,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 30,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
  },
  emptyBody: {
    color: palette.inkMuted,
    fontSize: 13,
    marginTop: 5,
    textAlign: 'center',
  },
});
