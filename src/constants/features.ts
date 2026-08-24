import { monetizationConfig } from '@/features/monetization/config';

/**
 * 인앱 결제(Gold Pass / Ad-Free) 노출 여부.
 *
 * 켜기 전 확인할 것:
 * - IAP SDK 설치와 스토어 상품 등록
 * - 서버 영수증 검증과 entitlement 반영
 * - 구매 복원 / 만료 / 환불 처리
 *
 * 플래그와 현재 플랫폼 RevenueCat 키가 둘 다 있을 때만 열린다.
 */
export const MONETIZATION_ENABLED = monetizationConfig.purchasesEnabled;

/**
 * 보상형 광고(광고 보고 되돌리기 1회) 노출 여부.
 *
 * 플래그와 현재 플랫폼 보상형 광고 단위 ID가 둘 다 있을 때만 열린다.
 */
export const REWARDED_ADS_ENABLED = monetizationConfig.rewardedAdsEnabled;

/** 자동 전면 광고는 보상형과 별도로 운영에서 켜고 끈다. */
export const INTERSTITIAL_ADS_ENABLED = monetizationConfig.interstitialAdsEnabled;
