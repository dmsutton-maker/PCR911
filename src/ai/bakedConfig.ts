import Constants from 'expo-constants';

/**
 * The connection settings baked into this build.
 *
 * The point of these is that a person installing the app should never see an
 * API key, a relay address, or a settings screen about either. They open the
 * app and it works. Whoever builds it configures it once, as repository
 * secrets — see app.config.ts.
 *
 * Read-only and build-time. Anything a user changes in Settings takes
 * precedence over what is here, so a build can ship a squad default and still
 * let one person point at something else.
 */

export interface BakedConfig {
  relayUrl: string;
  squadCode: string;
  apiKeys: Record<string, string>;
  preconfigured: boolean;
}

const EMPTY: BakedConfig = {
  relayUrl: '',
  squadCode: '',
  apiKeys: {},
  preconfigured: false,
};

let cached: BakedConfig | null = null;

export function getBakedConfig(): BakedConfig {
  if (cached) return cached;

  const raw = (Constants.expoConfig?.extra as { baked?: Partial<BakedConfig> } | undefined)?.baked;

  cached = raw
    ? {
        relayUrl: typeof raw.relayUrl === 'string' ? raw.relayUrl : '',
        squadCode: typeof raw.squadCode === 'string' ? raw.squadCode : '',
        apiKeys: raw.apiKeys && typeof raw.apiKeys === 'object' ? raw.apiKeys : {},
        preconfigured: Boolean(raw.preconfigured),
      }
    : EMPTY;

  return cached;
}

/** Whether this build arrives already connected, needing nothing from the user. */
export function isPreconfigured(): boolean {
  return getBakedConfig().preconfigured;
}

/**
 * How this build was configured, for the one place in Settings that admits any
 * of this exists. Never shows the credential itself.
 */
export function describeBakedConfig(): string | null {
  const baked = getBakedConfig();
  if (!baked.preconfigured) return null;

  if (baked.relayUrl && baked.squadCode) {
    return `Connected to your squad's shared account. Set up when this version was built — nothing for you to enter.`;
  }
  const providers = Object.keys(baked.apiKeys).join(' and ');
  return `An API key for ${providers} is built into this version. Nothing for you to enter.`;
}
