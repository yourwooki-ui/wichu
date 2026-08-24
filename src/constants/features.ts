/**
 * 출시 시점에 켜고 끄는 기능 스위치.
 *
 * 스토어 심사는 동작하지 않는 기능이 UI로 노출되는 것을 "미완성 앱"으로 본다.
 * 실제 연동이 끝나기 전까지 진입점 자체를 감추기 위한 스위치다.
 */

/**
 * 인앱 결제(Gold Pass / Ad-Free) 노출 여부.
 *
 * 켜기 전 확인할 것:
 * - IAP SDK 설치와 스토어 상품 등록
 * - 서버 영수증 검증과 entitlement 반영
 * - 구매 복원 / 만료 / 환불 처리
 *
 * 지금은 결제 화면이 "구매 준비 중" 알림만 띄우므로 꺼 둔다.
 */
export const MONETIZATION_ENABLED = false;

/**
 * 보상형 광고(광고 보고 되돌리기 1회) 노출 여부.
 *
 * `ads-service`가 항상 `unavailable`을 반환하는 동안에는 꺼 둔다.
 * 켜면 사용자가 "광고 보기"를 눌러도 100% 실패한다.
 */
export const REWARDED_ADS_ENABLED = false;
