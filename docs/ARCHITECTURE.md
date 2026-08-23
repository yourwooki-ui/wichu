# Architecture

## 원칙

WICHU는 Expo SDK 57 기반 iOS/Android 네이티브 앱이다. Expo Router는 라우팅, TanStack Query는 서버 상태, Zustand는 짧은 수명의 인터랙션 상태를 담당한다. Supabase는 Auth, PostgreSQL, Storage, Realtime을 제공하며 모든 데이터 접근은 RLS를 통과한다.

```text
app routes
  → feature screens/components
    → query hooks + local interaction store
      → feature services
        → Supabase client / ads / IAP / notifications / translation
```

라우트는 얇게 유지하고 API/DB/UI를 분리한다. 광고, 결제, 알림, 번역 provider는 서비스 인터페이스 뒤에 두어 화면 코드를 바꾸지 않고 교체할 수 있게 한다.

## 인증 경로

- 이메일 인증과 Google OAuth는 `auth-service`를 통해 Supabase Auth에 연결한다.
- 웹은 `/auth/callback`, iOS/Android는 `wichu://auth/callback`으로 돌아온 뒤 PKCE code를 session으로 교환한다.
- Google 회원가입도 앱에서 생년월일과 약관 동의를 먼저 확인한다. Google이 생년월일을 제공하지 않으므로 실제 프로필 저장 시 DB trigger가 18세 이상을 다시 강제한다.
- Google Cloud OAuth secret은 앱 환경변수나 저장소에 두지 않고 Supabase Auth provider 설정에만 저장한다.

## Discover 성능 경로

1. 서버가 필터와 RLS를 적용하고 최근 접속 7일 이내 후보를 **5명 단위**로 반환한다.
2. 클라이언트는 현재 후보를 포함한 5명 prepare queue를 유지한다.
3. 현재 카드와 prepare queue의 사진을 `expo-image`로 prefetch한다.
4. Swipe 애니메이션 직후 다음 1카드를 즉시 표시한다.
5. 현재 후보에 대한 `like` 또는 `pass`를 optimistic mutation으로 기록한다.
6. queue가 5명 미만이 되면 기존 카드를 유지한 채 background refill한다.

개발 빌드에서는 고정 UUID의 샘플 프로필 5명만 순환하며 Swipe를 DB에 저장하지 않는다. preview/production의 실제 후보, Swipe unique constraint, Match 생성에는 이 예외를 적용하지 않는다.

`Swipe → API → 이미지 다운로드 → 다음 화면` 직렬 경로는 금지한다. 현재 mock SwipeDeck의 1카드 애니메이션·prefetch 구조를 유지하고 서버 batch/refill을 연결한다.

접속 상태는 전역 Auth 계층의 단일 heartbeat에서만 갱신한다. 카드별 heartbeat는 만들지 않으며, UI 상대 시간 갱신도 덱 단위 1분 timer 하나를 공유한다.

## Navigation 성능 경로

- 하단 5개 핵심 탭은 lazy route로 분리하지 않고 최초 앱 번들에 포함한다.
- 탭 화면은 최초 앱 안정화 시 eager mount하고, 비활성 화면은 분리하지 않은 채 freeze하여 재방문 렌더와 네트워크 요청을 피한다.
- TanStack Query의 공통 `matches/connections`와 entitlement cache를 Match·Chat·Shop·Me가 공유한다.
- 프로필 사진은 운영 프로필 조회에서 이미 발급된 signed URL을 재사용하고 `expo-image`의 memory/disk cache를 유지한다.
- 로컬 개발 서버 전환 시간은 production 성능 수치로 사용하지 않되, eager mount 이후에도 빈 화면이 노출되지 않는지 회귀 측정한다.

## Chat 경로

- Expo Crypto UUID를 `client_id`로 사용해 메시지를 즉시 표시
- `send_my_message` RPC가 동일 UUID 재시도를 idempotent하게 처리하고, 실패 메시지는 인라인 재전송
- match 단위 Realtime channel만 구독
- 대화방 진입과 상대 메시지 수신 시 읽음 상태를 저장하고 목록 unread cache를 갱신
- 차단, match status, 참여자 여부를 DB가 재검증
- 번역은 상대 메시지의 `번역 보기` 요청 때만 Edge Function을 호출하고, 원문 보존·참여자 재검증·언어별 DB cache·일일 제한을 거쳐 DeepL adapter 결과를 연결

## 환경과 배포

- `development`: 로컬 개발 및 mock 허용
- `preview`: 별도 Supabase 프로젝트, 내부 QA 빌드
- `production`: 운영 Supabase, 스토어 서명 빌드

환경별 URL, publishable key, IAP 상품 ID를 분리한다. secret/service role은 앱 번들에 절대 포함하지 않는다. EAS Build/Update 채널도 동일하게 분리하고 production update에는 승인과 rollback 절차를 둔다.

## 운영 품질

- 타입체크, ESLint, 포맷, 단위 테스트, DB/RLS 통합 테스트를 CI gate로 사용
- 인증·DB·Realtime 실패와 앱 크래시를 환경/버전별로 추적
- 로그에 토큰, 생년월일, 메시지 원문 등 민감 정보를 남기지 않음
- 저사양 Android와 대표 iOS 실기기에서 메모리·이미지·리스트 성능 검증
- 대규모 목록은 FlashList로 교체 가능한 item 경계를 유지

## 화면 구조 계약

전체 정보구조, 화면별 대표 행동, loading/empty/error 상태, 공통 UI 규칙은 `docs/APP_STRUCTURE.md`를 따른다. 라우트 파일은 해당 명세의 사용자-facing 화면만 제공하며 Filter, Notification, 신고·차단, Match 성사는 sheet/modal로 유지한다.

# 위치 및 거리 계산

- 클라이언트는 `expo-location`으로 사용자가 동의한 포그라운드 GPS 좌표만 수집한다.
- 로그인과 프로필 초기 설정이 끝난 첫 앱 진입에서 위치와 알림 권한을 각각 설명한 뒤 순서대로 요청한다. 이미 결정된 권한은 건너뛴다.
- 탐색 조건에는 별도 위치 설정 UI를 두지 않고 거리 범위만 조절한다.
- 위치 권한을 허용하지 않아도 앱 이용은 막지 않으며 거리 기반 결과의 정확도만 제한한다.
- 원본 좌표는 Data API에 노출되지 않는 `private.profile_locations`에 저장한다.
- 클라이언트는 다른 사용자의 좌표를 읽을 수 없으며 `get_discovery_candidates`가 PostGIS로 계산한 정수 km만 받는다.
- 위치 기준은 6시간 주기로 갱신하며 백그라운드 위치 추적은 사용하지 않는다.
- 알림 권한은 `expo-notifications`로 요청하며 Android 기본 채널은 `wichu-default`로 분리한다.
- Android 채널은 토큰 발급 전에 생성하고, 이미 알림 권한을 허용한 사용자는 앱 진입 때 Expo token을 재등록해 토큰 교체와 계정 전환을 복구한다.
- Match/메시지 outbox는 secret-auth Edge Function이 원자적으로 claim한다. Expo ticket은 기기별로 저장하고 15분 이후 receipt를 최대 1,000개씩 확인하며, 24시간이 지난 미확인 receipt는 만료 처리한다.
- Expo가 `DeviceNotRegistered`를 반환하면 해당 기기만 비활성화한다. 알림 탭은 허용 목록(`/matches`, `/chat`, `/chat/:uuid`)을 통과한 기본 액션만 라우팅하고 처리한 cold-start 응답은 즉시 비운다.
