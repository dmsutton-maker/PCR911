/**
 * A single dark palette.
 *
 * Deliberately not theme-switching: this gets used at 3am in a moving ambulance
 * and on a well-lit ED ramp, and a consistent high-contrast dark UI is easier to
 * read in both than a scheme that changes underneath the user.
 */
export const colors = {
  bg: '#0B1B2B',
  surface: '#12293D',
  surfaceRaised: '#183449',
  border: '#25506E',
  text: '#EAF2F8',
  textMuted: '#9FB6C8',
  textFaint: '#6F8AA0',
  accent: '#4FA3E3',
  accentText: '#04121E',
  success: '#4CC38A',
  warning: '#E8B14C',
  danger: '#E8695C',
  practice: '#B07CD6',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

export const type = {
  title: { fontSize: 26, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 19, fontWeight: '700' as const, color: colors.text },
  subheading: { fontSize: 15, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 16, color: colors.text, lineHeight: 23 },
  small: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  tiny: { fontSize: 11, color: colors.textFaint, letterSpacing: 0.6 },
  mono: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.text,
    fontFamily: 'Menlo',
  },
} as const;
