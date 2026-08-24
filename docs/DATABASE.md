# Database

스키마는 `supabase/migrations`로만 변경한다. Dashboard의 수동 변경은 실험 이후 migration으로 환원해야 하며 development → preview → production 순서로 적용한다.

## 핵심 테이블

| Table                       | 역할                     | 필수 불변조건                                  |
| --------------------------- | ------------------------ | ---------------------------------------------- |
| `profiles`                  | 공개 발견 프로필         | auth user PK, 18+ 검증, 운영 심사 상태         |
| `profile_photos`            | 순서가 있는 Storage 경로 | 사용자당 position 1~6 unique, 사진별 심사 상태 |
| `interests`                 | 관심사 카탈로그          | unique slug                                    |
| `profile_interests`         | 프로필/관심사 연결       | composite PK                                   |
| `profile_languages`         | 추가 구사 언어/수준      | 사용자·언어 unique, owner-only                 |
| `profile_tags`              | 관계 목적/분위기 메타    | 허용 category/value 조합, composite PK         |
| `profile_details`           | 선택형 추가 프로필 정보  | 프로필과 1:1, 허용 값·키·신장 범위 검증        |
| `swipes`                    | like/pass 선택           | `(swiper_id,target_id)` unique, self 금지      |
| `matches`                   | 상호 선택 관계           | canonical user pair unique                     |
| `messages`                  | Match 대화               | 활성 Match 참여자만 작성                       |
| `match_read_states`         | Match별 사용자 읽음 상태 | `(match_id,user_id)` PK, RPC 전용 접근         |
| `blocks`                    | 방향성 차단              | pair unique, 즉시 접근 차단                    |
| `reports`                   | 안전 신고                | 신고자 소유, 운영 검토 상태                    |
| `user_settings`             | 필터/환경설정            | owner-only, 선호 연령 18~90세, 같은 국적 제외  |
| `subscriptions`             | Ad-Free 상태             | client read-only, server write                 |
| `profile_visits`            | 프로필 방문 기록         | 검증 RPC write, Gold 소유자 read               |
| `push_devices`              | Expo Push 기기 토큰      | owner-only, token unique                       |
| `account_deletion_requests` | 삭제 작업 queue          | client 직접 접근 차단, user unique             |
| `notification_outbox`       | Match/메시지 Push 작업   | client 접근 차단, source별 idempotent          |
| `push_delivery_receipts`    | 기기별 Expo 전송 결과    | client 접근 차단, ticket/receipt unique        |

## Swipe와 Match

운영형 Swipe 기록은 `record_my_swipe` RPC가 현재 후보 ID와 `like/pass` action을 받아 다음을 한 트랜잭션으로 처리한다.

1. 후보가 현재 사용자에게 노출 가능한지 재검증
2. `swiper_id/target_id` unique constraint로 중복 선택 방지
3. 양방향 pair advisory lock으로 동시 Pick을 직렬화
4. `like`의 reciprocal like가 있으면 canonical user pair로 match upsert하고 생성된 Match ID 반환

`least(user_id)` / `greatest(user_id)` canonicalization, unique constraint, server validation으로 동시 요청에서도 중복 Match를 막는다.

되돌리기는 `undo_my_swipe`가 서버에서 가장 최근 Swipe인지와 활성 Match 발생 여부를 다시 확인한다. Gold Pass는 크레딧 없이 연속 사용하고, 그 외 사용자는 private 크레딧 계정에서 1회를 원자 차감한다. 보상 크레딧 지급 RPC는 `service_role` 전용이며 광고 공급자의 검증된 고유 event ID를 중복 방지 키로 사용한다.

메시지는 클라이언트가 생성한 UUID를 `client_id`로 `send_my_message` RPC에 전달한다. `(sender_id,client_id)` unique constraint로 응답 유실 뒤 같은 요청을 재시도해도 한 행만 유지한다. 대화방 진입 및 상대 메시지 수신 시 `mark_match_read`가 사용자별 읽음 시각을 저장한다. Match 목록은 `get_my_match_connections`가 Match마다 lateral query로 최신 메시지 한 건과 unread를 함께 반환한다. 전 대화에 하나의 전역 message limit을 적용하지 않는다. `swipes`와 `messages`의 클라이언트 직접 쓰기 권한은 제거한다.

