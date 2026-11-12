import React, { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  Calendar,
  X,
  User,
} from 'lucide-react';
import api from '../../api';
import '../ReportingManagers.css';
import { CustomDatePicker } from '../../components/CustomDatePicker';

interface TeamAttendanceRow {
  employee_id: number;
  employee_code: string;
  full_name: string;
  department: string;
  designation: string;
  branch_name?: string;
  company_name?: string;
  profile_photo: string | null;
  calculated_status: string;
  status_reason: string;
  check_in: string | null;
  check_out: string | null;
  late_minutes: number;
  attendance_id: number | null;
  approval_status?: string | null;
  rejection_reason?: string | null;
  check_in_approval_status?: string | null;
  check_in_rejection_reason?: string | null;
  check_out_approval_status?: string | null;
  check_out_rejection_reason?: string | null;
}

const formatLateDuration = (minutes: number) => {
  if (!minutes || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `+${h}h ${m}m late`;
  if (h > 0) return `+${h}h late`;
  return `+${m}m late`;
};

const ManagerTeamAttendance: React.FC = () => {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [attendanceList, setAttendanceList] = useState<TeamAttendanceRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Approval / Rejection state
  const [rejectingItem, setRejectingItem] = useState<{ row: TeamAttendanceRow; type: 'check_in' | 'check_out' } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadAttendance = async () => {
    try {
      setLoading(true);
      const res = await api.get('/employees/manager/team-attendance/', {
        params: { date },
      });
      setAttendanceList(res.data.team_attendance || []);
      setSummary(res.data.summary || null);
    } catch (err) {
      console.error('Failed to load team attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, [date]);

  const handleApprovePunch = async (row: TeamAttendanceRow, type: 'check_in' | 'check_out') => {
    if (!row.attendance_id) return;
    const label = type === 'check_in' ? 'Check In' : 'Check Out';
    try {
      setActionLoading(true);
      await api.post(`/attendance/${row.attendance_id}/approve/`, { type });
      setActionMessage({ text: `${label} for ${row.full_name} approved!`, type: 'success' });
      loadAttendance();
    } catch (err: any) {
      setActionMessage({ text: err?.response?.data?.error || `Failed to approve ${label.toLowerCase()}.`, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingItem?.row?.attendance_id) return;
    if (!rejectionReason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    const { row, type } = rejectingItem;
    const label = type === 'check_in' ? 'Check In' : 'Check Out';
    try {
      setActionLoading(true);
      await api.post(`/attendance/${row.attendance_id}/reject/`, {
        reason: rejectionReason.trim(),
        rejection_reason: rejectionReason.trim(),
        type,
      });
      setActionMessage({ text: `${label} for ${row.full_name} rejected.`, type: 'success' });
      setRejectingItem(null);
      setRejectionReason('');
      loadAttendance();
    } catch (err: any) {
      setActionMessage({ text: err?.response?.data?.error || `Failed to reject ${label.toLowerCase()}.`, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const filteredList = attendanceList.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.full_name.toLowerCase().includes(q) ||
      item.employee_code.toLowerCase().includes(q) ||
      (item.department && item.department.toLowerCase().includes(q))
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return <span className="rm-badge rm-badge-active">Present</span>;
      case 'LATE':
        return <span className="rm-badge" style={{ background: '#fef3c7', color: '#b45309' }}>Late</span>;
      case 'ABSENT':
        return <span className="rm-badge rm-badge-inactive">Absent</span>;
      case 'ON_LEAVE':
        return <span className="rm-badge" style={{ background: '#f5f3ff', color: '#7c3aed' }}>On Leave</span>;
      case 'HOLIDAY':
        return <span className="rm-badge" style={{ background: '#f0f9ff', color: '#0284c7' }}>Holiday</span>;
      case 'WEEKLY_OFF':
        return <span className="rm-badge" style={{ background: '#f3f4f6', color: '#4b5563' }}>Weekly Off</span>;
      case 'HALF_DAY':
        return <span className="rm-badge" style={{ background: '#fff7ed', color: '#ea580c' }}>Half Day</span>;
      default:
        return <span className="rm-badge" style={{ background: '#f9fafb', color: '#6b7280' }}>{status}</span>;
    }
  };

  const renderPunchApproval = (
    row: TeamAttendanceRow,
    type: 'check_in' | 'check_out',
    time: string | null,
    approvalStatus?: string | null,
    rejectionReason?: string | null
  ) => {
    if (!row.attendance_id || !time) {
      return <span style={{ color: '#94a3b8', fontSize: '12px' }}>--:--</span>;
    }

    const isApproved = approvalStatus === 'APPROVED';
    const isRejected = approvalStatus === 'REJECTED';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>{time}</span>
          <span
            style={{
              padding: '2px 6px',
              borderRadius: '8px',
              fontSize: '10px',
              fontWeight: 700,
              background: isApproved ? '#dcfce7' : isRejected ? '#fee2e2' : '#fef3c7',
              color: isApproved ? '#15803d' : isRejected ? '#b91c1c' : '#b45309',
              border: `1px solid ${isApproved ? '#bbf7d0' : isRejected ? '#fecaca' : '#fde68a'}`,
            }}
          >
            {approvalStatus || 'PENDING'}
          </span>
        </div>

        {rejectionReason ? (
          <span style={{ fontSize: '11px', color: '#dc2626', fontStyle: 'italic', maxWidth: '160px' }}>
            {rejectionReason}
          </span>
        ) : null}

        <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
          <button
            type="button"
            className="btn btn-sm"
            style={{
              padding: '3px 7px',
              borderRadius: '4px',
              background: isApproved ? '#94a3b8' : '#0056CF',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 600,
              cursor: isApproved ? 'not-allowed' : 'pointer',
              border: 'none',
              opacity: isApproved ? 0.65 : 1,
            }}
            disabled={actionLoading || isApproved}
            onClick={() => handleApprovePunch(row, type)}
          >
            {isApproved ? 'Approved' : 'Approve'}
          </button>

          <button
            type="button"
            className="btn btn-sm"
            style={{
              padding: '3px 7px',
              borderRadius: '4px',
              background: '#fee2e2',
              color: '#b91c1c',
              border: '1px solid #fecaca',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            disabled={actionLoading}
            onClick={() => {
              setRejectingItem({ row, type });
              setRejectionReason('');
            }}
          >
            Reject
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="rm-container">
      {/* Header */}
      <div className="rm-header">
        <div>
          <h2 className="rm-title">Team Attendance</h2>
          <p className="rm-subtitle">Daily punch records, status, and punch-level approvals for your team</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <CustomDatePicker
            value={date}
            onChange={(newDate: string) => setDate(newDate)}
            placeholder="Select Date"
          />

          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadAttendance}
            disabled={loading}
            title="Refresh"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '13px',
            fontWeight: 500,
            background: actionMessage.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: actionMessage.type === 'success' ? '#15803d' : '#b91c1c',
            border: `1px solid ${actionMessage.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Summary Chips */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
          <div style={{ background: '#fff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Total Team</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{summary.total}</div>
          </div>
          <div style={{ background: '#fff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', color: '#059669' }}>Present</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#059669' }}>{summary.present}</div>
          </div>
          <div style={{ background: '#fff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', color: '#b45309' }}>Late</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#b45309' }}>{summary.late}</div>
          </div>
          <div style={{ background: '#fff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', color: '#dc2626' }}>Absent</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626' }}>{summary.absent}</div>
          </div>
          <div style={{ background: '#fff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', color: '#7c3aed' }}>Leave</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#7c3aed' }}>{summary.on_leave}</div>
          </div>
          <div style={{ background: '#fff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', color: '#0284c7' }}>Holiday</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0284c7' }}>{summary.holiday}</div>
          </div>
        </div>
      )}

      {/* Search Toolbar */}
      <div className="rm-toolbar" style={{ marginTop: '16px' }}>
        <div className="rm-search" style={{ maxWidth: '380px' }}>
          <Search size={16} className="rm-search-icon" />
          <input
            type="text"
            className="form-control"
            placeholder="Search by employee name, code, dept..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rm-table-card">
        {loading ? (
          <div className="rm-loading">
            <RefreshCw size={24} className="spin" />
            <p>Loading attendance data for {date}...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="rm-empty">
            <Calendar size={36} color="#94a3b8" />
            <p>No team attendance records found for {date}.</p>
          </div>
        ) : (
          <table className="rm-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Code</th>
                <th>Company / Branch</th>
                <th>Department</th>
                <th>Status</th>
                <th style={{ minWidth: '180px' }}>Check In (Approval)</th>
                <th style={{ minWidth: '180px' }}>Check Out (Approval)</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((row) => (
                <tr key={row.employee_id}>
                  <td>
                    <div className="rm-profile-cell">
                      {row.profile_photo ? (
                        <img src={row.profile_photo} alt={row.full_name} className="rm-avatar" />
                      ) : (
                        <div className="rm-avatar" style={{ background: '#eff6ff', color: '#2563eb' }}>
                          <User size={18} strokeWidth={2.2} />
                        </div>
                      )}
                      <div>
                        <div className="rm-name">{row.full_name}</div>
                        <div className="rm-sub">{row.designation || '--'}</div>
                      </div>
                    </div>
                  </td>
                  <td><strong>{row.employee_code}</strong></td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>
                        {row.company_name || 'Yaazh 360'}
                      </span>
                      <span style={{ color: '#64748b', fontSize: '12px' }}>
                        {row.branch_name || 'Main Branch'}
                      </span>
                    </div>
                  </td>
                  <td>{row.department || '--'}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {getStatusBadge(row.calculated_status)}
                      {row.late_minutes > 0 && (
                        <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 600 }}>{formatLateDuration(row.late_minutes)}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {renderPunchApproval(
                      row,
                      'check_in',
                      row.check_in,
                      row.check_in_approval_status,
                      row.check_in_rejection_reason
                    )}
                  </td>
                  <td>
                    {renderPunchApproval(
                      row,
                      'check_out',
                      row.check_out,
                      row.check_out_approval_status,
                      row.check_out_rejection_reason
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Rejection Modal */}
      {rejectingItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                Reject {rejectingItem.type === 'check_in' ? 'Check In' : 'Check Out'}
              </h3>
              <button
                onClick={() => setRejectingItem(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
              Please provide a reason for rejecting {rejectingItem.type === 'check_in' ? 'Check In' : 'Check Out'} for{' '}
              <strong>{rejectingItem.row.full_name}</strong>:
            </p>

            <textarea
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                minHeight: '80px',
                boxSizing: 'border-box',
                marginBottom: '16px',
              }}
              placeholder="e.g. Invalid photo, location discrepancy..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  background: '#f1f5f9',
                  border: 'none',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
                onClick={() => setRejectingItem(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-danger"
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={handleConfirmReject}
                disabled={actionLoading}
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerTeamAttendance;
