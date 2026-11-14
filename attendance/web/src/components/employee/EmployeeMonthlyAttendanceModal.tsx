import { useEffect, useMemo, useState } from 'react';
import {
  X,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CheckCircle2,
  XCircle,
  Coffee,
  HeartPulse,
  Sun,
  CalendarOff,
} from 'lucide-react';
import api from '../../services/api';

interface EmployeeMonthlyAttendanceModalProps {
  isOpen: boolean;
  employee: any | null;
  onClose: () => void;
}

interface AttendanceDay {
  date: string;
  day?: number;
  weekday?: string;
  status?: string;
  attendance_id?: number | null;
  id?: number | null;

  check_in?: string | null;
  check_out?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;

  late_minutes?: number | null;
  early_minutes?: number | null;
  overtime_minutes?: number | null;
  working_minutes?: number | null;
  working_hours?: string | null;

  shift_name?: string | null;
  shift_start?: string | null;
  shift_end?: string | null;

  leave_type?: string | null;
  leave_name?: string | null;

  holiday_name?: string | null;
  holiday_description?: string | null;
}

interface MonthlyResponse {
  summary?: {
    present?: number;
    absent?: number;
    working?: number;
    upcoming?: number;
    late_days?: number;
    holidays?: number;
    grace_used_count?: number;
    grace_used_minutes?: number;
    grace_limit?: number;
    grace_limit_minutes?: number;
    monthly_permission_limit_minutes?: number;
    monthly_permission_used_minutes?: number;
    monthly_permission_remaining_minutes?: number;
    approved_permission_count?: number;
    approved_permission_minutes?: number;
    break_minutes?: number;
    total_late_minutes?: number;
    early_checkout_days?: number;
    total_early_minutes?: number;
    overtime_days?: number;
    total_overtime_minutes?: number;
    total_working_minutes?: number;
  };
  days?: AttendanceDay[];
}

const pad = (value: number) =>
  String(value).padStart(2, '0');

const formatDateKey = (
  year: number,
  month: number,
  day: number
) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

const formatTime = (value?: string | null) => {
  if (!value) return '--';

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  return value;
};

const formatMinutes = (minutes?: number | null) => {
  const total = Number(minutes || 0);

  if (total <= 0) return '0m';

  const hours = Math.floor(total / 60);
  const mins = total % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }

  return `${mins}m`;
};

const getStatusInfo = (status?: string) => {
  const value = String(status || '').toUpperCase();

  switch (value) {
    case 'PRESENT':
    case 'COMPLETED':
    case 'ON_TIME':
      return {
        label: 'Present',
        color: '#15803D', // Dark Green
        background: '#DCFCE7', // Soft green pill background
        border: '#86EFAC',
        icon: CheckCircle2,
      };

    case 'WORKING':
      return {
        label: 'Working',
        color: '#1D4ED8', // Dark Blue
        background: '#DBEAFE',
        border: '#93C5FD',
        icon: Clock3,
      };

    case 'ABSENT':
      return {
        label: 'Absent',
        color: '#B91C1C', // Dark Red
        background: '#FEE2E2', // Soft red pill background
        border: '#FCA5A5',
        icon: XCircle,
      };

    case 'CASUAL_LEAVE':
      return {
        label: 'Casual Leave',
        color: '#9A3412', // Dark Amber/Orange-brown
        background: '#FFEDD5',
        border: '#FDBA74',
        icon: Coffee,
      };

    case 'SICK_LEAVE':
      return {
        label: 'Sick Leave',
        color: '#6D28D9', // Dark Purple
        background: '#EDE9FE',
        border: '#C4B5FD',
        icon: HeartPulse,
      };

    case 'HALF_DAY':
    case 'HALF_DAY_LEAVE':
      return {
        label: 'Half Day',
        color: '#BE185D', // Dark Pink/Magenta
        background: '#FCE7F3',
        border: '#F9A8D4',
        icon: Sun,
      };

    case 'PERSONAL_LEAVE':
      return {
        label: 'Personal Leave',
        color: '#4338CA', // Dark Indigo
        background: '#E0E7FF',
        border: '#A5B4FC',
        icon: CalendarDays,
      };

    case 'OTHER_LEAVE':
      return {
        label: 'Other Leave',
        color: '#0F766E', // Dark Teal
        background: '#CCFBF1', // Soft Mint/Teal pill
        border: '#5EEAD4',
        icon: Coffee,
      };

    case 'HOLIDAY':
      return {
        label: 'Holiday',
        color: '#0E7490', // Dark Cyan
        background: '#CFFAFE',
        border: '#67E8F9',
        icon: CalendarOff,
      };

    case 'WEEKEND':
      return {
        label: 'Weekend',
        color: '#334155', // Dark Slate Gray
        background: '#F1F5F9',
        border: '#CBD5E1',
        icon: CalendarDays,
      };

    case 'UPCOMING':
      return {
        label: 'Upcoming',
        color: '#64748B', // Medium Slate
        background: '#F8FAFC',
        border: '#E2E8F0',
        icon: CalendarDays,
      };

    default:
      return {
        label: value.replace(/_/g, ' ') || 'No Data',
        color: '#334155',
        background: '#F1F5F9',
        border: '#CBD5E1',
        icon: CalendarDays,
      };
  }
};

