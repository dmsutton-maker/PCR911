import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import {
  Banner,
  Card,
  Chip,
  Field,
  Muted,
  Screen,
  SectionLabel,
} from '@/components/ui';
import { CERT_LEVELS, US_STATES } from '@/domain/defaults';
import type { CertLevel } from '@/domain/types';
import { useSettings } from '@/state/settingsStore';
import { space } from '@/theme';

export default function ProfileScreen() {
  const { profile, setProfile } = useSettings();

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <Screen>
        <SectionLabel>Certification level</SectionLabel>
        <Card>
          <View style={s.chips}>
            {CERT_LEVELS.map((c) => (
              <Chip
                key={c}
                label={c}
                selected={profile.certLevel === c}
                onPress={() => setProfile({ certLevel: c as CertLevel })}
              />
            ))}
          </View>
          <Muted>
            Used so the narrative describes interventions at the right level. The app does not
            judge whether something was within your scope.
          </Muted>
        </Card>

        <SectionLabel>State</SectionLabel>
        <Card>
          <View style={s.chips}>
            {US_STATES.map((st) => (
              <Chip
                key={st}
                label={st}
                selected={profile.state === st}
                onPress={() => setProfile({ state: profile.state === st ? '' : st })}
              />
            ))}
          </View>
          <Muted>
            Only used for narrative context today. It is also what the protocol reference feature
            would key off if that gets built.
          </Muted>
        </Card>

        <Card>
          <Field
            label="Unit identifier"
            hint="Optional. e.g. Medic 4"
            value={profile.unitId}
            onChangeText={(unitId) => setProfile({ unitId })}
            placeholder="Medic 4"
            autoCapitalize="characters"
          />
        </Card>

        <Banner tone="info">
          None of this is patient information, so it is stored in ordinary app settings rather than
          the encrypted report vault.
        </Banner>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
