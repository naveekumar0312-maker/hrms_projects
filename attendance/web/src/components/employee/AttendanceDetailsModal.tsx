import React, { useEffect, useState } from 'react';
import {
  X,
  CalendarDays,
  Clock3,
  MapPin,
  CheckCircle2,
  CircleAlert,
  XCircle,
  User,
  Building2,
  BriefcaseBusiness,
  Timer,
  Image as ImageIcon,
} from 'lucide-react';
import api from '../../api/index';

interface AttendanceDetailsModalProps {
  isOpen: boolean;
  recordId: number;
  onClose: () => void;
}

interface AttendanceDetails {
  approved_permissions?: Array<{
    id: number;
    date: string;
    status: string;
    start_time: string | null;
    end_time: string | null;
    duration_minutes: number;
    approved_at?: string | null;
  }>;
  permission_minutes?: number;
  id: number;
  date?: string | null;

  employee?: any;

  // Optional direct employee fields returned by some attendance API responses.
  employee_name?: string | null;
  employee_id?: string | number | null;
  designation?: string | null;
  department?: string | null;
  work_type?: string | null;
  branch_name?: string | null;
  company_name?: string | null;

  check_in?: string | null;
  check_out?: string | null;

  check_in_time?: string | null;
  check_out_time?: string | null;

  check_in_latitude?: number | null;
  check_in_longitude?: number | null;
  check_in_accuracy?: number | null;

  check_out_latitude?: number | null;
  check_out_longitude?: number | null;
  check_out_accuracy?: number | null;

  check_in_photo?: string | null;
  check_out_photo?: string | null;

  status?: string | null;
  approval_status?: string | null;

  late_minutes?: number | null;
  grace_used?: boolean;
  working_hours?: string | null;

  branch?: any;
  company?: any;

  rejection_reason?: string | null;
}

