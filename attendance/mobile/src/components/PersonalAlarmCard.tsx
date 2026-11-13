import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import {
  Bell,
  BellOff,
  Clock,
  Check,
  Plus,
  Trash2,
  Calendar,
  CalendarDays,
  X,
  ChevronRight,
} from 'lucide-react-native';
import { api } from '../context/AuthContext';
import { cancelPersonalAlarmNotifications, AlarmItemData } from './PersonalAlarmManager';

export function convert24To12(time24?: string): { hour: string; minute: string; ampm: 'AM' | 'PM'; display: string } {
  if (!time24) {
    return { hour: '08', minute: '30', ampm: 'AM', display: '08:30 AM' };
  }
  const parts = time24.split(':');
  let hoursNum = parseInt(parts[0], 10);
  const minutes = parts[1] || '00';
  if (isNaN(hoursNum)) hoursNum = 8;

  const ampm: 'AM' | 'PM' = hoursNum >= 12 ? 'PM' : 'AM';
  let hours12 = hoursNum % 12;
  if (hours12 === 0) hours12 = 12;

  const hourStr = String(hours12).padStart(2, '0');
  const minuteStr = String(minutes).padStart(2, '0');
  return {
    hour: hourStr,
    minute: minuteStr,
    ampm,
    display: `${hourStr}:${minuteStr} ${ampm}`,
  };
}

export function convert12To24(hourStr: string, minuteStr: string, ampm: 'AM' | 'PM'): string {
  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  if (isNaN(hour)) hour = 8;
  const validMinute = isNaN(minute) ? '00' : String(minute).padStart(2, '0');

  if (ampm === 'AM') {
    if (hour === 12) hour = 0;
  } else {
    // PM
    if (hour !== 12) hour += 12;
  }
  return `${String(hour).padStart(2, '0')}:${validMinute}:00`;
}

const DAYS_LIST = [
  { key: 'MON', label: 'Mon' },
  { key: 'TUE', label: 'Tue' },
  { key: 'WED', label: 'Wed' },
  { key: 'THU', label: 'Thu' },
  { key: 'FRI', label: 'Fri' },
  { key: 'SAT', label: 'Sat' },
  { key: 'SUN', label: 'Sun' },
];

interface PersonalAlarmCardProps {
  onAlarmChanged?: () => void;
}

