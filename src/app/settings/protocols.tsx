import { Banner, Body, Card, Muted, Screen, SectionLabel } from '@/components/ui';
import { PROTOCOL_SOURCING_STATUS } from '@/protocols';
import { useSettings } from '@/state/settingsStore';

/**
 * Protocol Reference — intentionally not implemented.
 *
 * The brief flags this as the highest-risk feature and says to build it last.
 * This screen exists so the constraint is visible in the app itself rather than
 * only in a document, and so the unresolved sourcing question is stated plainly
 * to anyone who goes looking for the feature.
 */
export default function ProtocolsScreen() {
  const profile = useSettings((s) => s.profile);

  return (
    <Screen>
      <Banner tone="warning" title="Not built yet — on purpose">
        Surfacing protocol text during a live call is the highest-risk thing this app could do. It
        is deliberately last, after narrative generation and clinical reference have been used on
        real shifts, and it needs review by your squad&apos;s medical director before it goes live
        even in testing.
      </Banner>

      <Card>
        <SectionLabel>What it would do</SectionLabel>
        <Body>
          While live-listening, recognise the chief complaint or situation type and open the
          matching section of your state&apos;s actual published EMS protocol document — the real
          text, for you to read and apply.
        </Body>
        <Muted>
          It would never generate treatment steps, doses, or next actions. It is a lookup that
          scrolls a real document to the right page, labelled &quot;Protocol Reference&quot;, never
          &quot;Recommendations&quot; or &quot;Guidance&quot;. It does not replace medical control,
          your training, or your agency&apos;s standing orders.
        </Muted>
      </Card>

      <Card>
        <SectionLabel>Blocking question</SectionLabel>
        <Body>{PROTOCOL_SOURCING_STATUS.question}</Body>
        <Muted>{PROTOCOL_SOURCING_STATUS.detail}</Muted>
      </Card>

      <Card>
        <SectionLabel>Your setup</SectionLabel>
        <Muted>
          {profile.state
            ? `State set to ${profile.state}, certification ${profile.certLevel}. Protocols would be scoped to that pair.`
            : `No state set yet. Protocols are state-specific, so that has to be set before this feature could do anything.`}
        </Muted>
      </Card>
    </Screen>
  );
}
