import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800;
const MANIFEST_SUFFIX = '.secure-manifest';
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: 'app.wichu.mobile.auth',
};

type Manifest = { version: 1; generation: string; chunks: number };

function manifestKey(key: string) {
  return `${key}${MANIFEST_SUFFIX}`;
}

function chunkKey(key: string, generation: string, index: number) {
  return `${key}.${generation}.${index}`;
}

function parseManifest(value: string | null): Manifest | null {
  if (!value) return null;
  try {
    const manifest = JSON.parse(value) as Partial<Manifest>;
    if (
      manifest.version !== 1 ||
      typeof manifest.generation !== 'string' ||
      !Number.isInteger(manifest.chunks) ||
      Number(manifest.chunks) < 1 ||
      Number(manifest.chunks) > 20
    ) {
      return null;
    }
    return manifest as Manifest;
  } catch {
    return null;
  }
}

async function removeGeneration(key: string, manifest: Manifest | null) {
  if (!manifest) return;
  await Promise.all(
    Array.from({ length: manifest.chunks }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, manifest.generation, index), OPTIONS),
    ),
  );
}

export const sensitiveStorage = {
  async getItem(key: string) {
    const manifest = parseManifest(await SecureStore.getItemAsync(manifestKey(key), OPTIONS));
    if (manifest) {
      const chunks = await Promise.all(
        Array.from({ length: manifest.chunks }, (_, index) =>
          SecureStore.getItemAsync(chunkKey(key, manifest.generation, index), OPTIONS),
        ),
      );
      if (chunks.every((chunk): chunk is string => chunk !== null)) return chunks.join('');
      await removeGeneration(key, manifest);
      await SecureStore.deleteItemAsync(manifestKey(key), OPTIONS);
    }

    const legacyValue = await AsyncStorage.getItem(key);
    if (!legacyValue) return null;
    await sensitiveStorage.setItem(key, legacyValue);
    await AsyncStorage.removeItem(key);
    return legacyValue;
  },

  async setItem(key: string, value: string) {
    const previous = parseManifest(await SecureStore.getItemAsync(manifestKey(key), OPTIONS));
    const generation = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'gs')) ?? [''];
    if (chunks.length > 20) throw new Error('Secure session payload is unexpectedly large.');

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(chunkKey(key, generation, index), chunk, OPTIONS),
      ),
    );
    await SecureStore.setItemAsync(
      manifestKey(key),
      JSON.stringify({ version: 1, generation, chunks: chunks.length } satisfies Manifest),
      OPTIONS,
    );
    await removeGeneration(key, previous);
    await AsyncStorage.removeItem(key);
  },

  async removeItem(key: string) {
    const manifest = parseManifest(await SecureStore.getItemAsync(manifestKey(key), OPTIONS));
    await removeGeneration(key, manifest);
    await Promise.all([
      SecureStore.deleteItemAsync(manifestKey(key), OPTIONS),
      AsyncStorage.removeItem(key),
    ]);
  },
};
