const memoryStorage = new Map<string, string>();

function getSessionStorage() {
  return typeof globalThis.sessionStorage === 'undefined' ? null : globalThis.sessionStorage;
}

function getLocalStorage() {
  return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
}

export const sensitiveStorage = {
  async getItem(key: string) {
    const current = getSessionStorage()?.getItem(key) ?? memoryStorage.get(key) ?? null;
    if (current) return current;

    const legacyValue = getLocalStorage()?.getItem(key) ?? null;
    if (!legacyValue) return null;
    await sensitiveStorage.setItem(key, legacyValue);
    getLocalStorage()?.removeItem(key);
    return legacyValue;
  },
  async setItem(key: string, value: string) {
    const storage = getSessionStorage();
    if (storage) storage.setItem(key, value);
    else memoryStorage.set(key, value);
  },
  async removeItem(key: string) {
    getSessionStorage()?.removeItem(key);
    getLocalStorage()?.removeItem(key);
    memoryStorage.delete(key);
  },
};
