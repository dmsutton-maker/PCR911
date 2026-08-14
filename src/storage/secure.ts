import * as SecureStore from 'expo-secure-store';

/**
 * Thin wrapper over the platform keystore (iOS Keychain / Android Keystore).
 *
 * Two things live here and nowhere else:
 *   - the user's API key for each AI provider
 *   - the AES data key used to encrypt report bodies on disk
 *
 * Both are written with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, which means they are
 * unreadable while the device is locked and are never included in an iCloud or
 * iTunes backup. If the phone is restored to a different device, the reports on
 * it become permanently undecryptable — that is the intended tradeoff.
 */

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const DATA_KEY = 'report_data_key_v1';
const ACCESS_CODE = 'squad_access_code_v1';
const MEMBER_TOKEN = 'org_member_token_v1';

/** One key per provider, so switching provider does not lose the other key. */
function apiKeyName(providerId: string): string {
  return `api_key_${providerId}`;
}

export async function getApiKey(providerId: string): Promise<string | null> {
  return SecureStore.getItemAsync(apiKeyName(providerId), OPTIONS);
}

export async function setApiKey(providerId: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(apiKeyName(providerId), value.trim(), OPTIONS);
}

export async function clearApiKey(providerId: string): Promise<void> {
  await SecureStore.deleteItemAsync(apiKeyName(providerId), OPTIONS);
}

/**
 * The squad code used to authenticate against a relay. Not a provider key, but
 * it is a credential and belongs in the same place rather than in settings.
 */
export async function getAccessCode(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_CODE, OPTIONS);
}

export async function setAccessCode(value: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_CODE, value.trim(), OPTIONS);
}

export async function clearAccessCode(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_CODE, OPTIONS);
}

/**
 * The token identifying this person to their org. Issued on joining, revocable
 * by an admin, and never shown back to the user.
 */
export async function getMemberToken(): Promise<string | null> {
  return SecureStore.getItemAsync(MEMBER_TOKEN, OPTIONS);
}

export async function setMemberToken(value: string): Promise<void> {
  await SecureStore.setItemAsync(MEMBER_TOKEN, value.trim(), OPTIONS);
}

export async function clearMemberToken(): Promise<void> {
  await SecureStore.deleteItemAsync(MEMBER_TOKEN, OPTIONS);
}

export async function getStoredDataKey(): Promise<string | null> {
  return SecureStore.getItemAsync(DATA_KEY, OPTIONS);
}

export async function storeDataKey(hex: string): Promise<void> {
  await SecureStore.setItemAsync(DATA_KEY, hex, OPTIONS);
}

/**
 * Destroys the data key. Every encrypted report on disk becomes unreadable
 * immediately — this is the "crypto-shred everything" primitive behind the
 * Erase all data action in Settings.
 */
export async function destroyDataKey(): Promise<void> {
  await SecureStore.deleteItemAsync(DATA_KEY, OPTIONS);
}

export async function isSecureStoreAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}
