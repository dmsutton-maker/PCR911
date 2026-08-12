import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { normalizeRelayUrl } from '@/ai/connection';
import { useSettings } from '@/state/settingsStore';
import { setAccessCode } from '@/storage/secure';
import { clearJoinLink, readJoinLink } from '@/util/appUrl';
import type { JoinPayload } from '@/util/joinLink';
import { notify } from '@/util/dialog';

/**
 * Applies an invite link, once, on first launch after someone opens one.
 *
 * Two pieces of ordering matter here:
 *
 *   - The fragment is read during the first render rather than in the effect,
 *     because the router rewrites the address bar as soon as it mounts and the
 *     payload would be gone by the time an effect ran.
 *   - Writing waits for the settings store to finish rehydrating. Persisted
 *     state lands asynchronously and would otherwise overwrite the relay
 *     address we just set with the empty one from disk.
 */
export function useJoinLink(): void {
  const hydrated = useSettings((s) => s.hydrated);
  const payload = useRef<JoinPayload | null | undefined>(undefined);
  const applied = useRef(false);

  if (payload.current === undefined) payload.current = readJoinLink();

  useEffect(() => {
    const invite = payload.current;
    if (!hydrated || applied.current || !invite) return;
    applied.current = true;

    void (async () => {
      const relayUrl = normalizeRelayUrl(invite.relayUrl);
      try {
        await setAccessCode(invite.code);
      } catch {
        notify('Could not save the invite', 'This browser refused to store the squad code.');
        return;
      }
      useSettings.getState().setRelayUrl(relayUrl);
      useSettings.getState().setConnectionMode('relay');

      // Get the squad code out of the address bar, and out of history with it.
      // This has to go through the router rather than `history.replaceState`:
      // expo-router captured the fragment when it initialised and writes its
      // own copy back on every sync, so an external strip is undone within a
      // frame. Replacing the route updates the state the router writes from.
      router.replace('/');
      clearJoinLink();

      notify(
        "You're set up",
        `This app is connected to your squad's shared account. There is no API key for you to get — just start a report.\n\nStill practice data only: use fake patients.`,
      );
    })();
  }, [hydrated]);
}
