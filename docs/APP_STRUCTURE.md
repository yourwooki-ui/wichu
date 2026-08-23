# WICHU App Structure — 1.0

## 1. 제품 구조 원칙

WICHU 1.0은 `가입 → 프로필 승인 → 발견 → 상호 Pick → 대화 → 관계/안전 관리`가 끊기지 않는 소셜 디스커버리 앱이다. 화면 수를 늘리기보다 각 화면의 목적과 대표 행동을 분명하게 만든다.

- 한 화면에는 하나의 대표 목적만 둔다.
- 핑크는 Pick, 주요 CTA, 미확인 상태에만 사용한다.
- 라임은 온라인, 신규, Match 성사 같은 성공 상태에만 제한한다.
- 사진 콘텐츠를 가장 강하게, 내비게이션과 상태 정보는 한 단계 낮게 표현한다.
- 3D 아이콘은 주요 내비게이션과 상징적 상태에만 사용하고 일반 행·폼에는 단순 아이콘을 사용한다.
- 밝은 기본 배경 위에서 충분한 명도 대비를 확보한다.
- 모든 목록은 loading / empty / error / content 상태를 가진다.
- 신고, 차단, 매치 종료, 탈퇴는 숨기지 않되 실수로 실행되지 않게 확인 단계를 둔다.

## 2. 최상위 정보구조

```text
Entry
├─ Splash / Session restore
├─ Login / Sign up / Language
└─ Profile Setup / Review Status

Main Tabs
├─ Matches
├─ Chat
├─ Discover (기본 진입)
├─ Shop
└─ Me

Stack / Modal
├─ Profile Detail
├─ My Profile Preview
├─ Chat Room
├─ Settings
├─ Ad-Free
├─ Discover Filters sheet
├─ Notifications sheet
├─ Match celebration modal
└─ Report / Block action sheet
```

주요 화면은 10개를 유지한다. Shop은 Ad-Free 진입을 위한 탭 랜딩이며 별도 복잡한 상품 경제를 만들지 않는다. Filter, Notification, 신고·차단, Match 성사 화면은 sheet/modal로 처리한다.

## 3. 전역 내비게이션

하단 순서는 `Matches / Chat / Discover / Shop / Me`로 고정한다.

| 탭       | 역할                       | 배지                       |
| -------- | -------------------------- | -------------------------- |
| Matches  | 새 Match와 기존 Match 확인 | 새 Match 수                |
| Chat     | 대화 목록과 unread 확인    | 읽지 않은 메시지 수        |
| Discover | 핵심 1카드 탐색            | 없음, 중앙 강조            |
| Shop     | Ad-Free 상품 진입          | 없음                       |
| Me       | 내 프로필과 설정           | 심사/프로필 보완 필요 상태 |

헤더는 페이지별로 동일한 세로 리듬을 사용한다. Discover의 헤더 액션은 되돌리기, 필터, 알림 순이다. 알림의 핑크 점은 실제 미확인 항목이 있을 때만 표시한다.

## 4. 페이지별 설계

### 4.1 Splash / Login

목적: 3초 안에 로그인, 가입, 언어 변경 중 하나를 선택하게 한다.

- 로고와 짧은 브랜드 문장
- `Google로 계속하기`를 우선 CTA로 배치
- 이메일 로그인/가입은 동일한 시각 계층으로 제공
- 언어 변경은 상단 또는 하단의 짧은 진입점
- 가입 모드에만 생년월일, 18+ 고지, 약관 동의를 표시
- 로그인과 회원가입의 뒤로가기 규칙을 동일하게 유지

상태: session restore / login / sign-up / email sent / auth error.

### 4.2 Profile Setup / Review Status

목적: 공개 가능한 최소 프로필을 단계적으로 완성하고 운영 심사에 제출한다.

단계:

