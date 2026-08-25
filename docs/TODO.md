# WICHU 1.0 Launch TODO

## P0 — 기반과 데이터

- [x] Expo Router, TypeScript, Query, Zustand, i18n 기본 구조
- [x] WICHU 테마, 아이콘, 스플래시, 브랜드 문서
- [x] Supabase client/service 경계와 초기 migration 초안
- [x] development Supabase에 앱 스키마와 P0 migration 적용 및 RLS/advisor 재검증 — 2026-08-13 Security Advisor 오류 0건, 의도된 사용자 범위 `SECURITY DEFINER` RPC 경고와 유출 비밀번호 보호 경고만 잔존
- [x] 프로젝트 Data API 노출 설정과 migration의 명시적 grants 대조 — 새 public 객체 자동 노출 중지, 기존 19개 테이블 RLS·`anon` 차단·`authenticated` 최소 권한 원격 재검증 완료
- [x] 적용 스키마와 일치하는 typed Supabase client 정의
- [ ] Supabase 타입 자동 생성 — CLI 프로젝트 연결과 원격 타입 대조는 완료
- [x] migration/RLS CI — Supabase CLI 2.115.0을 고정하고 main 배포 전에 격리 DB migration 재생, 함수 lint, pgTAP 38개 계약 테스트를 강제
- [x] SQL Editor 적용분을 Supabase CLI migration history에 repair — 원격 객체 표식 확인 후 35개 기존 history 복구, 실제 누락된 rewarded undo migration만 별도 적용
- [ ] development / preview / production 환경 분리
- [ ] Expo 57 Metro 도구 체인의 `image-size`/`uuid` upstream advisory 추적 — 현재 강제 수정은 Expo 53으로 역다운그레이드하므로 적용 금지, 앱 사용자 업로드 런타임 경로와는 분리됨

## P0 — 핵심 사용자 여정

- [x] 이메일 인증, confirm deep link, protected session routing, 18+ 약관 동의
- [x] 이메일 비밀번호 재설정 요청·recovery deep link·새 비밀번호 저장 UI
- [ ] 비밀번호 재설정 redirect allowlist와 운영 SMTP 발송 도메인 검증
- [x] Google 로그인/회원가입 UI, Expo OAuth callback, session 교환 구조
- [ ] Google Cloud Web OAuth credentials와 Supabase Google provider/redirect allowlist 활성화
- [ ] Google/Apple Auth 운영 설정 — 18+ DB hook은 적용 완료, Dashboard의 Google provider와 iOS 동등 로그인 자격 증명 설정 대기
- [x] 정확한 생년월일을 재검증하는 18+ core profile 저장
- [x] 대표 사진 필수, 6장 사진 업로드/순서 변경, 운영진 최초 프로필 심사
- [x] 심사 대기 중 앱 탐색 허용, 미승인 프로필/공개 사진 노출 차단
- [x] 최초 승인 이후 일반 프로필 변경 즉시 반영, 신규·교체 사진만 사진 단위 재심사
- [x] AI 생성 사진을 포함한 해외 여성 개발용 테스트 프로필 5명 seed/원격 데이터 구성
- [x] 1카드 후보 batch RPC와 Swipe Discover UI 데이터 연결
- [x] 접속 상태 heartbeat/UI 및 최근 7일 이내 후보 제한
- [x] Discover 후보 5명 prepare/prefetch/background refill 및 개발 샘플 순환
- [x] 탐색 조건의 같은 국적 프로필 제외 — 사용자 설정 저장, 서버 후보 RPC와 개발 샘플 필터 연결
- [x] 실제 후보 optimistic pick 기록, 중복 방지, background refill — 인증 RPC·pair lock·unique constraint와 원격 P0 계약 테스트 완료
- [x] Match 생성/확인 상태 — 상호 Pick을 원자 처리하고 Discover 성사 알림에서 실제 채팅방 ID로 연결
- [x] optimistic Realtime Chat, 재시도, unread count — client UUID idempotency, 실패 탭 재전송, match별 읽음 저장·카운트 연결
- [x] 메시지 번역 adapter와 언어 상태 — DeepL API Free 활성화, `DEEPL_API_KEY` secret 등록, 원격 Function 부팅 수정, 참여자 검증·언어별 캐시·일일 제한 및 영문→한국어 실번역 E2E 검증 완료

