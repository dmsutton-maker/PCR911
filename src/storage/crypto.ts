import { gcm } from '@noble/ciphers/aes.js';
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils.js';
import * as Crypto from 'expo-crypto';

import { getStoredDataKey, storeDataKey } from './secure';

/**
 * Application-layer encryption for report bodies.
 *
 * AES-256-GCM with a random 96-bit nonce per write. The key is generated once
 * from the platform CSPRNG and kept in the keystore (see storage/secure.ts).
 *
 * iOS already encrypts app data at rest via Data Protection, so this is a
 * second layer, not the only one. What it buys: report files are unreadable
 * while the device is locked, are useless if lifted out of a filesystem dump,
 * and can be destroyed instantly by deleting one keystore entry.
 *
 * This is a pure-JS cipher so it works in Expo Go with no native module. Report
 * bodies are a few kilobytes, so the performance cost is not measurable. See
 * docs/SECURITY-PHI.md for the swap path to a native crypto module.
 */

const KEY_BYTES = 32; // AES-256
const NONCE_BYTES = 12; // GCM standard

let cachedKey: Uint8Array | null = null;

async function getDataKey(): Promise<Uint8Array> {
  if (cachedKey) return cachedKey;

  const existing = await getStoredDataKey();
  if (existing) {
    cachedKey = hexToBytes(existing);
    return cachedKey;
  }

  const fresh = Crypto.getRandomBytes(KEY_BYTES);
  await storeDataKey(bytesToHex(fresh));
  cachedKey = fresh;
  return cachedKey;
}

/** Drop the in-memory copy of the key. Call after erasing data or on app lock. */
export function forgetCachedKey(): void {
  if (cachedKey) cachedKey.fill(0);
  cachedKey = null;
}

/**
 * Envelope format: `v1.<nonce hex>.<ciphertext hex>`.
 * The version prefix exists so a future key rotation can be detected on read.
 */
export async function encryptString(plaintext: string): Promise<string> {
  const key = await getDataKey();
  const nonce = Crypto.getRandomBytes(NONCE_BYTES);
  const sealed = gcm(key, nonce).encrypt(utf8ToBytes(plaintext));
  return `v1.${bytesToHex(nonce)}.${bytesToHex(sealed)}`;
}

export async function decryptString(envelope: string): Promise<string> {
  const parts = envelope.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') {
    throw new Error('Unrecognized encrypted record format.');
  }
  const key = await getDataKey();
  const opened = gcm(key, hexToBytes(parts[1])).decrypt(hexToBytes(parts[2]));
  return bytesToUtf8(opened);
}

export async function encryptJson(value: unknown): Promise<string> {
  return encryptString(JSON.stringify(value));
}

export async function decryptJson<T>(envelope: string): Promise<T> {
  return JSON.parse(await decryptString(envelope)) as T;
}
