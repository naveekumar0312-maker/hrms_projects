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
} from 'react-native';
import { Bell, BellOff, Clock, Check } from 'lucide-react-native';
import { api } from '../context/AuthContext';
import { cancelPersonalAlarmNotifications } from './PersonalAlarmManager';

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

interface PersonalAlarmCardProps {
  onAlarmChanged?: () => void;
}

export default function PersonalAlarmCard({ onAlarmChanged }: PersonalAlarmCardProps) {
  const [hour, setHour] = useState('08');
  const [minute, setMinute] = useState('30');
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');
  const [savedTimeDisplay, setSavedTimeDisplay] = useState('08:30 AM');
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Picker modal state
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [tempHour, setTempHour] = useState('08');
  const [tempMinute, setTempMinute] = useState('30');
  const [tempAmpm, setTempAmpm] = useState<'AM' | 'PM'>('AM');

  const fetchAlarmSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance/personal-alarm/');
      const data = res.data;
      if (data) {
        if (data.alarm_time) {
          const parsed = convert24To12(data.alarm_time);
          setHour(parsed.hour);
          setMinute(parsed.minute);
          setAmpm(parsed.ampm);
          setSavedTimeDisplay(parsed.display);
        }
        setIsEnabled(Boolean(data.is_enabled));
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

  const handleSave = async (overrideEnabled?: boolean, overrideHour?: string, overrideMin?: string, overrideAmpm?: 'AM' | 'PM') => {
    try {
      setSaving(true);
      setSaveSuccess(false);

      const targetEnabled = overrideEnabled !== undefined ? overrideEnabled : isEnabled;
      const targetHour = overrideHour || hour;
      const targetMin = overrideMin || minute;
      const targetAmpm = overrideAmpm || ampm;

      const formatted24 = convert12To24(targetHour, targetMin, targetAmpm);

      const res = await api.post('/attendance/personal-alarm/', {
        alarm_time: formatted24,
        is_enabled: targetEnabled,
      });

      const updated = res.data;
      setIsEnabled(Boolean(updated.is_enabled));
      const parsed = convert24To12(updated.alarm_time);
      setSavedTimeDisplay(parsed.display);
      setHour(parsed.hour);
      setMinute(parsed.minute);
      setAmpm(parsed.ampm);

      if (!targetEnabled) {
        await cancelPersonalAlarmNotifications();
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onAlarmChanged?.();
    } catch (err) {
      console.error('[PersonalAlarmCard] Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (nextVal: boolean) => {
    setIsEnabled(nextVal);
    void handleSave(nextVal);
  };

  const openPickerModal = () => {
    setTempHour(hour);
    setTempMinute(minute);
    setTempAmpm(ampm);
    setPickerModalVisible(true);
  };

  const confirmPicker = () => {
    setHour(tempHour);
    setMinute(tempMinute);
    setAmpm(tempAmpm);
    setPickerModalVisible(false);
    void handleSave(isEnabled, tempHour, tempMinute, tempAmpm);
  };

  if (loading) {
    return null;
  }

  const hoursList = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const minutesList = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  return (
    <View style={styles.card}>
      {/* HEADER */}
      <View style={styles.cardHeader}>
        <View style={styles.iconBox}>
          {isEnabled ? (
            <Bell size={22} color="#000000" strokeWidth={2.2} />
          ) : (
            <BellOff size={22} color="#666666" strokeWidth={2.2} />
          )}
        </View>

        <View style={styles.headerTextContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle}>Personal Daily Alarm</Text>
            <View style={[styles.badge, isEnabled ? styles.badgeActive : styles.badgeInactive]}>
              <Text style={[styles.badgeText, isEnabled ? styles.badgeTextActive : styles.badgeTextInactive]}>
                {isEnabled ? 'Active' : 'Off'}
              </Text>
            </View>
          </View>
          <Text style={styles.cardSubtitle}>
            Recurring daily reminder at your preferred time.
          </Text>
        </View>

        <Switch
          value={isEnabled}
          onValueChange={handleToggle}
          trackColor={{ false: '#E5E5E5', true: '#E5E5E5' }}
          thumbColor={isEnabled ? '#000000' : '#FFFFFF'}
          disabled={saving}
        />
      </View>

      {/* TIME CONTROL ROW */}
      <View style={styles.bodyRow}>
        <TouchableOpacity
          style={styles.timeSelectorBtn}
          onPress={openPickerModal}
          disabled={saving}
          activeOpacity={0.7}
        >
          <Clock size={18} color="#000000" strokeWidth={2.2} style={{ marginRight: 6 }} />
          <Text style={styles.timeSelectorLabel}>Alarm Time:</Text>
          <Text style={styles.timeSelectorValue}>{`${hour}:${minute} ${ampm}`}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={() => void handleSave()}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>{saveSuccess ? 'Saved!' : 'Save Time'}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* SUCCESS CONFIRMATION BADGE */}
      {saveSuccess && (
        <View style={styles.successRow}>
          <Check size={14} color="#000000" strokeWidth={2.2} />
          <Text style={styles.successText}>
            Alarm scheduled for {savedTimeDisplay} ({isEnabled ? 'Enabled' : 'Disabled'})
          </Text>
        </View>
      )}

      {/* 12-HOUR TIME PICKER MODAL */}
      <Modal statusBarTranslucent visible={pickerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Alarm Time (12-Hour)</Text>
            <Text style={styles.modalSubtitle}>Scroll or tap to choose Hour, Minute, and AM/PM</Text>

            <View style={styles.pickerColumnsContainer}>
              {/* Hour Column */}
              <View style={styles.columnWrapper}>
                <Text style={styles.columnLabel}>Hour</Text>
                <ScrollView style={styles.wheelScrollView} showsVerticalScrollIndicator={false}>
                  {hoursList.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[styles.wheelItem, tempHour === h && styles.wheelItemSelected]}
                      onPress={() => setTempHour(h)}
                    >
                      <Text style={[styles.wheelItemText, tempHour === h && styles.wheelItemTextSelected]}>
                        {h}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={styles.colonSeparator}>:</Text>

              {/* Minute Column */}
              <View style={styles.columnWrapper}>
                <Text style={styles.columnLabel}>Minute</Text>
                <ScrollView style={styles.wheelScrollView} showsVerticalScrollIndicator={false}>
                  {minutesList.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.wheelItem, tempMinute === m && styles.wheelItemSelected]}
                      onPress={() => setTempMinute(m)}
                    >
                      <Text style={[styles.wheelItemText, tempMinute === m && styles.wheelItemTextSelected]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* AM/PM Column */}
              <View style={styles.columnWrapperAmpm}>
                <Text style={styles.columnLabel}>Period</Text>
                <View style={styles.ampmStack}>
                  <TouchableOpacity
                    style={[styles.ampmBtn, tempAmpm === 'AM' && styles.ampmBtnSelected]}
                    onPress={() => setTempAmpm('AM')}
                  >
                    <Text style={[styles.ampmBtnText, tempAmpm === 'AM' && styles.ampmBtnTextSelected]}>
                      AM
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.ampmBtn, tempAmpm === 'PM' && styles.ampmBtnSelected]}
                    onPress={() => setTempAmpm('PM')}
                  >
                    <Text style={[styles.ampmBtnText, tempAmpm === 'PM' && styles.ampmBtnTextSelected]}>
                      PM
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setPickerModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={confirmPicker}
              >
                <Text style={styles.modalConfirmBtnText}>Apply & Save</Text>
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
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#F5F5F5',
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
    backgroundColor: '#F5F5F5',
  },
  badgeInactive: {
    backgroundColor: '#F5F5F5',
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Comfortaa_700Bold',
  },
  badgeTextActive: {
    color: '#000000',
  },
  badgeTextInactive: {
    color: '#666666',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  bodyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    gap: 10,
  },
  timeSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flex: 1,
  },
  timeSelectorLabel: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#444444',
    marginRight: 6,
  },
  timeSelectorValue: {
    fontSize: 14,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  saveBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 85,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
    gap: 6,
  },
  successText: {
    fontSize: 12,
    color: '#000000',
    fontFamily: 'Comfortaa_600SemiBold',
    flex: 1,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  pickerColumnsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  columnWrapper: {
    alignItems: 'center',
    width: 65,
  },
  columnWrapperAmpm: {
    alignItems: 'center',
    width: 65,
    marginLeft: 6,
  },
  columnLabel: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: '#666666',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  colonSeparator: {
    fontSize: 24,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
    marginHorizontal: 4,
    marginTop: 12,
  },
  wheelScrollView: {
    height: 140,
    width: '100%',
  },
  wheelItem: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  wheelItemSelected: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  wheelItemText: {
    fontSize: 16,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#666666',
  },
  wheelItemTextSelected: {
    color: '#000000',
    fontFamily: 'Comfortaa_700Bold',
  },
  ampmStack: {
    height: 140,
    justifyContent: 'center',
    gap: 10,
    width: '100%',
  },
  ampmBtn: {
    height: 42,
    borderRadius: 8,
    backgroundColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ampmBtnSelected: {
    backgroundColor: '#000000',
  },
  ampmBtnText: {
    fontSize: 14,
    fontFamily: 'Comfortaa_700Bold',
    color: '#444444',
  },
  ampmBtnTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_700Bold',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontFamily: 'Comfortaa_700Bold',
    color: '#444444',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#000000',
    alignItems: 'center',
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontFamily: 'Comfortaa_700Bold',
    color: '#FFFFFF',
  },
});

