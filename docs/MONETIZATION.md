# WICHU Monetization

## 상품

| 등급      | Google Play / App Store 상품 ID | 한국 기준 가격 | 권한                                                                                     |
| --------- | ------------------------------- | -------------- | ---------------------------------------------------------------------------------------- |
| Free      | 없음                            | 무료           | 핵심 기능, 자동 광고, 광고 시청 후 되돌리기 1회                                          |
| Ad-Free   | `wichu_ad_free`                 | 월 ₩9,900      | 자동 광고 제거                                                                           |
| Gold Pass | `wichu_gold_monthly`            | 월 ₩19,900     | 광고 제거, 방문자 확인, 우선 노출, 골드 프로필, 무제한 되돌리기, 채팅 사진 최대 5장 전송 |

앱에 적힌 원화 가격은 한국 기준 안내다. 구매 버튼에는 스토어가 반환한 현지 통화와 가격을 우선 표시한다. 핵심 Match/Chat 기능은 유료화하지 않는다.

## 광고 원칙

- 첫 출시 광고 형식은 사용자가 직접 선택하는 `되돌리기 1회` 보상형 광고와 Discover 전면 광고뿐이다.
- 로그인, 가입, 프로필 설정, Match 축하, 메시지 작성·전송 중, 신고·차단 흐름에는 광고를
  표시하지 않는다.
- Discover 전면 광고는 완료된 Swipe 12회 이후, 최소 10분 간격, 하루 최대 3회다.
- Discover 자동 광고는 체감 강제 노출 20초 이하의 짧은 광고 경험만 허용한다.
  AdMob SDK는 개별 광고 소재의 총 길이를 앱에서 필터링하지 못하므로 표준 전면광고만 사용하고,
  AdMob 앱 설정에서 고참여 광고를 끄며 파트너 입찰 소스를 연결하지 않는다. 이 조건을 운영에서
  확인할 수 없으면 자동 전면광고 플래그를 켜지 않는다.
- 광고가 실제로 닫힌 뒤에만 노출 카운터를 초기화한다.
- Gold/Ad-Free 권한이 활성화된 사용자는 자동 광고 호출 전에 제외한다.
- 개발 빌드는 Google 테스트 광고 ID만 사용한다. 운영 광고 ID는 EAS 환경변수로만 주입한다.
- UMP 동의 결과가 광고 요청을 허용하기 전에는 Mobile Ads SDK를 초기화하지 않는다.
- 프로필의 위치·성별·관심 성별·대화 내용은 광고 타기팅 값으로 전달하지 않는다.

## 보상형 광고 검증

1. 앱은 보상형 광고 요청에 Supabase 사용자 UUID와 `discover_undo` placement를 SSV 값으로 넣는다.
2. AdMob은 `admob-reward` Edge Function으로 서명된 callback을 보낸다.
3. Function은 Google 공개키로 원문 query의 ECDSA 서명을 검증한다.
4. 운영 ad unit allowlist, 사용자 UUID, placement, callback 시각을 확인한다.
5. 검증된 `transaction_id`만 service-role 전용 `grant_rewarded_undo_credit` RPC로 전달한다.
6. DB의 provider event unique key가 재전송·재생 공격의 중복 지급을 막는다.

클라이언트의 `EARNED_REWARD` 이벤트는 화면 진행 신호일 뿐 권한 지급 근거가 아니다.

## 구독 검증

1. 앱은 RevenueCat SDK를 Supabase 사용자 UUID로 초기화한다.
2. 구매와 복원은 스토어 결제창에서 완료한다.
3. RevenueCat webhook은 별도 Authorization secret로 `revenuecat-webhook`을 호출한다.
4. Function은 허용된 상품·플랫폼·사용자 UUID만 원자 DB 함수로 전달한다.
5. `private.monetization_provider_events`가 webhook 중복을 제거하고, provider timestamp가 더 오래된 이벤트는 최신 권한을 덮지 못한다.
6. 앱은 client-write가 불가능한 `subscriptions`를 다시 조회한 뒤 혜택을 연다.

