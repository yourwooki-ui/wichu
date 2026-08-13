# WICHU 1.0 Launch TODO

## P0 — 기반과 데이터

- [x] Expo Router, TypeScript, Query, Zustand, i18n 기본 구조
- [x] WICHU 테마, 아이콘, 스플래시, 브랜드 문서
- [x] Supabase client/service 경계와 초기 migration 초안
- [x] development Supabase에 앱 스키마와 P0 migration 적용 및 RLS/advisor 재검증 — 2026-08-13 Security Advisor 오류 0건, 의도된 사용자 범위 `SECURITY DEFINER` RPC 경고와 유출 비밀번호 보호 경고만 잔존
- [ ] 프로젝트 Data API 노출 설정과 migration의 명시적 grants 대조
- [x] 적용 스키마와 일치하는 typed Supabase client 정의
- [ ] CLI 계정 연결 후 타입 자동 생성과 migration CI 추가
- [ ] SQL Editor 적용분을 Supabase CLI migration history에 repair
- [ ] development / preview / production 환경 분리

## P0 — 핵심 사용자 여정

- [x] 이메일 인증, confirm deep link, protected session routing, 18+ 약관 동의
- [x] Google 로그인/회원가입 UI, Expo OAuth callback, session 교환 구조
- [ ] Google Cloud Web OAuth credentials와 Supabase Google provider/redirect allowlist 활성화
- [ ] Google 신규 Auth 계정의 18+ 가입 정책 변경 승인 및 migration 적용
- [x] 정확한 생년월일을 재검증하는 18+ core profile 저장
- [x] 대표 사진 필수, 6장 사진 업로드/순서 변경, 운영진 최초 프로필 심사
- [x] 심사 대기 중 앱 탐색 허용, 미승인 프로필/공개 사진 노출 차단
- [x] AI 생성 사진을 포함한 해외 여성 개발용 테스트 프로필 5명 seed/원격 데이터 구성
- [x] 1카드 후보 batch RPC와 Swipe Discover UI 데이터 연결
- [x] 접속 상태 heartbeat/UI 및 최근 7일 이내 후보 제한
- [x] Discover 후보 5명 prepare/prefetch/background refill 및 개발 샘플 순환
- [ ] 실제 후보 optimistic pick 기록, 중복 방지, background refill 원격 E2E 검증
- [ ] Match 생성/확인 상태 — 실제 매치 목록과 채팅방 ID 연결 완료
- [ ] optimistic Realtime Chat, 재시도, unread count — 메시지 조회·낙관적 전송·Realtime INSERT 완료, 실패 메시지 재시도와 unread 저장 대기
- [ ] 메시지 번역 adapter와 언어 상태

## P0 — 안전과 운영

- [ ] 프로필/대화 신고, 차단, match 종료 — 신고 사유·차단 확인 UI와 저장 연결 완료, 차단 RLS 원격 적용 및 match 종료 대기
- [ ] 비활성화·탈퇴·데이터 삭제 완주 — 즉시 비공개/매치 종료/푸시 해제와 삭제 요청 queue까지 연결, Auth·Storage 실제 삭제 worker 및 보존 정책 대기
- [ ] 신고 triage용 최소 운영 도구 또는 검증된 Dashboard 절차 — 프로필 심사 queue/approve/reject RPC 완료, 운영 UI 대기
- [ ] Push 등록과 Match/메시지 deep link — 실기기 권한 요청·Expo token 등록/로그아웃 정리 완료, 서버 발송과 알림 응답 deep link 대기
- [ ] 개인정보 최소화, 민감 로그 redaction, rate limit
- [ ] 크래시·API 실패·핵심 funnel 관측성 연결

## P0 — 화면 구조 구현

- [x] 전체 정보구조와 페이지별 UX 계약 문서화 (`APP_STRUCTURE.md`)
- [ ] 공통 App Header, skeleton, empty/error state 컴포넌트 정리
- [x] Matches UI: 신규 Match 카드 + 기존 Match 목록 + Say hi 진입
- [x] Matches 카테고리: 나를 픽함 / 매칭됨 / 프로필 방문자 전환형 화면
- [x] 프로필 방문 기록 테이블·RLS·조회 서비스 연결 — Gold 전용 조회, RPC 기록, 최소 권한 원격 검증 완료
- [x] Chat List UI: 온라인 목록 + 검색 + unread/마지막 메시지/번역 상태
- [x] Chat Room UI: 실제 메시지 조회·낙관적 전송 + 번역 표시 + 신고/차단 안전 메뉴
- [ ] Matches/Chat 원격 데이터 연결: 매치·메시지·Realtime 연결 완료; 번역 API, unread, 실패 재전송 대기
- [x] Me: 실제 프로필/심사 상태/완성도/수정 진입
- [ ] Settings: Discovery / Notifications / Privacy & Safety / Account — 노출 여부·알림 저장, 로그아웃, 프로필 수정, 비활성화·삭제 요청 연결 완료; 차단 목록·정책 문서 대기
- [x] Profile Detail: 하단 Pick/Pass와 Discover queue 연계

## P1 — 수익화와 품질

- [ ] 광고 provider 연결 및 빈도/배치 정책 — Gold/Ad-Free 광고 차단 entitlement 경계 완료
- [ ] Apple/Google Ad-Free·Gold 상품, restore, entitlement 검증 — Ad-Free 한국 기준 월 ₩9,900 확정, Gold DB 권한·방문자·우선 노출 원격 적용 완료, 실제 Store product 대기
- [ ] 접근성, 영문/한국어 및 핵심 출시 locale QA
- [ ] 단위·통합·RLS·핵심 E2E 테스트 — 18+·생년월일 포맷 단위 테스트 6건 추가, 원격 RLS/Swipe/Match/Chat E2E 대기
- [ ] 저사양 Android/iOS 실기기 성능 프로파일링

## 출시 게이트

- [ ] 이용약관, 개인정보처리방침, 커뮤니티 기준, 지원 채널
- [ ] 스토어 연령/신고/차단/탈퇴/결제 고지
- [ ] EAS preview/production build와 서명/비밀정보 점검
- [ ] 단계 배포, 모니터링, incident/rollback 리허설

Feed, Story, Community, Video Call, AI 추천, 코인/선물은 이 목록에 추가하지 않는다.
