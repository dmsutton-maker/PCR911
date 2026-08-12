import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, space, type } from '@/theme';

export function Screen({
  children,
  scroll = true,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
}) {
  return (
    <SafeAreaView style={s.screen} edges={['bottom']}>
      {scroll ? (
        <ScrollView
          style={s.flex}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive">
          {children}
        </ScrollView>
      ) : (
        <View style={[s.flex, s.scrollContent]}>{children}</View>
      )}
      {footer ? <View style={s.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={[type.tiny, s.sectionLabel]}>{String(children).toUpperCase()}</Text>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={type.title}>{children}</Text>;
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={type.heading}>{children}</Text>;
}

export function Body({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: object;
  numberOfLines?: number;
}) {
  return (
    <Text style={[type.body, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Muted({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: object;
  numberOfLines?: number;
}) {
  return (
    <Text style={[type.small, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        s.button,
        variantStyles[variant],
        inactive && s.buttonDisabled,
        pressed && !inactive && s.buttonPressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.accentText : colors.text} />
      ) : (
        <Text style={[s.buttonLabel, variantLabelStyles[variant]]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={s.field}>
      <Text style={[type.subheading, s.fieldLabel]}>{label}</Text>
      {hint ? <Muted style={s.fieldHint}>{hint}</Muted> : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        {...props}
        style={[s.input, props.multiline && s.inputMultiline, props.style]}
      />
    </View>
  );
}

export function Toggle({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={s.toggleRow}>
      <View style={s.flex}>
        <Text style={type.subheading}>{label}</Text>
        {description ? <Muted style={s.toggleDescription}>{description}</Muted> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor={colors.text}
      />
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[s.chip, selected && s.chipSelected]}>
      <Text style={[s.chipLabel, selected && s.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export type BannerTone = 'info' | 'warning' | 'danger' | 'practice' | 'success';

const bannerColor: Record<BannerTone, string> = {
  info: colors.accent,
  warning: colors.warning,
  danger: colors.danger,
  practice: colors.practice,
  success: colors.success,
};

export function Banner({
  tone = 'info',
  title,
  children,
}: {
  tone?: BannerTone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <View style={[s.banner, { borderLeftColor: bannerColor[tone] }]}>
      {title ? (
        <Text style={[type.subheading, { color: bannerColor[tone] }, s.bannerTitle]}>{title}</Text>
      ) : null}
      <Text style={type.small}>{children}</Text>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.row, style]}>{children}</View>;
}

export function Divider() {
  return <View style={s.divider} />;
}

export function ListRow({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <View style={s.listRow}>
      <View style={s.flex}>
        <Text style={type.subheading}>{title}</Text>
        {subtitle ? <Muted style={s.listSubtitle}>{subtitle}</Muted> : null}
      </View>
      {right}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => pressed && s.rowPressed}>
      {content}
    </Pressable>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <View style={s.loading}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Muted style={s.loadingLabel}>{label}</Muted>
    </View>
  );
}

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
};

const variantLabelStyles: Record<ButtonVariant, { color: string }> = {
  primary: { color: colors.accentText },
  secondary: { color: colors.text },
  ghost: { color: colors.accent },
  danger: { color: colors.danger },
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scrollContent: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  footer: {
    padding: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: space.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sectionLabel: { marginTop: space.sm },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  buttonPressed: { opacity: 0.75 },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  field: { gap: space.xs },
  fieldLabel: { marginBottom: 2 },
  fieldHint: { marginBottom: space.xs },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
    padding: space.md,
  },
  inputMultiline: { minHeight: 140, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  toggleDescription: { marginTop: 2 },
  chip: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  chipLabelSelected: { color: colors.accentText },
  banner: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    padding: space.md,
    gap: space.xs,
  },
  bannerTitle: { fontSize: 14 },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  listSubtitle: { marginTop: 2 },
  rowPressed: { opacity: 0.7 },
  loading: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  loadingLabel: { textAlign: 'center' },
});
