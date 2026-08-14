import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { fetchMe } from '@/ai/account';
import { normalizeRelayUrl } from '@/ai/connection';
import { useSettings } from '@/state/settingsStore';
import { setAccessCode, setMemberToken } from '@/storage/secure';
import { clearJoinLink, readJoinLink } from '@/util/appUrl';
import { notify } from '@/util/dialog';
import type { JoinPayload } from '@/util/joinLink';

/**
 * Applies an invite link, once, on first launch after someone opens one.
 *
 * Two kinds arrive here. An **invite code** means the person gets their own
 * account, so this records the server address and hands off to the join screen,
 * which asks who they are — the one question the whole accounts design exists
 * to be able to answer. A bare **squad code** is the older shared-credential
 * link and is applied silently, since there is nobody to identify.
 *
 * Two pieces of ordering matter:
 *
 *   - The fragment is read during the first render rather than in the effect,
 *     because the router rewrites the address bar as soon as it mounts and the
 *     payload would be gone by the time an effect ran.
 *   - Writing waits for the settings store to finish rehydrating. Persisted
 *     state lands asynchronously and would otherwise overwrite the server
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
      useSettings.getState().setRelayUrl(relayUrl);
      useSettings.getState().setConnectionMode('relay');

      // A token link signs an account straight in — used by whoever created the
      // squad, since there is nobody to invite them, and for putting an
      // existing account on a second device.
      if (invite.token) {
        try {
          await setMemberToken(invite.token);
          const { account, config } = await fetchMe();
          useSettings.getState().setAccount(account);
          useSettings.getState().applyOrgConfig(account.orgName, config);
          router.replace('/');
          clearJoinLink();
          notify(
            `Signed in as ${account.name}`,
            `${account.orgName}${account.role === 'admin' ? ' · admin' : ''}. Nothing else to set up.`,
          );
        } catch {
          notify(
            'Could not sign in',
            'That link did not work. It may have been replaced, or the access withdrawn.',
          );
        }
        return;
      }

      if (invite.inviteCode) {
        // Get the code out of the address bar before navigating anywhere. See
        // the note in appUrl.web.ts about why this goes through the router.
        router.replace(`/join?code=${encodeURIComponent(invite.inviteCode)}`);
        clearJoinLink();
        return;
      }

      try {
        await setAccessCode(invite.code ?? '');
      } catch {
        notify('Could not save the invite', 'This browser refused to store the squad code.');
        return;
      }

      router.replace('/');
      clearJoinLink();

      notify(
        "You're set up",
        `This app is connected to your squad's shared account. There is no API key for you to get — just start a report.\n\nStill practice data only: use fake patients.`,
      );
    })();
  }, [hydrated]);
}
