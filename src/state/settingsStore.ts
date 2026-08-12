import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ConnectionMode } from '@/ai/connection';
import { DEFAULT_PROVIDER_ID, getProvider, type ProviderId } from '@/ai/providers';
import { createDefaultOrg, createDefaultProfile } from '@/domain/defaults';
import { cloneDefaultSpecifics } from '@/domain/requiredSpecifics';
import type { NarrativeFormatId, OrgConfig, ProviderProfile, RequiredSpecific } from '@/domain/types';
import { newId } from '@/util/id';
import { nowIso } from '@/util/time';

/**
 * App settings. Deliberately contains no patient information, so it is stored
 * in plain AsyncStorage — report bodies go through the encrypted vault instead.
 */
interface SettingsState {
  org: OrgConfig;
  profile: ProviderProfile;
  providerId: ProviderId;
  /** Chosen model per provider, so switching back and forth is lossless. */
  modelByProvider: Record<string, string>;
  /** Through a squad relay, or straight to the provider with a personal key. */
  connectionMode: ConnectionMode;
  /** Base address of the squad relay. The squad code lives in the keystore. */
  relayUrl: string;
  /** Require Face ID / passcode when the app returns to the foreground. */
  appLockEnabled: boolean;
  /** Default for new reports. On means generated narratives carry a training banner. */
  practiceModeDefault: boolean;
  /** Set to true once the user has been through first-run setup. */
  onboarded: boolean;
  /** Hydration flag so screens can wait for persisted state before rendering. */
  hydrated: boolean;

  setOrgName: (name: string) => void;
  setFormat: (formatId: NarrativeFormatId) => void;
  setHouseStyle: (houseStyle: string) => void;
  toggleSpecific: (id: string) => void;
  updateSpecific: (id: string, patch: Partial<RequiredSpecific>) => void;
  addSpecific: (input: Pick<RequiredSpecific, 'label' | 'criterion' | 'question' | 'appliesTo'>) => void;
  removeSpecific: (id: string) => void;
  restoreDefaultSpecifics: () => void;

  setProfile: (patch: Partial<ProviderProfile>) => void;
  setProviderId: (providerId: ProviderId) => void;
  setModel: (providerId: ProviderId, model: string) => void;
  setConnectionMode: (mode: ConnectionMode) => void;
  setRelayUrl: (relayUrl: string) => void;
  setAppLockEnabled: (enabled: boolean) => void;
  setPracticeModeDefault: (enabled: boolean) => void;
  setOnboarded: (value: boolean) => void;
}

function touch(org: OrgConfig): OrgConfig {
  return { ...org, updatedAt: nowIso() };
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      org: createDefaultOrg(),
      profile: createDefaultProfile(),
      providerId: DEFAULT_PROVIDER_ID,
      modelByProvider: {},
      // Defaults to a personal key: there is no relay until someone deploys
      // one, and an invite link flips this over without anyone choosing it.
      connectionMode: 'own_key',
      relayUrl: '',
      appLockEnabled: true,
      practiceModeDefault: true,
      onboarded: false,
      hydrated: false,

      setOrgName: (name) => set((s) => ({ org: touch({ ...s.org, name }) })),

      setFormat: (formatId) => set((s) => ({ org: touch({ ...s.org, formatId }) })),

      setHouseStyle: (houseStyle) => set((s) => ({ org: touch({ ...s.org, houseStyle }) })),

      toggleSpecific: (id) =>
        set((s) => ({
          org: touch({
            ...s.org,
            requiredSpecifics: s.org.requiredSpecifics.map((r) =>
              r.id === id ? { ...r, enabled: !r.enabled } : r,
            ),
          }),
        })),

      updateSpecific: (id, patch) =>
        set((s) => ({
          org: touch({
            ...s.org,
            requiredSpecifics: s.org.requiredSpecifics.map((r) =>
              r.id === id ? { ...r, ...patch } : r,
            ),
          }),
        })),

      addSpecific: (input) =>
        set((s) => ({
          org: touch({
            ...s.org,
            requiredSpecifics: [
              ...s.org.requiredSpecifics,
              { ...input, id: `custom_${newId().slice(0, 8)}`, enabled: true, custom: true },
            ],
          }),
        })),

      removeSpecific: (id) =>
        set((s) => ({
          org: touch({
            ...s.org,
            // Built-in entries are disabled rather than deleted, so an org can
            // always get back to the shipped baseline.
            requiredSpecifics: s.org.requiredSpecifics.filter((r) => !(r.id === id && r.custom)),
          }),
        })),

      restoreDefaultSpecifics: () =>
        set((s) => ({
          org: touch({
            ...s.org,
            requiredSpecifics: [
              ...cloneDefaultSpecifics(),
              ...s.org.requiredSpecifics.filter((r) => r.custom),
            ],
          }),
        })),

      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      setProviderId: (providerId) => set({ providerId }),
      setModel: (providerId, model) =>
        set((st) => ({ modelByProvider: { ...st.modelByProvider, [providerId]: model } })),
      setConnectionMode: (connectionMode) => set({ connectionMode }),
      setRelayUrl: (relayUrl) => set({ relayUrl }),
      setAppLockEnabled: (appLockEnabled) => set({ appLockEnabled }),
      setPracticeModeDefault: (practiceModeDefault) => set({ practiceModeDefault }),
      setOnboarded: (onboarded) => set({ onboarded }),
    }),
    {
      name: 'pcr-settings-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        org: s.org,
        profile: s.profile,
        providerId: s.providerId,
        modelByProvider: s.modelByProvider,
        connectionMode: s.connectionMode,
        relayUrl: s.relayUrl,
        appLockEnabled: s.appLockEnabled,
        practiceModeDefault: s.practiceModeDefault,
        onboarded: s.onboarded,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setOnboarded(state.onboarded);
        useSettings.setState({ hydrated: true });
      },
    },
  ),
);

/** The provider + model to use for the next request. */
export function currentAiConfig(): { providerId: ProviderId; model: string } {
  const { providerId, modelByProvider } = useSettings.getState();
  return {
    providerId,
    model: modelByProvider[providerId] || getProvider(providerId).defaultModel,
  };
}

/** The specifics the org actually wants checked right now. */
export function enabledSpecifics(org: OrgConfig): RequiredSpecific[] {
  return org.requiredSpecifics.filter((r) => r.enabled);
}