## P0 — 안전과 운영

- [x] 프로필/대화 신고, 차단, match 종료 — 7개 공통 신고 사유, 차단 확인 UI와 저장, 차단 RLS, 채팅 안전 메뉴의 매치 종료 및 즉시 메시지 차단 연결
- [x] 차단 사용자 최소 read model 원격 적용 — 앱 목록·차단 해제, 최소 필드 RPC, `anon` 실행 차단·`authenticated` 전용 권한 검증 완료
- [x] 비활성화·탈퇴·데이터 삭제 완주 — 즉시 비공개/매치 종료/푸시 해제, 동시 실행 방지 queue, Storage/Auth 실제 삭제 worker와 비식별 완료 감사 기록 연결
- [x] 신고 triage와 프로필 심사용 최소 운영 센터 — DB role 기반 진입, queue/approve/reject/resolve 전용 RPC 연결
- [ ] Push 등록과 Match/메시지 deep link — 권한 재진입 token 갱신, Match/메시지 outbox, Edge Function 발송, 티켓/receipt 추적, `DeviceNotRegistered` 자동 비활성화, 안전한 앱 딥링크까지 완료; 15분 receipt 전용 Cron과 EAS 실기기 수신 QA 대기
- [x] 개인정보 최소화, 민감 로그 redaction, rate limit — 좌표 30일·삭제 감사 1년·완료 Push 30일 자동 파기와 공개 정책 일치 검증 완료
- [ ] 크래시·API 실패·핵심 funnel 관측성 연결

## P0 — 화면 구조 구현

- [x] 전체 정보구조와 페이지별 UX 계약 문서화 (`APP_STRUCTURE.md`)
- [x] 공통 App Header, skeleton, empty/error state 컴포넌트 정리 — `typography`/`elevation`/`duration`/`pressFeedback` 토큰, shimmer `Skeleton` 세트, 단일 `StateView`(빈 상태·오류·잠김)와 variant 지원 `PrimaryButton`으로 통합
- [x] Matches / Chat / Shop / Me 공통 탭 헤더 규격화, 웹 네이티브 프리뷰 비율·모달 포털·고정 영역 보정
- [x] 신규가입 프로필 설정과 일반 프로필 수정 진입/검증 분리, 콜드 스타트 프로필 상세 원격 조회
- [x] Chat 최초 메시지 50개 제한·과거 페이지 추가 조회·번역 캐시/Realtime 병합, 온라인 대화 상대 FlashList 가상화
- [x] 하단 탭 lazy mount·inactive screen detach와 Discover native-thread swipe gesture 전환
- [x] Matches UI: 신규 Match 카드 + 기존 Match 목록 + Say hi 진입
- [x] Matches 카테고리: 나를 픽함 / 매칭됨 / 프로필 방문자 전환형 화면
- [x] 프로필 방문 기록 테이블·RLS·조회 서비스 연결 — Gold 전용 조회, RPC 기록, 최소 권한 원격 검증 완료
- [x] Gold 채팅 사진 묶음 전송 — private Storage, 서버 Gold/매치 검증, 최대 5장 선택·진행·재전송·전체 보기와 채팅 목록 미리보기 연결
- [x] Chat List UI: 온라인 목록 + 검색 + unread/마지막 메시지/번역 상태
- [x] Chat Room UI: 실제 메시지 조회·낙관적 전송 + 번역 표시 + 신고/차단 안전 메뉴
- [x] Matches/Chat 원격 데이터 연결: 매치·메시지·Realtime·unread·실패 재전송 및 선택 번역 Function 배포, DeepL secret 등록과 실번역 QA 완료
- [x] Me: 실제 프로필/심사 상태/완성도/수정 진입
- [x] 일반 프로필 편집을 기본/추가/취향/소개/사진으로 세분화하고 선택형 추가 정보·상세 공개 구조 구현
- [x] 선택형 `profile_details` 테이블·RLS·최소 권한을 development 원격에 적용 — CLI migration history repair는 기존 SQL Editor 적용분과 함께 진행
- [x] Settings: Discovery / Notifications / Privacy & Safety / Account — 노출 여부·알림 저장, 차단 목록·해제, 정책/문의, 로그아웃, 프로필 수정, 비활성화·삭제 요청 연결
- [x] Profile Detail: 하단 Pick/Pass와 Discover queue 연계
- [x] 상대 상세프로필과 내 공개 미리보기를 단일 표준 컴포넌트로 통합하고 행동 영역만 모드별 분리
- [x] 최초 세팅·일반 편집·마이페이지의 역할과 시각 계층 분리 — 온보딩 단계 표식, 편집 전용 헤더/탭, 관리 허브 밀도 정리
- [x] 최초 프로필 저장 후 권한 안내 → 3단계 제품 튜토리얼 → 발견 헤더·카드·하단 탭 코치마크 연결, 계정별 기기 저장과 설정 재실행 경로 구성
- [x] 경쟁 앱 UX benchmark와 WICHU 적용 원칙 문서화 (`UX_BENCHMARK.md`)
- [x] Discover 최초 1회 제스처 안내, 브랜드형 Match 전환, 후보 소진·오류·필터 조정 상태
- [x] `나를 픽함` 운영 조회 — 최소 RLS policy, security-invoker RPC, 앱 서비스·상태 UI와 원격 migration 적용 완료
- [x] Chat 빈 상태·오류·재시도, 첫 메시지 제안, 개인정보 안전 안내, dead action 제거

