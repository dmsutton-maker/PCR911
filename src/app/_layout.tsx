import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppLock } from '@/components/AppLock';
import { useJoinLink } from '@/state/useJoinLink';
import { colors } from '@/theme';

export default function RootLayout() {
  useJoinLink();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AppLock>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: colors.bg },
              headerBackButtonDisplayMode: 'minimal',
            }}>
            <Stack.Screen name="index" options={{ title: 'PCR Narrative' }} />
            <Stack.Screen name="join" options={{ title: 'Join your squad' }} />
            <Stack.Screen name="capture/notes" options={{ title: 'Capture notes' }} />
            <Stack.Screen name="capture/record" options={{ title: 'Live recording' }} />
            <Stack.Screen name="report/[id]/index" options={{ title: 'Narrative' }} />
            <Stack.Screen name="report/[id]/questions" options={{ title: 'Follow-up' }} />
            <Stack.Screen name="report/[id]/reference" options={{ title: 'Clinical reference' }} />
            <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
            <Stack.Screen name="settings/organization" options={{ title: 'Organization' }} />
            <Stack.Screen name="settings/specifics" options={{ title: 'Required specifics' }} />
            <Stack.Screen name="settings/profile" options={{ title: 'Provider profile' }} />
            <Stack.Screen name="settings/team" options={{ title: 'Your squad' }} />
            <Stack.Screen name="settings/api" options={{ title: 'AI provider' }} />
            <Stack.Screen name="settings/protocols" options={{ title: 'Protocol reference' }} />
          </Stack>
        </AppLock>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
