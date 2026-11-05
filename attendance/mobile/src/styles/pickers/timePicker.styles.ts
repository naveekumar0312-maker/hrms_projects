import { StyleSheet, Dimensions } from 'react-native';
import { colors } from '../../theme/colors';

const { width } = Dimensions.get('window');

export const timePickerStyles = StyleSheet.create({
  container: {
    marginBottom: 14,
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  requiredStar: {
    color: colors.primary,
  },
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 46,
  },
  triggerButtonFocused: {
    borderColor: colors.primary,
  },
  triggerButtonError: {
    borderColor: colors.error,
  },
  triggerButtonDisabled: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
    opacity: 0.6,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconContainer: {
    // Pure standalone icon without background container
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerFocused: {},
  valueText: {
    fontSize: 14,
    fontFamily: 'Comfortaa_600SemiBold',
    color: colors.textPrimary,
  },
  placeholderText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  formatBadge: {
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formatBadgeText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_600SemiBold',
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
    marginLeft: 2,
  },
  // Modal Bottom Sheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 14,
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  selectedPreviewBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedPreviewTime: {
    fontSize: 26,
    fontFamily: 'Comfortaa_700Bold',
    color: colors.primary,
    letterSpacing: 1,
  },
  selectedPreviewSub: {
    fontSize: 11,
    fontFamily: 'Comfortaa_600SemiBold',
    color: colors.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  dialContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  dialColumn: {
    alignItems: 'center',
    width: 76,
  },
  dialLabel: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  dialScroller: {
    height: 130,
    width: '100%',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dialScrollerContent: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  dialItem: {
    paddingVertical: 7,
    width: '100%',
    alignItems: 'center',
    borderRadius: 6,
  },
  dialItemActive: {
    backgroundColor: colors.primary,
  },
  dialItemText: {
    fontSize: 15,
    fontFamily: 'Comfortaa_500Medium',
    color: colors.textPrimary,
  },
  dialItemTextActive: {
    color: colors.white,
    fontFamily: 'Comfortaa_700Bold',
  },
  colonSeparator: {
    fontSize: 24,
    fontFamily: 'Comfortaa_700Bold',
    color: colors.textSecondary,
    marginTop: 18,
  },
  ampmContainer: {
    flexDirection: 'column',
    gap: 6,
    marginTop: 22,
  },
  ampmButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  ampmButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ampmText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
    color: colors.textSecondary,
  },
  ampmTextActive: {
    color: colors.white,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
    color: colors.textSecondary,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
    color: colors.white,
  },
});
