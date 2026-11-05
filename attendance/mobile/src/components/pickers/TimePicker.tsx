import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { Clock, X } from 'lucide-react-native';
import { timePickerStyles } from '../../styles/pickers/timePicker.styles';

export interface TimePickerProps {
  label?: string;
  value: string; // e.g. "09:30:00" or "09:30" or "09:30 AM"
  onChange: (timeStr: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

export const TimePicker: React.FC<TimePickerProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Select Time',
  required = false,
  disabled = false,
  error,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  // Parse initial hours, minutes, and ampm from value
  const parseTime = (valStr: string) => {
    if (!valStr) return { hour: 9, minute: 0, ampm: 'AM' };
    const parts = valStr.split(':');
    let h = parseInt(parts[0], 10) || 9;
    let m = parseInt(parts[1], 10) || 0;
    let period = 'AM';

    if (valStr.toUpperCase().includes('PM')) {
      period = 'PM';
    } else if (valStr.toUpperCase().includes('AM')) {
      period = 'AM';
    } else if (h >= 12) {
      period = 'PM';
      if (h > 12) h -= 12;
    } else if (h === 0) {
      h = 12;
      period = 'AM';
    }

    return { hour: h > 12 ? h - 12 : h === 0 ? 12 : h, minute: m, ampm: period };
  };

  const parsed = parseTime(value);
  const [selectedHour, setSelectedHour] = useState(parsed.hour);
  const [selectedMinute, setSelectedMinute] = useState(parsed.minute);
  const [selectedAmPm, setSelectedAmPm] = useState(parsed.ampm);

  const openPicker = () => {
    if (disabled) return;
    const p = parseTime(value);
    setSelectedHour(p.hour);
    setSelectedMinute(p.minute);
    setSelectedAmPm(p.ampm);
    setModalVisible(true);
  };

  const handleConfirm = () => {
    // Format to 24hr string for backend API consistency "HH:MM:00"
    let h24 = selectedHour;
    if (selectedAmPm === 'PM' && selectedHour < 12) {
      h24 += 12;
    } else if (selectedAmPm === 'AM' && selectedHour === 12) {
      h24 = 0;
    }
    const hh = String(h24).padStart(2, '0');
    const mm = String(selectedMinute).padStart(2, '0');
    const formatted24 = `${hh}:${mm}:00`;

    onChange(formatted24);
    setModalVisible(false);
  };

  const formatDisplayTime = (val: string) => {
    if (!val) return '';
    const p = parseTime(val);
    const mm = String(p.minute).padStart(2, '0');
    return `${p.hour}:${mm} ${p.ampm}`;
  };

  const hoursList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const minutesList = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <View style={timePickerStyles.container}>
      {label && (
        <Text style={timePickerStyles.label}>
          {label} {required && <Text style={timePickerStyles.requiredStar}>*</Text>}
        </Text>
      )}

      <TouchableOpacity
        style={[
          timePickerStyles.triggerButton,
          modalVisible && timePickerStyles.triggerButtonFocused,
          Boolean(error) && timePickerStyles.triggerButtonError,
          disabled && timePickerStyles.triggerButtonDisabled,
        ]}
        onPress={openPicker}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <View style={timePickerStyles.triggerLeft}>
          <View style={[timePickerStyles.iconContainer, modalVisible && timePickerStyles.iconContainerFocused]}>
            <Clock size={16} color={modalVisible ? '#FFFFFF' : '#0757B8'} />
          </View>
          {value ? (
            <Text style={timePickerStyles.valueText}>{formatDisplayTime(value)}</Text>
          ) : (
            <Text style={timePickerStyles.placeholderText}>{placeholder}</Text>
          )}
        </View>

        {value ? (
          <View style={timePickerStyles.formatBadge}>
            <Text style={timePickerStyles.formatBadgeText}>{value.substring(0, 5)}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      {error ? <Text style={timePickerStyles.errorText}>{error}</Text> : null}

      {/* Modern Time Selection Modal Bottom Sheet */}
      <Modal statusBarTranslucent visible={modalVisible} transparent animationType="slide">
        <View style={timePickerStyles.modalOverlay}>
          <View style={timePickerStyles.modalContent}>
            <View style={timePickerStyles.handleBar} />

            <View style={timePickerStyles.modalHeader}>
              <Text style={timePickerStyles.modalTitle}>{label || 'Select Time'}</Text>
              <TouchableOpacity
                style={timePickerStyles.closeBtn}
                onPress={() => setModalVisible(false)}
              >
                <X size={20} color="#666666" />
              </TouchableOpacity>
            </View>

            {/* Current Dial Preview */}
            <View style={timePickerStyles.selectedPreviewBox}>
              <Text style={timePickerStyles.selectedPreviewTime}>
                {String(selectedHour).padStart(2, '0')}:{String(selectedMinute).padStart(2, '0')} {selectedAmPm}
              </Text>
              <Text style={timePickerStyles.selectedPreviewSub}>Selected Schedule</Text>
            </View>

            {/* Dials for Hour, Minute, and AM/PM */}
            <View style={timePickerStyles.dialContainer}>
              {/* Hour Column */}
              <View style={timePickerStyles.dialColumn}>
                <Text style={timePickerStyles.dialLabel}>Hour</Text>
                <ScrollView
                  style={timePickerStyles.dialScroller}
                  contentContainerStyle={timePickerStyles.dialScrollerContent}
                  showsVerticalScrollIndicator={false}
                >
                  {hoursList.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[
                        timePickerStyles.dialItem,
                        selectedHour === h && timePickerStyles.dialItemActive,
                      ]}
                      onPress={() => setSelectedHour(h)}
                    >
                      <Text
                        style={[
                          timePickerStyles.dialItemText,
                          selectedHour === h && timePickerStyles.dialItemTextActive,
                        ]}
                      >
                        {String(h).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={timePickerStyles.colonSeparator}>:</Text>

              {/* Minute Column */}
              <View style={timePickerStyles.dialColumn}>
                <Text style={timePickerStyles.dialLabel}>Minute</Text>
                <ScrollView
                  style={timePickerStyles.dialScroller}
                  contentContainerStyle={timePickerStyles.dialScrollerContent}
                  showsVerticalScrollIndicator={false}
                >
                  {minutesList.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        timePickerStyles.dialItem,
                        selectedMinute === m && timePickerStyles.dialItemActive,
                      ]}
                      onPress={() => setSelectedMinute(m)}
                    >
                      <Text
                        style={[
                          timePickerStyles.dialItemText,
                          selectedMinute === m && timePickerStyles.dialItemTextActive,
                        ]}
                      >
                        {String(m).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* AM / PM Column */}
              <View style={timePickerStyles.ampmContainer}>
                <TouchableOpacity
                  style={[
                    timePickerStyles.ampmButton,
                    selectedAmPm === 'AM' && timePickerStyles.ampmButtonActive,
                  ]}
                  onPress={() => setSelectedAmPm('AM')}
                >
                  <Text
                    style={[
                      timePickerStyles.ampmText,
                      selectedAmPm === 'AM' && timePickerStyles.ampmTextActive,
                    ]}
                  >
                    AM
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    timePickerStyles.ampmButton,
                    selectedAmPm === 'PM' && timePickerStyles.ampmButtonActive,
                  ]}
                  onPress={() => setSelectedAmPm('PM')}
                >
                  <Text
                    style={[
                      timePickerStyles.ampmText,
                      selectedAmPm === 'PM' && timePickerStyles.ampmTextActive,
                    ]}
                  >
                    PM
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={timePickerStyles.actionRow}>
              <TouchableOpacity
                style={timePickerStyles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={timePickerStyles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={timePickerStyles.confirmBtn}
                onPress={handleConfirm}
              >
                <Text style={timePickerStyles.confirmBtnText}>Confirm Time</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

