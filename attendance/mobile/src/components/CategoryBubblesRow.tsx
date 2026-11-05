import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export interface CategoryBubbleItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  badge?: number | string;
}

interface CategoryBubblesRowProps {
  items: CategoryBubbleItem[];
}

export const CategoryBubblesRow: React.FC<CategoryBubblesRowProps> = ({ items }) => {
  return (
    <View style={styles.container}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.itemWrapper}
          onPress={item.onPress}
          activeOpacity={0.7}
        >
          <View style={styles.bubbleCircle}>
            {item.icon}
            {item.badge != null && (
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            )}
          </View>
          <Text style={styles.itemLabel} numberOfLines={2}>
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  itemWrapper: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 80,
  },
  bubbleCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(70, 89, 199, 0.08)',
  },
  badgePill: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: 'Comfortaa_700Bold',
  },
  itemLabel: {
    fontSize: 11,
    color: colors.textPrimary,
    textAlign: 'center',
    fontFamily: 'Comfortaa_500Medium',
    lineHeight: 14,
  },
});

