import * as SecureStore from 'expo-secure-store';

/**
 * Thin wrapper over the platform keystore (iOS Keychain / Android Keystore).
 *
 * Two things live here and nowhere else:
 *   - the user's Claude API key
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

const API_KEY = 'anthropic_api_key';
const DATA_KEY = 'report_data_key_v1';

export async function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(API_KEY, OPTIONS);
}

export async function setApiKey(value: string): Promise<void> {
  await SecureStore.setItemAsync(API_KEY, value.trim(), OPTIONS);
}

export async function clearApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(API_KEY, OPTIONS);
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
