import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Search, SlidersHorizontal, X } from 'lucide-react-native';
import { colors } from '../theme/colors';

interface AppSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFilterPress?: () => void;
  onClear?: () => void;
  loading?: boolean;
}

export const AppSearchBar: React.FC<AppSearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search...',
  onFilterPress,
  onClear,
  loading = false,
}) => {
  return (
    <View style={styles.container}>
      <Search size={18} color={colors.textSecondary} strokeWidth={2} style={styles.searchIcon} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.rightAction} />
      ) : value.length > 0 && onClear ? (
        <TouchableOpacity onPress={onClear} style={styles.rightAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : null}
      {onFilterPress && (
        <TouchableOpacity
          onPress={onFilterPress}
          style={styles.filterButton}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <SlidersHorizontal size={17} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 48,
    shadowColor: '#202334',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    fontFamily: 'Comfortaa_500Medium',
    paddingVertical: 0,
  },
  rightAction: {
    padding: 4,
    marginLeft: 6,
  },
  filterButton: {
    padding: 6,
    marginLeft: 8,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
  },
});

