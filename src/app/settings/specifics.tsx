import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Switch, View } from 'react-native';

import {
  Banner,
  Body,
  Button,
  Card,
  Chip,
  Divider,
  Field,
  Muted,
  Row,
  Screen,
  SectionLabel,
} from '@/components/ui';
import { APPLIES_TO_LABELS } from '@/domain/requiredSpecifics';
import type { RequiredSpecific } from '@/domain/types';
import { useSettings } from '@/state/settingsStore';
import { colors, space, type } from '@/theme';
import { confirm, notify } from '@/util/dialog';

const APPLIES_OPTIONS: RequiredSpecific['appliesTo'][] = [
  'always',
  'transport',
  'refusal',
  'cardiac_arrest',
  'trauma',
  'pediatric',
];

/**
 * The org-level required-specifics editor.
 *
 * Whatever is enabled here is what the model checks each narrative against, and
 * what it generates follow-up questions from. Nothing about this list is
 * hardcoded into the generation logic.
 */
export default function SpecificsScreen() {
  const { org, toggleSpecific, updateSpecific, addSpecific, removeSpecific, restoreDefaultSpecifics } =
    useSettings();

  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    label: '',
    criterion: '',
    question: '',
    appliesTo: 'always' as RequiredSpecific['appliesTo'],
  });

  const submitNew = () => {
    if (!draft.label.trim() || !draft.criterion.trim()) {
      notify('Needs a label and a requirement', 'Both are used to check the narrative.');
      return;
    }
    addSpecific({
      label: draft.label.trim(),
      criterion: draft.criterion.trim(),
      question:
        draft.question.trim() || `Can you provide: ${draft.label.trim().toLowerCase()}?`,
      appliesTo: draft.appliesTo,
    });
    setDraft({ label: '', criterion: '', question: '', appliesTo: 'always' });
    setAdding(false);
  };

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <Screen
        footer={
          adding ? (
            <Row>
              <Button
                label="Cancel"
                variant="secondary"
                style={s.flex}
                onPress={() => setAdding(false)}
              />
              <Button label="Add" style={s.flex} onPress={submitNew} />
            </Row>
          ) : (
            <Button label="Add a required specific" onPress={() => setAdding(true)} />
          )
        }>
        <Banner tone="info" title="What this list does">
          After a narrative is generated, it is checked against every enabled item below — judged
          against what you actually said, not what the model wrote. Anything missing becomes a
          follow-up question. Nothing here is ever guessed or filled in for you.
        </Banner>

        {adding ? (
          <Card>
            <SectionLabel>New required specific</SectionLabel>
            <Field
              label="Label"
              value={draft.label}
              onChangeText={(label) => setDraft((d) => ({ ...d, label }))}
              placeholder="e.g. Pain score before and after treatment"
            />
            <Field
              label="What must be present"
              hint="How the app decides whether your notes covered it."
              value={draft.criterion}
              onChangeText={(criterion) => setDraft((d) => ({ ...d, criterion }))}
              multiline
              placeholder="e.g. A 0-10 pain score documented before any analgesia and again after."
            />
            <Field
              label="Fallback question"
              hint="Optional. A call-specific question is generated when possible."
              value={draft.question}
              onChangeText={(question) => setDraft((d) => ({ ...d, question }))}
              placeholder="e.g. What was the pain score before and after treatment?"
            />
            <SectionLabel>Applies to</SectionLabel>
            <View style={s.chips}>
              {APPLIES_OPTIONS.map((o) => (
                <Chip
                  key={o}
                  label={APPLIES_TO_LABELS[o]}
                  selected={draft.appliesTo === o}
                  onPress={() => setDraft((d) => ({ ...d, appliesTo: o }))}
                />
              ))}
            </View>
          </Card>
        ) : null}

        <Card>
          {org.requiredSpecifics.map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <Divider /> : null}
              <View style={s.item}>
                <Row>
                  <View style={s.flex}>
                    <Body style={!r.enabled ? s.disabled : undefined}>{r.label}</Body>
                    <Muted>
                      {APPLIES_TO_LABELS[r.appliesTo]}
                      {r.custom ? ' · custom' : ''}
                    </Muted>
                  </View>
                  <Switch
                    value={r.enabled}
                    onValueChange={() => toggleSpecific(r.id)}
                    trackColor={{ true: colors.accent, false: colors.border }}
                    thumbColor={colors.text}
                  />
                </Row>

                {editing === r.id ? (
                  <View style={s.editor}>
                    <Field
                      label="What must be present"
                      value={r.criterion}
                      onChangeText={(criterion) => updateSpecific(r.id, { criterion })}
                      multiline
                    />
                    <Field
                      label="Fallback question"
                      value={r.question}
                      onChangeText={(question) => updateSpecific(r.id, { question })}
                      multiline
                    />
                    <SectionLabel>Applies to</SectionLabel>
                    <View style={s.chips}>
                      {APPLIES_OPTIONS.map((o) => (
                        <Chip
                          key={o}
                          label={APPLIES_TO_LABELS[o]}
                          selected={r.appliesTo === o}
                          onPress={() => updateSpecific(r.id, { appliesTo: o })}
                        />
                      ))}
                    </View>
                    <Row>
                      <Button
                        label="Done"
                        variant="secondary"
                        style={s.flex}
                        onPress={() => setEditing(null)}
                      />
                      {r.custom ? (
                        <Button
                          label="Delete"
                          variant="danger"
                          style={s.flex}
                          onPress={() => {
                            setEditing(null);
                            removeSpecific(r.id);
                          }}
                        />
                      ) : null}
                    </Row>
                  </View>
                ) : (
                  <Row>
                    <Muted style={s.flex} numberOfLines={2}>
                      {r.criterion}
                    </Muted>
                    <Button label="Edit" variant="ghost" onPress={() => setEditing(r.id)} />
                  </Row>
                )}
              </View>
            </View>
          ))}
        </Card>

        <Button
          label="Restore built-in defaults"
          variant="secondary"
          onPress={async () => {
            const ok = await confirm({
              title: 'Restore defaults?',
              message:
                'Built-in items go back to their shipped wording and are re-enabled. Your custom items are kept.',
              confirmLabel: 'Restore',
            });
            if (ok) restoreDefaultSpecifics();
          }}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  item: { paddingVertical: space.md, gap: space.sm },
  editor: { gap: space.sm, marginTop: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  disabled: { color: colors.textFaint, textDecorationLine: 'line-through' },
});
