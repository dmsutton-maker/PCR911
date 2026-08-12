import * as LocalAuthentication from 'expo-local-authentication';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, StyleSheet, Text, View } from 'react-native';

import { useSettings } from '@/state/settingsStore';
import { forgetCachedKey } from '@/storage/crypto';
import { colors, space, type } from '@/theme';
import { Button, Muted } from './ui';

/**
 * Biometric / passcode gate.
 *
 * Locks on cold start and whenever the app has been in the background long
 * enough that someone else could plausibly be holding the phone. Locking also
 * drops the cached decryption key from memory, so report bodies are not sitting
 * decryptable in a backgrounded process.
 */
const BACKGROUND_GRACE_MS = 30_000;

export function AppLock({ children }: { children: ReactNode }) {
  const appLockEnabled = useSettings((s) => s.appLockEnabled);
  const hydrated = useSettings((s) => s.hydrated);

  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hardwareAvailable, setHardwareAvailable] = useState<boolean | null>(null);
  const backgroundedAt = useRef<number | null>(null);

  const authenticate = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setHardwareAvailable(hasHardware && isEnrolled);

      if (!hasHardware || !isEnrolled) {
        // No passcode or biometrics configured on the device. Refusing to open
        // would strand the user, so open but say plainly that the lock is off.
        setUnlocked(true);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock PCR Narrative',
        cancelLabel: 'Cancel',
        requireConfirmation: false,
      });

      if (result.success) {
        setUnlocked(true);
      } else {
        setError('Not unlocked.');
      }
    } catch {
      setError('Could not start authentication on this device.');
    } finally {
      setChecking(false);
    }
  }, []);

  // Cold start.
  useEffect(() => {
    if (!hydrated) return;
    if (!appLockEnabled) {
      setUnlocked(true);
      return;
    }
    if (!unlocked) void authenticate();
    // Intentionally not depending on `unlocked`: this effect is the cold-start
    // path, and re-locking is handled by the AppState listener below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, appLockEnabled, authenticate]);

  // Re-lock after backgrounding.
  useEffect(() => {
    if (!appLockEnabled) return;

    const onChange = (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        if (backgroundedAt.current === null) backgroundedAt.current = Date.now();
        return;
      }
      if (state === 'active') {
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        if (since !== null && Date.now() - since > BACKGROUND_GRACE_MS) {
          forgetCachedKey();
          setUnlocked(false);
          void authenticate();
        }
      }
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [appLockEnabled, authenticate]);

  if (!hydrated) return <View style={s.blank} />;

  if (!unlocked) {
    return (
      <View style={s.lock}>
        <Text style={type.title}>PCR Narrative</Text>
        <Muted style={s.center}>
          {hardwareAvailable === false
            ? 'This device has no passcode or biometrics set up, so the app lock cannot be used.'
            : 'Locked. Authenticate to open your drafts.'}
        </Muted>
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Button label="Unlock" onPress={authenticate} loading={checking} style={s.button} />
      </View>
    );
  }

  return <>{children}</>;
}

const s = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.bg },
  lock: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    gap: space.md,
  },
  center: { textAlign: 'center' },
  error: { color: colors.danger, fontSize: 14 },
  button: { alignSelf: 'stretch', marginTop: space.md },
});
