import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme/colors';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top + 8, 16) }]}>
      <StatusBar style="dark" hidden={false} />
      <View style={styles.contentRow}>
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
          <View style={styles.titleWrapper}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        </View>

        {rightAction ? (
          <View style={styles.rightGroup}>
            {rightAction}
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    marginRight: 12,
  },
  titleWrapper: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Comfortaa_700Bold',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
});

