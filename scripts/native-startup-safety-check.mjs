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
// Metro resolves platform-specific modules before their generic siblings.
// Keep the scanner's startup graph aligned with the Android bundle.
const EXTS = ['.native.ts', '.native.tsx', '.ts', '.tsx', '.js', '.jsx', '/index.native.ts', '/index.native.tsx', '/index.ts', '/index.tsx'];

/**
 * 평가 시점 실행이 허용된 것.
 *
 * react-native-url-polyfill/auto는 supabase-js가 React Native에서 요구하는
 * 순수 JS URL 폴리필이다. 네이티브 모듈을 건드리지 않고 가벼워서 평가 시점에
 * 실행돼도 안전하며, Supabase 클라이언트보다 먼저 로드돼야 한다.
 */
const ALLOWED_SIDE_EFFECTS = new Set(['react-native-url-polyfill/auto']);

/** 평가 시점에 실행되면 위험한 패키지. */
const HEAVY_SIDE_EFFECT = /@formatjs|intl-|polyfill|react-native-purchases|react-native-google-mobile-ads/;
/** 평가 시점에 부르면 위험한 네이티브 API. */
const NATIVE_CALL =
  /\b(SecureStore|AsyncStorage|Crypto|Notifications|Location|ImagePicker|Device|Localization|FileSystem|SplashScreen|WebBrowser|NativeModules|getLocales|randomUUID)\b/;

function resolve(spec, from) {
  let base;
  if (spec.startsWith('@/')) base = 'src/' + spec.slice(2);
  else if (spec.startsWith('.')) base = normalize(join(dirname(from), spec)).split(sep).join('/');
  else return null;
  if (existsSync(base) && statSync(base).isFile()) return base;
  return EXTS.map((e) => base + e).find(existsSync) ?? null;
}

const seen = new Set();
const findings = [];

function visit(file) {
  if (!file || seen.has(file)) return;
  seen.add(file);
  const source = readFileSync(file, 'utf8');

  source.split('\n').forEach((line, index) => {
    const trimmed = line.trim();
    const at = `${file}:${index + 1}`;

    // 1) 부작용만 있는 import (import 'x') — 평가 시점에 그대로 실행된다
    const sideEffect = trimmed.match(/^import\s+['"]([^'"]+)['"]/);
    const allowed = sideEffect && ALLOWED_SIDE_EFFECTS.has(sideEffect[1]);
    if (sideEffect && !allowed && HEAVY_SIDE_EFFECT.test(sideEffect[1])) {
      findings.push({ at, why: `모듈 평가 시점 side-effect import: ${sideEffect[1]}`, code: trimmed });
    }

    // 2) 최상위에서 네이티브 API 호출
    const topLevel = line.length > 0 && !/^[\s})\]]/.test(line);
    const isDeclaration = /^(export\s+)?(async\s+)?function\b/.test(trimmed)
      || /^(export\s+)?const\s+\w+\s*=\s*(\(|async\s*\(|function)/.test(trimmed);
    if (topLevel && !isDeclaration && !trimmed.startsWith('import') && !trimmed.startsWith('//')) {
      if (NATIVE_CALL.test(trimmed) && /\w\s*\(/.test(trimmed) && !trimmed.includes('.catch(')) {
        findings.push({ at, why: '모듈 평가 시점 네이티브 호출', code: trimmed });
      }
    }
  });

  for (const m of source.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)) visit(resolve(m[1], file));
  for (const m of source.matchAll(/^export\s+.*from ['"]([^'"]+)['"]/gm)) visit(resolve(m[1], file));
}

ENTRIES.filter(existsSync).forEach(visit);

console.log(`시작 경로에서 로드되는 모듈: ${seen.size}개`);
if (findings.length === 0) {
  console.log('✅ 모듈 평가 시점의 위험한 실행 없음');
  process.exit(0);
}
console.log(`\n❌ ${findings.length}건 발견 — 화면이 뜨기 전에 실행되므로 예외를 잡을 수 없습니다\n`);
for (const f of findings) console.log(`  ${f.at}\n    ${f.why}\n    ${f.code}\n`);
process.exit(1);
