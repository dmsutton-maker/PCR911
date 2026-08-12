import { DEFAULT_FORMAT_ID } from './formats';
import { cloneDefaultSpecifics } from './requiredSpecifics';
import type { OrgConfig, ProviderProfile } from './types';

export function createDefaultOrg(): OrgConfig {
  return {
    id: 'local-org',
    name: 'My squad',
    formatId: DEFAULT_FORMAT_ID,
    requiredSpecifics: cloneDefaultSpecifics(),
    houseStyle: '',
    updatedAt: new Date().toISOString(),
  };
}

export function createDefaultProfile(): ProviderProfile {
  return { state: '', certLevel: 'EMT', unitId: '' };
}

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID',
  'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO',
  'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA',
  'PR', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const;

export const CERT_LEVELS = [
  'EMR',
  'EMT',
  'AEMT',
  'EMT-I',
  'Paramedic',
  'Critical Care',
] as const;