1. 기본 정보: 이름, 생년월일, 성별
2. 발견 취향: 관심 성별, 18~90세 범위, 국가
3. 언어: 모국어, 구사 언어, 각 구사 수준
4. 소개: 소개글, 관심사, 연결 목적, 바이브 키워드
5. 사진: 대표 사진 필수, 최대 6장, 순서 변경
6. 확인/제출: 공개 정보 미리보기와 심사 제출

심사 중에도 Discover는 사용할 수 있지만 본인의 미승인 공개 사진은 타인에게 노출하지 않는다. Review Status 하단에는 `스와이프하러 가기`를 둔다.

최초 세팅은 가입 완료에 필요한 정보만 순차적으로 묻는 온보딩이다. 가입 이후 수정은 별도 `/profile-edit` 편집기에서 기본·추가·취향·소개·사진 섹션으로 관리하며 최초 세팅 화면을 재사용하지 않는다.

### 4.3 Discover

목적: 최근 7일 이내 활동한 조건 일치 후보를 네트워크 대기 없이 연속 탐색한다.

- 화면에는 현재 카드 한 장만 표시
- 다음 5개 후보와 대표 사진을 prepare
- 오른쪽 Swipe 또는 빠른 두 번 탭: Pick
- 왼쪽 Swipe: Pass
- 한 번 탭: Profile Detail
- 헤더: 되돌리기 / 필터 / 알림
- Gold Pass는 Match가 생성되지 않은 최근 Swipe를 광고 없이 연속 되돌릴 수 있음
- Free/Ad-Free는 사용자가 직접 선택한 보상형 광고 시청 완료로 받은 1크레딧을 사용해 직전 Swipe 한 건을 되돌림
- 덱이 5장 미만이면 백그라운드 refill
- 개발 샘플 5명은 개발 빌드에서만 순환

상태: initial loading / card / background refill / empty / recoverable error / match modal.

### 4.4 Profile Detail

목적: Pick 전에 상대의 사진과 맥락을 충분히 확인한다.

- 상단 사진 pager와 사진 진행 표시
- 이름, 나이, 인증, 거리, 최근 접속, 국가
- 소개, 국가, 언어와 수준, 관심사, 프로필 키워드
- 하단 고정 행동: Pass / Pick
- 더보기에서 신고 / 차단
- Discover에서 진입 시 뒤로가면 동일 카드 상태를 유지
- 사진·기본정보·라이프스타일·언어·관심사는 공통 `StandardProfileDetail` 규격만 사용

### 4.5 Matches

목적: 새 Match를 발견하고 대화를 시작한다.

- 상단 `New matches` 가로 목록
- 하단 최근 Match 목록
- 항목 정보: 사진, 이름, 성사 시점, 마지막 활동
- 대표 행동: `Say hi`
- 아직 메시지가 없는 Match를 Chat 목록과 시각적으로 구분
- Match 종료는 상세 action sheet에서 제공

상태: skeleton / empty / content / error.

### 4.6 Chat List

목적: 읽지 않은 대화를 우선 확인하고 빠르게 재진입한다.

- unread 대화 우선, 이후 최신 메시지 순
- 사진, 이름, 마지막 메시지, 시간, unread badge
- 차단/종료된 대화는 작성 불가 상태 표시
- 상단 검색은 1.0 필수 아님. 대화가 많아질 때 활성화
- 새 Match는 Matches에 집중시키고 Chat에는 첫 메시지 이후 노출

### 4.7 Chat Room

목적: Match 관계 안에서 즉시성과 안전성을 갖춘 1:1 대화를 제공한다.

- 상단: 상대 사진/이름/접속 상태/더보기
- 메시지는 optimistic append 후 실패 시 재시도
- 번역은 메시지별 `번역 보기`로 원문을 보존
- 상대 메시지 unread/read 상태는 과도하게 강조하지 않음
- 더보기: 프로필 보기 / 신고 / 차단 / Match 종료
- 차단 또는 Match 종료 시 composer 즉시 잠금

### 4.8 Shop / Ad-Free

목적: 복잡한 상점 없이 광고 제거 가치만 명확히 설명한다.