const EmployeeMonthlyAttendanceModal = ({
  isOpen,
  employee,
  onClose,
}: EmployeeMonthlyAttendanceModalProps) => {
  const today = new Date();

  const [currentMonth, setCurrentMonth] = useState(
    today.getMonth()
  );

  const [currentYear, setCurrentYear] = useState(
    today.getFullYear()
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<MonthlyResponse>({
    summary: {},
    days: [],
  });

  const [selectedDay, setSelectedDay] =
    useState<AttendanceDay | null>(null);

  useEffect(() => {
    if (!isOpen || !employee?.id) return;

    const fetchMonthlyAttendance = async () => {
      try {
        setLoading(true);
        setError('');
        setSelectedDay(null);

        const response = await api.get(
          `/employees/${employee.id}/monthly-attendance/?month=${
            currentMonth + 1
          }&year=${currentYear}`
        );

        setData({
          summary: response.data?.summary || {},
          days: Array.isArray(response.data?.days)
            ? response.data.days
            : [],
        });
      } catch (err: any) {
        console.error(
          'Failed to fetch monthly attendance:',
          err
        );

        setData({
          summary: {},
          days: [],
        });

        setError(
          err?.response?.data?.detail ||
            err?.response?.data?.error ||
            'Unable to load monthly attendance.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMonthlyAttendance();
  }, [isOpen, employee?.id, currentMonth, currentYear]);

  const dayMap = useMemo(() => {
    const map = new Map<string, AttendanceDay>();

    data.days?.forEach((day) => {
      if (day.date) {
        map.set(day.date, day);
      }
    });

    return map;
  }, [data.days]);

  const calendarCells = useMemo(() => {
    // Attendance cycle: 26th of previous month through 25th of selected month.
    const cycleStart = new Date(currentYear, currentMonth - 1, 26);
    const cycleEnd = new Date(currentYear, currentMonth, 25);
    const firstDay = cycleStart.getDay();

    const cells: Array<
      AttendanceDay | null | { empty: true }
    > = [];

    for (let index = 0; index < firstDay; index += 1) {
      cells.push({ empty: true });
    }

    for (
      const cursor = new Date(cycleStart);
      cursor <= cycleEnd;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const day = cursor.getDate();
      const dateKey = formatDateKey(year, month, day);

      cells.push(
        dayMap.get(dateKey) || {
          date: dateKey,
        }
      );
    }

    return cells;
  }, [currentYear, currentMonth, dayMap]);

  const changeMonth = (direction: number) => {
    if (direction < 0) {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear((year) => year - 1);
      } else {
        setCurrentMonth((month) => month - 1);
      }

      return;
    }

    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((year) => year + 1);
    } else {
      setCurrentMonth((month) => month + 1);
    }
  };

  const summary = data.summary || {};

  if (!isOpen || !employee) {
    return null;
  }

  return (
    <>
      <style>
        {`
          .employee-calendar-overlay {
            position: fixed;
            inset: 0;
            z-index: 9999;
            background: rgba(15, 23, 42, 0.58);
            backdrop-filter: blur(5px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 18px;
          }

          .employee-calendar-modal {
            width: min(1120px, 100%);
            max-height: 94vh;
            overflow-y: auto;
            background: #ffffff;
            border-radius: 26px;
            box-shadow: 0 30px 90px rgba(15, 23, 42, .22);
          }

          .employee-calendar-header {
            position: sticky;
            top: 0;
            z-index: 5;
            background: #ffffff;
            padding: 20px 24px;
            border-bottom: 1px solid #E8EEF2;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
          }

          .employee-calendar-title-wrap {
            display: flex;
            align-items: center;
            gap: 13px;
            min-width: 0;
          }

          .employee-calendar-icon {
            width: 46px;
            height: 46px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 86, 179, 0.08);
            color: #E56108;
            flex-shrink: 0;
          }

          .employee-calendar-title {
            margin: 0;
            color: #10213E;
            font-size: 19px;
            font-weight: 800;
          }

          .employee-calendar-subtitle {
            margin: 4px 0 0;
            color: #7A8497;
            font-size: 12px;
          }

          .employee-calendar-close {
            width: 38px;
            height: 38px;
            border: 0;
            border-radius: 11px;
            background: #F8FAFC;
            color: #64748B;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            flex-shrink: 0;
          }

          .employee-calendar-close:hover {
            background: rgba(0, 86, 179, 0.08);
            color: #E56108;
          }

          .employee-calendar-body {
            padding: 22px;
          }

          .employee-calendar-layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 290px;
            gap: 20px;
          }

          .employee-calendar-main,
          .employee-calendar-side {
            border: 1px solid #E8EEF2;
            border-radius: 20px;
            background: #FBFDFC;
          }

          .employee-calendar-main {
            padding: 18px;
          }

          .employee-calendar-side {
            padding: 18px;
          }

          .employee-calendar-monthbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 18px;
          }

          .employee-calendar-month {
            color: #10213E;
            font-size: 18px;
            font-weight: 800;
          }

          .employee-calendar-nav {
            display: flex;
            gap: 7px;
          }

          .employee-calendar-nav button {
            width: 36px;
            height: 36px;
            border: 1px solid #DCE5EA;
            background: #ffffff;
            border-radius: 10px;
            cursor: pointer;
            color: #475569;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .employee-calendar-nav button:hover {
            border-color: #86D49E;
            color: #E56108;
          }

          .employee-calendar-weekdays,
          .employee-calendar-grid {
            display: grid;
            grid-template-columns: repeat(7, minmax(0, 1fr));
            gap: 7px;
          }

          .employee-calendar-weekday {
            text-align: center;
            color: #94A3B8;
            font-size: 11px;
            font-weight: 800;
            padding: 5px 0;
          }

          .employee-calendar-day {
            min-height: 72px;
            border: 1px solid #E8EEF2;
            border-radius: 13px;
            background: #ffffff;
            padding: 8px;
            cursor: pointer;
            text-align: left;
            transition: .15s ease;
          }

          .employee-calendar-day:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(15,23,42,.07);
          }

          .employee-calendar-day.empty {
            border-color: transparent;
            background: transparent;
            cursor: default;
          }

          .employee-calendar-day-number {
            font-size: 12px;
            font-weight: 800;
            color: #334155;
            margin-bottom: 7px;
          }

          .employee-calendar-day-status {
            font-size: 9px;
            line-height: 1.25;
            font-weight: 800;
            border-radius: 8px;
            padding: 5px 4px;
            text-align: center;
          }

          .employee-calendar-legend {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            margin-top: 17px;
            padding-top: 15px;
            border-top: 1px solid #E8EEF2;
          }

          .employee-calendar-legend-item {
            display: flex;
            align-items: center;
            gap: 7px;
            color: #64748B;
            font-size: 10px;
            font-weight: 700;
          }

          .employee-calendar-dot {
            width: 9px;
            height: 9px;
            border-radius: 50%;
            flex-shrink: 0;
          }

          .employee-calendar-summary-title {
            margin: 0 0 14px;
            color: #10213E;
            font-size: 15px;
            font-weight: 800;
          }

          .employee-calendar-stat-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 9px;
          }

          .employee-calendar-stat {
            padding: 12px;
            border-radius: 13px;
            background: #ffffff;
            border: 1px solid #E8EEF2;
          }

          .employee-calendar-stat-label {
            color: #8A94A6;
            font-size: 10px;
            font-weight: 700;
          }

          .employee-calendar-stat-value {
            margin-top: 3px;
            color: #10213E;
            font-size: 20px;
            font-weight: 800;
          }

          .employee-calendar-metric {
            margin-top: 9px;
            padding: 12px;
            border-radius: 13px;
            background: #ffffff;
            border: 1px solid #E8EEF2;
          }

          .employee-calendar-metric-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 5px 0;
            font-size: 11px;
          }

          .employee-calendar-metric-row span:first-child {
            color: #7A8497;
          }

          .employee-calendar-metric-row span:last-child {
            color: #17233D;
            font-weight: 800;
          }

          .employee-calendar-details {
            margin-top: 20px;
            border: 1px solid #E8EEF2;
            border-radius: 18px;
            background: #ffffff;
            padding: 17px;
          }

          .employee-calendar-details-title {
            margin: 0 0 14px;
            color: #10213E;
            font-size: 14px;
            font-weight: 800;
          }

          .employee-calendar-details-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
          }

          .employee-calendar-detail-item {
            padding: 11px;
            border-radius: 12px;
            background: #F8FAFC;
          }

          .employee-calendar-detail-label {
            color: #8A94A6;
            font-size: 10px;
            margin-bottom: 4px;
          }

          .employee-calendar-detail-value {
            color: #17233D;
            font-size: 13px;
            font-weight: 800;
          }

          .employee-calendar-loading,
          .employee-calendar-error {
            min-height: 300px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #64748B;
            text-align: center;
          }

          .employee-calendar-error {
            color: #DC2626;
          }

          @media (max-width: 850px) {
            .employee-calendar-layout {
              grid-template-columns: 1fr;
            }

            .employee-calendar-side {
              order: -1;
            }

            .employee-calendar-details-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 600px) {
            .employee-calendar-overlay {
              align-items: center;
              padding: 8px;
              overflow-y: auto;
            }

            .employee-calendar-modal {
              width: 100%;
              max-width: 420px;
              max-height: 96vh;
              border-radius: 18px;
              overflow-y: auto;
            }

            .employee-calendar-header {
              padding: 12px 14px;
              gap: 10px;
            }

            .employee-calendar-title-wrap {
              gap: 9px;
            }

            .employee-calendar-icon {
              width: 38px;
              height: 38px;
              border-radius: 11px;
            }

            .employee-calendar-title {
              font-size: 15px;
            }

            .employee-calendar-subtitle {
              margin-top: 2px;
              font-size: 10px;
            }

            .employee-calendar-close {
              width: 34px;
              height: 34px;
              border-radius: 9px;
            }

            .employee-calendar-body {
              padding: 8px;
            }

            .employee-calendar-layout {
              grid-template-columns: 1fr;
              gap: 8px;
            }

            .employee-calendar-side {
              order: -1;
              padding: 10px;
              border-radius: 14px;
            }

            .employee-calendar-summary-title {
              margin-bottom: 9px;
              font-size: 13px;
            }

            .employee-calendar-stat-grid {
              gap: 6px;
            }

            .employee-calendar-stat {
              padding: 8px;
              border-radius: 10px;
            }

            .employee-calendar-stat-label {
              font-size: 9px;
            }

            .employee-calendar-stat-value {
              margin-top: 2px;
              font-size: 17px;
            }

            .employee-calendar-metric {
              margin-top: 6px;
              padding: 8px;
              border-radius: 10px;
            }

            .employee-calendar-metric-row {
              gap: 6px;
              padding: 3px 0;
              font-size: 9px;
            }

            .employee-calendar-main {
              padding: 8px;
              border-radius: 14px;
            }

            .employee-calendar-monthbar {
              margin-bottom: 9px;
            }

            .employee-calendar-month {
              font-size: 15px;
            }

            .employee-calendar-nav {
              gap: 4px;
            }

            .employee-calendar-nav button {
              width: 32px;
              height: 32px;
              border-radius: 8px;
            }

            .employee-calendar-weekdays,
            .employee-calendar-grid {
              gap: 3px;
            }

            .employee-calendar-weekday {
              font-size: 8px;
              padding: 3px 0;
            }

            .employee-calendar-day {
              min-height: 50px;
              padding: 4px 3px;
              border-radius: 7px;
            }

            .employee-calendar-day-number {
              font-size: 9px;
              margin-bottom: 3px;
            }

            .employee-calendar-day-status {
              font-size: 6px;
              line-height: 1.15;
              padding: 3px 1px;
              border-radius: 5px;
              overflow: hidden;
              white-space: nowrap;
              text-overflow: ellipsis;
            }

            .employee-calendar-day-status svg {
              width: 7px;
              height: 7px;
              margin-right: 1px !important;
            }

            .employee-calendar-legend {
              grid-template-columns: 1fr 1fr;
              gap: 5px;
              margin-top: 10px;
              padding-top: 9px;
            }

            .employee-calendar-legend-item {
              gap: 5px;
              font-size: 8px;
            }

            .employee-calendar-dot {
              width: 7px;
              height: 7px;
            }

            .employee-calendar-details {
              margin-top: 10px;
              padding: 10px;
              border-radius: 13px;
            }

            .employee-calendar-details-title {
              margin-bottom: 9px;
              font-size: 12px;
            }

            .employee-calendar-details-grid {
              grid-template-columns: 1fr 1fr;
              gap: 6px;
            }

            .employee-calendar-detail-item {
              padding: 8px;
              border-radius: 9px;
            }

            .employee-calendar-detail-label {
              font-size: 8px;
              margin-bottom: 3px;
            }

            .employee-calendar-detail-value {
              font-size: 10px;
              word-break: break-word;
            }
          }        `}
      </style>

      <div
        className="employee-calendar-overlay"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="employee-calendar-modal">
          <div className="employee-calendar-header">
            <div className="employee-calendar-title-wrap">
              <div className="employee-calendar-icon">
                <CalendarDays size={22} />
              </div>

              <div>
                <h2 className="employee-calendar-title">
                  {employee.full_name || 'Employee'}
                </h2>

                <p className="employee-calendar-subtitle">
                  {employee.employee_id || '--'}  Monthly Attendance
                </p>
              </div>
            </div>

            <button
              type="button"
              className="employee-calendar-close"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>

          <div className="employee-calendar-body">
            {loading ? (
              <div className="employee-calendar-loading">
                Loading monthly attendance...
              </div>
            ) : error ? (
              <div className="employee-calendar-error">
                {error}
              </div>
            ) : (
              <>
                <div className="employee-calendar-layout">
                  <div className="employee-calendar-main">
                    <div className="employee-calendar-monthbar">
                      <div className="employee-calendar-month">
                        {new Date(
                          currentYear,
                          currentMonth,
                          1
                        ).toLocaleDateString('en-US', {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </div>

                      <div className="employee-calendar-nav">
                        <button
                          type="button"
                          onClick={() => changeMonth(-1)}
                          title="Previous month"
                        >
                          <ChevronLeft size={18} />
                        </button>

                        <button
                          type="button"
                          onClick={() => changeMonth(1)}
                          title="Next month"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="employee-calendar-weekdays">
                      {[
                        'Sun',
                        'Mon',
                        'Tue',
                        'Wed',
                        'Thu',
                        'Fri',
                        'Sat',
                      ].map((day) => (
                        <div
                          key={day}
                          className="employee-calendar-weekday"
                        >
                          {day}
                        </div>
                      ))}
                    </div>

                    <div className="employee-calendar-grid">
                      {calendarCells.map((cell, index) => {
                        if (!cell || 'empty' in cell) {
                          return (
                            <div
                              key={`empty-${index}`}
                              className="employee-calendar-day empty"
                            />
                          );
                        }

                        const info = getStatusInfo(
                          cell.status
                        );

                        const StatusIcon = info.icon;

                        return (
                          <button
                            key={cell.date || index}
                            type="button"
                            className="employee-calendar-day"
                            onClick={() =>
                              setSelectedDay(cell)
                            }
                            style={{
                              borderColor:
                                selectedDay?.date === cell.date
                                  ? '#E56108'
                                  : info.border,
                              boxShadow:
                                selectedDay?.date === cell.date
                                  ? '0 0 0 2px rgba(22,163,74,.12)'
                                  : undefined,
                            }}
                          >
                            <div className="employee-calendar-day-number">
                              {Number(
                                cell.date?.slice(-2)
                              )}
                            </div>

                            <div
                              className="employee-calendar-day-status"
                              style={{
                                color: info.color,
                                background: info.background,
                              }}
                            >
                              <StatusIcon
                                size={10}
                                style={{
                                  verticalAlign: 'middle',
                                  marginRight: 2,
                                }}
                              />
                              {info.label}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="employee-calendar-legend">
                      {[
                        ['#15803D', 'Present'],
                        ['#B91C1C', 'Absent'],
                        ['#1D4ED8', 'Working'],
                        ['#9A3412', 'Casual Leave'],
                        ['#6D28D9', 'Sick Leave'],
                        ['#4338CA', 'Personal Leave'],
                        ['#0F766E', 'Other Leave'],
                        ['#BE185D', 'Half Day'],
                        ['#0E7490', 'Holiday'],
                        ['#334155', 'Weekend'],
                        ['#64748B', 'Upcoming'],
                      ].map(([color, label]) => (
                        <div
                          key={label}
                          className="employee-calendar-legend-item"
                        >
                          <span
                            className="employee-calendar-dot"
                            style={{ background: color }}
                          />
                          {label}
                        </div>
                      ))}
                    </div>

                    {selectedDay && (
                      <div className="employee-calendar-details">
                        <h3 className="employee-calendar-details-title">
                          {selectedDay.date
                            ? new Date(
                                `${selectedDay.date}T00:00:00`
                              ).toLocaleDateString(
                                'en-US',
                                {
                                  weekday: 'long',
                                  day: '2-digit',
                                  month: 'long',
                                  year: 'numeric',
                                }
                              )
                            : 'Attendance Details'}
                        </h3>

                        <div className="employee-calendar-details-grid">
                          <div className="employee-calendar-detail-item">
                            <div className="employee-calendar-detail-label">
                              Status
                            </div>
                            <div className="employee-calendar-detail-value">
                              {
                                getStatusInfo(
                                  selectedDay.status
                                ).label
                              }
                            </div>
                          </div>

                          <div className="employee-calendar-detail-item">
                            <div className="employee-calendar-detail-label">
                              Check In
                            </div>
                            <div className="employee-calendar-detail-value">
                              {formatTime(
                                selectedDay.check_in ||
                                  selectedDay.check_in_time
                              )}
                            </div>
                          </div>

                          <div className="employee-calendar-detail-item">
                            <div className="employee-calendar-detail-label">
                              Check Out
                            </div>
                            <div className="employee-calendar-detail-value">
                              {formatTime(
                                selectedDay.check_out ||
                                  selectedDay.check_out_time
                              )}
                            </div>
                          </div>

                          <div className="employee-calendar-detail-item">
                            <div className="employee-calendar-detail-label">
                              Shift
                            </div>
                            <div className="employee-calendar-detail-value">
                              {selectedDay.shift_name || '--'}
                            </div>
                          </div>

                          <div className="employee-calendar-detail-item">
                            <div className="employee-calendar-detail-label">
                              Late
                            </div>
                            <div className="employee-calendar-detail-value">
                              {formatMinutes(
                                selectedDay.late_minutes
                              )}
                            </div>
                          </div>

                          <div className="employee-calendar-detail-item">
                            <div className="employee-calendar-detail-label">
                              Early Checkout
                            </div>
                            <div className="employee-calendar-detail-value">
                              {formatMinutes(
                                selectedDay.early_minutes
                              )}
                            </div>
                          </div>

                          <div className="employee-calendar-detail-item">
                            <div className="employee-calendar-detail-label">
                              Overtime
                            </div>
                            <div className="employee-calendar-detail-value">
                              {formatMinutes(
                                selectedDay.overtime_minutes
                              )}
                            </div>
                          </div>

                          <div className="employee-calendar-detail-item">
                            <div className="employee-calendar-detail-label">
                              Working
                            </div>
                            <div className="employee-calendar-detail-value">
                              {selectedDay.working_hours ||
                                formatMinutes(
                                  selectedDay.working_minutes
                                )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <aside className="employee-calendar-side">
                    <h3 className="employee-calendar-summary-title">
                      Monthly Summary
                    </h3>

                    <div className="employee-calendar-stat-grid">
                      <div className="employee-calendar-stat">
                        <div className="employee-calendar-stat-label">
                          Present
                        </div>
                        <div
                          className="employee-calendar-stat-value"
                          style={{ color: '#15803D' }}
                        >
                          {summary.present || 0}
                        </div>
                      </div>

                      <div className="employee-calendar-stat">
                        <div className="employee-calendar-stat-label">
                          Absent
                        </div>
                        <div
                          className="employee-calendar-stat-value"
                          style={{ color: '#B91C1C' }}
                        >
                          {summary.absent || 0}
                        </div>
                      </div>

                      <div className="employee-calendar-stat">
                        <div className="employee-calendar-stat-label">
                          Late Days
                        </div>
                        <div
                          className="employee-calendar-stat-value"
                          style={{ color: '#C2410C' }}
                        >
                          {summary.late_days || 0}
                        </div>
                      </div>
                      <div className="employee-calendar-stat">
                        <div className="employee-calendar-stat-label">
                          Holidays
                        </div>
                        <div
                          className="employee-calendar-stat-value"
                          style={{ color: '#0E7490' }}
                        >
                          {summary.holidays || 0}
                        </div>
                      </div>
                    </div>

                    <div className="employee-calendar-metric">
                      <div className="employee-calendar-metric-row">
                        <span>Total Late</span>
                        <span>{formatMinutes(summary.total_late_minutes)}</span>
                      </div>

                      <div className="employee-calendar-metric-row">
                        <span>Grace Used</span>
                        <span>
                          {summary.grace_used_count || 0} / {summary.grace_limit || 3} times
                          ({formatMinutes(summary.grace_used_minutes || 0)})
                        </span>
                      </div>

                      <div className="employee-calendar-metric-row">
                        <span>Permission Used</span>
                        <span>
                          {formatMinutes(summary.monthly_permission_used_minutes || 0)} / {formatMinutes(summary.monthly_permission_limit_minutes || 180)}
                        </span>
                      </div>

                      <div className="employee-calendar-metric-row">
                        <span>Permission Remaining</span>
                        <span>
                          {formatMinutes(summary.monthly_permission_remaining_minutes ?? 180)}
                        </span>
                      </div>

                      <div className="employee-calendar-metric-row">
                        <span>Overtime Days</span>
                        <span>{summary.overtime_days || 0}</span>
                      </div>

                      <div className="employee-calendar-metric-row">
                        <span>Total Overtime</span>
                        <span>{formatMinutes(summary.total_overtime_minutes)}</span>
                      </div>

                      <div className="employee-calendar-metric-row">
                        <span>Working Time</span>
                        <span>{formatMinutes(summary.total_working_minutes)}</span>
                      </div>
                    </div>
                  </aside>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default EmployeeMonthlyAttendanceModal;












