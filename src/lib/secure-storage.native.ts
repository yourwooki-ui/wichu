import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800;
const MANIFEST_SUFFIX = '.secure-manifest';
/**
 * SecureStore 옵션은 호출 시점에 만든다.
 *
 * 모듈 평가 시점에 네이티브 모듈의 상수를 읽으면, 그 모듈이 아직 준비되지 않았을 때
 * 파일 평가 자체가 실패한다. 이 파일은 supabase → AuthProvider → 루트 레이아웃으로
 * 이어지는 시작 경로에 있어서, 실패하면 화면 한 번 못 띄우고 앱이 종료된다.
 * (WHEN_UNLOCKED_THIS_DEVICE_ONLY는 iOS 키체인 전용 상수이기도 하다.)
 */
function getOptions(): SecureStore.SecureStoreOptions {
  const options: SecureStore.SecureStoreOptions = { keychainService: 'app.wichu.mobile.auth' };
  try {
    const accessible = SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY;
    if (accessible !== undefined) options.keychainAccessible = accessible;
  } catch {
    // 상수를 읽지 못해도 기본 접근 정책으로 동작한다.
  }
  return options;
}

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
      SecureStore.deleteItemAsync(chunkKey(key, manifest.generation, index), getOptions()),
    ),
  );
}

export const sensitiveStorage = {
  async getItem(key: string) {
    try {
      const manifest = parseManifest(
        await SecureStore.getItemAsync(manifestKey(key), getOptions()),
      );
      if (manifest) {
        const chunks = await Promise.all(
          Array.from({ length: manifest.chunks }, (_, index) =>
            SecureStore.getItemAsync(chunkKey(key, manifest.generation, index), getOptions()),
          ),
        );
        if (chunks.every((chunk): chunk is string => chunk !== null)) return chunks.join('');
        await removeGeneration(key, manifest);
        await SecureStore.deleteItemAsync(manifestKey(key), getOptions());
      }
    } catch {
      // 잠금화면·키스토어 초기화 등으로 SecureStore가 일시 실패하면 세션 없음으로 복구한다.
      return null;
    }

    const legacyValue = await AsyncStorage.getItem(key).catch(() => null);
    if (!legacyValue) return null;
    await sensitiveStorage.setItem(key, legacyValue);
    await AsyncStorage.removeItem(key);
    return legacyValue;
  },

  async setItem(key: string, value: string) {
    const previous = parseManifest(await SecureStore.getItemAsync(manifestKey(key), getOptions()));
    const generation = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'gs')) ?? [''];
    if (chunks.length > 20) throw new Error('Secure session payload is unexpectedly large.');

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(chunkKey(key, generation, index), chunk, getOptions()),
      ),
    );
    await SecureStore.setItemAsync(
      manifestKey(key),
      JSON.stringify({ version: 1, generation, chunks: chunks.length } satisfies Manifest),
      getOptions(),
    );
    await removeGeneration(key, previous);
    await AsyncStorage.removeItem(key);
  },

  async removeItem(key: string) {
    try {
      const manifest = parseManifest(
        await SecureStore.getItemAsync(manifestKey(key), getOptions()),
      );
      await removeGeneration(key, manifest);
      await SecureStore.deleteItemAsync(manifestKey(key), getOptions());
    } catch {
      // 기기 키스토어가 이미 초기화된 경우 삭제할 암호화 데이터도 사용할 수 없다.
    }
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
};
