import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { monetizationConfig } from '@/features/monetization/config';
import { palette, radius } from '@/constants/theme';
import { reportOperationalError } from '@/services/operational-error-service';

type MobileAdsModule = typeof import('react-native-google-mobile-ads');
type NativeAdInstance = Awaited<ReturnType<MobileAdsModule['NativeAd']['createForAdRequest']>>;

type LoadedNativeAd = {
  ad: NativeAdInstance;
  sdk: MobileAdsModule;
};

export function InlineProfileNativeAd({ profileId }: { profileId: string }) {
  const [loaded, setLoaded] = useState<LoadedNativeAd | null>(null);

  useEffect(() => {
    let disposed = false;
    let requestedAd: NativeAdInstance | null = null;

    void Promise.all([
      import('react-native-google-mobile-ads'),
      import('@/features/monetization/services/ads-provider'),
    ])
      .then(async ([sdk, { adsProvider }]) => {
        if (!(await adsProvider.initialize()) || disposed) return;
        const adUnitId =
          __DEV__ || monetizationConfig.testMode
            ? sdk.TestIds.NATIVE
            : monetizationConfig.profileNativeAdUnitId;
        if (!adUnitId) return;

        requestedAd = await sdk.NativeAd.createForAdRequest(adUnitId, {
          adChoicesPlacement: sdk.NativeAdChoicesPlacement.TOP_RIGHT,
          aspectRatio: sdk.NativeMediaAspectRatio.LANDSCAPE,
          requestNonPersonalizedAdsOnly: true,
          startVideoMuted: true,
        });
        if (disposed) {
          requestedAd.destroy();
          requestedAd = null;
          return;
        }
        setLoaded({ ad: requestedAd, sdk });
      })
      .catch((error) => {
        if (!disposed)
          reportOperationalError('ad_profile_native_load', error, `/profile/${profileId}`);
      });

    return () => {
      disposed = true;
      requestedAd?.destroy();
    };
  }, [profileId]);

  if (!loaded) return null;

  const { ad, sdk } = loaded;
  const { NativeAdView, NativeAsset, NativeAssetType, NativeMediaView } = sdk;

  return (
    <NativeAdView nativeAd={ad} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.sponsorCopy}>
          {ad.icon ? (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image cachePolicy="memory-disk" source={{ uri: ad.icon.url }} style={styles.icon} />
            </NativeAsset>
          ) : null}
          <View>
            <Text style={styles.advertiser}>{ad.advertiser || 'Sponsored'}</Text>
            <Text style={styles.disclosure}>AD · 광고</Text>
          </View>
        </View>
      </View>

      <NativeMediaView resizeMode="cover" style={styles.media} />

      <View style={styles.copy}>
        <NativeAsset assetType={NativeAssetType.HEADLINE}>
          <Text numberOfLines={2} style={styles.headline}>
            {ad.headline}
          </Text>
        </NativeAsset>
        {ad.body ? (
          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text numberOfLines={2} style={styles.body}>
              {ad.body}
            </Text>
          </NativeAsset>
        ) : null}
        {ad.callToAction ? (
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <Text style={styles.cta}>{ad.callToAction}</Text>
          </NativeAsset>
        ) : null}
      </View>
    </NativeAdView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F7F7F9',
    borderColor: '#E0E0E5',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 14,
    paddingRight: 48,
  },
  sponsorCopy: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  icon: { borderRadius: 10, height: 34, width: 34 },
  advertiser: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  disclosure: { color: palette.inkMuted, fontSize: 10, fontWeight: '800', marginTop: 2 },
  media: { backgroundColor: '#E8E8EC', height: 210, width: '100%' },
  copy: { gap: 7, padding: 14 },
  headline: { color: palette.ink, fontSize: 16, fontWeight: '900', lineHeight: 21 },
  body: { color: palette.inkMuted, fontSize: 11, lineHeight: 17 },
  cta: {
    alignSelf: 'stretch',
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    color: palette.white,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
    minHeight: 42,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 12,
    textAlign: 'center',
  },
});