상호작용 수명은 서버의 `swipes.expires_at`으로 강제한다. Pick은 보낸 기록과 받은 기록 모두 생성 후 24시간 동안만 활성이고, Pass는 3일 동안 후보 재노출을 막은 뒤 같은 프로필이 Discover에 다시 들어올 수 있다. Discover 후보는 `last_active_at`이 최근 7일 이내인 활성 사용자로 한정한다. Match와 메시지는 자동 만료하지 않으며, 참여자가 명시적으로 `end_my_match`를 실행할 때만 대화가 종료되고 양쪽 목록에서 숨겨진다.

번역은 활성 Match 참여자가 메시지별로 요청할 때만 `translate-message` Edge Function이 실행된다. 서버는 참여자·차단 상태를 다시 확인하고 사용자당 하루 100회의 cache-miss 제한을 적용한다. 동일 메시지·동일 대상 언어의 동시 요청은 private job lock으로 하나만 공급자에 전달하며 결과는 원문과 분리된 `translated_content`에 언어 코드별로 캐시한다. 번역 공급자 키는 Supabase secret에만 저장하고 클라이언트나 일반 로그에 원문을 복제하지 않는다.

## Discovery

`get_discovery_candidates`는 운영 승인되고 `last_active_at`이 최근 7일 이내인 프로필만 대상으로 본인, 기존 선택, 양방향 차단을 제외하고 관심 성별, 연령, 국가, 성별 필터를 적용한다. `exclude_same_country`가 켜지면 현재 사용자의 프로필 국가 코드와 같은 후보도 서버에서 제외한다. 이후 Gold Pass → 최근 활동 → 신규 → 프로필 완성도 순으로 정렬한다. Gold는 후보 자격을 우회하지 않으며 AI 추천이나 설명할 수 없는 점수는 사용하지 않는다.

Gold 권한은 `subscriptions.product_id = 'wichu_gold_monthly'`의 활성 상태와 만료일로만 판정한다. client는 구독을 쓸 수 없고, 비공개 DB 함수는 외부에 만료일을 노출하지 않은 채 활성 여부만 반환한다. 방문자 목록 RPC는 Gold가 유효한 본인에게만 결과를 반환한다.

RevenueCat webhook은 service-role 전용 `process_revenuecat_subscription_event`로만 구독을 반영한다. `private.monetization_provider_events`는 provider event ID를 중복 방지 키로 삼고, `private.subscription_provider_state`는 상품·플랫폼별 최신 event 시각을 저장해 느리게 도착한 이전 webhook이 권한을 되돌리지 못하게 한다.

`touch_presence()`는 인증된 사용자가 자신의 `last_active_at`만 갱신하는 `security invoker` 함수다. 앱이 활성 상태일 때 진입 즉시와 2분 간격으로 호출하고, 백그라운드에서는 중지한다. 5분 이내는 온라인, 이후 1시간 미만은 분, 24시간 미만은 시간, 7일 이내는 일 단위로 표시한다.

프로필 키워드는 `connection_goal`, `vibe`, `daily_rhythm`, `communication_style` 카테고리로 분리한다. 허용 값은 migration의 check constraint로 검증하며, 앱은 관계 목적 최대 2개, 분위기 최대 3개, 나머지 카테고리는 각 1개로 제한한다.

선택형 프로필 정보는 `profile_details`에 프로필과 1:1로 분리한다. 화면에서는 직장·학력·키를 기본 정보로, MBTI·음주·흡연·운동·반려동물을 취향과 라이프스타일로 분류한다. 모든 항목은 선택사항이며 사용자가 입력한 항목만 상세 프로필에 공개한다. 현재 위치와 도시는 프로필 정보로 저장하지 않고, 별도 위치 권한으로 계산한 거리만 노출한다.

## RLS

- 모든 public table에서 RLS 활성화
- Data API의 table/function grant는 프로젝트 기본값에 기대지 않고 migration에서 최소 권한으로 명시
- 공개 프로필도 인증 사용자에게 필요한 컬럼만 노출
- swipe/settings/report는 소유자 범위로 제한
- match/message는 활성 상태의 참여자만 접근하고 차단 또는 매치 종료 시 즉시 거부
- 구독/결제 상태는 클라이언트 쓰기 금지
- 사진 bucket은 private, path 첫 segment는 소유자 ID
- privileged function은 비노출 schema, 고정 search path, 최소 권한 사용
- `raw_user_meta_data`는 권한 판단에 사용하지 않고 운영 권한은 server-managed app metadata 또는 DB role table에서 판단
- 운영 권한은 `private.admin_users`와 좁은 범위 RPC로만 확인한다. 프로필 심사와 신고 triage는 원본 테이블에 대한 관리자 직접 권한 없이 각각 전용 queue/action RPC를 사용한다.
- `supabase/tests/p0_rls_contract.sql`은 일반 사용자·운영자 경계, 중복 Swipe, 상호 Match, Match read model, 메시지 idempotency, unread/read, Chat 참여자 제한을 롤백 트랜잭션으로 회귀 검증한다.