취소 이벤트만으로는 즉시 권한을 끊지 않는다. 결제 기간 만료 전에는 유지하고 `EXPIRATION`에서 종료한다. 환불·만료·갱신도 같은 서버 경로로 반영한다.

## 운영 연결 순서

1. Play Console에 월간 자동 갱신 상품 `wichu_ad_free`, `wichu_gold_monthly`와 KRW 가격을 생성한다.
2. RevenueCat 앱·entitlement·offering을 만들고 Google Play 서비스 계정을 연결한다.
   - Restore behavior는 구독을 다른 WICHU 계정으로 자동 이전하지 않는 `Keep with original App User ID`로 설정한다.
3. RevenueCat webhook URL을 `https://frhydcnpynohumbbvppd.supabase.co/functions/v1/revenuecat-webhook`으로 설정하고 임의의 긴 Authorization 값을 지정한다.
4. Supabase secret `REVENUECAT_WEBHOOK_AUTH`에 같은 값을 넣는다. 샌드박스 QA 중에만 `REVENUECAT_ALLOW_SANDBOX=true`를 사용한다.
5. AdMob 앱과 rewarded/interstitial unit을 만들고 UMP 메시지를 게시한다.
   - Discover interstitial은 표준 ad unit으로 만들고 High-engagement ads를 비활성화한다.
   - 최대 강제 노출 20초 정책을 보장하지 못하는 partner bidding/mediation source는 연결하지 않는다.
6. rewarded SSV URL을 `https://frhydcnpynohumbbvppd.supabase.co/functions/v1/admob-reward`로 설정한다.
7. Supabase secret `ADMOB_REWARDED_UNDO_AD_UNIT_IDS`에 운영 rewarded unit ID를 넣는다.
8. 개발/preview에서 테스트 구매와 광고 callback을 검증한 뒤 EAS production 환경의 플래그를 켠다.
9. Play Console 앱 콘텐츠에서 `광고 포함`을 예로 설정하고 데이터 안전·개인정보처리방침에 광고 SDK 처리를 반영한다.

## 현재 연결 상태 (2026-09-01)

- RevenueCat Google Play 앱 `WICHU Android`와 패키지 `app.wichu.mobile`을 생성했다.
- 전용 Google Cloud 서비스 계정을 WICHU 앱에만 연결하고 상품 조회, 재무 데이터 보기,
  주문·구독 관리 권한을 부여했다.
- Google Play Developer Notifications와 RevenueCat을 연결했다.
- RevenueCat webhook을 `revenuecat-webhook` Edge Function에 연결하고 HTTP 200 테스트를
  확인했다. Authorization 값은 Supabase secret에만 저장한다.
- Google Play 구독 webhook의 `상품ID:기본요금제ID` 형식은 서버에서 기본 상품 ID로
  정규화한 뒤 DB에 반영한다.
- 서비스 계정의 상품 카탈로그 검증은 통과했다. 구매 검증 권한은 Google Play 권한 전파가
  끝난 뒤 RevenueCat에서 다시 확인한다.
- `stylesihi@gmail.com` AdMob 계정에 WICHU Android 앱과 운영 광고 단위 3개를 생성했다.
  - 되돌리기 보상형: `Discover Undo Rewarded`
  - Discover 전면: `Discover Swipe Interstitial`
  - 프로필·채팅 탐색 전면: `Profile Chat Browse Interstitial`
- AdMob 고참여 광고는 비활성화했고 파트너 입찰·미디에이션은 연결하지 않았다.
- 보상형 SSV URL을 `admob-reward` Edge Function으로 검증·저장했으며, 운영 allowlist에는
  AdMob 콜백 형식인 숫자형 광고 단위 ID를 저장한다.
