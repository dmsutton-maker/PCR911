import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Build-time configuration.
 *
 * Everything static lives in app.json, which Expo loads and hands to this file
 * as `config`. This file exists to bake the AI connection into the build so
 * that **nobody using the app ever enters an API key**. You set it once, as
 * repository secrets; every phone that installs the build is already connected.
 *
 * Two ways to supply it, in order of preference:
 *
 *   PCR_RELAY_URL + PCR_SQUAD_CODE   the squad relay (server/README.md).
 *                                    The provider key stays on the server and
 *                                    the code can be changed without a rebuild
 *                                    of anything but this config.
 *
 *   PCR_GEMINI_API_KEY               the provider key itself, baked in.
 *   PCR_ANTHROPIC_API_KEY            Simpler, and worse: a key inside an app
 *                                    binary or a web bundle can be extracted by
 *                                    anyone who has the app. Use it to get
 *                                    moving, not to stay.
 *
 * Nothing secret is committed. These are read from the environment at build
 * time, which in practice means GitHub Actions secrets. A build with none of
 * them set still works — the app just asks for a key the way it used to.
 */

function env(name: string): string {
  return (process.env[name] ?? '').trim();
}

export interface BakedConfig {
  relayUrl: string;
  squadCode: string;
  apiKeys: Record<string, string>;
  /** True when this build needs no setup from the person using it. */
  preconfigured: boolean;
}

function bakedConfig(): BakedConfig {
  const relayUrl = env('PCR_RELAY_URL');
  const squadCode = env('PCR_SQUAD_CODE');
  const apiKeys: Record<string, string> = {};

  const gemini = env('PCR_GEMINI_API_KEY');
  if (gemini) apiKeys.gemini = gemini;

  const anthropic = env('PCR_ANTHROPIC_API_KEY');
  if (anthropic) apiKeys.anthropic = anthropic;

  return {
    relayUrl,
    squadCode,
    apiKeys,
    preconfigured: Boolean((relayUrl && squadCode) || Object.keys(apiKeys).length > 0),
  };
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  extra: {
    ...(config.extra ?? {}),
    baked: bakedConfig(),
  },
});
