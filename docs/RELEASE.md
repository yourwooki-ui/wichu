# Release

## 채널

| 채널        | 대상                    | 데이터               |
| ----------- | ----------------------- | -------------------- |
| development | 개발자, Expo dev build  | development Supabase |
| preview     | 내부 QA / 제한 테스터   | preview Supabase     |
| production  | App Store / Google Play | production Supabase  |

채널 간 `.env`, Supabase project, 앱 식별자/서명, IAP 상품을 혼용하지 않는다.

## CI gate

1. dependency install 고정 (`npm ci`)
2. TypeScript, ESLint, Prettier
3. 단위 테스트와 DB/RLS 통합 테스트
4. Expo config 검증 및 preview build
5. 핵심 여정 실기기 smoke test

## 스토어 전 체크

- 18+ 연령 정책과 생년월일 검증
- 신고·차단·탈퇴·데이터 삭제 경로
- 개인정보처리방침, 이용약관, 지원 URL
- 사진/채팅 권한과 privacy manifest 고지
- 광고 추적 동의 및 IAP restore/entitlement
- 앱 아이콘, 스플래시, 스크린샷, 설명의 브랜드 일치

## 배포

preview에서 migration을 먼저 적용하고 핵심 여정을 검증한다. production은 소수 비율 또는 제한 국가/테스터부터 시작해 crash, 인증, Pick, Match, Chat, 신고 지표를 확인한 뒤 확대한다.

## 롤백

- JS 변경은 호환 가능한 경우 이전 EAS Update/runtime으로 복귀
- native/runtime 변경은 이전 스토어 build 유지 또는 긴급 심사 배포
- DB migration은 무조건 down migration에 의존하지 않고 forward-fix와 backup restore 계획을 준비
- 새 앱과 이전 앱이 동시에 사용하는 기간 동안 schema backward compatibility 유지