- AdMob 계정 승인과 WICHU 앱 검토는 진행 중이다. 앱이 비공개 테스트 상태라 Google Play
  스토어 연결은 공개 등록정보 검색이 가능해진 뒤 마무리한다.
- `monthly` 기본 요금제 활성화와 실기기 샌드박스 구매·복원 검증은 Billing SDK가 포함된
  새 AAB를 Play 비공개 테스트에 올린 뒤 진행한다.

## 네이티브 SDK 안전 경계

- `react-native-google-mobile-ads@16.3.4`, `react-native-purchases@10.8.1`을 잠금파일에 고정한다.
  - 광고 모듈 16.4.0은 Google Ads SDK 25.4.0(Kotlin 2.3 메타데이터)을 가져와 Expo SDK 57의
    Kotlin 2.1.20 릴리스 빌드와 충돌하므로 올리지 않는다. 16.3.4는 Google Ads SDK 25.0.0을
    사용하며 현재 Android 릴리스 빌드로 검증했다.
- 두 SDK 모두 라우트 또는 provider 모듈 평가 시 정적으로 불러오지 않는다. 인증과 프로필 설정이
  끝난 뒤 실제 초기화 함수 안의 `import()`로만 로드한다.
- AdMob config plugin에는 항상 유효한 App ID가 들어간다. 운영 App ID가 없을 때는 Google 공식
  테스트 App ID를 사용하지만 광고 플래그는 꺼진 상태를 유지한다.
- production 프로필은 테스트 모드 또는 실 App ID 없는 광고 활성화를 config 단계에서 거부한다.
- 광고 동의가 완료되지 않거나 SDK 초기화가 실패하면 광고만 비활성화하고 앱은 계속 실행한다.
- 결제 성공만으로 혜택을 열지 않는다. RevenueCat Webhook이 갱신한 Supabase `subscriptions`를
  다시 읽어 서버 권한이 확인된 뒤에만 Gold/Ad-Free 혜택을 연다.

## Play Console 상품

- `wichu_ad_free`: WICHU Ad-Free, 월 ₩9,900
- `wichu_gold_monthly`: WICHU Gold Pass, 월 ₩19,900
- 두 상품과 한국어 혜택 정보는 생성되어 있다. Billing 권한이 포함된 Android 빌드를 Play에
  업로드한 뒤 `monthly` 자동 갱신 기본 요금제와 글로벌 환산 가격을 저장·활성화한다.

## 출시 게이트

- 운영 App ID/ad unit/API key가 하나라도 없으면 기능은 자동으로 숨겨진다.
- 광고를 켠 production EAS 빌드에 Google 샘플 App ID가 남으면 빌드를 실패시킨다.
- AdMob `app-ads.txt` 승인과 앱 준비 상태 검토가 끝나기 전에는 실광고 수익이 발생하지 않을 수 있다.

## 탐색 광고 슬롯

- 상대 상세 프로필 열기와 채팅방 열기를 합산해 탐색 10회를 하나의 주기로 계산한다.
- 광고는 10번째 화면 안에서 갑자기 띄우지 않고, 10번째 탐색을 마친 뒤 다음 프로필 또는
  채팅방으로 이동하려는 자연스러운 전환 시점에 표시한다.
- 이 슬롯은 30초 이상의 전면광고도 허용한다. 단, 닫기 버튼과 광고 컨트롤을 가리지 않고
  사용자가 광고를 닫으면 즉시 원래 이동을 계속한다.
- 활성 대화 중, 메시지 입력 중, 새 메시지 수신 직후에는 광고를 띄우지 않는다.
- Gold/Ad-Free 사용자는 이 슬롯에서도 제외한다.
- Discover 카드 Swipe 자동 광고는 이 슬롯과 별도 카운터를 사용하며 앞선 20초 이하 정책을
  그대로 유지한다.
- 네이티브 SDK가 추가됐으므로 OTA가 아닌 새 AAB/IPA 빌드가 필요하다.
