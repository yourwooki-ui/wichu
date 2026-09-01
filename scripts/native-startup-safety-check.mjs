#!/usr/bin/env node
/**
 * 앱 시작 시 실행되는 위험한 코드를 찾는다.
 *
 * 모듈 평가 시점(= React 마운트 전, AppErrorBoundary 생성 전)에 무거운 폴리필이나
 * 네이티브 모듈을 건드리면, 예외가 나도 잡을 화면이 없어 앱이 즉시 종료된다.
 * 이 저장소는 실제로 두 번 겪었다.
 *   - expo-crypto randomUUID (product-analytics-service)
 *   - @formatjs/intl-displaynames (app/_layout.tsx의 side-effect import)
 *
 * 사용법: node scripts/native-startup-safety-check.mjs
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, normalize, sep } from 'node:path';

const ENTRIES = ['app/_layout.tsx', 'app/index.tsx'];
const LAZY_NATIVE_PROVIDER_FILES = [
  'src/features/monetization/services/ads-provider.native.ts',
  'src/features/monetization/services/purchase-provider.native.ts',
];
// Metro resolves platform-specific modules before their generic siblings.
// Keep the scanner's startup graph aligned with the Android bundle.
const EXTS = [
  '.native.ts',
  '.native.tsx',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '/index.native.ts',
  '/index.native.tsx',
  '/index.ts',
  '/index.tsx',
];

/**
 * 평가 시점 실행이 허용된 것.
 *
 * react-native-url-polyfill/auto는 supabase-js가 React Native에서 요구하는
 * 순수 JS URL 폴리필이다. 네이티브 모듈을 건드리지 않고 가벼워서 평가 시점에
 * 실행돼도 안전하며, Supabase 클라이언트보다 먼저 로드돼야 한다.
 */
const ALLOWED_SIDE_EFFECTS = new Set(['react-native-url-polyfill/auto']);

/** 평가 시점에 실행되면 위험한 패키지. */
const HEAVY_SIDE_EFFECT =
  /@formatjs|intl-|polyfill|react-native-purchases|react-native-google-mobile-ads/;
/** 평가 시점에 부르면 위험한 네이티브 API. */
const NATIVE_CALL =
  /\b(SecureStore|AsyncStorage|Crypto|Notifications|Location|ImagePicker|Device|Localization|FileSystem|SplashScreen|WebBrowser|NativeModules|getLocales|randomUUID)\b/;
/** 번역 준비도 React 마운트 전에 실행하지 않는다. */
const STARTUP_I18N_CALL = /\b(initializeTranslations|hydrateAppLanguage)\s*\(/;

function resolve(spec, from) {
  let base;
  if (spec.startsWith('@/')) base = 'src/' + spec.slice(2);
  else if (spec.startsWith('.'))
    base = normalize(join(dirname(from), spec))
      .split(sep)
      .join('/');
  else return null;
  if (existsSync(base) && statSync(base).isFile()) return base;
  return EXTS.map((e) => base + e).find(existsSync) ?? null;
}

const seen = new Set();
const visiting = new Set();
const importStack = [];
const findings = [];

function visit(file) {
  if (!file) return;
  if (visiting.has(file)) {
    const cycleStart = importStack.indexOf(file);
    const cycle = [...importStack.slice(cycleStart), file];
    findings.push({
      at: file,
      why: '앱 시작 경로 순환 import',
      code: cycle.join(' -> '),
    });
    return;
  }
  if (seen.has(file)) return;

  visiting.add(file);
  importStack.push(file);
  const source = readFileSync(file, 'utf8');

  source.split('\n').forEach((line, index) => {
    const trimmed = line.trim();
    const at = `${file}:${index + 1}`;

    // 1) 부작용만 있는 import (import 'x') — 평가 시점에 그대로 실행된다
    const sideEffect = trimmed.match(/^import\s+['"]([^'"]+)['"]/);
    const allowed = sideEffect && ALLOWED_SIDE_EFFECTS.has(sideEffect[1]);
    if (sideEffect && !allowed && HEAVY_SIDE_EFFECT.test(sideEffect[1])) {
      findings.push({
        at,
        why: `모듈 평가 시점 side-effect import: ${sideEffect[1]}`,
        code: trimmed,
      });
    }

    // 2) 최상위에서 네이티브 API 호출
    const topLevel = line.length > 0 && !/^[\s})\]]/.test(line);
    const isDeclaration =
      /^(export\s+)?(async\s+)?function\b/.test(trimmed) ||
      /^(export\s+)?const\s+\w+\s*=\s*(\(|async\s*\(|function)/.test(trimmed);
    if (topLevel && !isDeclaration && !trimmed.startsWith('import') && !trimmed.startsWith('//')) {
      const isCall = /\w\s*\(/.test(trimmed);
      // 호출뿐 아니라 '속성 접근'도 위험하다. 네이티브 모듈의 상수를 평가 시점에 읽으면
      // 모듈이 아직 준비되지 않았을 때 파일 평가 자체가 실패한다.
      const isPropertyRead = /\b[A-Z][A-Za-z0-9_]*\.[A-Z_][A-Z0-9_]{2,}\b/.test(trimmed);
      // Promise.catch는 비동기 reject만 잡는다. 네이티브 연결 시 호출 자체가
      // 동기적으로 throw할 수 있으므로 최상위 호출은 .catch 유무와 관계없이 막는다.
      if (NATIVE_CALL.test(trimmed) && (isCall || isPropertyRead)) {
        findings.push({
          at,
          why: isCall ? '모듈 평가 시점 네이티브 호출' : '모듈 평가 시점 네이티브 속성 접근',
          code: trimmed,
        });
      }
      if (STARTUP_I18N_CALL.test(trimmed)) {
        findings.push({ at, why: '모듈 평가 시점 번역 초기화', code: trimmed });
      }
    }
  });

  for (const m of source.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)) visit(resolve(m[1], file));
  for (const m of source.matchAll(/^export\s+.*from ['"]([^'"]+)['"]/gm))
    visit(resolve(m[1], file));

  importStack.pop();
  visiting.delete(file);
  seen.add(file);
}

ENTRIES.filter(existsSync).forEach(visit);

// 광고·결제 SDK는 라우트가 평가될 때도 불러오면 안 된다. 로그인 완료 후 provider
// 함수 내부의 import()로만 진입해야 네이티브 연결 실패를 기능 단위로 격리할 수 있다.
for (const file of LAZY_NATIVE_PROVIDER_FILES.filter(existsSync)) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(
    /^import\s+(?!type\b)(?:[^;]*?\sfrom\s+)?['"](react-native-purchases|react-native-google-mobile-ads)['"]\s*;?/gm,
  )) {
    const line = source.slice(0, match.index).split('\n').length;
    findings.push({
      at: `${file}:${line}`,
      why: `수익화 네이티브 SDK 정적 import: ${match[1]}`,
      code: match[0],
    });
  }
}

console.log(`시작 경로에서 로드되는 모듈: ${seen.size}개`);
if (findings.length === 0) {
  console.log('✅ 모듈 평가 시점의 위험한 실행 없음');
  process.exit(0);
}
console.log(
  `\n❌ ${findings.length}건 발견 — 화면이 뜨기 전에 실행되므로 예외를 잡을 수 없습니다\n`,
);
for (const f of findings) console.log(`  ${f.at}\n    ${f.why}\n    ${f.code}\n`);
process.exit(1);
