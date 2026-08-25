// Hermes does not provide Intl.DisplayNames. Load the FormatJS implementation
// and only the locale data shipped by WICHU before any screen is evaluated.
import '@formatjs/intl-displaynames/polyfill.js';
import '@formatjs/intl-displaynames/locale-data/en.js';
import '@formatjs/intl-displaynames/locale-data/es.js';
import '@formatjs/intl-displaynames/locale-data/fa.js';
import '@formatjs/intl-displaynames/locale-data/fr.js';
import '@formatjs/intl-displaynames/locale-data/id.js';
import '@formatjs/intl-displaynames/locale-data/ja.js';
import '@formatjs/intl-displaynames/locale-data/ko.js';
import '@formatjs/intl-displaynames/locale-data/pt.js';
import '@formatjs/intl-displaynames/locale-data/vi.js';
import '@formatjs/intl-displaynames/locale-data/zh-Hant.js';