## 최초 프로필 심사

- 최초 프로필은 필수 정보와 position 1 대표 사진이 있어야 `pending`으로 제출 가능
- `draft → pending → approved/rejected` 상태를 DB에서 강제
- `pending`과 `rejected` 사용자는 승인된 후보를 탐색하고 Swipe할 수 있지만, 본인 프로필과 공개 사진은 다른 사용자에게 노출되지 않음
- 운영자만 최소 공개 정보 심사 큐를 조회하고 승인/반려 RPC를 실행
- 일반 사용자는 심사 컬럼을 직접 수정할 수 없고 자신의 상태와 검토 내용만 조회
- 최초 승인 후 기본 정보·추가 정보·취향·소개·언어 변경은 즉시 반영되며 프로필 승인 상태를 유지
- 새로 추가하거나 교체한 Storage 경로만 사진별 `pending`이 되고, 기존 승인 사진은 계속 공개
- 사진 반려는 해당 사진 행에만 기록하며 승인된 프로필 전체를 비공개로 되돌리지 않음

## 운영 데이터

- 프로필 편집은 새 사진을 먼저 private Storage에 임시 업로드한 뒤 `save_my_profile_for_review` RPC 한 트랜잭션으로 프로필·설정·언어·키워드·관심사·사진 순서를 저장한다. 서버는 기존 Storage 경로의 사진 심사 상태를 보존하고 새 경로만 심사 큐에 넣는다. 실패하면 새 업로드만 정리하고 기존 공개 데이터는 보존한다.
- `push_devices`는 본인 토큰만 등록·조회·삭제할 수 있고 로그아웃 시 기기 토큰 행을 제거한다. 등록 RPC는 인증 사용자 ID를 서버에서 고정하고 동일 기기의 계정 전환·토큰 재활성화를 원자적으로 처리한다.
- Match/메시지 trigger는 사용자 알림 설정과 차단 상태를 확인한 뒤 `notification_outbox`에 한 번만 적재한다. Database Webhook이 secret-auth Edge Function을 호출하며 Expo Push의 `data.url`은 허용된 앱 내부 경로만 사용한다.
- outbox claim은 attempts를 원자 증가시키고 15분 이상 중단된 `processing` 작업만 재시도한다. 기기별 Expo ticket과 receipt는 `push_delivery_receipts`에 저장하며, receipt의 `DeviceNotRegistered` 오류는 해당 `push_devices` 행을 비활성화한다.
- 비활성화 RPC는 즉시 프로필을 비공개로 전환하고 활성 Match와 Push를 중지한다.
- `end_my_match`는 참여자 본인의 활성 Match만 `unmatched`로 전환한다. 전환 직후 Match 행과 기존 메시지는 양쪽 사용자에게 모두 보이지 않고 새 메시지 작성도 거부된다.
- 계정 삭제 요청은 즉시 프로필·Match·Push를 비활성화한 뒤 원자적으로 worker 실행권을 획득한다. worker는 Storage API로 사진을 먼저 제거하고 Auth 사용자를 삭제해 cascade로 관계 데이터를 정리한다.
- 삭제 worker는 15분 경과한 중단 작업만 재시도하고 동시 실행을 거부한다. Auth 삭제 전 trigger가 사용자 UUID의 SHA-256 fingerprint, 요청·완료 시각, 제거 사진 수만 비식별 감사 기록으로 보존한다.
- 좌표 원본은 새 좌표로 덮어쓰며 30일 이상 갱신되지 않으면 삭제한다. 삭제 완료 감사 기록은 1년, 완료·최종 실패 Push 기록은 30일 보존 후 `pg_cron`으로 자동 삭제한다. 신고와 관계 데이터는 계정 탈퇴 시 cascade로 삭제한다.
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
