import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { IllustratedIcon } from '@/components/IllustratedIcon';
import { useAppTheme } from '@/components/ThemeProvider';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { pressFeedback, radius, spacing } from '@/constants/theme';
import { normalizeProfilePhotoAsset } from '@/features/profile/services/profile-photo-normalizer';
import {
  getProfilePhotoIdentity,
  normalizeProfilePhotoSelections,
} from '@/features/profile/services/profile-photo-selection';
import type { ProfilePhotoDraft } from '@/features/profile/types/profile-photo';

const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const MIN_PHOTO_EDGE = 600;
const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type ProfilePhotoPickerProps = {
  dark?: boolean;
  disabled?: boolean;
  photos: ProfilePhotoDraft[];
  ready?: boolean;
  uploadProgress?: { completed: number; total: number } | null;
  onChange: (photos: ProfilePhotoDraft[]) => void;
  onError: (message: string) => void;
};

export function ProfilePhotoPicker({
  dark = false,
  disabled,
  photos,
  ready = true,
  uploadProgress,
  onChange,
  onError,
}: ProfilePhotoPickerProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [picking, setPicking] = useState(false);
  const pickingRef = useRef(false);
  const recoveredPendingResult = useRef(false);
  const latestPhotos = useRef(photos);
  const textColor = dark ? '#FFFFFF' : theme.colors.text;
  const mutedColor = dark ? '#8F8F99' : theme.colors.textMuted;
  const surfaceColor = dark ? '#17171B' : theme.colors.surface;
  const borderColor = dark ? '#34343B' : theme.colors.border;

  useEffect(() => {
    latestPhotos.current = photos;
  }, [photos]);

  const addAssets = useCallback(
    async (assets: ImagePicker.ImagePickerAsset[]) => {
      const currentPhotos = latestPhotos.current;
      const remaining = MAX_PHOTOS - currentPhotos.length;
      if (remaining <= 0) return;

      const normalized = await normalizeProfilePhotoSelections(
        assets.slice(0, remaining),
        normalizeProfilePhotoAsset,
      );

      const knownIdentities = new Set(currentPhotos.map(getProfilePhotoIdentity));
      const validAssets: typeof normalized.assets = [];
      let skipped = normalized.failed;

      for (const asset of normalized.assets) {
        const identity = getProfilePhotoIdentity(asset);
        const isUnsupported = asset.mimeType && !SUPPORTED_MIME_TYPES.has(asset.mimeType);
        const isTooLarge = (asset.fileSize ?? 0) > MAX_PHOTO_BYTES;
        const isTooSmall = asset.width < MIN_PHOTO_EDGE || asset.height < MIN_PHOTO_EDGE;
        const isDuplicate = knownIdentities.has(identity);

        if (isUnsupported || isTooLarge || isTooSmall || isDuplicate) {
          skipped += 1;
          continue;
        }

        knownIdentities.add(identity);
        validAssets.push(asset);
      }

      const drafts = validAssets.slice(0, remaining).map((asset) => ({
        ...asset,
        draftId: `new:${getProfilePhotoIdentity(asset)}`,
      }));

      if (drafts.length > 0) {
        const nextPhotos = [...currentPhotos, ...drafts];
        latestPhotos.current = nextPhotos;
        onChange(nextPhotos);
      }
      if (skipped > 0) onError(t('profileSetup.photos.skipped', { count: skipped }));
      else onError('');
    },
    [onChange, onError, t],
  );

  useEffect(() => {
    if (!ready || Platform.OS !== 'android' || recoveredPendingResult.current) return;
    recoveredPendingResult.current = true;

    void ImagePicker.getPendingResultAsync()
      .then((result) => {
        if (result && 'assets' in result && !result.canceled) return addAssets(result.assets);
      })
      .catch(() => undefined);
  }, [addAssets, ready]);

  async function pickFromLibrary() {
    const remaining = MAX_PHOTOS - latestPhotos.current.length;
    if (remaining <= 0 || pickingRef.current || disabled || !ready) return;

    pickingRef.current = true;
    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        orderedSelection: true,
        selectionLimit: remaining,
        quality: 0.86,
      });

      if (result.canceled) return;
      await addAssets(result.assets);
    } catch (error) {
      onError(error instanceof Error ? error.message : t('profileSetup.photos.pickFailed'));
    } finally {
      pickingRef.current = false;
      setPicking(false);
    }
  }

  async function replaceFromLibrary(index: number) {
    const currentPhoto = latestPhotos.current[index];
    if (!currentPhoto || pickingRef.current || disabled || !ready) return;

    pickingRef.current = true;
    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.86,
      });
      if (result.canceled) return;

      const pickedAsset = result.assets[0];
      if (!pickedAsset) return;
      const sourceIdentity = getProfilePhotoIdentity(pickedAsset);
      const asset = await normalizeProfilePhotoAsset(pickedAsset);
      const otherPhotos = latestPhotos.current.filter((_, photoIndex) => photoIndex !== index);
      const isUnsupported = asset.mimeType && !SUPPORTED_MIME_TYPES.has(asset.mimeType);
      const isTooLarge = (asset.fileSize ?? 0) > MAX_PHOTO_BYTES;
      const isTooSmall = asset.width < MIN_PHOTO_EDGE || asset.height < MIN_PHOTO_EDGE;
      const isDuplicate = new Set(otherPhotos.map(getProfilePhotoIdentity)).has(sourceIdentity);

      if (isUnsupported || isTooLarge || isTooSmall || isDuplicate) {
        onError(t('profileSetup.photos.skipped', { count: 1 }));
        return;
      }

      const nextPhotos = [...latestPhotos.current];
      nextPhotos[index] = {
        ...asset,
        draftId: `replacement:${sourceIdentity}`,
        sourceIdentity,
      };
      latestPhotos.current = nextPhotos;
      onChange(nextPhotos);
      onError('');
    } catch (error) {
      onError(error instanceof Error ? error.message : t('profileSetup.photos.pickFailed'));
    } finally {
      pickingRef.current = false;
      setPicking(false);
    }
  }

  async function takePhoto() {
    if (latestPhotos.current.length >= MAX_PHOTOS || pickingRef.current || disabled || !ready)
      return;

    pickingRef.current = true;
    setPicking(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        onError(t('profileSetup.photos.cameraPermission'));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.86,
      });
      if (!result.canceled) await addAssets(result.assets);
    } catch (error) {
      onError(error instanceof Error ? error.message : t('profileSetup.photos.cameraFailed'));
    } finally {
      pickingRef.current = false;
      setPicking(false);
    }
  }

  function movePhoto(index: number, direction: -1 | 1) {
    const currentPhotos = latestPhotos.current;
    const target = index + direction;
    if (target < 0 || target >= currentPhotos.length) return;
    const next = [...currentPhotos];
    [next[index], next[target]] = [next[target], next[index]];
    latestPhotos.current = next;
    onChange(next);
  }

  function removePhoto(draftId: string) {
    const next = latestPhotos.current.filter((photo) => photo.draftId !== draftId);
    latestPhotos.current = next;
    onChange(next);
  }

  function setPrimaryPhoto(index: number) {
    if (index === 0) return;
    const next = [...latestPhotos.current];
    const [primary] = next.splice(index, 1);
    if (!primary) return;
    const reordered = [primary, ...next];
    latestPhotos.current = reordered;
    onChange(reordered);
  }

  const controlsDisabled = disabled || picking || !ready;

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View>
          <Text style={[styles.label, { color: textColor }]}>{t('profileSetup.photos.title')}</Text>
          <Text style={[styles.hint, { color: mutedColor }]}>{t('profileSetup.photos.hint')}</Text>
        </View>
        <Text style={[styles.counter, { color: mutedColor }]}>{photos.length}/6</Text>
      </View>

      <View style={[styles.readinessCard, { borderColor, backgroundColor: surfaceColor }]}>
        <View style={styles.readinessIcon}>
          <Ionicons
            name={photos.length >= 3 ? 'checkmark' : 'images-outline'}
            size={16}
            color={theme.colors.primary}
          />
        </View>
        <View style={styles.readinessCopy}>
          <Text style={[styles.readinessTitle, { color: textColor }]}>
            {t('profileSetup.photos.readiness', { count: photos.length })}
          </Text>
          <Text style={[styles.readinessHint, { color: mutedColor }]}>
            {t('profileSetup.photos.recommendation')}
          </Text>
          <Text style={[styles.requiredHint, { color: theme.colors.primary }]}>
            {t('profileSetup.photos.mainRequired')}
          </Text>
        </View>
        <View style={styles.readinessDots}>
          {Array.from({ length: MAX_PHOTOS }, (_, index) => (
            <View
              key={index}
              style={[
                styles.readinessDot,
                { backgroundColor: index < photos.length ? theme.colors.primary : borderColor },
              ]}
            />
          ))}
        </View>
      </View>

      {photos.length < MAX_PHOTOS ? (
        <View style={styles.sourceActions}>
          <SourceButton
            icon="images-outline"
            label={t('profileSetup.photos.library')}
            disabled={controlsDisabled}
            onPress={pickFromLibrary}
          />
          <SourceButton
            icon="camera-outline"
            label={t('profileSetup.photos.camera')}
            disabled={controlsDisabled}
            onPress={takePhoto}
          />
        </View>
      ) : null}

      <View style={styles.grid}>
        {photos.map((photo, index) => (
          <View key={photo.draftId} style={[styles.photoTile, { backgroundColor: surfaceColor }]}>
            <Image
              cachePolicy="memory-disk"
              contentFit="cover"
              source={{ cacheKey: photo.storagePath ?? photo.draftId, uri: photo.uri }}
              style={StyleSheet.absoluteFill}
              transition={140}
            />
            {photo.reviewStatus === 'pending' || photo.reviewStatus === 'rejected' ? (
              <View
                style={[
                  styles.reviewBadge,
                  photo.reviewStatus === 'rejected' && styles.reviewBadgeRejected,
                ]}
              >
                <IllustratedIcon
                  size={17}
                  source={
                    photo.reviewStatus === 'pending'
                      ? illustratedIcons.photoReview
                      : illustratedIcons.photoRejected
                  }
                />
                <Text style={styles.reviewBadgeText}>
                  {photo.reviewStatus === 'pending'
                    ? t('profilePhotos.reviewPending')
                    : t('profilePhotos.reviewRejected')}
                </Text>
              </View>
            ) : !photo.storagePath ? (
              <View style={styles.newPhotoBadge}>
                <Text style={styles.newPhotoBadgeText}>{t('profilePhotos.newPending')}</Text>
              </View>
            ) : null}
            {index === 0 ? (
              <View style={[styles.primaryBadge, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.primaryText}>{t('profileSetup.photos.primary')}</Text>
              </View>
            ) : null}
            <Pressable
              accessibilityLabel={t('profileSetup.photos.remove', { index: index + 1 })}
              accessibilityRole="button"
              disabled={controlsDisabled}
              hitSlop={10}
              onPress={() => removePhoto(photo.draftId)}
              style={styles.removeButton}
            >
              <Ionicons name="close" size={16} color="#FFFFFF" />
            </Pressable>
            <Pressable
              accessibilityLabel={t('profilePhotos.replace', { index: index + 1 })}
              accessibilityRole="button"
              disabled={controlsDisabled}
              hitSlop={10}
              onPress={() => replaceFromLibrary(index)}
              style={styles.replaceButton}
            >
              <Ionicons name="refresh" size={14} color="#FFFFFF" />
            </Pressable>
            {index > 0 ? (
              <Pressable
                accessibilityLabel={t('profileSetup.photos.setPrimary', { index: index + 1 })}
                accessibilityRole="button"
                disabled={controlsDisabled}
                onPress={() => setPrimaryPhoto(index)}
                hitSlop={10}
                style={styles.setPrimaryButton}
              >
                <Ionicons name="star" size={12} color="#FFFFFF" />
              </Pressable>
            ) : null}
            <View style={styles.orderButtons}>
              <OrderButton
                icon="chevron-back"
                label={t('profileSetup.photos.moveEarlier', { index: index + 1 })}
                disabled={controlsDisabled || index === 0}
                onPress={() => movePhoto(index, -1)}
              />
              <OrderButton
                icon="chevron-forward"
                label={t('profileSetup.photos.moveLater', { index: index + 1 })}
                disabled={controlsDisabled || index === photos.length - 1}
                onPress={() => movePhoto(index, 1)}
              />
            </View>
          </View>
        ))}

        {photos.length < MAX_PHOTOS ? (
          <Pressable
            accessibilityLabel={t('profileSetup.photos.add')}
            accessibilityRole="button"
            disabled={controlsDisabled}
            onPress={pickFromLibrary}
            style={({ pressed }) => [
              styles.addTile,
              { borderColor, backgroundColor: surfaceColor },
              (pressed || controlsDisabled) && styles.pressed,
            ]}
          >
            <IllustratedIcon size={42} source={illustratedIcons.profilePhotos} />
            <Text style={[styles.addLabel, { color: textColor }]}>
              {t('profileSetup.photos.add')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.photoTips}>
        <PhotoTip icon="person-outline" label={t('profileSetup.photos.tipFace')} />
        <PhotoTip icon="sunny-outline" label={t('profileSetup.photos.tipClear')} />
        <PhotoTip illustration={illustratedIcons.safety} label={t('profileSetup.photos.tipSafe')} />
      </View>

      {uploadProgress ? (
        <View style={[styles.uploadStatus, { backgroundColor: surfaceColor }]}>
          <IllustratedIcon size={24} source={illustratedIcons.profilePhotos} />
          <Text style={[styles.uploadText, { color: textColor }]}>
            {t('profileSetup.photos.uploading', uploadProgress)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

type SourceButtonProps = {
  icon: 'images-outline' | 'camera-outline';
  label: string;
  disabled: boolean;
  onPress: () => void;
};

function SourceButton({ icon, label, disabled, onPress }: SourceButtonProps) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.sourceButton,
        { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={18} color={theme.colors.primary} />
      <Text style={[styles.sourceButtonLabel, { color: theme.colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function PhotoTip({
  icon,
  illustration,
  label,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  illustration?: ImageSource;
  label: string;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.photoTip}>
      {illustration ? (
        <IllustratedIcon size={18} source={illustration} />
      ) : icon ? (
        <Ionicons name={icon} size={13} color={theme.colors.textMuted} />
      ) : null}
      <Text style={[styles.photoTipText, { color: theme.colors.textMuted }]}>{label}</Text>
    </View>
  );
}

type OrderButtonProps = {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  disabled: boolean;
  onPress: () => void;
};

function OrderButton({ icon, label, disabled, onPress }: OrderButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.orderButton,
        disabled && styles.disabledOrderButton,
        pressed && !disabled && pressFeedback.control,
      ]}
    >
      <Ionicons name={icon} size={17} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  headingRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  label: { fontSize: 13, fontWeight: '800' },
  hint: { marginTop: 3, fontSize: 12 },
  counter: { fontSize: 12, fontWeight: '800' },
  readinessCard: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  readinessIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255,45,111,0.09)',
  },
  readinessCopy: { flex: 1, gap: 2 },
  readinessTitle: { fontSize: 12, fontWeight: '900' },
  readinessHint: { fontSize: 10, lineHeight: 14 },
  requiredHint: { fontSize: 10, lineHeight: 14, fontWeight: '800' },
  readinessDots: { flexDirection: 'row', gap: 3 },
  readinessDot: { width: 5, height: 5, borderRadius: 3 },
  sourceActions: { flexDirection: 'row', gap: spacing.xs },
  sourceButton: {
    minHeight: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  sourceButtonLabel: { fontSize: 12, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  photoTile: { width: '31.6%', aspectRatio: 0.78, overflow: 'hidden', borderRadius: radius.md },
  primaryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radius.pill,
    zIndex: 2,
  },
  primaryText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  reviewBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(25,25,29,0.78)',
    borderRadius: radius.pill,
    bottom: 41,
    flexDirection: 'row',
    gap: 4,
    left: 7,
    paddingHorizontal: 7,
    paddingVertical: 5,
    position: 'absolute',
    zIndex: 2,
  },
  reviewBadgeRejected: { backgroundColor: 'rgba(196,45,63,0.88)' },
  reviewBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  newPhotoBadge: {
    backgroundColor: 'rgba(25,25,29,0.78)',
    borderRadius: radius.pill,
    bottom: 41,
    left: 7,
    paddingHorizontal: 7,
    paddingVertical: 5,
    position: 'absolute',
    zIndex: 2,
  },
  newPhotoBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  removeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.68)',
    zIndex: 3,
  },
  replaceButton: {
    position: 'absolute',
    top: 38,
    right: 6,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.68)',
    zIndex: 3,
  },
  setPrimaryButton: {
    position: 'absolute',
    bottom: 7,
    left: 7,
    width: 27,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 3,
  },
  orderButtons: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    gap: 4,
    zIndex: 3,
  },
  orderButton: {
    width: 29,
    height: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  disabledOrderButton: { opacity: 0.28 },
  addTile: {
    width: '31.6%',
    aspectRatio: 0.78,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.md,
  },
  addLabel: { fontSize: 11, fontWeight: '800' },
  photoTips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  photoTip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  photoTipText: { fontSize: 10, fontWeight: '700' },
  uploadStatus: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: radius.md,
  },
  uploadText: { fontSize: 11, fontWeight: '900' },
  pressed: { opacity: 0.65 },
});
