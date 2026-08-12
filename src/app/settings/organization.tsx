import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import {
  Body,
  Button,
  Card,
  Field,
  ListRow,
  Muted,
  Screen,
  SectionLabel,
} from '@/components/ui';
import { NARRATIVE_FORMATS } from '@/domain/formats';
import { useSettings } from '@/state/settingsStore';
import { colors, radius, space } from '@/theme';

export default function OrganizationScreen() {
  const { org, setOrgName, setFormat, setHouseStyle } = useSettings();

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <Screen>
        <Card>
          <Field
            label="Organization name"
            hint="Appears on reports and in follow-up prompts."
            value={org.name}
            onChangeText={setOrgName}
            placeholder="e.g. Riverside Volunteer Ambulance"
          />
        </Card>

        <SectionLabel>Narrative format</SectionLabel>
        <Body>
          The format the generated narrative is structured in. Every org documents differently, so
          this is a per-org setting rather than a fixed choice.
        </Body>
        <Card>
          {NARRATIVE_FORMATS.map((f) => (
            <View
              key={f.id}
              style={[s.formatRow, org.formatId === f.id && s.formatRowSelected]}>
              <ListRow
                title={f.label}
                subtitle={f.description}
                onPress={() => setFormat(f.id)}
                right={
                  org.formatId === f.id ? <Muted style={s.selected}>Selected</Muted> : undefined
                }
              />
            </View>
          ))}
        </Card>

        <SectionLabel>House style rules</SectionLabel>
        <Card>
          <Field
            label="Extra rules for this org"
            hint="Free text appended to the generation prompt. Use it for wording conventions your agency requires."
            value={org.houseStyle}
            onChangeText={setHouseStyle}
            multiline
            placeholder={`e.g.
Use 24-hour clock for all times.
Never abbreviate medication names.
Refer to the crew as "this writer" and "my partner".`}
            style={s.houseStyle}
          />
          <Muted>
            These are style rules, not content requirements. Things the narrative must always
            contain belong in Required specifics, where the app can check for them and ask you.
          </Muted>
        </Card>

        <Button
          label="Edit required specifics"
          variant="secondary"
          onPress={() => router.push('/settings/specifics')}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  formatRow: {
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    marginHorizontal: -space.sm,
  },
  formatRowSelected: { backgroundColor: colors.surfaceRaised },
  selected: { color: colors.accent },
  houseStyle: { minHeight: 140 },
});
