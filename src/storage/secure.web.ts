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

const DATA_KEY = 'pcr.secure.report_data_key_v1';
const ACCESS_CODE = 'pcr.secure.squad_access_code_v1';
const MEMBER_TOKEN = 'pcr.secure.org_member_token_v1';

function apiKeyName(providerId: string): string {
  return `pcr.secure.api_key_${providerId}`;
}

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

/**
 * Throws rather than failing quietly.
 *
 * `localStorage` is absent in Safari private browsing and throws on write when
 * a quota is hit. Swallowing that meant the app cheerfully said "Saved" over a
 * key it had not stored, and the user then went hunting for a problem in the
 * key instead of in the browser. Callers surface the failure.
 */
function write(key: string, value: string): void {
  const storage = store();
  if (!storage) {
    throw new Error(
      'This browser is not allowing local storage. If you are in a Private Browsing window, open the app in a normal one.',
    );
  }
  storage.setItem(key, value);
  if (storage.getItem(key) !== value) {
    throw new Error('This browser accepted the write but did not keep it.');
  }
}

function remove(key: string): void {
  store()?.removeItem(key);
}

export async function getApiKey(providerId: string): Promise<string | null> {
  return read(apiKeyName(providerId));
}

export async function setApiKey(providerId: string, value: string): Promise<void> {
  write(apiKeyName(providerId), value.trim());
}

export async function clearApiKey(providerId: string): Promise<void> {
  remove(apiKeyName(providerId));
}

export async function getAccessCode(): Promise<string | null> {
  return read(ACCESS_CODE);
}

export async function setAccessCode(value: string): Promise<void> {
  write(ACCESS_CODE, value.trim());
}

export async function clearAccessCode(): Promise<void> {
  remove(ACCESS_CODE);
}

export async function getMemberToken(): Promise<string | null> {
  return read(MEMBER_TOKEN);
}

export async function setMemberToken(value: string): Promise<void> {
  write(MEMBER_TOKEN, value.trim());
}

export async function clearMemberToken(): Promise<void> {
  remove(MEMBER_TOKEN);
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