const formatPermissionTime = (value?: string | null): string => {
  if (!value) return "--";
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = match[2];
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${minute} ${period}`;
};
const AttendanceDetailsModal: React.FC<
  AttendanceDetailsModalProps
> = ({
  isOpen,
  recordId,
  onClose,
}) => {
  const [record, setRecord] =
    useState<AttendanceDetails | null>(null);

  const [employeeProfile, setEmployeeProfile] =
    useState<any | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  // =========================================================
  // FETCH ATTENDANCE DETAILS
  // =========================================================
  useEffect(() => {
    if (!isOpen || !recordId) {
      return;
    }

    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError('');

        const attendanceResponse =
          await api.get(`/attendance/${recordId}`);

        const attendanceData =
          attendanceResponse.data;

        let employeeData = null;

        const employeeId =
          attendanceData?.employee?.id ||
          attendanceData?.employee_id ||
          attendanceData?.employee?.employee_id;

        if (employeeId) {
          try {
            const employeeResponse =
              await api.get(`/employees/${employeeId}`);

            employeeData =
              employeeResponse.data?.employee ||
              employeeResponse.data?.data ||
              employeeResponse.data;
          } catch (employeeError) {
            console.warn(
              'Unable to fetch employee profile:',
              employeeError
            );
          }
        }

        setRecord(attendanceData);
        setEmployeeProfile(employeeData);
        setEmployeeProfile(employeeData);
      } catch (err: any) {
        console.error(
          'Failed to fetch attendance details:',
          err
        );

        setError(
          err?.response?.data?.detail ||
          err?.response?.data?.error ||
          'Unable to load attendance details.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [isOpen, recordId]);

  // =========================================================
  // FORMAT TIME
  // =========================================================
  const formatTime = (
    value?: string | null
  ) => {
    if (!value) {
      return '-- : --';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '-- : --';
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
  // FORMAT DATE
  // =========================================================
  const formatDate = (
    value?: string | null
  ) => {
    if (!value) {
      return '--';
    }

    const date = new Date(
      `${value}T00:00:00`
    );

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString(
      'en-US',
      {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }
    );
  };

  // =========================================================
  // LATE FORMAT
  // =========================================================
  const formatLateDuration = (
    minutes?: number | null
  ) => {
    if (!minutes || minutes <= 0) {
      return 'On Time';
    }

    const hours = Math.floor(
      minutes / 60
    );

    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m late`;
    }

    return `${mins}m late`;
  };

  // =========================================================
  // IMAGE URL
  // =========================================================
  const getImageUrl = (
    url?: string | null
  ) => {
    if (!url) {
      return '';
    }

    if (url.startsWith('http')) {
      if (
        url.includes('localhost') ||
        url.includes('127.0.0.1')
      ) {
        try {
          const path =
            new URL(url).pathname;

          return `${path}`;
        } catch {
          return url;
        }
      }

      return url;
    }

    return `${url}`;
  };

  // =========================================================
  // STATUS
  // =========================================================
  const getStatus = () => {
    const status =
      String(
        record?.status || ''
      ).toUpperCase();

    if (
      status === 'LATE'
    ) {
      return {
        label: 'Late',
        background: '#FFF1DD',
        color: '#F97316',
        icon: <Clock3 size={18} />,
      };
    }

    if (
      status === 'ABSENT'
    ) {
      return {
        label: 'Absent',
        background: '#FEEBEC',
        color: '#EF4444',
        icon: <XCircle size={18} />,
      };
    }

    if (
      status === 'WORKING'
    ) {
      return {
        label: 'Working',
        background: '#EAF4FF',
        color: '#2563EB',
        icon: <Clock3 size={18} />,
      };
    }

    if (
      status === 'REJECTED'
    ) {
      return {
        label: 'Rejected',
        background: '#FEEBEC',
        color: '#EF4444',
        icon: <XCircle size={18} />,
      };
    }

    return {
      label:
        status === 'COMPLETED'
          ? 'Completed'
          : 'Present',
      background: '#E5F8EF',
      color: '#E56108',
      icon: <CheckCircle2 size={18} />,
    };
  };

  // =========================================================
  // APPROVAL
  // =========================================================
  const getApproval = () => {
    const approval =
      String(
        record?.approval_status || ''
      ).toUpperCase();

    if (
      approval === 'APPROVED'
    ) {
      return {
        label: 'Approved',
        background: '#E5F8EF',
        color: '#E56108',
        icon: <CheckCircle2 size={17} />,
      };
    }

    if (
      approval === 'REJECTED'
    ) {
      return {
        label: 'Rejected',
        background: '#FEEBEC',
        color: '#EF4444',
        icon: <XCircle size={17} />,
      };
    }

    return {
      label: 'Pending Approval',
      background: '#FFF7E8',
      color: '#D97706',
      icon: <CircleAlert size={17} />,
    };
  };

  if (!isOpen) {
    return null;
  }

  const status = getStatus();
  const approval = getApproval();

  const employeeName =
    record?.employee?.full_name ||
    record?.employee?.name ||
    employeeProfile?.full_name ||
    employeeProfile?.name ||
    record?.employee_name ||
    'Employee';

  const employeeId =
    record?.employee?.employee_id ||
    employeeProfile?.employee_id ||
    record?.employee_id ||
    '--';

  const designation =
    record?.employee?.designation ||
    employeeProfile?.designation ||
    record?.designation ||
    '--';

  const department =
    record?.employee?.department ||
    employeeProfile?.department ||
    record?.department ||
    '--';

  const workType =
    record?.employee?.work_type ||
    employeeProfile?.work_type ||
    record?.work_type ||
    '--';

  const branchName =
    record?.employee?.branch?.branch_name ||
    record?.employee?.branch?.name ||
    employeeProfile?.branch?.branch_name ||
    employeeProfile?.branch?.name ||
    record?.branch?.branch_name ||
    record?.branch?.name ||
    record?.branch_name ||
    '--';

  const companyName =
    record?.employee?.company?.name ||
    record?.employee?.company?.company_name ||
    employeeProfile?.company?.name ||
    employeeProfile?.company?.company_name ||
    record?.company?.name ||
    record?.company_name ||
    '--';

  const checkInPhoto =
    getImageUrl(
      record?.check_in_photo
    );

  const checkOutPhoto =
    getImageUrl(
      record?.check_out_photo
    );

  return (
    <>
      <style>
        {`
          .attendance-detail-overlay {
            position: fixed;
            inset: 0;
            z-index: 9999;
            background: rgba(15, 23, 42, 0.58);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }

          .attendance-detail-modal {
            width: min(760px, 100%);
            max-height: 92vh;
            overflow-y: auto;
            background: #ffffff;
            border-radius: 24px;
            box-shadow: 0 30px 80px rgba(15, 23, 42, .22);
          }

          .attendance-detail-header {
            position: sticky;
            top: 0;
            z-index: 3;
            padding: 22px 24px;
            background: #ffffff;
            border-bottom: 1px solid #EEF2F7;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
          }

          .attendance-detail-title-wrap {
            display: flex;
            align-items: center;
            gap: 13px;
          }

          .attendance-detail-title-icon {
            width: 44px;
            height: 44px;
            border-radius: 14px;
            background: #FFF1E6;
            color: #F97316;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .attendance-detail-title {
            margin: 0;
            color: #10213E;
            font-size: 20px;
            font-weight: 800;
          }

          .attendance-detail-subtitle {
            margin: 3px 0 0;
            color: #7A8497;
            font-size: 12px;
          }

          .attendance-detail-close {
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
          }

          .attendance-detail-close:hover {
            background: #FFF1E6;
            color: #F97316;
          }

          .attendance-detail-body {
            padding: 24px;
          }

          .attendance-detail-status-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 20px;
            flex-wrap: wrap;
          }

          .attendance-detail-status {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            padding: 9px 14px;
            border-radius: 24px;
            font-size: 13px;
            font-weight: 800;
          }

          .attendance-detail-date {
            color: #64748B;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .attendance-detail-section {
            margin-top: 22px;
          }

          .attendance-detail-section-title {
            margin: 0 0 12px;
            color: #10213E;
            font-size: 15px;
            font-weight: 800;
          }

          .attendance-detail-info-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .attendance-detail-info-card {
            border: 1px solid #EEF2F7;
            background: #FBFCFE;
            border-radius: 15px;
            padding: 15px;
          }

          .attendance-detail-info-label {
            color: #8A94A6;
            font-size: 11px;
            margin-bottom: 5px;
          }

          .attendance-detail-info-value {
            color: #17233D;
            font-size: 14px;
            font-weight: 700;
            word-break: break-word;
          }

          .attendance-detail-time-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
          }

          .attendance-detail-time-card {
            border-radius: 17px;
            padding: 18px;
            background: #F8FAFC;
            border: 1px solid #EEF2F7;
          }

          .attendance-detail-time-label {
            color: #7A8497;
            font-size: 12px;
            margin-bottom: 6px;
          }

          .attendance-detail-time-value {
            color: #10213E;
            font-size: 22px;
            font-weight: 800;
          }

          .attendance-detail-time-location {
            margin-top: 7px;
            color: #7A8497;
            font-size: 11px;
          }

          .attendance-detail-approval {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 14px 16px;
            border-radius: 15px;
          }

          .attendance-detail-approval-left {
            display: flex;
            align-items: center;
            gap: 9px;
            font-size: 13px;
            font-weight: 800;
          }

          .attendance-detail-late {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 12px;
            padding: 12px 14px;
            border-radius: 13px;
            background: #FFF7ED;
            color: #C2410C;
            font-size: 13px;
            font-weight: 700;
          }

          .attendance-detail-photos {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
          }

          .attendance-detail-photo-card {
            border: 1px solid #EEF2F7;
            border-radius: 16px;
            overflow: hidden;
            background: #FBFCFE;
          }

          .attendance-detail-photo-label {
            padding: 11px 13px;
            font-size: 12px;
            color: #64748B;
            font-weight: 700;
          }

          .attendance-detail-photo {
            display: block;
            width: 100%;
            height: 220px;
            object-fit: cover;
            background: #F1F5F9;
          }

          .attendance-detail-no-photo {
            height: 220px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #94A3B8;
            gap: 7px;
            font-size: 12px;
          }

          .attendance-detail-loading,
          .attendance-detail-error {
            min-height: 300px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 30px;
            color: #64748B;
          }

          .attendance-detail-error {
            color: #EF4444;
          }

          @media (max-width: 600px) {
            .attendance-detail-overlay {
              align-items: flex-end;
              padding: 0;
            }

            .attendance-detail-modal {
              width: 100%;
              max-height: 94vh;
              border-radius: 24px 24px 0 0;
            }

            .attendance-detail-header {
              padding: 17px 18px;
            }

            .attendance-detail-body {
              padding: 18px;
            }

            .attendance-detail-info-grid,
            .attendance-detail-time-grid,
            .attendance-detail-photos {
              grid-template-columns: 1fr;
            }

            .attendance-detail-photo {
              height: 250px;
            }

            .attendance-detail-no-photo {
              height: 160px;
            }

            .attendance-detail-title {
              font-size: 18px;
            }
          }
        `}
      </style>

      {/* =====================================================
          OVERLAY
      ===================================================== */}
      <div
        className="attendance-detail-overlay"
        onMouseDown={(event) => {
          if (
            event.target ===
            event.currentTarget
          ) {
            onClose();
          }
        }}
      >

        {/* ===================================================
            MODAL
        =================================================== */}
        <div className="attendance-detail-modal">

          {/* HEADER */}
          <div className="attendance-detail-header">

            <div className="attendance-detail-title-wrap">

              <div className="attendance-detail-title-icon">
                <CalendarDays
                  size={22}
                />
              </div>

              <div>
                <h2 className="attendance-detail-title">
                  Attendance Details
                </h2>

                <p className="attendance-detail-subtitle">
                  Complete attendance information
                </p>
              </div>

            </div>

            <button
              type="button"
              className="attendance-detail-close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={20} />
            </button>

          </div>

          {/* BODY */}
          <div className="attendance-detail-body">

            {loading ? (

              <div className="attendance-detail-loading">
                Loading attendance details...
              </div>

            ) : error ? (

              <div className="attendance-detail-error">
                {error}
              </div>

            ) : !record ? (

              <div className="attendance-detail-error">
                Attendance record not found.
              </div>

            ) : (

              <>
                {/* STATUS + DATE */}
                <div className="attendance-detail-status-row">

                  <div
                    className="attendance-detail-status"
                    style={{
                      background:
                        status.background,
                      color:
                        status.color,
                    }}
                  >
                    {status.icon}
                    {status.label}
                  </div>

                  <div className="attendance-detail-date">
                    <CalendarDays
                      size={15}
                    />

                    {formatDate(
                      record.date
                    )}
                  </div>

                </div>

                {/* =================================================
                    EMPLOYEE INFORMATION
                ================================================= */}
                <section className="attendance-detail-section">

                  <h3 className="attendance-detail-section-title">
                    Employee Information
                  </h3>

                  <div className="attendance-detail-info-grid">

                    <div className="attendance-detail-info-card">
                      <div className="attendance-detail-info-label">
                        Employee
                      </div>

                      <div className="attendance-detail-info-value">
                        <User
                          size={14}
                          style={{
                            marginRight: 5,
                            verticalAlign:
                              'middle',
                          }}
                        />

                        {employeeName}
                      </div>
                    </div>

                    <div className="attendance-detail-info-card">
                      <div className="attendance-detail-info-label">
                        Employee ID
                      </div>

                      <div className="attendance-detail-info-value">
                        {employeeId}
                      </div>
                    </div>

                    <div className="attendance-detail-info-card">
                      <div className="attendance-detail-info-label">
                        Department
                      </div>

                      <div className="attendance-detail-info-value">
                        {department}
                      </div>
                    </div>

                    <div className="attendance-detail-info-card">
                      <div className="attendance-detail-info-label">
                        Designation
                      </div>

                      <div className="attendance-detail-info-value">
                        {designation}
                      </div>
                    </div>

                    <div className="attendance-detail-info-card">
                      <div className="attendance-detail-info-label">
                        Work Type
                      </div>

                      <div className="attendance-detail-info-value">
                        <BriefcaseBusiness
                          size={14}
                          style={{
                            marginRight: 5,
                            verticalAlign:
                              'middle',
                          }}
                        />

                        {workType}
                      </div>
                    </div>

                    <div className="attendance-detail-info-card">
                      <div className="attendance-detail-info-label">
                        Company
                      </div>

                      <div className="attendance-detail-info-value">
                        <Building2
                          size={14}
                          style={{
                            marginRight: 5,
                            verticalAlign:
                              'middle',
                          }}
                        />

                        {companyName}
                      </div>
                    </div>

                    <div className="attendance-detail-info-card">
                      <div className="attendance-detail-info-label">
                        Branch
                      </div>

                      <div className="attendance-detail-info-value">
                        <MapPin
                          size={14}
                          style={{
                            marginRight: 5,
                            verticalAlign:
                              'middle',
                          }}
                        />

                        {branchName}
                      </div>
                    </div>

                  </div>

                </section>

                {/* =================================================
                    Check In / OUT
                ================================================= */}
                <section className="attendance-detail-section">

                  <h3 className="attendance-detail-section-title">
                    Attendance Timing
                  </h3>

                  <div className="attendance-detail-time-grid">

                    <div className="attendance-detail-time-card">

                      <div className="attendance-detail-time-label">
                        Check In
                      </div>

                      <div className="attendance-detail-time-value">
                        {formatTime(
                          record.check_in ||
                          record.check_in_time
                        )}
                      </div>

                      {record.check_in_accuracy !==
                        null &&
                        record.check_in_accuracy !==
                          undefined && (
                          <div className="attendance-detail-time-location">
                            GPS Accuracy:{' '}
                            {record.check_in_accuracy}m
                          </div>
                        )}

                    </div>

                    <div className="attendance-detail-time-card">

                      <div className="attendance-detail-time-label">
                        Check Out
                      </div>

                      <div className="attendance-detail-time-value">
                        {formatTime(
                          record.check_out ||
                          record.check_out_time
                        )}
                      </div>

                      {record.check_out_accuracy !==
                        null &&
                        record.check_out_accuracy !==
                          undefined && (
                          <div className="attendance-detail-time-location">
                            GPS Accuracy:{' '}
                            {record.check_out_accuracy}m
                          </div>
                        )}

                    </div>

                  </div>

                  {/* LATE */}
                  {record.late_minutes &&
                    record.late_minutes >
                      0 && (
                      <div className="attendance-detail-late">

                        <Timer
                          size={17}
                        />

                        Late Duration:{' '}
                        {formatLateDuration(
                          record.late_minutes
                        )}

                      </div>
                    )}

                  {/* WORKING HOURS */}
                  {record.working_hours && (
                    <div
                      className="attendance-detail-late"
                      style={{
                        background:
                          '#EEF6FF',
                        color:
                          '#2563EB',
                      }}
                    >
                      <Clock3
                        size={17}
                      />

                      Working Hours:{' '}
                      {record.working_hours}
                    </div>
                  )}

                </section>

                {/* =================================================
                    APPROVAL
                ================================================= */}
                {(record.approved_permissions?.length ?? 0) > 0 && (
<section className="attendance-detail-section">
  <h3 className="attendance-detail-section-title">Permission Used</h3>
  {record.approved_permissions!.map((permission) => (
    <div
      key={permission.id}
      style={{
        marginBottom: 10,
        padding: 14,
        borderRadius: 12,
        background: "#F8F9FC",
        border: "1px solid #BBF7D0",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <strong style={{ color: "#166534" }}>
          {permission.duration_minutes >= 60
            ? `${Math.floor(permission.duration_minutes / 60)} ${Math.floor(permission.duration_minutes / 60) === 1 ? "Hour" : "Hours"}${permission.duration_minutes % 60 ? ` ${permission.duration_minutes % 60} Minutes` : ""}`
            : `${permission.duration_minutes} Minutes`}
        </strong>
        <span style={{ padding: "5px 10px", borderRadius: 20, background: "rgba(0, 86, 179, 0.12)", color: "#166534", fontSize: 11, fontWeight: 800 }}>
          Approved
        </span>
      </div>
      <div style={{ marginTop: 8, color: "#475569", fontSize: 13 }}>
        Permission Time: {formatPermissionTime(permission.start_time)}  {formatPermissionTime(permission.end_time)}
      </div>
    </div>
  ))}
</section>

)}

<section className="attendance-detail-section">

                  <h3 className="attendance-detail-section-title">
                    Approval Status
                  </h3>

                  <div
                    className="attendance-detail-approval"
                    style={{
                      background:
                        approval.background,
                    }}
                  >

                    <div
                      className="attendance-detail-approval-left"
                      style={{
                        color:
                          approval.color,
                      }}
                    >
                      {approval.icon}
                      {approval.label}
                    </div>

                  </div>

                  {record.rejection_reason && (
                    <div
                      style={{
                        marginTop:
                          10,
                        padding:
                          '11px 13px',
                        borderRadius:
                          12,
                        background:
                          '#FEF2F2',
                        color:
                          '#B91C1C',
                        fontSize:
                          12,
                      }}
                    >
                      <strong>
                        Reason:
                      </strong>{' '}
                      {
                        record.rejection_reason
                      }
                    </div>
                  )}

                </section>

                {/* =================================================
                    PHOTOS
                ================================================= */}
                <section className="attendance-detail-section">

                  <h3 className="attendance-detail-section-title">
                    Attendance Photos
                  </h3>

                  <div className="attendance-detail-photos">

                    {/* Check In PHOTO */}
                    <div className="attendance-detail-photo-card">

                      <div className="attendance-detail-photo-label">
                        Check In Photo
                      </div>

                      {checkInPhoto ? (

                        <img
                          src={
                            checkInPhoto
                          }
                          alt="Check In"
                          className="attendance-detail-photo"
                        />

                      ) : (

                        <div className="attendance-detail-no-photo">

                          <ImageIcon
                            size={28}
                          />

                          No Check In photo

                        </div>

                      )}

                    </div>

                    {/* Check Out PHOTO */}
                    <div className="attendance-detail-photo-card">

                      <div className="attendance-detail-photo-label">
                        Check Out Photo
                      </div>

                      {checkOutPhoto ? (

                        <img
                          src={
                            checkOutPhoto
                          }
                          alt="Check Out"
                          className="attendance-detail-photo"
                        />

                      ) : (

                        <div className="attendance-detail-no-photo">

                          <ImageIcon
                            size={28}
                          />

                          No Check Out photo

                        </div>

                      )}

                    </div>

                  </div>

                </section>

              </>

            )}

          </div>

        </div>

      </div>
    </>
  );
};

export default AttendanceDetailsModal;