## P1 — 수익화와 품질

- [ ] 광고 provider 연결 및 빈도/배치 정책 — AdMob SDK·UMP·SSV 공개키 검증, 12 Swipe/10분/3회 정책과 Gold/Ad-Free 제외까지 구현; AdMob 앱·unit 생성, app-ads.txt 승인, 실기기 callback QA 대기
- [ ] Apple/Google Ad-Free·Gold 상품, restore, entitlement 검증 — RevenueCat SDK·현지화 가격·구매/복원·인증 webhook·중복/역순 방지 구현; Play/App Store 상품·RevenueCat 프로젝트 생성과 sandbox 실기기 QA 대기
- [ ] 접근성 및 10개 출시 locale 실기기 QA — 한국어·영어·베트남어·일본어·프랑스어·스페인어·포르투갈어(브라질)·중국어(대만)·인도네시아어·페르시아어의 앱/OS 언어 선언, 권한 문구, 기기 언어 자동 감지, 설정 변경과 RTL 구조 완료. 포르투갈어 관리 키 누락 0건, 10개 언어 로그인·비밀번호 재설정·최초 권한 안내 번역 및 자동 회귀 검사 완료. Discover/Matches/Chat/Shop/Me와 편집·운영 화면의 기존 하드코딩 문구 이전, 스크린리더·줄바꿈 실기기 QA 대기
- [ ] 단위·통합·RLS·핵심 E2E 테스트 — 단위 테스트와 원격 롤백형 `p0_rls_contract.sql` 38개 통과, 격리 DB CI 자동 실행 완료, 모바일 E2E 대기
- [ ] 저사양 Android/iOS 실기기 성능 프로파일링
- [x] Android R8 코드 축소·리소스 축소·AGP 8.12 최적 리소스 축소 설정과 대화면 하단 내비게이션 폭 제한
- [ ] R8 production AAB 실기기 smoke test와 versionCode별 `mapping.txt` 보관·Play Console 업로드
- [ ] Android 16 대화면 QA — 8/10.5인치 태블릿, 폴더블 펼침, 가로 회전, 멀티윈도우에서 상태 보존·키보드·시트·Swipe 검증

## 출시 게이트

- [x] 이용약관, 개인정보처리방침, 커뮤니티 기준 운영 확정 — 2026-08-24 공개본, 국내 저장 리전·국외 이전·보존 기간·삭제 URL과 실제 동작 일치
- [ ] 스토어 연령/신고/차단/탈퇴/결제 고지
- [ ] EAS preview/production build와 서명/비밀정보 점검
- [ ] 단계 배포, 모니터링, incident/rollback 리허설

Feed, Story, Community, Video Call, AI 추천, 코인/선물은 이 목록에 추가하지 않는다.
