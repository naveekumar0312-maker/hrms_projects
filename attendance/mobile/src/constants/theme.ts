import { colors } from '../theme/colors';

export const FONTS = {
  regular: 'Comfortaa_400Regular',
  medium: 'Comfortaa_500Medium',
  semiBold: 'Comfortaa_600SemiBold',
  bold: 'Comfortaa_700Bold',
};

export const COLORS = {
  // Modern Clean iOS Reference Palette
  primary: colors.primary,             // #E56108 Accent Blue
  primaryDark: colors.primaryDark,     // #CC5200
  primaryLight: colors.primaryLight,   // #F0F2FF Soft Pastel Blue Bubble
  secondary: colors.textSecondary,     // #7B8192 Slate Grey
  background: colors.background,       // #FFFFFF White
  backgroundSecondary: colors.backgroundSecondary, // #F7F8FC
  surface: colors.surface,             // #FFFFFF White Surface
  surfaceSecondary: colors.surfaceSecondary, // #F0F2FF
  card: colors.card,                   // #FFFFFF White Elevated Card
  white: '#FFFFFF',
  black: '#202334',
  disabled: colors.disabled,           // #C8CBD5

  // Brand Accents
  gold: colors.gold,                   // #D4A017
  goldDark: colors.goldDark,
  goldLight: colors.goldLight,
  navy: colors.navy,                   // #202334

  // Text
  textPrimary: colors.textPrimary,     // #202334 Deep Heading
  textSecondary: colors.textSecondary, // #7B8192 Slate Body
  primaryText: colors.primaryText,     // #FFFFFF
  dark: colors.textPrimary,
  muted: colors.textMuted,

  // Borders
  border: colors.border,               // #ECEEF3
  borderSubtle: colors.borderSubtle,
  borderDark: colors.borderDark,

  // Statuses
  success: colors.success,             // #10B981
  warning: colors.warning,             // #F59E0B
  error: colors.error,                 // #EF4444
  danger: colors.error,
  info: colors.info,

  // Standalone Icons
  iconPrimary: colors.iconPrimary,
  iconSecondary: colors.iconSecondary,
  iconMuted: colors.iconMuted,
  iconActive: colors.iconActive,
};

export const SIZES = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const SHADOWS = {
  small: {
    shadowColor: '#202334',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  medium: {
    shadowColor: '#202334',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  card: {
    shadowColor: '#202334',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
};
