# Database

스키마는 `supabase/migrations`로만 변경한다. Dashboard의 수동 변경은 실험 이후 migration으로 환원해야 하며 development → preview → production 순서로 적용한다.

## 핵심 테이블

| Table               | 역할                     | 필수 불변조건                             |
| ------------------- | ------------------------ | ----------------------------------------- |
| `profiles`          | 공개 발견 프로필         | auth user PK, 18+ 검증, 운영 심사 상태    |
| `profile_photos`    | 순서가 있는 Storage 경로 | 사용자당 position 1~6 unique              |
| `interests`         | 관심사 카탈로그          | unique slug                               |
| `profile_interests` | 프로필/관심사 연결       | composite PK                              |
| `profile_languages` | 추가 구사 언어/수준      | 사용자·언어 unique, owner-only            |
| `profile_tags`      | 관계 목적/분위기 메타    | 허용 category/value 조합, composite PK    |
| `swipes`            | like/pass 선택           | `(swiper_id,target_id)` unique, self 금지 |
| `matches`           | 상호 선택 관계           | canonical user pair unique                |
| `messages`          | Match 대화               | 활성 Match 참여자만 작성                  |
| `blocks`            | 방향성 차단              | pair unique, 즉시 접근 차단               |
| `reports`           | 안전 신고                | 신고자 소유, 운영 검토 상태               |
| `user_settings`     | 필터/환경설정            | owner-only, 선호 연령 18~90세             |
| `subscriptions`     | Ad-Free 상태             | client read-only, server write            |
| `profile_visits`    | 프로필 방문 기록         | 검증 RPC write, Gold 소유자 read           |

## Swipe와 Match

운영형 Swipe 기록은 현재 후보 ID와 `like/pass` action을 받아 다음을 처리한다.

1. 후보가 현재 사용자에게 노출 가능한지 재검증
2. `swiper_id/target_id` unique constraint로 중복 선택 방지
3. `like`의 reciprocal like가 있으면 canonical user pair로 match upsert

`least(user_id)` / `greatest(user_id)` canonicalization, unique constraint, server validation으로 동시 요청에서도 중복 Match를 막는다.

## Discovery

`get_discovery_candidates`는 운영 승인되고 `last_active_at`이 최근 7일 이내인 프로필만 대상으로 본인, 기존 선택, 양방향 차단을 제외하고 관심 성별, 연령, 국가, 성별 필터를 적용한다. 이후 Gold Pass → 최근 활동 → 신규 → 프로필 완성도 순으로 정렬한다. Gold는 후보 자격을 우회하지 않으며 AI 추천이나 설명할 수 없는 점수는 사용하지 않는다.

Gold 권한은 `subscriptions.product_id = 'wichu_gold_monthly'`의 활성 상태와 만료일로만 판정한다. client는 구독을 쓸 수 없고, 비공개 DB 함수는 외부에 만료일을 노출하지 않은 채 활성 여부만 반환한다. 방문자 목록 RPC는 Gold가 유효한 본인에게만 결과를 반환한다.

`touch_presence()`는 인증된 사용자가 자신의 `last_active_at`만 갱신하는 `security invoker` 함수다. 앱이 활성 상태일 때 진입 즉시와 2분 간격으로 호출하고, 백그라운드에서는 중지한다. 5분 이내는 온라인, 이후 1시간 미만은 분, 24시간 미만은 시간, 7일 이내는 일 단위로 표시한다.

프로필 키워드는 `connection_goal`, `vibe`, `daily_rhythm`, `communication_style` 카테고리로 분리한다. 허용 값은 migration의 check constraint로 검증하며, 앱은 관계 목적 최대 2개, 분위기 최대 3개, 나머지 카테고리는 각 1개로 제한한다.

## RLS

- 모든 public table에서 RLS 활성화
- Data API의 table/function grant는 프로젝트 기본값에 기대지 않고 migration에서 최소 권한으로 명시
- 공개 프로필도 인증 사용자에게 필요한 컬럼만 노출
- swipe/settings/report는 소유자 범위로 제한
- match/message는 참여자만 접근하고 차단 시 즉시 거부
- 구독/결제 상태는 클라이언트 쓰기 금지
- 사진 bucket은 private, path 첫 segment는 소유자 ID
- privileged function은 비노출 schema, 고정 search path, 최소 권한 사용
- `raw_user_meta_data`는 권한 판단에 사용하지 않고 운영 권한은 server-managed app metadata 또는 DB role table에서 판단

## 최초 프로필 심사

- 최초 프로필은 필수 정보와 position 1 대표 사진이 있어야 `pending`으로 제출 가능
- `draft → pending → approved/rejected` 상태를 DB에서 강제
- `pending`과 `rejected` 사용자는 승인된 후보를 탐색하고 Swipe할 수 있지만, 본인 프로필과 공개 사진은 다른 사용자에게 노출되지 않음
- 운영자만 최소 공개 정보 심사 큐를 조회하고 승인/반려 RPC를 실행
- 일반 사용자는 심사 컬럼을 직접 수정할 수 없고 자신의 상태와 검토 내용만 조회

## 운영 데이터

- 계정 삭제 요청은 Auth, 프로필, 사진, 관계 데이터와 provider 데이터를 추적 가능한 작업으로 처리
- 사용자 삭제 전 활성 session을 revoke/sign-out하고 삭제 완료를 별도로 검증
- 신고 보존 기간과 사용자 삭제 예외는 정책 문서와 일치시킴
- 메시지/민감 데이터는 분석 이벤트나 일반 로그에 복제하지 않음
- production migration 전 backup/restore 가능 여부와 예상 lock을 확인

## 검증 게이트

- 중복 swipe/match 동시성 테스트
- 비참여자 message insert 차단 테스트
- 차단 전후 profile/message 접근 테스트
- 18세 미만 profile 생성/수정 차단 테스트
- 탈퇴 및 사진 삭제 테스트
- migration 적용 후 Supabase Database/Security Advisor 확인

## 개발용 테스트 프로필

- `supabase/seed.sql`에 `@wichu.test` 비로그인 계정 5명을 고정 UUID로 유지
- AI 생성 대표 사진은 `supabase/seed-assets/test-profiles/<profile-id>/seed-primary.png`에 보관
- 테스트 계정은 `raw_app_meta_data.is_test = true`, 승인 상태로만 생성
- 출시 전 고정 UUID 5명의 Auth/Profile/Storage 데이터를 일괄 제거
