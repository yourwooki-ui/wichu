import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeProvider';
import { radius, spacing } from '@/constants/theme';
import type { ProfilePhotoDraft } from '@/features/profile/types/profile-photo';

const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const MIN_PHOTO_EDGE = 600;
const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type ProfilePhotoPickerProps = {
  dark?: boolean;
  disabled?: boolean;
  photos: ProfilePhotoDraft[];
  uploadProgress?: { completed: number; total: number } | null;
  onChange: (photos: ProfilePhotoDraft[]) => void;
  onError: (message: string) => void;
};

export function ProfilePhotoPicker({
  dark = false,
  disabled,
  photos,
  uploadProgress,
  onChange,
  onError,
}: ProfilePhotoPickerProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [picking, setPicking] = useState(false);
  const recoveredPendingResult = useRef(false);
  const textColor = dark ? '#FFFFFF' : theme.colors.text;
  const mutedColor = dark ? '#8F8F99' : theme.colors.textMuted;
  const surfaceColor = dark ? '#17171B' : theme.colors.surface;
  const borderColor = dark ? '#34343B' : theme.colors.border;

  const addAssets = useCallback(
    (assets: ImagePicker.ImagePickerAsset[]) => {
      const remaining = MAX_PHOTOS - photos.length;
      if (remaining <= 0) return;

      const knownIdentities = new Set(photos.map(getPhotoIdentity));
      const validAssets: ImagePicker.ImagePickerAsset[] = [];
      let skipped = 0;

      for (const asset of assets) {
        const identity = getPhotoIdentity(asset);
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

      const drafts = validAssets.slice(0, remaining).map((asset, index) => ({
        ...asset,
        draftId: `${asset.assetId ?? asset.uri}-${Date.now()}-${index}`,
      }));

      if (drafts.length > 0) onChange([...photos, ...drafts]);
      if (skipped > 0) onError(t('profileSetup.photos.skipped', { count: skipped }));
      else onError('');
    },
    [onChange, onError, photos, t],
  );

  useEffect(() => {
    if (Platform.OS !== 'android' || recoveredPendingResult.current) return;
    recoveredPendingResult.current = true;

    void ImagePicker.getPendingResultAsync()
      .then((result) => {
        if (result && 'assets' in result && !result.canceled) addAssets(result.assets);
      })
      .catch(() => undefined);
  }, [addAssets]);

  async function pickFromLibrary() {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0 || picking || disabled) return;

    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        orderedSelection: true,
        selectionLimit: remaining,
        quality: 0.85,
      });

      if (result.canceled) return;
      addAssets(result.assets);
    } catch (error) {
      onError(error instanceof Error ? error.message : t('profileSetup.photos.pickFailed'));
    } finally {
      setPicking(false);
    }
  }

  async function takePhoto() {
    if (photos.length >= MAX_PHOTOS || picking || disabled) return;

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
        quality: 0.9,
      });
      if (!result.canceled) addAssets(result.assets);
    } catch (error) {
      onError(error instanceof Error ? error.message : t('profileSetup.photos.cameraFailed'));
    } finally {
      setPicking(false);
    }
  }

  function movePhoto(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function removePhoto(draftId: string) {
    onChange(photos.filter((photo) => photo.draftId !== draftId));
  }

  function setPrimaryPhoto(index: number) {
    if (index === 0) return;
    const next = [...photos];
    const [primary] = next.splice(index, 1);
    if (!primary) return;
    onChange([primary, ...next]);
  }

  const controlsDisabled = disabled || picking;

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
            <Image source={{ uri: photo.uri }} contentFit="cover" style={StyleSheet.absoluteFill} />
            {index === 0 ? (
              <View style={[styles.primaryBadge, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.primaryText}>{t('profileSetup.photos.primary')}</Text>
              </View>
            ) : null}
            <Pressable
              accessibilityLabel={t('profileSetup.photos.remove', { index: index + 1 })}
              accessibilityRole="button"
              disabled={controlsDisabled}
              hitSlop={8}
              onPress={() => removePhoto(photo.draftId)}
              style={styles.removeButton}
            >
              <Ionicons name="close" size={16} color="#FFFFFF" />
            </Pressable>
            {index > 0 ? (
              <Pressable
                accessibilityLabel={t('profileSetup.photos.setPrimary', { index: index + 1 })}
                accessibilityRole="button"
                disabled={controlsDisabled}
                onPress={() => setPrimaryPhoto(index)}
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
            <Ionicons name="add" size={28} color={theme.colors.primary} />
            <Text style={[styles.addLabel, { color: textColor }]}>
              {t('profileSetup.photos.add')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.photoTips}>
        <PhotoTip icon="person-outline" label={t('profileSetup.photos.tipFace')} />
        <PhotoTip icon="sunny-outline" label={t('profileSetup.photos.tipClear')} />
        <PhotoTip icon="shield-checkmark-outline" label={t('profileSetup.photos.tipSafe')} />
      </View>

      {uploadProgress ? (
        <View style={[styles.uploadStatus, { backgroundColor: surfaceColor }]}>
          <Ionicons name="cloud-upload-outline" size={17} color={theme.colors.primary} />
          <Text style={[styles.uploadText, { color: textColor }]}>
            {t('profileSetup.photos.uploading', uploadProgress)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function getPhotoIdentity(photo: ImagePicker.ImagePickerAsset) {
  if (photo.assetId) return `asset:${photo.assetId}`;
  if (photo.fileName || photo.fileSize != null) {
    return `file:${photo.fileName ?? ''}:${photo.fileSize ?? ''}:${photo.width}x${photo.height}`;
  }
  return `uri:${photo.uri}`;
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

function PhotoTip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.photoTip}>
      <Ionicons name={icon} size={13} color={theme.colors.textMuted} />
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
      style={[styles.orderButton, disabled && styles.disabledOrderButton]}
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
  },
  primaryText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
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
  },
  orderButtons: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    gap: 4,
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
  photoTipText: { fontSize: 9, fontWeight: '700' },
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
