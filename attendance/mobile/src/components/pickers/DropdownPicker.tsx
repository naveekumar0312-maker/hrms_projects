import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { ChevronDown, Search, Check, X, Layers } from 'lucide-react-native';
import { dropdownPickerStyles } from '../../styles/pickers/dropdownPicker.styles';

export interface DropdownOption {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ReactNode;
}

export interface DropdownPickerProps {
  label?: string;
  options: DropdownOption[];
  value: string | number | (string | number)[];
  onChange: (val: any) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  searchable?: boolean;
  multiple?: boolean;
  loading?: boolean;
}

export const DropdownPicker: React.FC<DropdownPickerProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  required = false,
  disabled = false,
  error,
  searchable = true,
  multiple = false,
  loading = false,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected values array for multiple mode
  const selectedValues = Array.isArray(value) ? value : value !== undefined && value !== null && value !== '' ? [value] : [];

  const filteredOptions = options.filter((opt) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const lMatch = opt.label.toLowerCase().includes(query);
    const sMatch = opt.sublabel?.toLowerCase().includes(query);
    return lMatch || sMatch;
  });

  const getDisplayLabel = () => {
    if (multiple) {
      if (selectedValues.length === 0) return '';
      return `${selectedValues.length} selected`;
    }
    const match = options.find((o) => o.value === value);
    return match ? match.label : '';
  };

  const handleSelect = (optVal: string | number) => {
    if (multiple) {
      const exists = selectedValues.includes(optVal);
      const next = exists ? selectedValues.filter((v) => v !== optVal) : [...selectedValues, optVal];
      onChange(next);
    } else {
      onChange(optVal);
      setModalVisible(false);
      setSearchQuery('');
    }
  };

  return (
    <View style={dropdownPickerStyles.container}>
      {label && (
        <Text style={dropdownPickerStyles.label}>
          {label} {required && <Text style={dropdownPickerStyles.requiredStar}>*</Text>}
        </Text>
      )}

      <TouchableOpacity
        style={[
          dropdownPickerStyles.triggerButton,
          modalVisible && dropdownPickerStyles.triggerButtonFocused,
          Boolean(error) && dropdownPickerStyles.triggerButtonError,
          disabled && dropdownPickerStyles.triggerButtonDisabled,
        ]}
        onPress={() => {
          if (!disabled) setModalVisible(true);
        }}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <View style={dropdownPickerStyles.triggerLeft}>
          <View style={dropdownPickerStyles.iconContainer}>
            <Layers size={16} color="#E56108" />
          </View>
          {multiple && selectedValues.length > 0 && (
            <View style={dropdownPickerStyles.multiBadge}>
              <Text style={dropdownPickerStyles.multiBadgeText}>{selectedValues.length}</Text>
            </View>
          )}
          {getDisplayLabel() ? (
            <Text style={dropdownPickerStyles.valueText} numberOfLines={1}>
              {getDisplayLabel()}
            </Text>
          ) : (
            <Text style={dropdownPickerStyles.placeholderText}>{placeholder}</Text>
          )}
        </View>

        <ChevronDown size={18} color="#666666" />
      </TouchableOpacity>

      {error ? <Text style={dropdownPickerStyles.errorText}>{error}</Text> : null}

      {/* Modal Selection Sheet */}
      <Modal statusBarTranslucent visible={modalVisible} transparent animationType="slide">
        <View style={dropdownPickerStyles.modalOverlay}>
          <View style={dropdownPickerStyles.modalContent}>
            <View style={dropdownPickerStyles.handleBar} />

            <View style={dropdownPickerStyles.modalHeader}>
              <Text style={dropdownPickerStyles.modalTitle}>{label || 'Select Option'}</Text>
              <TouchableOpacity
                style={dropdownPickerStyles.closeBtn}
                onPress={() => {
                  setModalVisible(false);
                  setSearchQuery('');
                }}
              >
                <X size={20} color="#666666" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            {searchable && (
              <View style={dropdownPickerStyles.searchContainer}>
                <Search size={16} color="#888888" />
                <TextInput
                  style={dropdownPickerStyles.searchInput}
                  placeholder="Search options..."
                  placeholderTextColor="#888888"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={16} color="#888888" />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {/* Options List */}
            {loading ? (
              <View style={dropdownPickerStyles.emptyContainer}>
                <ActivityIndicator size="small" color="#E56108" />
                <Text style={dropdownPickerStyles.emptyText}>Loading options...</Text>
              </View>
            ) : (
              <ScrollView style={dropdownPickerStyles.optionsList} showsVerticalScrollIndicator={false}>
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((opt) => {
                    const isSelected = selectedValues.includes(opt.value);
                    return (
                      <TouchableOpacity
                        key={String(opt.value)}
                        style={[
                          dropdownPickerStyles.optionItem,
                          isSelected && dropdownPickerStyles.optionItemSelected,
                        ]}
                        onPress={() => handleSelect(opt.value)}
                        activeOpacity={0.7}
                      >
                        <View style={dropdownPickerStyles.optionLeft}>
                          {opt.icon ? (
                            <View style={dropdownPickerStyles.optionIcon}>{opt.icon}</View>
                          ) : null}
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                dropdownPickerStyles.optionLabel,
                                isSelected && dropdownPickerStyles.optionLabelSelected,
                              ]}
                            >
                              {opt.label}
                            </Text>
                            {opt.sublabel ? (
                              <Text style={dropdownPickerStyles.optionSub}>{opt.sublabel}</Text>
                            ) : null}
                          </View>
                        </View>

                        {isSelected && (
                          <View style={dropdownPickerStyles.checkIcon}>
                            <Check size={12} color="#FFFFFF" strokeWidth={3} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={dropdownPickerStyles.emptyContainer}>
                    <Text style={dropdownPickerStyles.emptyText}>No options found</Text>
                    <Text style={dropdownPickerStyles.emptySubtext}>Try a different search query</Text>
                  </View>
                )}
              </ScrollView>
            )}

            {/* Multi-selection Footer */}
            {multiple && (
              <View style={dropdownPickerStyles.multiActionRow}>
                <TouchableOpacity
                  style={dropdownPickerStyles.clearBtn}
                  onPress={() => onChange([])}
                >
                  <Text style={dropdownPickerStyles.clearBtnText}>Clear All</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={dropdownPickerStyles.doneBtn}
                  onPress={() => {
                    setModalVisible(false);
                    setSearchQuery('');
                  }}
                >
                  <Text style={dropdownPickerStyles.doneBtnText}>
                    Done ({selectedValues.length})
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

