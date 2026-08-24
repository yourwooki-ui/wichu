# WICHU Monetization

## 상품

| 등급      | Google Play / App Store 상품 ID | 한국 기준 가격 | 권한                                                            |
| --------- | ------------------------------- | -------------- | --------------------------------------------------------------- |
| Free      | 없음                            | 무료           | 핵심 기능, 자동 광고, 광고 시청 후 되돌리기 1회                 |
| Ad-Free   | `wichu_ad_free`                 | 월 ₩9,900      | 자동 광고 제거                                                  |
| Gold Pass | `wichu_gold_monthly`            | 월 ₩19,900     | 광고 제거, 방문자 확인, 우선 노출, 골드 프로필, 무제한 되돌리기 |

앱에 적힌 원화 가격은 한국 기준 안내다. 구매 버튼에는 스토어가 반환한 현지 통화와 가격을 우선 표시한다. 핵심 Match/Chat 기능은 유료화하지 않는다.

## 광고 원칙

- 첫 출시 광고 형식은 사용자가 직접 선택하는 `되돌리기 1회` 보상형 광고와 Discover 전면 광고뿐이다.
- 로그인, 가입, 프로필 설정, Match 축하, Chat, 신고·차단 흐름에는 광고를 표시하지 않는다.
- Discover 전면 광고는 완료된 Swipe 12회 이후, 최소 10분 간격, 하루 최대 3회다.
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
6. rewarded SSV URL을 `https://frhydcnpynohumbbvppd.supabase.co/functions/v1/admob-reward`로 설정한다.
7. Supabase secret `ADMOB_REWARDED_UNDO_AD_UNIT_IDS`에 운영 rewarded unit ID를 넣는다.
8. 개발/preview에서 테스트 구매와 광고 callback을 검증한 뒤 EAS production 환경의 플래그를 켠다.
9. Play Console 앱 콘텐츠에서 `광고 포함`을 예로 설정하고 데이터 안전·개인정보처리방침에 광고 SDK 처리를 반영한다.

## 출시 게이트

- 운영 App ID/ad unit/API key가 하나라도 없으면 기능은 자동으로 숨겨진다.
- 광고를 켠 production EAS 빌드에 Google 샘플 App ID가 남으면 빌드를 실패시킨다.
- AdMob `app-ads.txt` 승인과 앱 준비 상태 검토가 끝나기 전에는 실광고 수익이 발생하지 않을 수 있다.
- 네이티브 SDK가 추가됐으므로 OTA가 아닌 새 AAB/IPA 빌드가 필요하다.
