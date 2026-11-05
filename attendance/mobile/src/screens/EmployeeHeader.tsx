import { StatusBar } from 'expo-status-bar';
import React, { useContext } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { AuthContext } from '../context/AuthContext';
import { colors } from '../theme/colors';

type EmployeeHeaderProps = {
  onApply: () => void;
  title?: string;
  subtitle?: string;
};

const getImageUrl = (url: string | null | undefined) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || ''}${url}`;
};

const EmployeeHeader = ({ onApply, title, subtitle }: EmployeeHeaderProps) => {
  const { employee } = useContext(AuthContext);
  const insets = useSafeAreaInsets();
  const profilePhoto = getImageUrl(employee?.profile_photo);

  return (
    <>
      <StatusBar style="dark" hidden={false} />
      <View style={[styles.headerArea, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerContent}>
          <View style={styles.identity}>
            {profilePhoto ? (
              <Image
                source={{ uri: profilePhoto }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {employee?.full_name?.charAt(0) || 'U'}
                </Text>
              </View>
            )}

            <View style={styles.textWrapper}>
              <Text style={styles.employeeName} numberOfLines={1}>
                {title || `Hi, ${employee?.full_name?.split(' ')[0] || 'Employee'}`}
              </Text>
              <Text style={styles.greeting} numberOfLines={1}>
                {subtitle || employee?.designation || 'Yaazh 360 Employee'}
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.addButton}
            onPress={onApply}
          >
            <Plus size={16} color={colors.white} strokeWidth={2.2} />
            <Text style={styles.addButtonText}>Apply</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  headerArea: {
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  textWrapper: {
    flex: 1,
  },
  employeeName: {
    fontSize: 18,
    fontFamily: 'Comfortaa_700Bold',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  greeting: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 17,
    fontFamily: 'Comfortaa_700Bold',
  },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  addButtonText: {
    color: colors.white,
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
  },
});

export default EmployeeHeader;
