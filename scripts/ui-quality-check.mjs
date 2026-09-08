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

  // 이미지 교체 속도도 모션 시스템의 일부다. 숫자를 직접 쓰면 화면마다
  // fade가 달라지고 재활용되는 목록에서 잔상이 길어질 수 있다.
  if (/transition=\{[0-9]+\}/.test(source)) {
    findings.push(`${file}: expo-image transition must use imageTransition tokens`);
  }

  // 추천 신호는 정렬과 품질 분석에만 사용한다. 카드에 이유를 다시 노출하면
  // 사용자가 요청한 사진 중심 탐색 경험과 어긋난다.
  if (file.endsWith('.tsx') && /recommendationReasons/.test(source)) {
    findings.push(`${file}: recommendation reasons must not be rendered in UI`);
  }

  // 접근성 설정 조회는 실패 안전성과 런타임 업데이트를 처리하는 공통 훅을 쓴다.
  if (
    !file.endsWith('use-reduce-motion.ts') &&
    (/\buseReducedMotion\b/.test(source) || /AccessibilityInfo\.isReduceMotionEnabled/.test(source))
  ) {
    findings.push(`${file}: motion accessibility must use useReduceMotion`);
  }

  // 화면별 상대 시간 갱신은 공통 활성 시계로 모아 백그라운드 타이머를 남기지 않는다.
  if (/[\\/]screens[\\/]/.test(file) && /setInterval\(/.test(source)) {
    findings.push(`${file}: screen timers must use useActiveClock`);
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

  // 텍스트 입력 화면은 키보드가 올라와도 포커스된 필드와 주요 동작이 보여야 한다.
  // FormField는 소비 화면의 컨테이너가 처리한다. 검색형 바텀시트는 명시적으로
  // keyboardAvoiding을 선택하고, 긴 입력 폼은 KeyboardAwareScrollView를 쓴다.
  if (
    source.includes('<TextInput') &&
    !file.endsWith('FormField.tsx') &&
    !source.includes('KeyboardAwareScrollView') &&
    !source.includes('KeyboardAvoidingView') &&
    !(source.includes('InteractiveBottomSheet') && source.includes('keyboardAvoiding'))
  ) {
    findings.push(`${file}: TextInput surface is missing keyboard avoidance`);
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

// Discover는 카드 제스처와 명시적 액션 독이 같은 결정을 실행해야 한다.
// 별도 DeckAction 구현이 생기면 두 경로의 햅틱·잠금·애니메이션이 갈라진다.
const swipeDeckSource = readFileSync('src/features/discover/components/SwipeDeck.tsx', 'utf8');
if (/function\s+DeckAction/.test(swipeDeckSource)) {
  findings.push('SwipeDeck: actions must keep using the shared startSwipe decision path');
}

// 프로필 편집은 고정 footer와 긴 multiline 입력을 함께 쓴다. 화면별 타이머나
// 중첩 KeyboardAvoidingView를 다시 추가하면 기기별 IME 높이에서 가림이 재발한다.
const profileSetupSource = readFileSync('app/profile-setup.tsx', 'utf8');
if (!profileSetupSource.includes('<KeyboardAwareScrollView')) {
  findings.push('profile-setup: editable fields must stay inside KeyboardAwareScrollView');
}
if (/KeyboardAvoidingView|revealBioInput|scrollToEnd\(/.test(profileSetupSource)) {
  findings.push('profile-setup: must not use duplicate or bio-only keyboard workarounds');
}

const keyboardScrollSource = readFileSync('src/components/KeyboardAwareScrollView.tsx', 'utf8');
if (!keyboardScrollSource.includes('react-native-keyboard-controller')) {
  findings.push('KeyboardAwareScrollView: must use the Expo-compatible native controller');
}

const bottomSheetSource = readFileSync('src/components/InteractiveBottomSheet.tsx', 'utf8');
if (!bottomSheetSource.includes('keyboardAvoiding = false')) {
  findings.push('InteractiveBottomSheet: keyboard avoidance must be opt-in to prevent nesting');
}

for (const file of [
  'src/features/profile/components/CountryPickerField.tsx',
  'src/features/profile/components/LanguagePreferencesField.tsx',
  'src/features/discover/components/CountryMultiSelectField.tsx',
]) {
  const source = readFileSync(file, 'utf8');
  if (!/<InteractiveBottomSheet[\s\S]*?keyboardAvoiding/.test(source)) {
    findings.push(`${file}: searchable picker sheet must avoid the keyboard`);
  }
}

const dateFeedbackSource = readFileSync(
  'src/features/chat/components/DateFeedbackSheet.tsx',
  'utf8',
);
if (!dateFeedbackSource.includes('<KeyboardAwareScrollView')) {
  findings.push('DateFeedbackSheet: long feedback form must scroll above the keyboard');
}

const operationsSource = readFileSync(
  'src/features/operations/screens/OperationsScreen.tsx',
  'utf8',
);
const actionDialogSource = operationsSource.slice(
  operationsSource.indexOf('function ActionDialog'),
  operationsSource.indexOf('function Action(', operationsSource.indexOf('function ActionDialog')),
);
if (!actionDialogSource.includes('<KeyboardAwareScrollView')) {
  findings.push('Operations ActionDialog: moderation note must scroll above the keyboard');
}

const rootLayoutSource = readFileSync('app/_layout.tsx', 'utf8');
if (!rootLayoutSource.includes('<KeyboardProvider>')) {
  findings.push('root layout: KeyboardProvider is required for keyboard-aware forms');
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
