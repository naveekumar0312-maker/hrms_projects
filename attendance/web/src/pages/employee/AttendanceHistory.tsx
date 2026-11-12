import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  Clock3,
  XCircle,
  BriefcaseBusiness,
  Eye,
} from 'lucide-react';


import { getHistory } from '../../api/attendance';
import AttendanceDetailsModal from '../../components/employee/AttendanceDetailsModal';

interface AttendanceRecord {
  id: number;
  date?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  status?: string | null;
  approval_status?: string | null;
  late_minutes?: number | null;
  grace_used?: boolean;
  working_hours?: string | null;
}

const EmployeeAttendanceHistory: React.FC = () => {
  const today = new Date();

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedMonth, setSelectedMonth] = useState(
    today.getMonth() + 1
  );

  const [selectedYear] = useState(
    today.getFullYear()
  );

  const [selectedRecordId, setSelectedRecordId] =
    useState<number | null>(null);

  // Selected calendar date. Empty means show the full selected month.
  const [selectedDate, setSelectedDate] = useState<string>('');

  const [showMonthMenu, setShowMonthMenu] = useState(false);

  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  // =========================================================
  // FETCH HISTORY
  // =========================================================

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await getHistory(1);

      const data =
        response?.data?.results ||
        response?.data ||
        response ||
        [];

      setRecords(
        Array.isArray(data) ? data : []
      );
    } catch (err: any) {
      console.error(
        'Failed to fetch attendance history:',
        err
      );

      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.error ||
          'Unable to load attendance history.'
      );

      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // =========================================================
  // FILTER MONTH
  // =========================================================

  const monthRecords = useMemo(() => {
    return records
      .filter((record) => {
        if (!record.date) return false;

        const date = new Date(
          `${record.date}T00:00:00`
        );

        return (
          date.getMonth() + 1 === selectedMonth &&
          date.getFullYear() === selectedYear
        );
      })
      .sort((a, b) =>
        String(b.date || '').localeCompare(
          String(a.date || '')
        )
      );
  }, [
    records,
    selectedMonth,
    selectedYear,
  ]);

  // When a date is selected, show only that day's attendance.
  // When no date is selected, show the complete selected month.
  const visibleRecords = useMemo(() => {
    if (!selectedDate) {
      return monthRecords;
    }

    return monthRecords.filter(
      (record) => record.date === selectedDate
    );
  }, [monthRecords, selectedDate]);

  // =========================================================
  // SUMMARY
  // =========================================================

  const presentCount = visibleRecords.filter((record) => {
    const status = String(
      record.status || ''
    ).toUpperCase();

    return (
      status === 'PRESENT' ||
      status === 'ON_TIME' ||
      status === 'COMPLETED'
    );
  }).length;

  const lateCount = visibleRecords.filter(
    (record) =>
      String(
        record.status || ''
      ).toUpperCase() === 'LATE'
  ).length;

  const absentCount = visibleRecords.filter(
    (record) =>
      String(
        record.status || ''
      ).toUpperCase() === 'ABSENT'
  ).length;

  const workingCount = visibleRecords.filter(
    (record) => {
      const status = String(
        record.status || ''
      ).toUpperCase();

      return (
        status === 'WORKING' ||
        status === 'COMPLETED' ||
        status === 'ON_TIME' ||
        status === 'LATE'
      );
    }
  ).length;

  // =========================================================
  // DATE HELPERS
  // =========================================================

  const getDayNumber = (
    value?: string | null
  ) => {
    if (!value) return '--';

    const date = new Date(
      `${value}T00:00:00`
    );

    return Number.isNaN(date.getTime())
      ? '--'
      : date.getDate();
  };

  const getDayName = (
    value?: string | null
  ) => {
    if (!value) return '--';

    const date = new Date(
      `${value}T00:00:00`
    );

    return Number.isNaN(date.getTime())
      ? '--'
      : date.toLocaleDateString(
          'en-US',
          {
            weekday: 'short',
          }
        );
  };

  // =========================================================
  // TIME
  // =========================================================

  const formatTime = (
    value?: string | null
  ) => {
    if (!value) return '-- : --';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleTimeString(
      'en-US',
      {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }
    );
  };

  // =========================================================
  // WORKING HOURS
  // =========================================================

  const formatWorkingHours = (
    record: AttendanceRecord
  ) => {
    if (record.working_hours) {
      return record.working_hours;
    }

    const checkIn =
      record.check_in ||
      record.check_in_time;

    const checkOut =
      record.check_out ||
      record.check_out_time;

    if (!checkIn || !checkOut) {
      return '-- : --';
    }

    const start =
      new Date(checkIn).getTime();

    const end =
      new Date(checkOut).getTime();

    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      end <= start
    ) {
      return '-- : --';
    }

    const totalMinutes = Math.floor(
      (end - start) / 60000
    );

    const hours = Math.floor(
      totalMinutes / 60
    );

    const minutes =
      totalMinutes % 60;

    return `${String(hours).padStart(
      2,
      '0'
    )}h ${String(minutes).padStart(
      2,
      '0'
    )}m`;
  };

  // =========================================================
  // STATUS
  // =========================================================

  const getStatusStyle = (
    statusValue?: string | null
  ) => {
    const status = String(
      statusValue || ''
    ).toUpperCase();

    if (status === 'LATE') {
      return {
        label: 'Late',
        background: '#FFF7E8',
        color: '#D97706',
      };
    }

    if (status === 'ABSENT') {
      return {
        label: 'Absent',
        background: '#FEECEC',
        color: '#DC2626',
      };
    }

    if (status === 'WORKING') {
      return {
        label: 'Working',
        background: '#EAF4FF',
        color: '#2563EB',
      };
    }

    if (status === 'REJECTED') {
      return {
        label: 'Rejected',
        background: '#FEECEC',
        color: '#DC2626',
      };
    }

    return {
      label:
        status === 'COMPLETED'
          ? 'Completed'
          : 'Present',
      background: '#E5F8EF',
      color: '#E56108',
    };
  };

  // =========================================================
  // WEEK DATES
  // =========================================================

  const weekDates = useMemo(() => {
    const baseDate = new Date(
      selectedYear,
      selectedMonth - 1,
      1
    );

    const firstDay = new Date(baseDate);

    const day =
      firstDay.getDay();

    firstDay.setDate(
      firstDay.getDate() -
        (day === 0 ? 6 : day - 1)
    );

    return Array.from(
      { length: 7 },
      (_, index) => {
        const date = new Date(
          firstDay
        );

        date.setDate(
          firstDay.getDate() + index
        );

        return date;
      }
    );
  }, [
    selectedMonth,
    selectedYear,
  ]);

  const hasAttendance = (
    date: Date
  ) => {
    const dateString =
      `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, '0')}-${String(
        date.getDate()
      ).padStart(2, '0')}`;

    return monthRecords.some(
      (record) =>
        record.date === dateString
    );
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="attendance-history-page">

      <style>
        {`
          .attendance-history-page {
            min-height: 100%;
            background: #F5FBF7;
            padding: 24px;
          }

          .attendance-history-container {
            max-width: 1280px;
            margin: 0 auto;
          }

          .attendance-history-hero {
            position: relative;
            overflow: visible;
            background:
              linear-gradient(
                135deg,
                #CC5200 0%,
                #22A35A 48%,
                #65D58C 100%
              );
            border-radius: 24px;
            padding: 28px;
            color: white;
            box-shadow:
              0 14px 35px
              rgba(22, 163, 74, .15);
          }

          .attendance-history-hero::after {
            content: "";
            position: absolute;
            width: 280px;
            height: 280px;
            right: -100px;
            top: -130px;
            border-radius: 50%;
            background: rgba(255,255,255,.10);
          }

          .attendance-history-hero-content {
            position: relative;
            z-index: 1;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
          }

          .attendance-history-title {
            margin: 0;
            font-size: 30px;
            font-weight: 800;
            letter-spacing: -.03em;
          }

          .attendance-history-subtitle {
            margin: 7px 0 0;
            color: rgba(255,255,255,.84);
            font-size: 14px;
          }

          .attendance-month-wrapper {
            position: relative;
            z-index: 30;
          }

          .attendance-month-button {
            height: 48px;
            min-width: 205px;
            padding: 0 15px;
            border: 1px solid rgba(255,255,255,.65);
            border-radius: 13px;
            background: white;
            color: #163B27;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            font-size: 14px;
            font-weight: 750;
            cursor: pointer;
          }

          .attendance-month-menu {
            position: absolute;
            z-index: 100;
            right: 0;
            top: calc(100% + 8px);
            width: 220px;
            max-height: 300px;
            overflow-y: auto;
            padding: 7px;
            border-radius: 14px;
            background: white;
            border: 1px solid #DCEAE1;
            box-shadow:
              0 18px 45px
              rgba(15,23,42,.15);
          }

          .attendance-month-item {
            width: 100%;
            border: 0;
            background: transparent;
            padding: 10px 12px;
            border-radius: 9px;
            color: #475569;
            text-align: left;
            font-weight: 600;
            cursor: pointer;
          }

          .attendance-month-item:hover {
            background: #EAF8F0;
            color: #CC5200;
          }

          .attendance-week-card {
            margin-top: 18px;
            background: white;
            border: 1px solid #E1ECE5;
            border-radius: 19px;
            padding: 14px;
            display: grid;
            grid-template-columns:
              repeat(7, minmax(0, 1fr));
            gap: 8px;
            box-shadow:
              0 5px 18px
              rgba(15,23,42,.035);
          }

          .attendance-week-day {
            width: 100%;
            min-height: 70px;
            border: 1px solid transparent;
            border-radius: 13px;
            background: #F8FBF9;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            padding: 8px;
            font-family: inherit;
            font-size: inherit;
            cursor: pointer;
            appearance: none;
            -webkit-appearance: none;
          }

          .attendance-week-day.has-record {
            background: #EAF8F0;
            border-color: #D3EFDC;
          }

          .attendance-week-day:hover {
            background: #EAF8F0;
            border-color: #BFE8CC;
          }

          .attendance-week-day.selected {
            background: #CC5200;
            border-color: #CC5200;
            box-shadow: 0 5px 14px rgba(21, 128, 61, .22);
          }

          .attendance-week-day.selected .attendance-week-name,
          .attendance-week-day.selected .attendance-week-number {
            color: white;
          }

          .attendance-week-name {
            color: #94A3B8;
            font-size: 10px;
            font-weight: 750;
          }

          .attendance-week-number {
            color: #163B27;
            font-size: 17px;
            font-weight: 850;
          }

          .attendance-summary {
            margin-top: 18px;
            display: grid;
            grid-template-columns:
              repeat(4, minmax(0, 1fr));
            gap: 14px;
          }

          .attendance-summary-card {
            min-height: 138px;
            padding: 17px;
            border-radius: 18px;
            border: 1px solid #E0ECE4;
            background: white;
            box-shadow:
              0 5px 18px
              rgba(15,23,42,.035);
          }

          .attendance-summary-card.present {
            background: #EFFAF3;
          }

          .attendance-summary-card.late {
            background: #FFF9ED;
          }

          .attendance-summary-card.absent {
            background: #FFF4F4;
          }

          .attendance-summary-card.working {
            background: #EFF8F3;
          }

          .attendance-summary-icon {
            width: 38px;
            height: 38px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 11px;
          }

          .attendance-summary-label {
            color: #64748B;
            font-size: 12px;
            font-weight: 700;
          }

          .attendance-summary-value {
            margin-top: 3px;
            color: #163B27;
            font-size: 27px;
            font-weight: 850;
          }

          .attendance-content-card {
            margin-top: 18px;
            background: white;
            border: 1px solid #E1ECE5;
            border-radius: 20px;
            overflow: hidden;
            box-shadow:
              0 5px 20px
              rgba(15,23,42,.035);
          }

          .attendance-content-header {
            padding: 20px 22px;
            border-bottom: 1px solid #EEF3EF;
          }

          .attendance-content-title {
            margin: 0;
            color: #163B27;
            font-size: 19px;
            font-weight: 800;
          }

          .attendance-content-subtitle {
            margin: 4px 0 0;
            color: #8A978F;
            font-size: 12px;
          }

          .attendance-history-list {
            padding: 8px;
          }

          .attendance-history-row {
            display: grid;
            grid-template-columns:
              90px
              1fr
              1fr
              1fr
              110px
              48px;
            align-items: center;
            gap: 12px;
            padding: 13px 12px;
            border-bottom: 1px solid #F0F4F1;
          }

          .attendance-history-row:last-child {
            border-bottom: 0;
          }

          .attendance-history-row:hover {
            background: #FAFDFB;
          }

          .attendance-date-box {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background: #EAF8F0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }

          .attendance-date-number {
            color: #163B27;
            font-size: 17px;
            line-height: 1;
            font-weight: 850;
          }

          .attendance-date-day {
            margin-top: 3px;
            color: #6B7B71;
            font-size: 9px;
            font-weight: 700;
          }

          .attendance-column-label {
            display: none;
            color: #94A3B8;
            font-size: 10px;
            font-weight: 700;
            margin-bottom: 3px;
          }

          .attendance-value {
            color: #263A2E;
            font-size: 13px;
            font-weight: 700;
          }

          .attendance-status {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 80px;
            padding: 7px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 800;
          }

          .attendance-view-button {
            width: 34px;
            height: 34px;
            border: 0;
            border-radius: 9px;
            background: #EAF8F0;
            color: #CC5200;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }

          .attendance-view-button:hover {
            background: #D8F2E1;
          }

          .attendance-loading,
          .attendance-error,
          .attendance-empty {
            padding: 55px 20px;
            text-align: center;
            color: #7A8A80;
            font-size: 13px;
          }

          .attendance-error {
            color: #DC2626;
          }

          @media (max-width: 900px) {
            .attendance-summary {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .attendance-history-row {
              grid-template-columns:
                70px
                1fr
                1fr
                100px
                42px;
            }

            .attendance-history-row > :nth-child(4) {
              display: none;
            }
          }

          @media (max-width: 640px) {
            .attendance-history-page {
              padding: 14px;
            }

            .attendance-history-hero {
              padding: 21px;
              border-radius: 18px;
            }

            .attendance-history-hero-content {
              flex-direction: column;
              align-items: flex-start;
            }

            .attendance-history-title {
              font-size: 26px;
            }

            .attendance-month-wrapper,
            .attendance-month-button {
              width: 100%;
            }

            .attendance-month-menu {
              left: 0;
              right: auto;
              width: 100%;
            }

            .attendance-week-card {
              gap: 4px;
              padding: 8px;
            }

            .attendance-week-day {
              min-height: 62px;
            }

            .attendance-week-name {
              font-size: 8px;
            }

            .attendance-week-number {
              font-size: 14px;
            }

            .attendance-summary {
              grid-template-columns: 1fr 1fr;
              gap: 9px;
            }

            .attendance-summary-card {
              min-height: 120px;
              padding: 14px;
            }

            .attendance-summary-value {
              font-size: 23px;
            }

            .attendance-content-card {
              border-radius: 17px;
            }

            .attendance-history-row {
              grid-template-columns:
                55px
                1fr
                1fr
                42px;
              gap: 8px;
              padding: 12px 8px;
            }

            .attendance-history-row > :nth-child(4),
            .attendance-history-row > :nth-child(5) {
              display: none;
            }

            .attendance-column-label {
              display: block;
            }

            .attendance-value {
              font-size: 12px;
            }

            .attendance-date-box {
              width: 43px;
              height: 43px;
            }
          }
        `}
      </style>

      <div className="attendance-history-container">

        {/* HERO */}
        <section className="attendance-history-hero">
          <div className="attendance-history-hero-content">

            <div>
              <h1 className="attendance-history-title">
                Attendance
              </h1>

              <p className="attendance-history-subtitle">
                View your daily and past attendance records
              </p>
            </div>

            <div className="attendance-month-wrapper">

              <button
                type="button"
                className="attendance-month-button"
                onClick={() =>
                  setShowMonthMenu(
                    (value) => !value
                  )
                }
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <CalendarDays
                    size={18}
                    color="#CC5200"
                  />

                  {months[selectedMonth - 1]}{' '}
                  {selectedYear}
                </span>

                <ChevronDown size={18} />
              </button>

              {showMonthMenu && (
                <div className="attendance-month-menu">
                  {months.map(
                    (month, index) => (
                      <button
                        key={month}
                        type="button"
                        className="attendance-month-item"
                        onClick={() => {
                          setSelectedMonth(index + 1);
                          setSelectedDate('');
                          setShowMonthMenu(false);
                        }}
                      >
                        {month} {selectedYear}
                      </button>
                    )
                  )}
                </div>
              )}

            </div>

          </div>
        </section>

        {/* WEEK STRIP */}
        <div className="attendance-week-card">

          {weekDates.map((date) => {
            const dateString =
              `${date.getFullYear()}-${String(
                date.getMonth() + 1
              ).padStart(2, '0')}-${String(
                date.getDate()
              ).padStart(2, '0')}`;

            const isSelected = selectedDate === dateString;

            return (
              <button
                key={date.toISOString()}
                type="button"
                className={`attendance-week-day ${
                  hasAttendance(date)
                    ? 'has-record'
                    : ''
                } ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedDate(dateString);

                  // If the strip contains the adjacent month days
                  // (for example 28, 29, 30 before October 1),
                  // keep the selected month in sync.
                  if (date.getMonth() + 1 !== selectedMonth) {
                    setSelectedMonth(date.getMonth() + 1);
                  }
                }}
                aria-label={`View attendance for ${date.toLocaleDateString(
                  'en-US',
                  {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  }
                )}`}
              >
                <div className="attendance-week-name">
                  {date.toLocaleDateString(
                    'en-US',
                    {
                      weekday: 'short',
                    }
                  )}
                </div>

                <div className="attendance-week-number">
                  {date.getDate()}
                </div>
              </button>
            );
          })}

        </div>

        {selectedDate && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: 8,
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedDate('')}
              style={{
                border: 0,
                background: 'transparent',
                color: '#CC5200',
                fontSize: 12,
                fontWeight: 750,
                cursor: 'pointer',
                padding: '4px 6px',
              }}
            >
              Show full month
            </button>
          </div>
        )}

        {/* SUMMARY */}
        <section className="attendance-summary">

          <div className="attendance-summary-card present">

            <div
              className="attendance-summary-icon"
              style={{
                background: '#DDF5E6',
                color: '#E56108',
              }}
            >
              <CheckCircle2 size={20} />
            </div>

            <div className="attendance-summary-label">
              Present
            </div>

            <div className="attendance-summary-value">
              {presentCount}
            </div>

          </div>

          <div className="attendance-summary-card late">

            <div
              className="attendance-summary-icon"
              style={{
                background: '#FFF0C9',
                color: '#D97706',
              }}
            >
              <Clock3 size={20} />
            </div>

            <div className="attendance-summary-label">
              Late
            </div>

            <div className="attendance-summary-value">
              {lateCount}
            </div>

          </div>

          <div className="attendance-summary-card absent">

            <div
              className="attendance-summary-icon"
              style={{
                background: '#FFE0E0',
                color: '#DC2626',
              }}
            >
              <XCircle size={20} />
            </div>

            <div className="attendance-summary-label">
              Absent
            </div>

            <div className="attendance-summary-value">
              {absentCount}
            </div>

          </div>

          <div className="attendance-summary-card working">

            <div
              className="attendance-summary-icon"
              style={{
                background: '#DDF5E6',
                color: '#CC5200',
              }}
            >
              <BriefcaseBusiness size={20} />
            </div>

            <div className="attendance-summary-label">
              Working Days
            </div>

            <div className="attendance-summary-value">
              {workingCount}
            </div>

          </div>

        </section>

        {/* HISTORY */}
        <section className="attendance-content-card">

          <div className="attendance-content-header">

            <h2 className="attendance-content-title">
              Attendance History
            </h2>

            <p className="attendance-content-subtitle">
              {selectedDate
                ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
                    'en-US',
                    {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    }
                  )
                : `${months[selectedMonth - 1]} ${selectedYear}`}
              {' '}attendance details
            </p>

          </div>

          {loading ? (
            <div className="attendance-loading">
              Loading attendance records...
            </div>
          ) : error ? (
            <div className="attendance-error">
              {error}
            </div>
          ) : monthRecords.length === 0 ? (
            <div className="attendance-empty">
              No attendance records found for this period.
            </div>
          ) : (
            <div className="attendance-history-list">

              {/* HEADER */}
              <div
                className="attendance-history-row"
                style={{
                  background: '#F7FAF8',
                  borderRadius: 10,
                  color: '#7A8A80',
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                <div>Date</div>
                <div>Check In</div>
                <div>Check Out</div>
                <div>Working Hours</div>
                <div>Status</div>
                <div />
              </div>

              {visibleRecords.map(
                (record) => {
                  const status =
                    getStatusStyle(
                      record.status
                    );

                  return (
                    <div
                      className="attendance-history-row"
                      key={record.id}
                    >

                      <div>
                        <div className="attendance-date-box">
                          <div className="attendance-date-number">
                            {getDayNumber(
                              record.date
                            )}
                          </div>

                          <div className="attendance-date-day">
                            {getDayName(
                              record.date
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="attendance-column-label">
                          Check In
                        </div>

                        <div className="attendance-value">
                          {formatTime(
                            record.check_in ||
                              record.check_in_time
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="attendance-column-label">
                          Check Out
                        </div>

                        <div className="attendance-value">
                          {formatTime(
                            record.check_out ||
                              record.check_out_time
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="attendance-column-label">
                          Working Hours
                        </div>

                        <div className="attendance-value">
                          {formatWorkingHours(
                            record
                          )}
                        </div>
                      </div>

                      <div>
                        <span
                          className="attendance-status"
                          style={{
                            background:
                              status.background,
                            color:
                              status.color,
                          }}
                        >
                          {status.label}
                        </span>
                      </div>

                      <div>
                        <button
                          type="button"
                          className="attendance-view-button"
                          title="View Details"
                          onClick={() =>
                            setSelectedRecordId(
                              record.id
                            )
                          }
                        >
                          <Eye size={17} />
                        </button>
                      </div>

                    </div>
                  );
                }
              )}

            </div>
          )}

        </section>

      </div>

      {/* DETAILS MODAL */}
      {selectedRecordId !== null && (
        <AttendanceDetailsModal
          isOpen={true}
          recordId={selectedRecordId}
          onClose={() =>
            setSelectedRecordId(null)
          }
        />
      )}

    </div>
  );
};

export default EmployeeAttendanceHistory;


