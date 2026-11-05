import React, { useEffect, useMemo, useState } from 'react';
import CustomDatePicker from '../../components/CustomDatePicker';
import { createPermission, getPermissions, updatePermission, deletePermission } from '../../api/permissions';
import type { PermissionRequest } from '../../api/permissions';

type TimePicker12HourProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
};

const TimePicker12Hour: React.FC<TimePicker12HourProps> = ({
  label,
  value,
  onChange,
  required = false,
  className,
}) => {
  const getParts = (time: string) => {
    if (!time || !/^\d{2}:\d{2}$/.test(time)) {
      return { hour: '', minute: '', period: 'AM' };
    }

    const [hours, minutes] = time.split(':').map(Number);
    return {
      hour: String(hours % 12 || 12).padStart(2, '0'),
      minute: String(minutes).padStart(2, '0'),
      period: hours >= 12 ? 'PM' : 'AM',
    };
  };

  const initial = getParts(value);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [period, setPeriod] = useState(initial.period);

  useEffect(() => {
    const parts = getParts(value);
    setHour(parts.hour);
    setMinute(parts.minute);
    setPeriod(parts.period);
  }, [value]);

  const commitTime = (nextHour: string, nextMinute: string, nextPeriod: string) => {
    if (!nextHour || !nextMinute) return;

    let hours = Number(nextHour) % 12;
    if (nextPeriod === 'PM') hours += 12;

    onChange(`${String(hours).padStart(2, '0')}:${nextMinute}`);
  };

  return (
    <div className="time-picker-field">
      <label className="permission-label">{label}</label>
      <div className="time-picker-controls">
        <select
          aria-label={`${label} hour`}
          className={className}
          value={hour}
          required={required}
          onChange={(event) => {
            const next = event.target.value;
            setHour(next);
            commitTime(next, minute, period);
          }}
        >
          <option value="">Hour</option>
          {Array.from({ length: 12 }, (_, i) =>
            String(i + 1).padStart(2, '0')
          ).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>

        <select
          aria-label={`${label} minute`}
          className={className}
          value={minute}
          required={required}
          onChange={(event) => {
            const next = event.target.value;
            setMinute(next);
            commitTime(hour, next, period);
          }}
        >
          <option value="">Min</option>
          {Array.from({ length: 60 }, (_, i) =>
            String(i).padStart(2, '0')
          ).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>

        <select
          aria-label={`${label} AM or PM`}
          className={className}
          value={period}
          required={required}
          onChange={(event) => {
            const next = event.target.value;
            setPeriod(next);
            commitTime(hour, minute, next);
          }}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
};
const formatDate = (date: string) => {
  if (!date) return '-';

  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getStatusClass = (status: PermissionRequest['status']) => {
  switch (status) {
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    default:
      return 'pending';
  }
};

const Permission: React.FC = () => {
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [viewPermission, setViewPermission] = useState<PermissionRequest | null>(null);
  const [editPermission, setEditPermission] = useState<PermissionRequest | null>(null);
  const [deletePermissionTarget, setDeletePermissionTarget] = useState<PermissionRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editReason, setEditReason] = useState('');

  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [reason, setReason] = useState('');

  const calculatedDuration = (() => {
    if (!startTime || !endTime) return 0;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  })();

  const loadPermissions = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await getPermissions();

      const data = Array.isArray(response)
        ? response
        : response?.results || [];

      setPermissions(data);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.error ||
          'Failed to load permission requests.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, []);

  const currentMonthMinutes = useMemo(() => {
    const now = new Date();

    return permissions
      .filter((item) => {
        const itemDate = new Date(`${item.date}T00:00:00`);

        return (
          itemDate.getMonth() === now.getMonth() &&
          itemDate.getFullYear() === now.getFullYear() &&
          ['PENDING', 'APPROVED'].includes(item.status)
        );
      })
      .reduce(
        (total, item) => total + Number(item.duration_minutes || 0),
        0
      );
  }, [permissions]);

  const remainingMinutes = Math.max(180 - currentMonthMinutes, 0);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!date) {
      setError('Please select a permission date.');
      return;
    }

    if (!startTime || !endTime) {
      setError('Please select both start time and end time.');
      return;
    }

    if (![30, 60].includes(calculatedDuration)) {
      setError('Permission duration must be exactly 30 or 60 minutes.');
      return;
    }

    if (!reason.trim()) {
      setError('Please enter a reason.');
      return;
    }

    try {
      setSubmitting(true);

      await createPermission({
        date,
        start_time: startTime,
        end_time: endTime,
        reason: reason.trim(),
      });

      setDate('');
      setStartTime('');
      setEndTime('');
      setReason('');

      setSuccess('Permission request submitted successfully.');

      await loadPermissions();
    } catch (err: any) {
      const responseData = err?.response?.data;

      const message =
        responseData?.duration_minutes?.[0] ||
        responseData?.start_time?.[0] ||
        responseData?.end_time?.[0] ||
        responseData?.date?.[0] ||
        responseData?.reason?.[0] ||
        responseData?.non_field_errors?.[0] ||
        responseData?.detail ||
        responseData?.error ||
        'Failed to submit permission request.';

      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditPermission = (item: PermissionRequest) => {
    if (item.status !== 'PENDING') return;
    setError('');
    setSuccess('');
    setEditPermission(item);
    setEditDate(item.date);
    setEditStartTime(item.start_time || '');
    setEditEndTime(item.end_time || '');
    setEditReason(item.reason);
  };

  const savePermissionEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editPermission || editPermission.status !== 'PENDING') return;

    const toMinutes = (value: string) => {
      const [hours, minutes] = value.split(':').map(Number);
      return hours * 60 + minutes;
    };
    const duration = toMinutes(editEndTime) - toMinutes(editStartTime);

    if (!editDate || !editStartTime || !editEndTime || !editReason.trim()) {
      setError('Please fill all required fields.');
      return;
    }
    if (![30, 60].includes(duration)) {
      setError('Permission duration must be exactly 30 or 60 minutes.');
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      setSuccess('');
      await updatePermission(editPermission.id, {
        date: editDate,
        start_time: editStartTime,
        end_time: editEndTime,
        reason: editReason.trim(),
      });
      setEditPermission(null);
      setSuccess('Permission request updated successfully.');
      await loadPermissions();
    } catch (err: any) {
      const data = err?.response?.data;
      setError(
        data?.detail || data?.error || data?.non_field_errors?.[0] ||
        data?.start_time?.[0] || data?.end_time?.[0] ||
        data?.date?.[0] || data?.reason?.[0] ||
        'Failed to update permission request.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDeletePermission = async () => {
    if (!deletePermissionTarget || deletePermissionTarget.status !== 'PENDING') return;

    try {
      setActionLoading(true);
      setError('');
      setSuccess('');
      await deletePermission(deletePermissionTarget.id);
      setDeletePermissionTarget(null);
      setSuccess('Permission request deleted successfully.');
      await loadPermissions();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to delete permission request.'
      );
    } finally {
      setActionLoading(false);
    }
  };
  return (
    <div className="permission-page">
      <style>{`
        @media (max-width: 768px) {
          .permission-card,
          .permission-card * {
            box-sizing: border-box;
          }

          .permission-card {
            width: 100%;
            min-width: 0;
            max-width: 100%;
            padding: 20px 16px;
            overflow: hidden;
          }

          .permission-card form,
          .permission-card .usage-box,
          .permission-card input,
          .permission-card textarea,
          .permission-card select {
            width: 100%;
            min-width: 0;
            max-width: 100%;
          }

          .permission-card form button[type="submit"] {
            width: 100%;
            min-width: 0;
            max-width: 100%;
            white-space: normal;
          }

          .permission-table-wrap {
            width: 100%;
            max-width: 100%;
            min-width: 0;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .permission-table {
            width: 100%;
            min-width: 650px;
          }
        }

        @media (max-width: 420px) {
          .permission-card {
            padding: 18px 12px;
          }

          .permission-card-title {
            font-size: 1.25rem;
          }

          .permission-card .usage-value {
            font-size: clamp(1.6rem, 7vw, 2rem);
          }
        }

        .permission-page {
          padding: 24px;
          min-height: 100%;
          background: #f7fbf8;
          color: #18352a;
        }

        .permission-header {
          margin-bottom: 24px;
        }

        .permission-title {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          color: #173c2c;
        }

        .permission-subtitle {
          margin: 6px 0 0;
          color: #6b7f75;
          font-size: 14px;
        }

        .permission-grid {
          display: grid;
          grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
          gap: 20px;
          align-items: start;
        }

        .permission-card {
          background: #ffffff;
          border: 1px solid #e2eee7;
          border-radius: 18px;
          padding: 22px;
          box-shadow: 0 8px 24px rgba(35, 92, 65, 0.06);
        }

        .permission-card-title {
          margin: 0 0 18px;
          font-size: 18px;
          font-weight: 700;
          color: #173c2c;
        }

        .permission-field {
          margin-bottom: 16px;
        }

        .permission-label {
          display: block;
          margin-bottom: 7px;
          font-size: 13px;
          font-weight: 600;
          color: #355347;
        }

        .permission-input,
        .permission-textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d6e5dc;
          border-radius: 11px;
          padding: 11px 13px;
          background: #fbfdfc;
          color: #18352a;
          font-size: 14px;
          outline: none;
        }

        /* Responsive permission time controls */
        .permission-field {
          min-width: 0;
          width: 100%;
        }

        .permission-field select,
        .permission-field input,
        .permission-field .permission-input {
          min-width: 0;
          max-width: 100%;
          min-height: 44px;
          font-size: 14px;
          touch-action: manipulation;
        }

        .permission-field > div {
          min-width: 0;
        }

        @media (max-width: 640px) {
          .permission-card {
            padding: 16px !important;
            border-radius: 14px;
          }

          .permission-field {
            margin-bottom: 14px;
          }

          .permission-label {
            font-size: 13px;
            margin-bottom: 6px;
          }

          .permission-field select,
          .permission-field input,
          .permission-field .permission-input {
            min-height: 46px;
            padding: 10px 9px;
            font-size: 14px;
          }

          .permission-field [class*="time"],
          .permission-field [class*="Time"] {
            max-width: 100%;
          }
        }

        @media (max-width: 380px) {
          .permission-card {
            padding: 12px !important;
          }

          .permission-field select,
          .permission-field input {
            font-size: 13px;
            padding-left: 7px;
            padding-right: 7px;
          }
        }

        .permission-input:focus,
        .permission-textarea:focus {
          border-color: #36a269;
          box-shadow: 0 0 0 3px rgba(54, 162, 105, 0.10);
        }

        .permission-textarea {
          min-height: 100px;
          resize: vertical;
        }

        /* Responsive permission time controls */
        .permission-field {
          min-width: 0;
          width: 100%;
        }

        .permission-field select,
        .permission-field input,
        .permission-field .permission-input {
          min-width: 0;
          max-width: 100%;
          min-height: 44px;
          font-size: 14px;
          touch-action: manipulation;
        }

        .permission-field > div {
          min-width: 0;
        }

        @media (max-width: 640px) {
          .permission-card {
            padding: 16px !important;
            border-radius: 14px;
          }

          .permission-field {
            margin-bottom: 14px;
          }

          .permission-label {
            font-size: 13px;
            margin-bottom: 6px;
          }

          .permission-field select,
          .permission-field input,
          .permission-field .permission-input {
            min-height: 46px;
            padding: 10px 9px;
            font-size: 14px;
          }

          .permission-field [class*="time"],
          .permission-field [class*="Time"] {
            max-width: 100%;
          }
        }

        @media (max-width: 380px) {
          .permission-card {
            padding: 12px !important;
          }

          .permission-field select,
          .permission-field input {
            font-size: 13px;
            padding-left: 7px;
            padding-right: 7px;
          }
        }

        .duration-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .duration-option {
          border: 1px solid #d6e5dc;
          background: #ffffff;
          border-radius: 11px;
          padding: 11px;
          cursor: pointer;
          font-weight: 600;
          color: #426052;
        }

        .duration-option.active {
          background: #eaf8f0;
          border-color: #36a269;
          color: #167344;
        }

        .permission-submit {
          width: 100%;
          border: 0;
          border-radius: 11px;
          padding: 12px 16px;
          background: #24945b;
          color: white;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .permission-submit:hover {
          background: #1d7d4d;
        }

        .permission-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .usage-box {
          margin-bottom: 20px;
          padding: 16px;
          border-radius: 14px;
          background: #eef9f2;
          border: 1px solid #d8efdf;
        }

        .usage-label {
          font-size: 12px;
          color: #557365;
          margin-bottom: 6px;
        }

        .usage-value {
          font-size: 24px;
          font-weight: 700;
          color: #167344;
        }

        .usage-note {
          margin-top: 4px;
          font-size: 12px;
          color: #668072;
        }

        .message {
          padding: 11px 13px;
          border-radius: 10px;
          margin-bottom: 16px;
          font-size: 13px;
        }

        .message.error {
          background: #fff1f1;
          color: #b42318;
          border: 1px solid #ffd5d2;
        }

        .message.success {
          background: #eefaf3;
          color: #167344;
          border: 1px solid #d4efdd;
        }

        .permission-table-wrap {
          overflow-x: auto;
        }

        .permission-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 650px;
        }

        .permission-table th {
          text-align: left;
          padding: 12px;
          background: #f5faf7;
          color: #557365;
          font-size: 12px;
          font-weight: 700;
          border-bottom: 1px solid #e3eee7;
        }

        .permission-table td {
          padding: 14px 12px;
          border-bottom: 1px solid #edf2ef;
          font-size: 13px;
          color: #355347;
          vertical-align: top;
        }

        .status-badge {
          display: inline-flex;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
        }

        .status-badge.pending {
          background: #fff7df;
          color: #9a6700;
        }

        .status-badge.approved {
          background: #eaf8f0;
          color: #167344;
        }

        .status-badge.rejected {
          background: #fff0f0;
          color: #b42318;
        }

        .empty-state {
          padding: 35px 20px;
          text-align: center;
          color: #789084;
          font-size: 14px;
        }

        @media (max-width: 900px) {
          .permission-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .permission-page {
            padding: 16px;
          }

          .permission-title {
            font-size: 23px;
          }
        }
        .permission-row-actions { display: flex; flex-wrap: wrap; gap: 6px; min-width: 150px; }
        .permission-row-actions button, .permission-modal button { border: 1px solid #d5e5db; border-radius: 8px; padding: 7px 10px; background: #fff; color: #287a52; font-size: 12px; font-weight: 700; cursor: pointer; }
        .permission-row-actions .permission-delete-action { color: #b23b3b; }
        .permission-modal-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(15,35,25,.48); display: flex; align-items: center; justify-content: center; padding: 18px; }
        .permission-modal { width: 100%; max-width: 480px; max-height: 85vh; overflow-y: auto; box-sizing: border-box; padding: 24px; border-radius: 16px; background: #fff; box-shadow: 0 20px 70px rgba(0,0,0,.2); }
        .permission-modal h2 { margin: 0 0 18px; font-size: 20px; color: #17352b; }
        .permission-modal p { font-size: 13px; line-height: 1.6; color: #536c61; overflow-wrap: anywhere; }
        .permission-modal label { display: block; margin: 12px 0 6px; font-size: 12px; font-weight: 700; color: #486256; }
        .permission-modal input, .permission-modal textarea { width: 100%; box-sizing: border-box; margin-bottom: 10px; }
        .permission-modal-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
        .permission-modal-actions button:first-child { background: #287a52; color: #fff; }
        .permission-modal button:disabled { opacity: .6; cursor: not-allowed; }
        .time-picker-field > label {
          display: block;
          margin-bottom: 6px;
          font-size: 12px;
          font-weight: 700;
          color: #486256;
        }
        .time-picker-controls {
          display: grid;
          grid-template-columns: 1fr 1fr .9fr;
          gap: 8px;
          width: 100%;
        }
        .time-picker-controls select {
          min-width: 0;
          width: 100%;
          min-height: 42px;
          padding: 9px 8px;
          border: 1px solid #d7e4dc;
          border-radius: 8px;
          background: #fff;
          color: #234637;
          font-size: 14px;
        }
      
        /* Consistent professional typography and message fields */
        .permission-page {
          font-family: Inter, "Segoe UI", Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .permission-page textarea,
        .permission-page .permission-textarea {
          font-family: Inter, "Segoe UI", Arial, sans-serif;
          font-size: 14px;
          font-weight: 400;
          line-height: 1.7;
          letter-spacing: 0.1px;
          min-height: 112px;
          padding: 14px 15px;
          color: #18352a;
          background: #fcfdfc;
          border: 1px solid #d6e5dc;
          border-radius: 12px;
          resize: vertical;
          transition: border-color .2s ease, box-shadow .2s ease;
        }

        /* Responsive permission time controls */
        .permission-field {
          min-width: 0;
          width: 100%;
        }

        .permission-field select,
        .permission-field input,
        .permission-field .permission-input {
          min-width: 0;
          max-width: 100%;
          min-height: 44px;
          font-size: 14px;
          touch-action: manipulation;
        }

        .permission-field > div {
          min-width: 0;
        }

        @media (max-width: 640px) {
          .permission-card {
            padding: 16px !important;
            border-radius: 14px;
          }

          .permission-field {
            margin-bottom: 14px;
          }

          .permission-label {
            font-size: 13px;
            margin-bottom: 6px;
          }

          .permission-field select,
          .permission-field input,
          .permission-field .permission-input {
            min-height: 46px;
            padding: 10px 9px;
            font-size: 14px;
          }

          .permission-field [class*="time"],
          .permission-field [class*="Time"] {
            max-width: 100%;
          }
        }

        @media (max-width: 380px) {
          .permission-card {
            padding: 12px !important;
          }

          .permission-field select,
          .permission-field input {
            font-size: 13px;
            padding-left: 7px;
            padding-right: 7px;
          }
        }

        .permission-page textarea::placeholder,
        .permission-page .permission-textarea::placeholder {
          color: #899a91;
          opacity: 1;
          font-size: 13px;
        }

        .permission-page textarea:focus,
        .permission-page .permission-textarea:focus {
          outline: none;
          border-color: #29945f;
          box-shadow: 0 0 0 3px rgba(41, 148, 95, .12);
        }
      `}</style>

      <div className="permission-header">
        <h1 className="permission-title">Permission</h1>
        <p className="permission-subtitle">
          Apply for permission and track your requests.
        </p>
      </div>

      {error && (
        <div className="message error">
          {error}
        </div>
      )}

      {success && (
        <div className="message success">
          {success}
        </div>
      )}

      <div className="permission-grid">
        <div>
          <div className="permission-card">
            <h2 className="permission-card-title">
              Apply Permission
            </h2>

            <div className="usage-box">
              <div className="usage-label">
                Current Month Usage
              </div>

              <div className="usage-value">
                {currentMonthMinutes} / 180 min
              </div>

              <div className="usage-note">
                Remaining: {remainingMinutes} minutes
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="permission-field">
                <label className="permission-label">
                  Date
                </label>

                <CustomDatePicker
                  value={date}
                  onChange={setDate}
                  required
                  className="permission-input"
                />
              </div>

              <div className="permission-field">
                <TimePicker12Hour
                  label="Start Time"
                  value={startTime}
                  onChange={(value) => {
                    setStartTime(value);
                    if (endTime && value && endTime <= value) setEndTime('');
                  }}
                  required
                  className="permission-input"
                />
              </div>

              <div className="permission-field">
                <TimePicker12Hour
                  label="End Time"
                  value={endTime}
                  onChange={setEndTime}
                  required
                  className="permission-input"
                />
                <div className="usage-note">
                  Selected duration: {calculatedDuration > 0
                    ? `${calculatedDuration} minutes`
                    : '--'}
                  {' '} (allowed: 30 or 60 minutes)
                </div>
              </div>

              <div className="permission-field">
                <label className="permission-label">
                  Reason
                </label>

                <textarea
                  className="permission-textarea"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Briefly describe the reason for your permission request..."
                />
              </div>

              <button
                className="permission-submit"
                type="submit"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit Permission'}
              </button>
            </form>
          </div>
        </div>

        <div className="permission-card">
          <h2 className="permission-card-title">
            Permission History
          </h2>

          <div className="permission-table-wrap">
            {loading ? (
              <div className="empty-state">
                Loading permission requests...
              </div>
            ) : permissions.length === 0 ? (
              <div className="empty-state">
                No permission requests found.
              </div>
            ) : (
              <table className="permission-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Duration</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Remarks</th>
                    <th>Actions</th>
                    
                  </tr>
                </thead>

                <tbody>
                  {permissions.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.date)}</td>

                      <td>
                        {item.duration_minutes} min
                      </td>

                      <td>{item.reason}</td>

                      <td>
                        <span
                          className={`status-badge ${getStatusClass(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td>
                        {item.status === 'REJECTED'
                          ? item.rejection_reason || '-'
                          : item.status === 'APPROVED'
                          ? item.approved_by_name
                            ? `Approved by ${item.approved_by_name}`
                            : 'Approved'
                          : '-'}
                      </td>
                      <td>
                        <div className="permission-row-actions">
                          <button type="button" onClick={() => setViewPermission(item)}>View</button>
                          {item.status === 'PENDING' && (
                            <>
                              <button type="button" onClick={() => openEditPermission(item)}>Edit</button>
                              <button type="button" className="permission-delete-action" onClick={() => setDeletePermissionTarget(item)}>Delete</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      {(viewPermission || editPermission || deletePermissionTarget) && (
        <div className="permission-modal-backdrop" onClick={() => {
          if (!actionLoading) {
            setViewPermission(null);
            setEditPermission(null);
            setDeletePermissionTarget(null);
          }
        }}>
          <div className="permission-modal" onClick={(event) => event.stopPropagation()}>
            {viewPermission && (
              <>
                <h2>Permission Details</h2>
                <p><strong>Date:</strong> {formatDate(viewPermission.date)}</p>
                <p><strong>Start Time:</strong> {viewPermission.start_time || '--'}</p>
                <p><strong>End Time:</strong> {viewPermission.end_time || '--'}</p>
                <p><strong>Duration:</strong> {viewPermission.duration_minutes} minutes</p>
                <p><strong>Reason:</strong> {viewPermission.reason}</p>
                <p><strong>Status:</strong> {viewPermission.status}</p>
                {viewPermission.status === 'APPROVED' && (
                  <p><strong>Approved by:</strong> {viewPermission.approved_by_name || '--'}</p>
                )}
                {viewPermission.rejection_reason && (
                  <p><strong>Remarks:</strong> {viewPermission.rejection_reason}</p>
                )}
                <div className="permission-modal-actions">
                  <button type="button" onClick={() => setViewPermission(null)}>Close</button>
                </div>
              </>
            )}

            {editPermission && (
              <>
                <h2>Edit Permission Request</h2>
                <form onSubmit={savePermissionEdit}>
                  <label>Date</label>
                  <CustomDatePicker
                    value={editDate}
                    onChange={setEditDate}
                    required
                  />
                  <label>Start Time</label>
                  <TimePicker12Hour
                    label="Start Time"
                    value={editStartTime}
                    onChange={(value) => {
                      setEditStartTime(value);
                      if (editEndTime && value && editEndTime <= value) setEditEndTime('');
                    }}
                    required
                  />
                  <label>End Time</label>
                  <TimePicker12Hour
                    label="End Time"
                    value={editEndTime}
                    onChange={setEditEndTime}
                    required
                  />
                  <p>Duration: {editStartTime && editEndTime ? (() => {
                    const [sh, sm] = editStartTime.split(':').map(Number);
                    const [eh, em] = editEndTime.split(':').map(Number);
                    return `${(eh * 60 + em) - (sh * 60 + sm)} minutes`;
                  })() : '--'}</p>
                  <label>Reason</label>
                  <textarea required rows={3} value={editReason} onChange={(event) => setEditReason(event.target.value)} placeholder="Provide a clear and professional reason for your permission request..." />
                  <div className="permission-modal-actions">
                    <button type="submit" disabled={actionLoading}>{actionLoading ? 'Saving...' : 'Save Changes'}</button>
                    <button type="button" disabled={actionLoading} onClick={() => setEditPermission(null)}>Cancel</button>
                  </div>
                </form>
              </>
            )}

            {deletePermissionTarget && (
              <>
                <h2>Delete Permission Request?</h2>
                <p>This will permanently delete your pending permission request. This action cannot be undone.</p>
                <div className="permission-modal-actions">
                  <button type="button" disabled={actionLoading} onClick={confirmDeletePermission}>{actionLoading ? 'Deleting...' : 'Confirm Delete'}</button>
                  <button type="button" disabled={actionLoading} onClick={() => setDeletePermissionTarget(null)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default Permission;


