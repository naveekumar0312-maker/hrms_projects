import { requireOptionalNativeModule } from 'expo-modules-core';

export type ShiftAlarmItem = {
  id: string;
  timestamp: number;
  event: 'SHIFT_START' | 'SHIFT_END';
  shiftName: string;
  title: string;
  body: string;
};

export type ShiftAlarmNativeModule = {
  canScheduleExactAlarms(): boolean;
  openExactAlarmSettings(): void;
  scheduleAlarms(items: ShiftAlarmItem[]): void;
  cancelAlarms(): void;
  stopAlarm(): void;
};

const ShiftAlarm =
  requireOptionalNativeModule<ShiftAlarmNativeModule>('ShiftAlarm');

export default ShiftAlarm;
