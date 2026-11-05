import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Clock3,
  CheckCircle2,
  XCircle,
  BriefcaseBusiness,
  BarChart3,
} from 'lucide-react';

import api from '../../api';
import AttendanceDetailsModal from '../../components/employee/AttendanceDetailsModal';
import { CustomDatePicker } from '../../components/CustomDatePicker';

type ReportMode =
  | 'monthly'
  | 'weekly'
  | 'custom';

interface AttendanceRecord {
  id?: number;

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

interface ReportData {
  present?: number;
  late?: number;
  absent?: number;
  working_days?: number;

  total_present?: number;
  total_late?: number;
  total_absent?: number;
  total_working_days?: number;

  calendar?: AttendanceRecord[];

  records?: AttendanceRecord[];
  attendance?: AttendanceRecord[];
  data?: AttendanceRecord[];
  results?: AttendanceRecord[];
}

const Reports: React.FC = () => {
  const now = new Date();

  const [selectedMonth, setSelectedMonth] =
    useState(now.getMonth() + 1);

  const [selectedYear] =
    useState(now.getFullYear());

  const [mode, setMode] =
    useState<ReportMode>('monthly');

  const [report, setReport] =
    useState<ReportData | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [selectedRecordId, setSelectedRecordId] =
    useState<number | null>(null);

  const [customStart, setCustomStart] =
    useState('');

  const [customEnd, setCustomEnd] =
    useState('');

  const [weekOffset, setWeekOffset] =
    useState(0);

  const [monthMenuOpen, setMonthMenuOpen] =
    useState(false);

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
  // NORMALIZE API RESPONSE
  // =========================================================

  const normalizeReportResponse = (
    response: any
  ): ReportData => {
    const root =
      response?.data &&
      !Array.isArray(response.data)
        ? response.data
        : response;

    const nested =
      root?.data &&
      !Array.isArray(root.data)
        ? root.data
        : {};

    const summary =
      root?.summary ||
      root?.stats ||
      root?.statistics ||
      nested?.summary ||
      nested?.stats ||
      nested?.statistics ||
      {};

    /*
      IMPORTANT:
      Backend currently returns:

      {
        calendar: [...],
        summary: {
          present,
          absent,
          late,
          working_days
        }
      }

      So calendar MUST be checked first.
    */

    const rawRecords =
      root?.calendar ||
      root?.records ||
      root?.attendance ||
      root?.results ||
      nested?.calendar ||
      nested?.records ||
      nested?.attendance ||
      nested?.results ||
      (
        Array.isArray(root?.data)
          ? root.data
          : []
      );

    const records: AttendanceRecord[] =
      Array.isArray(rawRecords)
        ? rawRecords
        : [];

    return {
      present:
        typeof root?.present === 'number'
          ? root.present
          : typeof root?.total_present === 'number'
          ? root.total_present
          : typeof summary?.present === 'number'
          ? summary.present
          : typeof summary?.total_present === 'number'
          ? summary.total_present
          : undefined,

      late:
        typeof root?.late === 'number'
          ? root.late
          : typeof root?.total_late === 'number'
          ? root.total_late
          : typeof summary?.late === 'number'
          ? summary.late
          : typeof summary?.total_late === 'number'
          ? summary.total_late
          : undefined,

      absent:
        typeof root?.absent === 'number'
          ? root.absent
          : typeof root?.total_absent === 'number'
          ? root.total_absent
          : typeof summary?.absent === 'number'
          ? summary.absent
          : typeof summary?.total_absent === 'number'
          ? summary.total_absent
          : undefined,

      working_days:
        typeof root?.working_days === 'number'
          ? root.working_days
          : typeof root?.total_working_days === 'number'
          ? root.total_working_days
          : typeof summary?.working_days === 'number'
          ? summary.working_days
          : typeof summary?.total_working_days === 'number'
          ? summary.total_working_days
          : undefined,

      calendar: records,
      records,
    };
  };

  // =========================================================
  // FETCH REPORT
  // =========================================================

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError('');

      const params =
        new URLSearchParams();

      if (mode === 'monthly') {
        params.set(
          'month',
          selectedMonth.toString()
        );

        params.set(
          'year',
          selectedYear.toString()
        );
      }

      if (mode === 'weekly') {
        params.set(
          'period',
          'weekly'
        );

        params.set(
          'week_offset',
          weekOffset.toString()
        );
      }

      if (mode === 'custom') {
        if (!customStart || !customEnd) {
          setLoading(false);
          return;
        }

        params.set(
          'start_date',
          customStart
        );

        params.set(
          'end_date',
          customEnd
        );

        params.set(
          'period',
          'custom'
        );
      }

      const response = await api.get(
        `/attendance/reports/?${params.toString()}`
      );

      const normalized =
        normalizeReportResponse(
          response.data
        );

      setReport(normalized);

    } catch (err: any) {
      console.error(
        'Failed to fetch reports:',
        err?.response?.data || err
      );

      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Unable to load attendance reports.'
      );

