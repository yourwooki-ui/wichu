export const illustratedIcons = {
  matches: require('../../assets/illustrated-icons/matches-wichu.png'),
  chatEmpty: require('../../assets/soft-icons/chat-empty.png'),
  purchase: require('../../assets/illustrated-icons/purchase-heritage.png'),
  settings: require('../../assets/soft-icons/settings.png'),
  goldPremium: require('../../assets/illustrated-icons/gold-premium-heritage.png'),
  profileEdit: require('../../assets/soft-icons/profile-edit.png'),
  discoverySettings: require('../../assets/soft-icons/discovery-settings.png'),
  connections: require('../../assets/soft-icons/connections.png'),
  connectionError: require('../../assets/soft-icons/connection-error.png'),
  discoveryVisible: require('../../assets/soft-icons/discovery-visible.png'),
  photoReview: require('../../assets/soft-icons/photo-review.png'),
  photoRejected: require('../../assets/soft-icons/photo-rejected.png'),
  goldPass: require('../../assets/soft-icons/gold-pass.png'),
  searchEmpty: require('../../assets/soft-icons/search-empty.png'),
  translation: require('../../assets/soft-icons/translation.png'),
  safety: require('../../assets/soft-icons/safety.png'),
  notification: require('../../assets/soft-icons/notification.png'),
  location: require('../../assets/soft-icons/location.png'),
  profilePhotos: require('../../assets/soft-icons/profile-photos.png'),
  adFree: require('../../assets/soft-icons/ad-free.png'),
  rewind: require('../../assets/soft-icons/rewind.png'),
} as const;

/** 이용권 등급이 표시되는 모든 화면에서 같은 상품 아이콘을 사용한다. */
export function getPassIllustration(tier: string | null | undefined) {
  if (tier === 'gold') return illustratedIcons.goldPass;
  if (tier === 'ad_free') return illustratedIcons.adFree;
  return illustratedIcons.purchase;
}
