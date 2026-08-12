import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { describeError } from '@/ai/client';
import { lookupClinicalReference } from '@/ai/reference';
import {
  Banner,
  Button,
  Card,
  Divider,
  Loading,
  Muted,
  Screen,
  SectionLabel,
} from '@/components/ui';
import { useReports } from '@/state/reportStore';
import { useSettings } from '@/state/settingsStore';
import { space, type } from '@/theme';
import { formatShort } from '@/util/time';

/**
 * Clinical reference — background context only.
 *
 * Kept on its own screen, never merged into the narrative, and framed
 * explanatorily throughout. This is a lookup aid sitting alongside the report,
 * not part of the documentation output.
 */
export default function ReferenceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const modelId = useSettings((s) => s.modelId);
  const { current, open, update } = useReports();

  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      if (current?.id !== id) await open(id);
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!loaded) return <Screen><Loading label="Opening report…" /></Screen>;
  if (!current) {
    return (
      <Screen>
        <Banner tone="danger">That report could not be opened.</Banner>
      </Screen>
    );
  }

  const report = current;
  const reference = report.reference;

  const run = async () => {
    setBusy(true);
    try {
      const result = await lookupClinicalReference({
        modelId,
        rawInput: report.rawInput,
        narrative: report.narrative,
      });
      await update({ reference: result }, 'Clinical reference looked up');
    } catch (error) {
      Alert.alert('Could not look that up', describeError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <Button
          label={reference ? 'Look up again' : 'Look up medications and history'}
          onPress={run}
          loading={busy}
        />
      }>
      <Banner tone="info" title="Background context — not clinical guidance">
        This is a reference aid describing what the medications and conditions mentioned in your
        notes generally are. It is not an assessment of this patient, not a diagnosis, and not a
        treatment recommendation. It does not replace your training, your judgment, your protocols,
        or medical control. Nothing here belongs in the narrative.
      </Banner>

      {busy && !reference ? <Loading label="Looking up medications and history…" /> : null}

      {!reference && !busy ? (
        <Card>
          <Muted>
            Nothing looked up yet. This reads the medications and medical history mentioned in your
            notes and explains each in plain language.
          </Muted>
        </Card>
      ) : null}

      {reference ? (
        <>
          <Muted>Looked up {formatShort(reference.generatedAt)}</Muted>

          {reference.medications.length > 0 ? (
            <Card>
              <SectionLabel>Medications mentioned</SectionLabel>
              {reference.medications.map((m, i) => (
                <View key={`${m.name}-${i}`}>
                  {i > 0 ? <Divider /> : null}
                  <View style={s.entry}>
                    <Text style={type.subheading}>{m.name}</Text>
                    <Text style={type.body}>{m.commonlyUsedFor}</Text>
                    {m.note ? <Muted>{m.note}</Muted> : null}
                  </View>
                </View>
              ))}
            </Card>
          ) : null}

          {reference.conditions.length > 0 ? (
            <Card>
              <SectionLabel>Conditions mentioned</SectionLabel>
              {reference.conditions.map((c, i) => (
                <View key={`${c.name}-${i}`}>
                  {i > 0 ? <Divider /> : null}
                  <View style={s.entry}>
                    <Text style={type.subheading}>{c.name}</Text>
                    <Text style={type.body}>{c.whatItInvolves}</Text>
                    {c.note ? <Muted>{c.note}</Muted> : null}
                  </View>
                </View>
              ))}
            </Card>
          ) : null}

          {reference.possibleRelevance ? (
            <Card>
              <SectionLabel>General background</SectionLabel>
              <Text style={type.body}>{reference.possibleRelevance}</Text>
              <Muted>
                Explanatory background about these medications and conditions in general — not a
                conclusion about this patient.
              </Muted>
            </Card>
          ) : null}

          {reference.notIdentified.length > 0 ? (
            <Card>
              <SectionLabel>Could not identify</SectionLabel>
              <Muted>{reference.notIdentified.join(', ')}</Muted>
            </Card>
          ) : null}

          {reference.medications.length === 0 &&
          reference.conditions.length === 0 &&
          reference.notIdentified.length === 0 ? (
            <Card>
              <Muted>No medications or conditions were found in these notes.</Muted>
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  entry: { gap: space.xs, paddingVertical: space.sm },
});