      setReport(null);

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (
      mode === 'custom' &&
      (!customStart || !customEnd)
    ) {
      return;
    }

    fetchReport();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedMonth,
    selectedYear,
    mode,
    weekOffset,
    customStart,
    customEnd,
  ]);

  // =========================================================
  // RECORDS
  // =========================================================

  const records = useMemo(() => {
    if (!report) {
      return [];
    }

    const list =
      report.calendar ||
      report.records ||
      report.attendance ||
      report.data ||
      report.results ||
      [];

    return Array.isArray(list)
      ? list
      : [];
  }, [report]);

  // =========================================================
  // COUNTS
  // =========================================================

  const presentCount = useMemo(() => {
    if (
      typeof report?.present ===
      'number'
    ) {
      return report.present;
    }

    if (
      typeof report?.total_present ===
      'number'
    ) {
      return report.total_present;
    }

    return records.filter(
      (record) => {
        const status =
          String(
            record.status || ''
          ).toUpperCase();

        return (
          status === 'PRESENT' ||
          status === 'ON_TIME' ||
          status === 'COMPLETED'
        );
      }
    ).length;

  }, [report, records]);

  const lateCount = useMemo(() => {
    if (
      typeof report?.late ===
      'number'
    ) {
      return report.late;
    }

    if (
      typeof report?.total_late ===
      'number'
    ) {
      return report.total_late;
    }

    return records.filter(
      (record) =>
        String(
          record.status || ''
        ).toUpperCase() === 'LATE'
    ).length;

  }, [report, records]);

  const absentCount = useMemo(() => {
    if (
      typeof report?.absent ===
      'number'
    ) {
      return report.absent;
    }

    if (
      typeof report?.total_absent ===
      'number'
    ) {
      return report.total_absent;
    }

    return records.filter(
      (record) =>
        String(
          record.status || ''
        ).toUpperCase() === 'ABSENT'
    ).length;

  }, [report, records]);

  const workingDays = useMemo(() => {
    if (
      typeof report?.working_days ===
      'number'
    ) {
      return report.working_days;
    }

    if (
      typeof report?.total_working_days ===
      'number'
    ) {
      return report.total_working_days;
    }

    return presentCount + lateCount;

  }, [
    report,
    presentCount,
    lateCount,
  ]);

  const totalAttendanceDays =
    presentCount +
    lateCount +
    absentCount;

  const presentPercentage =
    totalAttendanceDays > 0
      ? Math.round(
          (presentCount /
            totalAttendanceDays) *
            100
        )
      : 0;

  const latePercentage =
    totalAttendanceDays > 0
      ? Math.round(
          (lateCount /
            totalAttendanceDays) *
            100
        )
      : 0;

  const absentPercentage =
    totalAttendanceDays > 0
      ? Math.round(
          (absentCount /
            totalAttendanceDays) *
            100
        )
      : 0;

  // =========================================================
  // DATE FORMAT
  // =========================================================

  const formatDate = (
    dateValue?: string | null
  ) => {
    if (!dateValue) {
      return '--';
    }

    const date = new Date(
      `${dateValue}T00:00:00`
    );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return dateValue;
    }

    return date.toLocaleDateString(
      'en-US',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    );
  };

  const getDayNumber = (
    dateValue?: string | null
  ) => {
    if (!dateValue) {
      return '--';
    }

    const date = new Date(
      `${dateValue}T00:00:00`
    );

    return Number.isNaN(
      date.getTime()
    )
      ? '--'
      : date.getDate();
  };

  const getDayName = (
    dateValue?: string | null
  ) => {
    if (!dateValue) {
      return '--';
    }

    const date = new Date(
      `${dateValue}T00:00:00`
    );

    return Number.isNaN(
      date.getTime()
    )
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
    if (!value) {
      return '-- : --';
    }

    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
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

    if (
      !checkIn ||
      !checkOut
    ) {
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

    const totalMinutes =
      Math.floor(
        (end - start) / 60000
      );

    const hours =
      Math.floor(
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

  const getStatus = (
    record: AttendanceRecord
  ) => {
    const status =
      String(
        record.status || ''
      ).toUpperCase();

    if (status === 'HOLIDAY') {
      return {
        label: 'Holiday',
        bg: '#E6F8FC',
        color: '#0891B2',
      };
    }

    if (status === 'ON_LEAVE' || status === 'ON LEAVE') {
      return {
        label: 'On Leave',
        bg: '#FEF3C7',
        color: '#D97706',
      };
    }

    if (status === 'HALF DAY' || status === 'HALF_DAY') {
      return {
        label: 'Half Day',
        bg: '#FEF3C7',
        color: '#D97706',
      };
    }

    if (status === 'WEEKLY_OFF' || status === 'WEEKEND') {
      return {
        label: 'Weekly Off',
        bg: '#EFF6FF',
        color: '#2563EB',
      };
    }

    if (status === 'LATE') {
      return {
        label: 'Late',
        bg: '#FFF7E6',
        color: '#D97706',
      };
    }

    if (status === 'ABSENT') {
      return {
        label: 'Absent',
        bg: '#FEF2F2',
        color: '#DC2626',
      };
    }

    if (status === 'WORKING') {
      return {
        label: 'Working',
        bg: '#EFF6FF',
        color: '#2563EB',
      };
    }

    if (
      status === 'REJECTED'
    ) {
      return {
        label: 'Rejected',
        bg: '#FEF2F2',
        color: '#DC2626',
      };
    }

    if (
      status === 'COMPLETED' ||
      status === 'ON_TIME' ||
      status === 'PRESENT'
    ) {
      return {
        label: 'Present',
        bg: '#EAF8F0',
        color: '#16A34A',
      };
    }

    return {
      label:
        status || 'Absent',
      bg: '#F8FAFC',
      color: '#64748B',
    };
  };

  // =========================================================
  // CHART
  // =========================================================

  const chartRecords =
    useMemo(() => {
      return [...records]
        .sort((a, b) =>
          String(
            a.date || ''
          ).localeCompare(
            String(
              b.date || ''
            )
          )
        )
        .slice(-31);

    }, [records]);

  const getBarHeight = (
    record: AttendanceRecord
  ) => {
    const status =
      String(
        record.status || ''
      ).toUpperCase();

    if (
      status === 'ABSENT'
    ) {
      return 28;
    }

    if (
      status === 'LATE'
    ) {
      return 48;
    }

    if (
      status === 'WORKING'
    ) {
      return 62;
    }

    return 78;
  };

  // =========================================================
  // WEEK LABEL
  // =========================================================

  const currentWeekLabel =
    useMemo(() => {
      const base =
        new Date();

      base.setDate(
        base.getDate() +
          weekOffset * 7
      );

      const day =
        base.getDay();

      const monday =
        new Date(base);

      monday.setDate(
        base.getDate() -
          (
            day === 0
              ? 6
              : day - 1
          )
      );

      const sunday =
        new Date(monday);

      sunday.setDate(
        monday.getDate() + 6
      );

      return `${monday.toLocaleDateString(
        'en-US',
        {
          day: '2-digit',
          month: 'short',
        }
      )} - ${sunday.toLocaleDateString(
        'en-US',
        {
          day: '2-digit',
          month: 'short',
        }
      )}`;
    }, [weekOffset]);

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div
      style={{
        minHeight: '100%',
        background: '#F5FBF7',
      }}
    >
      <style>
        {`
          .reports-page {
            width: 100%;
            max-width: 1280px;
            margin: 0 auto;
            padding: 24px;
          }

          .reports-hero {
            position: relative;
            overflow: visible;
            background:
              linear-gradient(
                135deg,
                #15803D 0%,
                #22A35A 45%,
                #4CCB7A 100%
              );
            border-radius: 24px;
            padding: 30px;
            color: white;
            box-shadow:
              0 14px 35px
              rgba(22, 163, 74, 0.18);
          }

          .reports-hero-content {
            position: relative;
            z-index: 1;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
          }

          .reports-title {
            margin: 0;
            font-size: 30px;
            font-weight: 800;
            letter-spacing: -0.03em;
          }

          .reports-subtitle {
            margin: 7px 0 0;
            color: rgba(255,255,255,.82);
            font-size: 14px;
          }

          .reports-month-wrapper {
            position: relative;
          }

          .reports-month-button {
            min-width: 210px;
            height: 48px;
            padding: 0 16px;
            border: 1px solid rgba(255,255,255,.65);
            border-radius: 14px;
            background: rgba(255,255,255,.97);
            color: #163B27;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            font-size: 14px;
            font-weight: 750;
            cursor: pointer;
          }

          .reports-month-menu {
            position: absolute;
            right: 0;
            top: 56px;
            z-index: 100;
            width: 230px;
            max-height: 300px;
            overflow-y: auto;
            padding: 7px;
            background: white;
            border: 1px solid #DDECE2;
            border-radius: 14px;
            box-shadow:
              0 18px 45px
              rgba(15, 23, 42, .15);
          }

          .reports-month-item {
            width: 100%;
            border: 0;
            background: transparent;
            padding: 11px 12px;
            border-radius: 10px;
            text-align: left;
            cursor: pointer;
            color: #334155;
            font-weight: 600;
          }

          .reports-month-item:hover,
          .reports-month-item.active {
            background: #EAF8F0;
            color: #15803D;
          }

          .reports-content {
            margin-top: 18px;
          }

          .reports-tabs {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 5px;
            padding: 5px;
            background: #EAF5ED;
            border-radius: 14px;
            margin-bottom: 18px;
          }

          .reports-tab {
            height: 44px;
            border: 0;
            border-radius: 11px;
            background: transparent;
            color: #64748B;
            font-size: 14px;
            font-weight: 750;
            cursor: pointer;
          }

          .reports-tab.active {
            background: #FFFFFF;
            color: #15803D;
            box-shadow:
              0 3px 12px
              rgba(22, 101, 52, .10);
          }

          .reports-custom {
            display: grid;
            grid-template-columns: 1fr 1fr auto;
            gap: 12px;
            align-items: end;
            margin-bottom: 18px;
          }

          .reports-input-group label {
            display: block;
            color: #64748B;
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 6px;
          }

          .reports-input {
            width: 100%;
            height: 44px;
            padding: 0 12px;
            border: 1px solid #DDE8E0;
            border-radius: 11px;
            background: white;
            color: #17233D;
            outline: none;
          }

          .reports-input:focus {
            border-color: #22A35A;
            box-shadow:
              0 0 0 3px
              rgba(34,163,90,.10);
          }

          .reports-week-control {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 18px;
            padding: 11px 14px;
            background: white;
            border: 1px solid #E1ECE5;
            border-radius: 14px;
          }

          .reports-week-button {
            width: 36px;
            height: 36px;
            border: 1px solid #DCE8DF;
            background: white;
            border-radius: 10px;
            color: #15803D;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }

          .reports-week-label {
            color: #163B27;
            font-size: 14px;
            font-weight: 800;
          }

          .reports-summary {
            display: grid;
            grid-template-columns:
              repeat(4, minmax(0, 1fr));
            gap: 14px;
          }

          .reports-summary-card {
            min-height: 142px;
            padding: 18px;
            border-radius: 18px;
            border: 1px solid #E1EEE5;
            background: white;
            box-shadow:
              0 5px 18px
              rgba(15, 23, 42, .04);
          }

          .reports-summary-card.present {
            background: #EFFAF3;
          }

          .reports-summary-card.late {
            background: #FFF9ED;
          }

          .reports-summary-card.absent {
            background: #FFF4F4;
          }

          .reports-summary-card.working {
            background: #EFF8F3;
          }

          .reports-summary-icon {
            width: 38px;
            height: 38px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 12px;
          }

          .reports-summary-label {
            color: #64748B;
            font-size: 12px;
            font-weight: 700;
          }

          .reports-summary-value {
            margin-top: 3px;
            color: #163B27;
            font-size: 27px;
            line-height: 1;
            font-weight: 850;
          }

          .reports-summary-percent {
            margin-top: 7px;
            color: #7A8A80;
            font-size: 11px;
            font-weight: 600;
          }

          .reports-card {
            margin-top: 18px;
            background: white;
            border: 1px solid #E3ECE6;
            border-radius: 20px;
            box-shadow:
              0 5px 20px
              rgba(15,23,42,.035);
            overflow: hidden;
          }

          .reports-card-header {
            padding: 20px 22px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
          }

          .reports-card-title {
            margin: 0;
            color: #163B27;
            font-size: 18px;
            font-weight: 800;
          }

          .reports-card-subtitle {
            margin: 4px 0 0;
            color: #8A978F;
            font-size: 12px;
          }

          .reports-legend {
            display: flex;
            align-items: center;
            gap: 16px;
            flex-wrap: wrap;
          }

          .reports-legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
            color: #64748B;
            font-size: 12px;
            font-weight: 650;
          }

          .reports-dot {
            width: 9px;
            height: 9px;
            border-radius: 50%;
          }

          .reports-chart {
            min-height: 220px;
            padding: 15px 22px 25px;
            display: flex;
            align-items: flex-end;
            gap: 8px;
            overflow-x: auto;
          }

          .reports-chart-column {
            min-width: 22px;
            height: 190px;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            align-items: center;
            gap: 7px;
          }

          .reports-chart-bar-wrap {
            width: 18px;
            height: 160px;
            display: flex;
            align-items: flex-end;
          }

          .reports-chart-bar {
            width: 100%;
            border-radius: 6px 6px 3px 3px;
            min-height: 8px;
          }

          .reports-chart-date {
            color: #94A3B8;
            font-size: 10px;
            font-weight: 700;
          }

          .reports-empty-chart {
            width: 100%;
            min-height: 180px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #94A3B8;
            font-size: 13px;
          }

          .reports-table-wrap {
            overflow-x: auto;
          }

          .reports-table {
            width: 100%;
            border-collapse: collapse;
            min-width: 720px;
          }

          .reports-table th {
            padding: 13px 20px;
            background: #F7FAF8;
            color: #7A8A80;
            font-size: 11px;
            font-weight: 800;
            text-align: left;
            white-space: nowrap;
          }

          .reports-table td {
            padding: 14px 20px;
            border-top: 1px solid #EEF3EF;
            color: #24372C;
            font-size: 13px;
            font-weight: 650;
            white-space: nowrap;
          }

          .reports-date-box {
            width: 45px;
            height: 45px;
            border-radius: 11px;
            background: #F2F8F4;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }

          .reports-date-number {
            color: #163B27;
            font-size: 16px;
            line-height: 1;
            font-weight: 850;
          }

          .reports-date-day {
            margin-top: 3px;
            color: #7A8A80;
            font-size: 9px;
            font-weight: 700;
          }

          .reports-status {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 82px;
            padding: 7px 11px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 800;
          }

          .reports-view-button {
            width: 34px;
            height: 34px;
            border: 0;
            background: #F0F8F3;
            color: #15803D;
            border-radius: 9px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }

          .reports-view-button:hover {
            background: #DDF3E5;
          }

          .reports-loading,
          .reports-error,
          .reports-empty {
            min-height: 160px;
            padding: 55px 20px;
            text-align: center;
            color: #7A8A80;
            font-size: 13px;
          }

          .reports-error {
            color: #DC2626;
          }

          @media (max-width: 900px) {
            .reports-summary {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .reports-hero-content {
              align-items: flex-start;
              flex-direction: column;
            }

            .reports-month-button {
              width: 100%;
            }

            .reports-month-wrapper {
              width: 100%;
            }

            .reports-month-menu {
              left: 0;
              right: auto;
              width: 100%;
            }
          }

          @media (max-width: 640px) {
            .reports-page {
              padding: 14px;
            }

            .reports-hero {
              padding: 22px;
              border-radius: 19px;
            }

            .reports-title {
              font-size: 26px;
            }

            .reports-summary {
              grid-template-columns: 1fr 1fr;
              gap: 9px;
            }

            .reports-summary-card {
              min-height: 125px;
              padding: 14px;
            }

            .reports-summary-value {
              font-size: 23px;
            }

            .reports-tabs {
              grid-template-columns: 1fr;
            }

            .reports-custom {
              grid-template-columns: 1fr;
            }

            .reports-card {
              border-radius: 17px;
            }

            .reports-card-header {
              padding: 17px;
              align-items: flex-start;
              flex-direction: column;
            }

            .reports-legend {
              gap: 10px;
            }

            .reports-chart {
              padding-left: 15px;
              padding-right: 15px;
            }
          }
        `}
      </style>

      <div className="reports-page">

        {/* HERO */}

        <section className="reports-hero">

          <div className="reports-hero-content">

            <div>
              <h1 className="reports-title">
                Reports
              </h1>

              <p className="reports-subtitle">
                View your attendance reports
              </p>
            </div>

            <div className="reports-month-wrapper">

              <button
                type="button"
                className="reports-month-button"
                onClick={() =>
                  setMonthMenuOpen(
                    value => !value
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
                    size={19}
                    color="#15803D"
                  />

                  {months[
                    selectedMonth - 1
                  ]}{' '}
                  {selectedYear}
                </span>

                <ChevronDown
                  size={18}
                />
              </button>

              {monthMenuOpen && (
                <div className="reports-month-menu">

                  {months.map(
                    (
                      month,
                      index
                    ) => (
                      <button
                        key={month}
                        type="button"
                        className={`reports-month-item ${
                          selectedMonth ===
                          index + 1
                            ? 'active'
                            : ''
                        }`}
                        onClick={() => {
                          setSelectedMonth(
                            index + 1
                          );

                          setMonthMenuOpen(
                            false
                          );
                        }}
                      >
                        {month}{' '}
                        {selectedYear}
                      </button>
                    )
                  )}

                </div>
              )}

            </div>

          </div>

        </section>

        <div className="reports-content">

          {/* TABS */}

          <div className="reports-tabs">

            <button
              type="button"
              className={`reports-tab ${
                mode === 'monthly'
                  ? 'active'
                  : ''
              }`}
              onClick={() => {
                setMode('monthly');
                setWeekOffset(0);
              }}
            >
              Monthly
            </button>

            <button
              type="button"
              className={`reports-tab ${
                mode === 'weekly'
                  ? 'active'
                  : ''
              }`}
              onClick={() => {
                setMode('weekly');
              }}
            >
              Weekly
            </button>

            <button
              type="button"
              className={`reports-tab ${
                mode === 'custom'
                  ? 'active'
                  : ''
              }`}
              onClick={() => {
                setMode('custom');
              }}
            >
              Custom Range
            </button>

          </div>

          {/* WEEK CONTROL */}

          {mode === 'weekly' && (
            <div className="reports-week-control">

              <button
                type="button"
                className="reports-week-button"
                onClick={() =>
                  setWeekOffset(
                    value =>
                      value - 1
                  )
                }
                aria-label="Previous week"
              >
                <ChevronLeft
                  size={18}
                />
              </button>

              <div className="reports-week-label">
                {currentWeekLabel}
              </div>

              <button
                type="button"
                className="reports-week-button"
                onClick={() =>
                  setWeekOffset(
                    value =>
                      value + 1
                  )
                }
                aria-label="Next week"
              >
                <ChevronRight
                  size={18}
                />
              </button>

            </div>
          )}

          {/* CUSTOM RANGE */}

          {mode === 'custom' && (
            <div className="reports-custom">

              <div className="reports-input-group">
                <CustomDatePicker
                  label="Start Date"
                  value={customStart}
                  onChange={setCustomStart}
                  maxDate={customEnd || undefined}
                />
              </div>

              <div className="reports-input-group">
                <CustomDatePicker
                  label="End Date"
                  value={customEnd}
                  onChange={setCustomEnd}
                  minDate={customStart || undefined}
                />
              </div>

              <div />

            </div>
          )}

          {/* SUMMARY */}

          <section className="reports-summary">

            <div className="reports-summary-card present">

              <div
                className="reports-summary-icon"
                style={{
                  background:
                    '#DDF5E6',
                  color:
                    '#16A34A',
                }}
              >
                <CheckCircle2
                  size={20}
                />
              </div>

              <div className="reports-summary-label">
                Present
              </div>

              <div className="reports-summary-value">
                {presentCount}
              </div>

              <div className="reports-summary-percent">
                {presentPercentage}%
                attendance
              </div>

            </div>

            <div className="reports-summary-card late">

              <div
                className="reports-summary-icon"
                style={{
                  background:
                    '#FFF0C9',
                  color:
                    '#D97706',
                }}
              >
                <Clock3
                  size={20}
                />
              </div>

              <div className="reports-summary-label">
                Late
              </div>

              <div className="reports-summary-value">
                {lateCount}
              </div>

              <div className="reports-summary-percent">
                {latePercentage}%
                attendance
              </div>

            </div>

            <div className="reports-summary-card absent">

              <div
                className="reports-summary-icon"
                style={{
                  background:
                    '#FFE0E0',
                  color:
                    '#DC2626',
                }}
              >
                <XCircle
                  size={20}
                />
              </div>

              <div className="reports-summary-label">
                Absent
              </div>

              <div className="reports-summary-value">
                {absentCount}
              </div>

              <div className="reports-summary-percent">
                {absentPercentage}%
                attendance
              </div>

            </div>

            <div className="reports-summary-card working">

              <div
                className="reports-summary-icon"
                style={{
                  background:
                    '#DDF5E6',
                  color:
                    '#15803D',
                }}
              >
                <BriefcaseBusiness
                  size={20}
                />
              </div>

              <div className="reports-summary-label">
                Working Days
              </div>

              <div className="reports-summary-value">
                {workingDays}
              </div>

              <div className="reports-summary-percent">
                {mode === 'weekly'
                  ? currentWeekLabel
                  : mode === 'custom'
                  ? customStart &&
                    customEnd
                    ? `${formatDate(customStart)} - ${formatDate(customEnd)}`
                    : 'Select date range'
                  : `${months[selectedMonth - 1]} ${selectedYear}`}
              </div>

            </div>

          </section>

          {/* ATTENDANCE OVERVIEW */}

          <section className="reports-card">

            <div className="reports-card-header">

              <div>
                <h2 className="reports-card-title">
                  Attendance Overview
                </h2>

                <p className="reports-card-subtitle">
                  Daily attendance performance
                </p>
              </div>

              <div className="reports-legend">

                <div className="reports-legend-item">
                  <span
                    className="reports-dot"
                    style={{
                      background:
                        '#22A35A',
                    }}
                  />
                  Present
                </div>

                <div className="reports-legend-item">
                  <span
                    className="reports-dot"
                    style={{
                      background:
                        '#F59E0B',
                    }}
                  />
                  Late
                </div>

                <div className="reports-legend-item">
                  <span
                    className="reports-dot"
                    style={{
                      background:
                        '#EF4444',
                    }}
                  />
                  Absent
                </div>

              </div>

            </div>

            {loading ? (

              <div className="reports-loading">
                Loading attendance overview...
              </div>

            ) : chartRecords.length === 0 ? (

              <div className="reports-empty-chart">
                No attendance data available.
              </div>

            ) : (

              <div className="reports-chart">

                {chartRecords.map(
                  (
                    record,
                    index
                  ) => {

                    const status =
                      getStatus(
                        record
                      );

                    let barColor =
                      '#22A35A';

                    if (
                      status.label ===
                      'Late'
                    ) {
                      barColor =
                        '#F59E0B';
                    }

                    if (
                      status.label ===
                      'Absent'
                    ) {
                      barColor =
                        '#EF4444';
                    }

                    return (
                      <div
                        key={
                          record.id ??
                          `${record.date}-${index}`
                        }
                        className="reports-chart-column"
                        title={`${formatDate(
                          record.date
                        )} - ${
                          status.label
                        }`}
                      >

                        <div className="reports-chart-bar-wrap">

                          <div
                            className="reports-chart-bar"
                            style={{
                              height:
                                `${getBarHeight(
                                  record
                                )}%`,
                              background:
                                barColor,
                            }}
                          />

                        </div>

                        <span className="reports-chart-date">
                          {getDayNumber(
                            record.date
                          )}
                        </span>

                      </div>
                    );
                  }
                )}

              </div>
            )}

          </section>

          {/* DAILY ATTENDANCE DETAILS */}

          <section className="reports-card">

            <div className="reports-card-header">

              <div>
                <h2 className="reports-card-title">
                  Daily Attendance Details
                </h2>

                <p className="reports-card-subtitle">
                  Detailed attendance records
                </p>
              </div>

              <BarChart3
                size={21}
                color="#15803D"
              />

            </div>

            {loading ? (

              <div className="reports-loading">
                Loading attendance details...
              </div>

            ) : error ? (

              <div className="reports-error">
                {error}
              </div>

            ) : records.length === 0 ? (

              <div className="reports-empty">
                No attendance records found
                for this period.
              </div>

            ) : (

              <div className="reports-table-wrap">

                <table className="reports-table">

                  <thead>

                    <tr>

                      <th>
                        Date
                      </th>

                      <th>
                        Check In
                      </th>

                      <th>
                        Check Out
                      </th>

                      <th>
                        Working Hours
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        View
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {[...records]
                      .sort(
                        (a, b) =>
                          String(
                            b.date || ''
                          ).localeCompare(
                            String(
                              a.date || ''
                            )
                          )
                      )
                      .map(
                        (
                          record,
                          index
                        ) => {

                          const status =
                            getStatus(
                              record
                            );

                          return (
                            <tr
                              key={
                                record.id ??
                                `${record.date}-${index}`
                              }
                            >

                              <td>

                                <div className="reports-date-box">

                                  <div className="reports-date-number">
                                    {getDayNumber(
                                      record.date
                                    )}
                                  </div>

                                  <div className="reports-date-day">
                                    {getDayName(
                                      record.date
                                    )}
                                  </div>

                                </div>

                              </td>

                              <td>
                                {formatTime(
                                  record.check_in ||
                                  record.check_in_time
                                )}
                              </td>

                              <td>
                                {formatTime(
                                  record.check_out ||
                                  record.check_out_time
                                )}
                              </td>

                              <td>
                                {formatWorkingHours(
                                  record
                                )}
                              </td>

                              <td>

                                <span
                                  className="reports-status"
                                  style={{
                                    background:
                                      status.bg,
                                    color:
                                      status.color,
                                  }}
                                >
                                  {
                                    status.label
                                  }
                                </span>

                              </td>

                              <td>

                                {record.id ? (

                                  <button
                                    type="button"
                                    className="reports-view-button"
                                    onClick={() =>
                                      setSelectedRecordId(
                                        Number(
                                          record.id
                                        )
                                      )
                                    }
                                    aria-label="View attendance"
                                  >
                                    <ChevronRight
                                      size={
                                        18
                                      }
                                    />
                                  </button>

                                ) : (
                                  '--'
                                )}

                              </td>

                            </tr>
                          );
                        }
                      )}

                  </tbody>

                </table>

              </div>
            )}

          </section>

        </div>
      </div>

      {/* ATTENDANCE DETAILS MODAL */}

      {selectedRecordId !== null && (
        <AttendanceDetailsModal
          isOpen={
            selectedRecordId !== null
          }
          recordId={
            selectedRecordId
          }
          onClose={() =>
            setSelectedRecordId(
              null
            )
          }
        />
      )}

    </div>
  );
};

export default Reports;


