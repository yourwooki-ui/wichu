import * as Localization from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: { tabs: { discover: 'Discover', matches: 'Matches', chat: 'Chat', me: 'Me' } },
  },
  ko: { translation: { tabs: { discover: '발견', matches: '매치', chat: '채팅', me: '나' } } },
};

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: Localization.getLocales()[0]?.languageCode ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
