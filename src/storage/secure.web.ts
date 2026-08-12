/**
 * Web fallback for the keystore.
 *
 * Metro picks this file over secure.ts when building for web. It exists so the
 * browser version runs at all — `expo-secure-store` has no web implementation.
 *
 * ⚠️ This is browser localStorage. It is NOT equivalent to the iOS Keychain:
 * there is no hardware backing, no lock-screen gating, and any script running
 * on this origin can read it. The web build is therefore a practice-data
 * evaluation tool, not a PHI-capable one — the app says so on the home screen,
 * and docs/SECURITY-PHI.md explains the difference.
 */

const API_KEY = 'pcr.secure.anthropic_api_key';
const DATA_KEY = 'pcr.secure.report_data_key_v1';

function store(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Safari private browsing can throw on access rather than returning null.
    return null;
  }
}

function read(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  store()?.setItem(key, value);
}

function remove(key: string): void {
  store()?.removeItem(key);
}

export async function getApiKey(): Promise<string | null> {
  return read(API_KEY);
}

export async function setApiKey(value: string): Promise<void> {
  write(API_KEY, value.trim());
}

export async function clearApiKey(): Promise<void> {
  remove(API_KEY);
}

export async function getStoredDataKey(): Promise<string | null> {
  return read(DATA_KEY);
}

export async function storeDataKey(hex: string): Promise<void> {
  write(DATA_KEY, hex);
}

export async function destroyDataKey(): Promise<void> {
  remove(DATA_KEY);
}

/** Always false on web — there is no real secure store here, and callers should know. */
export async function isSecureStoreAvailable(): Promise<boolean> {
  return false;
}
