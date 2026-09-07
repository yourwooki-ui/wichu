import type { PassTier } from '@/features/monetization/services/purchase-service';

type ProfileNativeAdPolicyInput = {
  enabled: boolean;
  entitlementReady: boolean;
  isPreview: boolean;
  photoCount: number;
  tier: PassTier | undefined;
};

/** Inline profile ads are reserved for complete, public, free-tier photo galleries. */
export function shouldShowProfileNativeAd({
  enabled,
  entitlementReady,
  isPreview,
  photoCount,
  tier,
}: ProfileNativeAdPolicyInput) {
  return enabled && entitlementReady && !isPreview && photoCount >= 3 && tier === 'free';
}

/** The hero is photo 1, so the first gallery item is photo 2. Insert directly after it. */
export function shouldInsertProfileNativeAdAfter(additionalPhotoIndex: number, photoCount: number) {
  return photoCount >= 3 && additionalPhotoIndex === 0;
}
