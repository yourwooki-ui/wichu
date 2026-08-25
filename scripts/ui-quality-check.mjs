import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const FORBIDDEN_DISCOVERY_COPY = [
  '오늘 볼 수 있는 사람을 다 봤어요',
  '오늘의 후보를 모두 확인했어요',
  '오늘의 후보를 다 봤어요',
];
const findings = [];

for (const file of [...listSourceFiles('app'), ...listSourceFiles('src')]) {
  const source = readFileSync(file, 'utf8');

  for (const copy of FORBIDDEN_DISCOVERY_COPY) {
    if (source.includes(copy)) findings.push(`${file}: final-sounding discovery copy: ${copy}`);
  }

  for (const match of source.matchAll(/fontSize\s*:\s*([0-9]+(?:\.[0-9]+)?)/g)) {
    if (Number(match[1]) < 10) findings.push(`${file}: undersized text: ${match[0]}`);
  }

  // 원격 프로필 사진은 화면을 오갈 때마다 다시 내려받지 않는다.
  for (const match of source.matchAll(/<Image\b[\s\S]*?\/>/g)) {
    const tag = match[0];
    if (/source=\{\{\s*uri\s*:/.test(tag) && !/cachePolicy=/.test(tag)) {
      findings.push(`${file}: remote Image is missing cachePolicy`);
    }
  }

  // Android 하드웨어 뒤로가기가 열린 모달을 닫을 수 있어야 한다.
  for (const match of source.matchAll(/<AppModal\b[\s\S]*?>/g)) {
    if (!/onRequestClose=/.test(match[0])) {
      findings.push(`${file}: AppModal is missing onRequestClose`);
    }
  }

  // 모든 직접 터치 요소는 보조기기에 역할을 알려야 한다. 탭 바처럼 접근성
  // props를 그대로 전달하는 래퍼와 의도적으로 비접근성인 제스처 트랙은 제외한다.
  for (const match of source.matchAll(/<Pressable\b[\s\S]*?>/g)) {
    const tag = match[0];
    if (
      !/accessibilityRole=/.test(tag) &&
      !/accessible=\{false\}/.test(tag) &&
      !/\{\.\.\.props\}/.test(tag)
    ) {
      findings.push(`${file}: Pressable is missing accessibilityRole`);
    }
  }
}

const FORBIDDEN_RAW_ERROR_SURFACES = [
  'app/login.tsx',
  'src/features/auth/context/AuthProvider.tsx',
  'src/features/chat/screens/ChatRoomScreen.tsx',
  'src/features/discover/hooks/use-discover-deck.ts',
  'src/features/profile/screens/MeScreen.tsx',
  'src/features/settings/screens/SettingsScreen.tsx',
];

for (const file of FORBIDDEN_RAW_ERROR_SURFACES) {
  const source = readFileSync(file, 'utf8');
  if (/error\s+instanceof\s+Error\s*\?\s*error\.message/.test(source)) {
    findings.push(`${file}: backend error.message can reach user-facing copy`);
  }
}

if (findings.length) {
  console.error('UI quality check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('UI quality check passed.');

function listSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return entry.isFile() && ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
  });
}