export default function PersonalAlarmCard({ onAlarmChanged }: PersonalAlarmCardProps) {
  const [alarms, setAlarms] = useState<AlarmItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  // Edit / Add Modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<AlarmItemData | null>(null);
  const [modalHour, setModalHour] = useState('08');
  const [modalMinute, setModalMinute] = useState('30');
  const [modalAmpm, setModalAmpm] = useState<'AM' | 'PM'>('AM');
  const [modalLabel, setModalLabel] = useState('Personal Alarm');
  const [modalDays, setModalDays] = useState<string[]>([]);
  const [modalDates, setModalDates] = useState<string[]>([]);
  const [newDateInput, setNewDateInput] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const fetchAlarmSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance/personal-alarm/');
      const data = res.data;
      if (data) {
        if (Array.isArray(data.alarms) && data.alarms.length > 0) {
          setAlarms(data.alarms);
        } else if (data.alarm_time) {
          setAlarms([data]);
        } else {
          setAlarms([]);
        }
      }
    } catch (err) {
      console.warn('[PersonalAlarmCard] Error fetching alarm:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAlarmSettings();
  }, [fetchAlarmSettings]);

  const handleToggle = async (alarm: AlarmItemData, nextVal: boolean) => {
    try {
      if (alarm.id) setSavingId(alarm.id);
      const res = await api.post('/attendance/personal-alarm/', {
        id: alarm.id,
        is_enabled: nextVal,
      });

      if (res.data?.alarms) {
        setAlarms(res.data.alarms);
      } else {
        await fetchAlarmSettings();
      }

      onAlarmChanged?.();
    } catch (err) {
      console.error('[PersonalAlarmCard] Toggle error:', err);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = (alarm: AlarmItemData) => {
    if (!alarm.id) return;
    Alert.alert(
      'Delete Alarm',
      `Are you sure you want to delete "${alarm.label || 'this alarm'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setSavingId(alarm.id || null);
              const res = await api.delete(`/attendance/personal-alarm/?id=${alarm.id}`);
              if (res.data?.alarms) {
                setAlarms(res.data.alarms);
              } else {
                await fetchAlarmSettings();
              }
              onAlarmChanged?.();
            } catch (err) {
              console.error('[PersonalAlarmCard] Delete error:', err);
            } finally {
              setSavingId(null);
            }
          },
        },
      ]
    );
  };

  const openAddModal = () => {
    setEditingAlarm(null);
    setModalLabel(`Alarm ${alarms.length + 1}`);
    setModalHour('08');
    setModalMinute('30');
    setModalAmpm('AM');
    setModalDays([]);
    setModalDates([]);
    setNewDateInput('');
    setEditModalVisible(true);
  };

  const openEditModal = (alarm: AlarmItemData) => {
    setEditingAlarm(alarm);
    setModalLabel(alarm.label || 'Personal Alarm');
    const parsed = convert24To12(alarm.alarm_time);
    setModalHour(parsed.hour);
    setModalMinute(parsed.minute);
    setModalAmpm(parsed.ampm);
    setModalDays(alarm.days_of_week || []);
    setModalDates(alarm.specific_dates || []);
    setNewDateInput('');
    setEditModalVisible(true);
  };

  const toggleDay = (dayKey: string) => {
    if (modalDays.includes(dayKey)) {
      setModalDays(modalDays.filter((d) => d !== dayKey));
    } else {
      setModalDays([...modalDays, dayKey]);
    }
  };

  const addSpecificDate = () => {
    const trimmed = newDateInput.trim();
    if (!trimmed) return;
    // Basic date check YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      Alert.alert('Invalid Date', 'Please enter date in format: YYYY-MM-DD (e.g. 2026-11-15)');
      return;
    }
    if (!modalDates.includes(trimmed)) {
      setModalDates([...modalDates, trimmed]);
    }
    setNewDateInput('');
  };

  const removeSpecificDate = (dateStr: string) => {
    setModalDates(modalDates.filter((d) => d !== dateStr));
  };

  const handleSaveModal = async () => {
    try {
      setModalSubmitting(true);
      const time24 = convert12To24(modalHour, modalMinute, modalAmpm);

      const payload: any = {
        label: modalLabel.trim() || 'Personal Alarm',
        alarm_time: time24,
        is_enabled: true,
        days_of_week: modalDays,
        specific_dates: modalDates,
      };

      if (editingAlarm?.id) {
        payload.id = editingAlarm.id;
      } else {
        payload.action = 'create';
      }

      const res = await api.post('/attendance/personal-alarm/', payload);
      if (res.data?.alarms) {
        setAlarms(res.data.alarms);
      } else {
        await fetchAlarmSettings();
      }

      setEditModalVisible(false);
      onAlarmChanged?.();
    } catch (err: any) {
      console.error('[PersonalAlarmCard] Save modal error:', err);
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to save alarm.');
    } finally {
      setModalSubmitting(false);
    }
  };

  if (loading) {
    return null;
  }

  const hoursList = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const minutesList = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  const anyEnabled = alarms.some((a) => a.is_enabled);

  return (
    <View style={styles.card}>
      {/* HEADER */}
      <View style={styles.cardHeader}>
        <View style={styles.iconBox}>
          {anyEnabled ? (
            <Bell size={22} color="#E56108" strokeWidth={2.2} />
          ) : (
            <BellOff size={22} color="#666666" strokeWidth={2.2} />
          )}
        </View>

        <View style={styles.headerTextContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle}>Personal Alarms</Text>
            <View style={[styles.badge, anyEnabled ? styles.badgeActive : styles.badgeInactive]}>
              <Text style={[styles.badgeText, anyEnabled ? styles.badgeTextActive : styles.badgeTextInactive]}>
                {anyEnabled ? `${alarms.filter((a) => a.is_enabled).length} Active` : 'All Off'}
              </Text>
            </View>
          </View>
          <Text style={styles.cardSubtitle}>
            Set daily or specific day/date reminders with alarm sound.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={openAddModal}
          activeOpacity={0.8}
        >
          <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* ALARMS LIST */}
      <View style={styles.alarmsList}>
        {alarms.map((alarm, idx) => {
          const parsed = convert24To12(alarm.alarm_time);
          const hasDays = Array.isArray(alarm.days_of_week) && alarm.days_of_week.length > 0;
          const hasDates = Array.isArray(alarm.specific_dates) && alarm.specific_dates.length > 0;

          return (
            <View key={alarm.id || `alarm-${idx}`} style={styles.alarmItem}>
              <TouchableOpacity
                style={styles.alarmItemInfo}
                onPress={() => openEditModal(alarm)}
                activeOpacity={0.7}
              >
                <View style={styles.alarmTimeRow}>
                  <Text style={[styles.alarmTimeText, !alarm.is_enabled && styles.alarmTimeDisabled]}>
                    {parsed.display}
                  </Text>
                  <Text style={styles.alarmLabelText}>{alarm.label || 'Alarm'}</Text>
                </View>

                {/* Days / Dates Tags */}
                <View style={styles.tagsRow}>
                  {hasDays ? (
                    <View style={styles.tagBadge}>
                      <CalendarDays size={11} color="#E56108" strokeWidth={2} style={{ marginRight: 3 }} />
                      <Text style={styles.tagText}>{alarm.days_of_week!.join(', ')}</Text>
                    </View>
                  ) : hasDates ? (
                    <View style={styles.tagBadge}>
                      <Calendar size={11} color="#E56108" strokeWidth={2} style={{ marginRight: 3 }} />
                      <Text style={styles.tagText}>{alarm.specific_dates!.join(', ')}</Text>
                    </View>
                  ) : (
                    <View style={styles.tagBadge}>
                      <Clock size={11} color="#666666" strokeWidth={2} style={{ marginRight: 3 }} />
                      <Text style={[styles.tagText, { color: '#666666' }]}>Every Day</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              {/* Action Controls */}
              <View style={styles.alarmItemControls}>
                {savingId === alarm.id ? (
                  <ActivityIndicator size="small" color="#E56108" />
                ) : (
                  <Switch
                    value={alarm.is_enabled}
                    onValueChange={(nextVal) => void handleToggle(alarm, nextVal)}
                    trackColor={{ false: '#E5E5E5', true: '#FED7AA' }}
                    thumbColor={alarm.is_enabled ? '#E56108' : '#FFFFFF'}
                  />
                )}

                {alarms.length > 1 && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(alarm)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Trash2 size={16} color="#999999" strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* EDIT / ADD MODAL */}
      <Modal statusBarTranslucent visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAlarm ? 'Edit Alarm' : 'Set New Alarm'}
              </Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <X size={20} color="#666666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              {/* Label Input */}
              <Text style={styles.sectionLabel}>Alarm Name / Label</Text>
              <TextInput
                style={styles.textInput}
                value={modalLabel}
                onChangeText={setModalLabel}
                placeholder="e.g. Office Wakeup, Evening Punch-Out"
                placeholderTextColor="#999999"
              />

              {/* Time Picker */}
              <Text style={styles.sectionLabel}>Alarm Time</Text>
              <View style={styles.pickerColumnsContainer}>
                {/* Hour Column */}
                <View style={styles.pickerColumn}>
                  <Text style={styles.columnLabel}>Hour</Text>
                  <ScrollView style={styles.columnScrollView} showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
                    {hoursList.map((h) => {
                      const isSelected = modalHour === h;
                      return (
                        <TouchableOpacity
                          key={h}
                          style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                          onPress={() => setModalHour(h)}
                        >
                          <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>
                            {h}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Minute Column */}
                <View style={styles.pickerColumn}>
                  <Text style={styles.columnLabel}>Minute</Text>
                  <ScrollView style={styles.columnScrollView} showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
                    {minutesList.map((m) => {
                      const isSelected = modalMinute === m;
                      return (
                        <TouchableOpacity
                          key={m}
                          style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                          onPress={() => setModalMinute(m)}
                        >
                          <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>
                            {m}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* AM/PM Column */}
                <View style={[styles.pickerColumn, { flex: 0.8 }]}>
                  <Text style={styles.columnLabel}>AM / PM</Text>
                  <View style={styles.ampmContainer}>
                    <TouchableOpacity
                      style={[styles.ampmBtn, modalAmpm === 'AM' && styles.ampmBtnSelected]}
                      onPress={() => setModalAmpm('AM')}
                    >
                      <Text style={[styles.ampmBtnText, modalAmpm === 'AM' && styles.ampmBtnTextSelected]}>
                        AM
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.ampmBtn, modalAmpm === 'PM' && styles.ampmBtnSelected]}
                      onPress={() => setModalAmpm('PM')}
                    >
                      <Text style={[styles.ampmBtnText, modalAmpm === 'PM' && styles.ampmBtnTextSelected]}>
                        PM
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Day of Week Repeat Selector */}
              <Text style={styles.sectionLabel}>Repeat On Specific Days (Optional)</Text>
              <Text style={styles.helperText}>Leave unselected to ring every day.</Text>
              <View style={styles.daysRow}>
                {DAYS_LIST.map((day) => {
                  const selected = modalDays.includes(day.key);
                  return (
                    <TouchableOpacity
                      key={day.key}
                      style={[styles.dayChip, selected && styles.dayChipSelected]}
                      onPress={() => toggleDay(day.key)}
                    >
                      <Text style={[styles.dayChipText, selected && styles.dayChipTextSelected]}>
                        {day.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Specific Dates (Optional) */}
              <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Specific Dates (Optional)</Text>
              <Text style={styles.helperText}>Add specific dates when this alarm should ring.</Text>
              <View style={styles.addDateRow}>
                <TextInput
                  style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
                  value={newDateInput}
                  onChangeText={setNewDateInput}
                  placeholder="YYYY-MM-DD (e.g. 2026-11-15)"
                  placeholderTextColor="#999999"
                />
                <TouchableOpacity style={styles.addDateBtn} onPress={addSpecificDate}>
                  <Plus size={16} color="#FFFFFF" />
                  <Text style={styles.addDateBtnText}>Add</Text>
                </TouchableOpacity>
              </View>

              {/* Selected Dates Badges */}
              {modalDates.length > 0 && (
                <View style={styles.datesContainer}>
                  {modalDates.map((dateStr) => (
                    <View key={dateStr} style={styles.dateTag}>
                      <Text style={styles.dateTagText}>{dateStr}</Text>
                      <TouchableOpacity onPress={() => removeSpecificDate(dateStr)}>
                        <X size={12} color="#666666" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
                disabled={modalSubmitting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => void handleSaveModal()}
                disabled={modalSubmitting}
              >
                {modalSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Save Alarm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  badgeActive: {
    backgroundColor: '#FFF7ED',
  },
  badgeInactive: {
    backgroundColor: '#F5F5F5',
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Comfortaa_700Bold',
  },
  badgeTextActive: {
    color: '#E56108',
  },
  badgeTextInactive: {
    color: '#666666',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E56108',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
  },
  alarmsList: {
    marginTop: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    gap: 10,
  },
  alarmItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  alarmItemInfo: {
    flex: 1,
  },
  alarmTimeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  alarmTimeText: {
    fontSize: 18,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  alarmTimeDisabled: {
    color: '#999999',
  },
  alarmLabelText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#666666',
  },
  tagsRow: {
    flexDirection: 'row',
    marginTop: 4,
    alignItems: 'center',
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#E56108',
  },
  alarmItemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteBtn: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 380,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
    color: '#222222',
    marginBottom: 6,
    marginTop: 10,
  },
  helperText: {
    fontSize: 11,
    color: '#888888',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000000',
    marginBottom: 6,
  },
  pickerColumnsContainer: {
    flexDirection: 'row',
    height: 190,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    overflow: 'hidden',
  },
  pickerColumn: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: '#EEEEEE',
  },
  columnLabel: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: '#666666',
    textAlign: 'center',
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  columnScrollView: {
    flex: 1,
  },
  pickerItem: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItemSelected: {
    backgroundColor: '#FFF7ED',
  },
  pickerItemText: {
    fontSize: 14,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#444444',
  },
  pickerItemTextSelected: {
    fontFamily: 'Comfortaa_700Bold',
    color: '#E56108',
  },
  ampmContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 8,
    gap: 8,
  },
  ampmBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#EEEEEE',
  },
  ampmBtnSelected: {
    backgroundColor: '#E56108',
  },
  ampmBtnText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
    color: '#444444',
  },
  ampmBtnTextSelected: {
    color: '#FFFFFF',
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    backgroundColor: '#FAFAFA',
  },
  dayChipSelected: {
    backgroundColor: '#E56108',
    borderColor: '#E56108',
  },
  dayChipText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#555555',
  },
  dayChipTextSelected: {
    color: '#FFFFFF',
  },
  addDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222222',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 4,
  },
  addDateBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
  },
  datesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  dateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  dateTagText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#E56108',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  modalCancelText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#666666',
  },
  modalConfirmBtn: {
    backgroundColor: '#E56108',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
    color: '#FFFFFF',
  },
});
