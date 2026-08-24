# WICHU UX Benchmark

## 목적

WICHU의 브랜드와 1카드 Swipe 구조는 유지하면서, 검증된 데이팅 앱의 전환·안전·상태 안내 패턴을 운영 가능한 수준으로 반영한다. 화면이나 문구를 복제하지 않고 사용자 문제와 해결 원칙만 참고한다.

## 공개 제품 기준 비교

| 제품                   | 확인한 핵심 패턴                                                                                                                   | WICHU 적용                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Tinder                 | Swipe 방향이 명확하고 상호 Like 직후 Match→Chat 전환을 강하게 안내한다. 프로필·채팅 어디서든 신고, 차단, Unmatch에 접근할 수 있다. | 최초 1회 제스처 코치, 브랜드형 Match 모달, 상세·채팅 안전 메뉴, Match 종료를 유지한다.         |
| Bumble                 | Opening Moves로 첫 메시지 부담을 낮추고, 프로필·사진 완성 안내와 안전한 대화 도구를 전면에 둔다.                                   | AI 없이 고정형 첫 문장 제안, 개인정보 공유 주의 안내, 프로필 완성·심사 상태를 명확히 표시한다. |
| Hinge                  | 사진·프롬프트 등 구체적인 프로필 요소가 대화의 시작점이 되며, Likes You·Matches 상태를 구분한다.                                   | 관심사·소개·언어 레벨을 상세에서 읽기 쉽게 구성하고, 나를 픽함·매칭됨·방문자를 분리한다.       |
| MEEFF 계열 글로벌 탐색 | 국가·언어 맥락과 번역이 연결의 장벽을 낮춘다.                                                                                      | 국기, 거리, 활동 상태, 모국어·구사 수준, 메시지별 선택 번역을 핵심 메타로 유지한다.            |

## 화면별 UX 계약

### Discover

- 왼쪽 Swipe는 Pass, 오른쪽 Swipe와 빠른 두 번 탭은 Pick, 한 번 탭은 상세 보기다.
- 최초 1회만 제스처 코치를 노출한다.
- 다음 후보 사진을 미리 준비하고 활성 카드에서는 별도 액션 버튼을 노출하지 않는다.
- 후보 소진, 네트워크 오류, 재시도, 탐색 조건 조정을 서로 다른 행동으로 안내한다.
- Match 발생 시 시스템 Alert 대신 상대 정보와 `첫 인사 보내기`가 포함된 브랜드 화면을 표시한다.

### Connections

- `나를 픽함 / 매칭됨 / 방문자`는 한 화면의 탭으로 구분한다.
- 각 탭은 loading, error, empty 상태와 다음 행동을 가진다.
- 방문자는 Gold Pass가 아니면 사진을 블러 처리하고 상점으로 연결한다.
- `나를 픽함` 데이터는 본인에게 도착한 Like만 읽을 수 있는 RLS 정책과 security-invoker RPC를 사용한다.

### Chat

- 목록은 실제 unread, 마지막 메시지, 온라인 상태를 우선한다.
- 검색 결과 없음과 대화 자체가 없음을 다른 상태로 안내한다.
- 새 대화에는 사용자가 선택·수정할 수 있는 고정형 첫 문장을 제공한다.
- 구현되지 않은 사진 첨부 같은 dead action은 노출하지 않는다.
- 메시지는 optimistic 전송, 실패 재전송, 선택 번역을 유지한다.
- 연락처·개인정보 공유 주의와 신고·차단·Match 종료를 대화에서 바로 제공한다.

## 적용하지 않는 패턴

- Feed, Story, Community, Video Call
- AI 추천과 AI 자동 메시지 작성
- 코인, 선물, 복잡한 부스트 아이템
- 핵심 탐색을 막는 강제 결제벽

## 참고 자료

- Tinder: https://tinder.com/en-AU/feature/swipe
- Tinder Safety: https://tinder.com/safety-tips/
- Bumble Date: https://bumble.com/en-us/date/
- Bumble Opening Moves: https://bumble.com/en-us/features/opening-moves/
- Hinge Overview: https://help.hinge.co/hc/en-us/articles/26845979318803-What-is-Hinge
- Hinge Match and Chat: https://help.hinge.co/hc/en-us/articles/360011090134-How-do-I-Match-with-someone-and-start-chatting
