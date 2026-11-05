import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Building2, Bell, Shield, ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme/colors';

interface AdminHRHeaderProps {
  title: string;
  subtitle?: string;
  role: 'SUPER_ADMIN' | 'HR' | string;
  companyName?: string;
  onNotificationsPress?: () => void;
  rightAction?: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  notificationBadgeCount?: number;
}

export const AdminHRHeader: React.FC<AdminHRHeaderProps> = ({
  title,
  subtitle,
  role,
  companyName,
  onNotificationsPress,
  rightAction,
  showBack = false,
  onBack,
  notificationBadgeCount = 0,
}) => {
  const insets = useSafeAreaInsets();
  const isHR = role === 'HR';

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top + 8, 16) }]}>
      <StatusBar style="dark" hidden={false} />

      {/* Top Banner for HR or Super Admin: Minimal Pill */}
      {isHR && companyName ? (
        <View style={styles.companyBanner}>
          <Building2 size={13} color={colors.primary} strokeWidth={2} />
          <Text style={styles.companyBannerText} numberOfLines={1}>
            {companyName}
          </Text>
          <View style={styles.companyBadge}>
            <Text style={styles.companyBadgeText}>HR</Text>
          </View>
        </View>
      ) : role === 'SUPER_ADMIN' ? (
        <View style={styles.adminBanner}>
          <Shield size={13} color={colors.primary} strokeWidth={2} />
          <Text style={styles.adminBannerText}>SUPER ADMIN</Text>
        </View>
      ) : null}

      {/* Main Header Content */}
      <View style={styles.headerContent}>
        <View style={styles.leftGroup}>
          {showBack && onBack ? (
            <TouchableOpacity
              onPress={onBack}
              style={styles.backButton}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft size={22} color={colors.textPrimary} strokeWidth={2.2} />
            </TouchableOpacity>
          ) : null}
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        </View>

        <View style={styles.actionsContainer}>
          {rightAction}
          {onNotificationsPress && (
            <TouchableOpacity
              style={styles.notificationBtn}
              onPress={onNotificationsPress}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Bell size={20} color={colors.iconPrimary} strokeWidth={1.8} />
              {notificationBadgeCount > 0 && (
                <View style={styles.unreadDot} />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  companyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginBottom: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(70, 89, 199, 0.08)',
  },
  companyBannerText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_600SemiBold',
    color: colors.textPrimary,
  },
  companyBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  companyBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: 'Comfortaa_700Bold',
  },
  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginBottom: 8,
    gap: 6,
  },
  adminBannerText: {
    fontSize: 10,
    fontFamily: 'Comfortaa_700Bold',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Comfortaa_700Bold',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#202334',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  unreadDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});
