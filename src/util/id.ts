import * as Crypto from 'expo-crypto';
import { bytesToHex } from '@noble/ciphers/utils.js';

/** Random, non-sequential id. Not derived from any patient data. */
export function newId(): string {
  return bytesToHex(Crypto.getRandomBytes(12));
}