- Shop에는 Ad-Free 카드 한 개와 현재 이용 상태만 제공
- Ad-Free 상세: 혜택, 가격, 구매, 복원, 약관 링크
- 코인, Boost, 선물, 무제한 Pick 상품은 금지
- 결제 미연동 환경에서는 구매 CTA 대신 준비 상태를 명확히 표시

### 4.9 Me

목적: 내 공개 프로필 상태와 계정 관리 진입점을 한곳에 모은다.

- 대표 사진, 이름/나이/국가, 심사 상태
- 프로필 완성도와 `프로필 수정`
- 내 프로필 미리보기
- 미리보기 카드를 누르면 상대 상세프로필과 동일한 표준 전체 화면으로 전환
- 내 미리보기에서는 Pick/Pass·신고를 숨기고 프로필 수정 행동만 제공
- Ad-Free 상태
- 설정 진입
- 공개 프로필과 계정 설정을 한 카드에 혼합하지 않음
- 상세 정보를 마이페이지에 다시 펼쳐놓지 않고 표준 전체 미리보기로 연결

### 4.10 Settings

목적: 발견, 알림, 안전, 계정을 예측 가능한 섹션으로 관리한다.

섹션:

- Discovery: 성별, 나이, 국가, 발견 허용
- Notifications: Match, 메시지, 마케팅
- Privacy & Safety: 차단 목록, 위치/거리 표시, 커뮤니티 기준
- Language: 앱 언어
- Account: 로그아웃, 비활성화, 탈퇴
- Legal & Support: 약관, 개인정보, 문의, 앱 버전

탈퇴는 재인증·영향 안내·최종 확인을 거친다.

## 5. 공통 UI 상태

| 상태               | 원칙                                              |
| ------------------ | ------------------------------------------------- |
| Initial loading    | 레이아웃과 같은 skeleton, 전체 spinner 남용 금지  |
| Background loading | 기존 콘텐츠 유지, 작은 상태만 표시                |
| Empty              | 이유와 다음 행동 한 개 제공                       |
| Error              | 사용자가 복구 가능한 문구와 retry 제공            |
| Offline            | 저장 가능한 로컬 행동은 유지하고 동기화 상태 표시 |
| Disabled           | 이유가 예측 가능해야 하며 색만으로 구분하지 않음  |

## 6. 데이터와 성능 계약

- Discover 초기 후보/prepare/refill 기준은 5명이다.
- 현재 카드 제거와 다음 카드 표시는 로컬에서 먼저 처리한다.
- 프로필 사진은 `memory-disk` cache를 사용한다.
- 탭 이동 시 이미 확보한 서버 상태를 유지하고 매번 초기화하지 않는다.
- Matches, Chat, Me는 TanStack Query 서버 상태를 사용한다.
- Swipe gesture, 카드 queue처럼 짧은 상태만 Zustand에 둔다.
- 메시지는 match 단위 Realtime channel만 구독한다.
- unread, 알림, 심사 상태는 실제 데이터가 있을 때만 badge를 표시한다.

## 7. 운영·안전 계약

- 미승인 프로필은 타인에게 공개하지 않는다.
- 차단 관계에서는 프로필 조회, 후보 추천, 메시지 작성이 모두 중단된다.
- 신고 접수 후 사용자가 같은 신고를 반복 전송하지 않게 한다.
- 운영자는 프로필 심사, 신고 triage, 계정 비활성화 이력을 확인할 수 있어야 한다.
- 로그와 관측성 이벤트에 생년월일, 메시지 원문, 토큰을 기록하지 않는다.

## 8. 구현 순서

1. 공통 App Header / page state / list row 컴포넌트
2. Matches 실제 데이터와 Match celebration
3. Chat List + Chat Room optimistic/realtime
4. Me 실제 프로필과 수정 재진입
5. Settings 발견/알림/안전/계정
6. Profile Detail 하단 Pick/Pass 및 Discover 상태 연계
7. Shop / Ad-Free provider 연결
8. Push, 관측성, 접근성, 다국어, 실기기 QA
