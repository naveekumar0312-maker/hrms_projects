import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { datePickerStyles } from '../../styles/pickers/datePicker.styles';

export interface DatePickerProps {
  label?: string;
  value: string; // "YYYY-MM-DD"
  onChange: (dateStr: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  minDate?: string;
  maxDate?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Select Date',
  required = false,
  disabled = false,
  error,
  minDate,
  maxDate,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  // Initialize selected date
  const initialDate = value ? new Date(value) : new Date();
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth()); // 0-11
  const [selectedDateStr, setSelectedDateStr] = useState(value || '');

  const openPicker = () => {
    if (disabled) return;
    const d = value ? new Date(value) : new Date();
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
    setSelectedDateStr(value || '');
    setModalVisible(true);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Get days in month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // First day of month (0 = Sun, 1 = Mon...)
  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysCount = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const todayStr = new Date().toISOString().split('T')[0];

  const handleSelectDay = (day: number) => {
    const mm = String(currentMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateStr = `${currentYear}-${mm}-${dd}`;

    if (minDate && dateStr < minDate) return;
    if (maxDate && dateStr > maxDate) return;

    setSelectedDateStr(dateStr);
  };

  const handleConfirm = () => {
    if (selectedDateStr) {
      onChange(selectedDateStr);
    }
    setModalVisible(false);
  };

  const handleSetToday = () => {
    setSelectedDateStr(todayStr);
    const t = new Date();
    setCurrentYear(t.getFullYear());
    setCurrentMonth(t.getMonth());
  };

  const formatDisplay = (dStr: string) => {
    if (!dStr) return '';
    try {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const day = String(d.getDate()).padStart(2, '0');
        const month = d.toLocaleString('en-US', { month: 'short' });
        const year = d.getFullYear();
        return `${day} ${month} ${year}`;
      }
      return dStr;
    } catch {
      return dStr;
    }
  };

  return (
    <View style={datePickerStyles.container}>
      {label && (
        <Text style={datePickerStyles.label}>
          {label} {required && <Text style={datePickerStyles.requiredStar}>*</Text>}
        </Text>
      )}

      <TouchableOpacity
        style={[
          datePickerStyles.triggerButton,
          modalVisible && datePickerStyles.triggerButtonFocused,
          Boolean(error) && datePickerStyles.triggerButtonError,
          disabled && datePickerStyles.triggerButtonDisabled,
        ]}
        onPress={openPicker}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <View style={datePickerStyles.triggerLeft}>
          <View style={datePickerStyles.iconContainer}>
            <Calendar size={16} color="#0757B8" />
          </View>
          {value ? (
            <Text style={datePickerStyles.valueText}>{formatDisplay(value)}</Text>
          ) : (
            <Text style={datePickerStyles.placeholderText}>{placeholder}</Text>
          )}
        </View>

        {value ? (
          <View style={datePickerStyles.dayOfWeekBadge}>
            <Text style={datePickerStyles.dayOfWeekBadgeText}>
              {new Date(value).toLocaleDateString('en-US', { weekday: 'short' })}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>

      {error ? <Text style={datePickerStyles.errorText}>{error}</Text> : null}

      {/* Modern Calendar Modal */}
      <Modal statusBarTranslucent visible={modalVisible} transparent animationType="slide">
        <View style={datePickerStyles.modalOverlay}>
          <View style={datePickerStyles.modalContent}>
            <View style={datePickerStyles.handleBar} />

            <View style={datePickerStyles.modalHeader}>
              <Text style={datePickerStyles.modalTitle}>{label || 'Select Date'}</Text>
              <TouchableOpacity
                style={datePickerStyles.closeBtn}
                onPress={() => setModalVisible(false)}
              >
                <X size={20} color="#666666" />
              </TouchableOpacity>
            </View>

            {/* Month & Year Navigator */}
            <View style={datePickerStyles.monthNavRow}>
              <TouchableOpacity style={datePickerStyles.navArrowBtn} onPress={prevMonth}>
                <ChevronLeft size={18} color="#0757B8" />
              </TouchableOpacity>

              <Text style={datePickerStyles.monthYearDisplay}>
                {monthNames[currentMonth]} {currentYear}
              </Text>

              <TouchableOpacity style={datePickerStyles.navArrowBtn} onPress={nextMonth}>
                <ChevronRight size={18} color="#0757B8" />
              </TouchableOpacity>
            </View>

            {/* Weekdays Row */}
            <View style={datePickerStyles.weekdaysRow}>
              {weekdays.map((w, idx) => (
                <Text key={idx} style={datePickerStyles.weekdayLabel}>
                  {w}
                </Text>
              ))}
            </View>

            {/* Calendar Days Grid */}
            <View style={datePickerStyles.daysGrid}>
              {(() => {
                const totalCells: (number | null)[] = [];
                for (let i = 0; i < firstDay; i++) {
                  totalCells.push(null);
                }
                for (let d = 1; d <= daysCount; d++) {
                  totalCells.push(d);
                }
                // Pad last week to 7 items if needed so row spacing is perfectly uniform
                while (totalCells.length % 7 !== 0) {
                  totalCells.push(null);
                }

                const weeks: (number | null)[][] = [];
                for (let i = 0; i < totalCells.length; i += 7) {
                  weeks.push(totalCells.slice(i, i + 7));
                }

                return weeks.map((week, weekIdx) => (
                  <View key={`week-${weekIdx}`} style={datePickerStyles.weekRow}>
                    {week.map((dayNum, colIdx) => {
                      if (dayNum === null) {
                        return <View key={`empty-${weekIdx}-${colIdx}`} style={datePickerStyles.dayCell} />;
                      }

                      const mm = String(currentMonth + 1).padStart(2, '0');
                      const dd = String(dayNum).padStart(2, '0');
                      const cellDateStr = `${currentYear}-${mm}-${dd}`;

                      const isSelected = selectedDateStr === cellDateStr;
                      const isToday = cellDateStr === todayStr;
                      const isDisabled =
                        Boolean(minDate && cellDateStr < minDate) ||
                        Boolean(maxDate && cellDateStr > maxDate);

                      return (
                        <TouchableOpacity
                          key={`day-${dayNum}`}
                          style={[
                            datePickerStyles.dayCell,
                            isDisabled && datePickerStyles.dayCellDisabled,
                          ]}
                          onPress={() => handleSelectDay(dayNum)}
                          disabled={isDisabled}
                        >
                          <View
                            style={[
                              datePickerStyles.dayCellInner,
                              isToday && datePickerStyles.dayCellToday,
                              isSelected && datePickerStyles.dayCellSelected,
                            ]}
                          >
                            <Text
                              style={[
                                datePickerStyles.dayText,
                                isToday && datePickerStyles.dayTextToday,
                                isSelected && datePickerStyles.dayTextSelected,
                                isDisabled && datePickerStyles.dayTextDisabled,
                              ]}
                            >
                              {dayNum}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ));
              })()}
            </View>

            {/* Action Row */}
            <View style={datePickerStyles.actionRow}>
              <TouchableOpacity
                style={datePickerStyles.todayBtn}
                onPress={handleSetToday}
              >
                <Text style={datePickerStyles.todayBtnText}>Today</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={datePickerStyles.confirmBtn}
                onPress={handleConfirm}
              >
                <Text style={datePickerStyles.confirmBtnText}>Confirm Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

