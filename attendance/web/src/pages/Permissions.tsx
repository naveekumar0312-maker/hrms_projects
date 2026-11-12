import React, { useEffect, useState } from 'react';
import {
  getPermissions,
  approvePermission,
  rejectPermission,
  undoPermission,
} from '../api/permissions';
import type { PermissionRequest } from '../api/permissions';




function formatPermissionTime(time?: string | null): string {
  if (!time) return "--";
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return time;
  const hours = Number(match[1]);
  const minutes = match[2];
  if (hours > 23 || hours < 0) return time;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${String(displayHour).padStart(2, "0")}:${minutes} ${period}`;
}

const Permissions: React.FC = () => {
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [viewPermission, setViewPermission] = useState<PermissionRequest | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rejectPermissionItem, setRejectPermissionItem] = useState<PermissionRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadPermissions = async () => {
    try {
      setLoading(true);
      setError('');

      const data = await getPermissions();

      setPermissions(
        Array.isArray(data)
          ? data
          : data?.results || []
      );
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

  const handleApprove = async (id: number) => {
    try {
      setActionLoading(id);
      setError('');
      setSuccess('');

      await approvePermission(id);

      setSuccess('Permission request approved successfully.');
      await loadPermissions();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to approve permission request.'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleUndo = async (id: number) => {
    try {
      setActionLoading(id);
      setError('');
      setSuccess('');
      await undoPermission(id);
      setSuccess('Permission request restored to pending successfully.');
      await loadPermissions();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to undo permission request.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = (permission: PermissionRequest) => {
    setRejectionReason('');
    setRejectPermissionItem(permission);
  };

  const submitRejection = async () => {
    if (!rejectPermissionItem || !rejectionReason.trim()) return;

    try {
      setActionLoading(rejectPermissionItem.id);
      setError('');
      setSuccess('');

      await rejectPermission(
        rejectPermissionItem.id,
        rejectionReason.trim()
      );

      setSuccess('Permission request rejected successfully.');
      setRejectPermissionItem(null);
      setRejectionReason('');
      await loadPermissions();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to reject permission request.'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date: string) => {
    if (!date) return '--';

    return new Date(`${date}T00:00:00`).toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    );
  };

  const formatDuration = (minutes: number) => {
    if (minutes === 60) return '1 Hour';
    return `${minutes} Minutes`;
  };

  const getStatusClass = (status: string) => {
    if (status === 'APPROVED') return 'approved';
    if (status === 'REJECTED') return 'rejected';
    return 'pending';
  };

  return (
    <div className="permissions-page">
      <div className="permissions-header">
        <div>
          <div className="permissions-eyebrow">
            ATTENDANCE MANAGEMENT
          </div>

          <h1>Permission Requests</h1>

          <p>
            Review and manage employee permission requests.
          </p>
        </div>

        <div className="permission-summary">
          <div className="summary-number">
            {permissions.filter(
              item => item.status === 'PENDING'
            ).length}
          </div>

          <div className="summary-label">
            Pending Requests
          </div>
        </div>
      </div>

      {success && (
        <div className="permission-alert success">
          {success}
        </div>
      )}

      {error && (
        <div className="permission-alert error">
          {error}
        </div>
      )}

      <div className="permissions-card">
        <div className="card-top">
          <div>
            <h2>All Permission Requests</h2>
            <p>
              Employees can request up to 60 minutes per day
              and 180 minutes per month.
            </p>
          </div>

          <button
            type="button"
            className="refresh-button"
            onClick={loadPermissions}
            disabled={loading}
          >
             Refresh
          </button>
        </div>

        {loading ? (
          <div className="permissions-state">
            <div className="loader" />
            <p>Loading permission requests...</p>
          </div>
        ) : permissions.length === 0 ? (
          <div className="permissions-state empty">
            <div className="empty-icon"></div>
            <h3>No Permission Requests</h3>
            <p>
              There are no permission requests available.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="permissions-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Employee ID</th>
                  <th>Date</th>
                  <th>Permission Time</th>
                  <th>Duration</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {permissions.map(permission => (
                  <tr key={permission.id}>
                    <td>
                      <div className="employee-cell">
                        <div className="employee-avatar">
                          {(permission.employee_name || 'E')
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>
                            {permission.employee_name || '--'}
                          </strong>
                        </div>
                      </div>
                    </td>

                    <td>
                      {permission.employee_id || '--'}
                    </td>

                    <td>
                      {formatDate(permission.date)}
                    </td>

                    <td>
                      {permission.start_time && permission.end_time
                        ? `${formatPermissionTime(permission.start_time)} - ${formatPermissionTime(permission.end_time)}`
                        : '--'}
                    </td>

                    <td>
                      <span className="duration-badge">
                        {formatDuration(permission.duration_minutes)}
                      </span>
                    </td>

                    <td>
                      <div className="reason-cell">
                        {permission.reason || '--'}
                      </div>
                    </td>

                    <td>
                      <span
                        className={`status-badge ${getStatusClass(
                          permission.status
                        )}`}
                      >
                        {permission.status}
                      </span>
                    </td>

                    <td>
                      {permission.status === 'REJECTED'
                        ? permission.rejection_reason || '--'
                        : permission.status === 'APPROVED'
                        ? permission.approved_by_name || 'Approved'
                        : '--'}
                    </td>

                    <td>
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="view-button"
                          onClick={() => setViewPermission(permission)}
                        >
                          View
                        </button>
                      </div>
                      {permission.status === 'PENDING' ? (
                        <div className="action-buttons">
                          <button
                            type="button"
                            className="approve-button"
                            disabled={
                              actionLoading === permission.id
                            }
                            onClick={() =>
                              handleApprove(permission.id)
                            }
                          >
                            {actionLoading === permission.id
                              ? '...'
                              : 'Approve'}
                          </button>

                          <button
                            type="button"
                            className="reject-button"
                            disabled={
                              actionLoading === permission.id
                            }
                            onClick={() =>
                              handleReject(permission)
                            }
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="undo-button"
                          disabled={actionLoading === permission.id}
                          onClick={() => handleUndo(permission.id)}
                        >
                          {actionLoading === permission.id ? 'Undoing...' : 'Undo'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewPermission && (
        <div
          role="presentation"
          onClick={() => setViewPermission(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="permission-details-title"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '620px',
              maxHeight: 'min(88vh, 820px)',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              boxSizing: 'border-box',
              background: '#fff',
              borderRadius: '18px',
              padding: '24px',
              boxShadow: '0 24px 70px rgba(15,23,42,0.2)',
              color: '#0f172a',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
              marginBottom: '22px',
            }}>
              <div>
                <h3 id="permission-details-title" style={{
                  margin: 0,
                  fontSize: '1.15rem',
                  color: '#0f172a',
                }}>
                  Permission Details
                </h3>
                <p style={{
                  margin: '4px 0 0',
                  fontSize: '0.78rem',
                  color: '#64748b',
                }}>
                  Employee permission request information
                </p>
              </div>
              <button
                type="button"
                aria-label="Close permission details"
                onClick={() => setViewPermission(null)}
                style={{
                  border: 'none',
                  background: '#f1f5f9',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: '#475569',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '12px',
              fontSize: '13px',
              lineHeight: 1.6,
              overflowWrap: 'anywhere',
            }}>
              <div>
                <strong>Employee</strong>
                <div>{viewPermission.employee_name || '--'}</div>
              </div>
              <div>
                <strong>Employee ID</strong>
                <div>{viewPermission.employee_id || '--'}</div>
              </div>
              <div>
                <strong>Permission Date</strong>
                <div>{formatDate(viewPermission.date)}</div>
              </div>
              <div>
                <strong>Start Time</strong>
                <div>{formatPermissionTime(viewPermission.start_time)}</div>
              </div>
              <div>
                <strong>End Time</strong>
                <div>{formatPermissionTime(viewPermission.end_time)}</div>
              </div>
              <div>
                <strong>Duration</strong>
                <div>{formatDuration(viewPermission.duration_minutes)}</div>
              </div>
              <div>
                <strong>Reason</strong>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {viewPermission.reason || '--'}
                </div>
              </div>
              <div>
                <strong>Status</strong>
                <div>
                  <span className={`status-badge ${getStatusClass(viewPermission.status)}`}>
                    {viewPermission.status}
                  </span>
                </div>
              </div>
              {viewPermission.approved_by_name && (
                <div>
                  <strong>Processed By</strong>
                  <div>{viewPermission.approved_by_name}</div>
                </div>
              )}
              {viewPermission.approved_at && (
                <div>
                  <strong>Processed At</strong>
                  <div>{new Date(viewPermission.approved_at).toLocaleString('en-IN')}</div>
                </div>
              )}
              {viewPermission.rejection_reason && (
                <div>
                  <strong>Rejection Reason</strong>
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {viewPermission.rejection_reason}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setViewPermission(null)}
              style={{
                width: '100%',
                marginTop: '20px',
                padding: '10px',
                border: 'none',
                borderRadius: '9px',
                background: '#E56108',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <style>{`

        /* Table alignment improvements */
        .permissions-page .table-wrapper {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .permissions-page .permissions-table {
          width: 100%;
          min-width: 1320px;
          table-layout: fixed;
          border-collapse: separate;
          border-spacing: 0;
        }

        .permissions-page .permissions-table th,
        .permissions-page .permissions-table td {
          box-sizing: border-box;
          overflow-wrap: anywhere;
          word-break: normal;
          line-height: 1.5;
        }

        .permissions-page .permissions-table th:nth-child(1),
        .permissions-page .permissions-table td:nth-child(1) { width: 170px; }

        .permissions-page .permissions-table th:nth-child(2),
        .permissions-page .permissions-table td:nth-child(2) { width: 115px; }

        .permissions-page .permissions-table th:nth-child(3),
        .permissions-page .permissions-table td:nth-child(3) { width: 115px; }

        .permissions-page .permissions-table th:nth-child(4),
        .permissions-page .permissions-table td:nth-child(4) { width: 145px; }

        .permissions-page .permissions-table th:nth-child(5),
        .permissions-page .permissions-table td:nth-child(5) { width: 110px; }

        .permissions-page .permissions-table th:nth-child(6),
        .permissions-page .permissions-table td:nth-child(6) { width: 230px; }

        .permissions-page .permissions-table th:nth-child(7),
        .permissions-page .permissions-table td:nth-child(7) { width: 115px; }

        .permissions-page .permissions-table th:nth-child(8),
        .permissions-page .permissions-table td:nth-child(8) { width: 145px; }

        .permissions-page .permissions-table th:nth-child(9),
        .permissions-page .permissions-table td:nth-child(9) { width: 175px; }

        .permissions-page .permissions-table td:nth-child(4),
        .permissions-page .permissions-table td:nth-child(5),
        .permissions-page .permissions-table td:nth-child(7) {
          white-space: normal;
        }

        .permissions-page .permissions-table .action-buttons {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 7px;
          margin-bottom: 7px;
        }

        .permissions-page .permissions-table .view-button,
        .permissions-page .permissions-table .approve-button,
        .permissions-page .permissions-table .reject-button,
        .permissions-page .permissions-table .undo-button {
          box-sizing: border-box;
          min-height: 34px;
          margin: 0;
          white-space: nowrap;
        }

        .permissions-page .permissions-table tbody tr:hover {
          background: #f8fafc;
        }

        @media (max-width: 768px) {
          .permissions-page .permissions-table {
            min-width: 1320px;
          }
        }
        .permissions-page {
          padding: 28px;
          background: #f8fafc;
          min-height: 100%;
          color: #0f172a;
        }

        .permissions-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .permissions-eyebrow {
          color: #E56108;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.5px;
          margin-bottom: 7px;
        }

        .permissions-header h1 {
          margin: 0;
          font-size: 30px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .permissions-header p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .permission-summary {
          min-width: 150px;
          padding: 18px 20px;
          border-radius: 16px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          box-shadow: 0 8px 24px rgba(7, 87, 184, 0.05);
        }

        .summary-number {
          font-size: 26px;
          font-weight: 800;
          color: #E56108;
        }

        .summary-label {
          margin-top: 3px;
          font-size: 12px;
          color: #64748b;
          font-weight: 600;
        }

        .permission-alert {
          padding: 13px 16px;
          border-radius: 12px;
          margin-bottom: 18px;
          font-size: 13px;
          font-weight: 600;
        }

        .permission-alert.success {
          background: #eff6ff;
          color: #E56108;
          border: 1px solid #bfdbfe;
        }

        .permission-alert.error {
          background: #fff0f0;
          color: #b23b3b;
          border: 1px solid #f2cccc;
        }

        .permissions-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          box-shadow: 0 8px 28px rgba(7, 87, 184, 0.05);
          overflow: hidden;
        }

        .card-top {
          padding: 21px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          border-bottom: 1px solid #e2e8f0;
        }

        .card-top h2 {
          margin: 0;
          font-size: 17px;
          font-weight: 800;
        }

        .card-top p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 12px;
        }

        .refresh-button {
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          color: #E56108;
          padding: 9px 14px;
          border-radius: 9px;
          font-weight: 700;
          cursor: pointer;
        }

        .refresh-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .permissions-table {
          width: 100%;
          min-width: 1050px;
          border-collapse: collapse;
        }

        .permissions-table th {
          padding: 14px 18px;
          text-align: left;
          background: #f8fafc;
          color: #64748b;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.7px;
          font-weight: 800;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        .permissions-table td {
          padding: 15px 18px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 13px;
          color: #334155;
          vertical-align: middle;
        }

        .employee-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 155px;
        }

        .employee-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eff6ff;
          color: #E56108;
          font-weight: 800;
          flex-shrink: 0;
        }

        .employee-cell strong {
          color: #0f172a;
          font-size: 13px;
        }

        .duration-badge {
          display: inline-flex;
          padding: 6px 9px;
          border-radius: 8px;
          background: #eff6ff;
          color: #E56108;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .reason-cell {
          max-width: 220px;
          line-height: 1.45;
        }

        .status-badge {
          display: inline-flex;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.3px;
        }

        .status-badge.pending {
          background: #fff7df;
          color: #a16d08;
        }

        .status-badge.approved {
          background: #eff6ff;
          color: #E56108;
        }

        .status-badge.rejected {
          background: #fff0f0;
          color: #b23b3b;
        }

        .action-buttons {
          display: flex;
          gap: 7px;
        }

        .approve-button,
        .reject-button {
          border: none;
          padding: 7px 11px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }

        .approve-button {
          background: #E56108;
          color: white;
        }

        .reject-button {
          background: #fff0f0;
          color: #b23b3b;
          border: 1px solid #f0cccc;
        }

        .approve-button:disabled,
        .reject-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .undo-button {
          padding: 6px 12px;
          border: 1px solid #d97706;
          border-radius: 6px;
          background: #fff7ed;
          color: #9a3412;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .undo-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .view-button {
          padding: 6px 12px;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          background: #eff6ff;
          color: #E56108;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .action-completed {
          color: #94a3b8;
          font-size: 11px;
          font-weight: 700;
        }

        .permissions-state {
          min-height: 300px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #64748b;
        }

        .permissions-state p {
          margin: 10px 0 0;
          font-size: 13px;
        }

        .permissions-state.empty h3 {
          margin: 12px 0 0;
          color: #334155;
          font-size: 16px;
        }

        .permissions-state.empty p {
          margin-top: 5px;
        }

        .empty-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eff6ff;
          color: #E56108;
          font-size: 22px;
          font-weight: 800;
        }

        .loader {
          width: 26px;
          height: 26px;
          border: 3px solid #e2e8f0;
          border-top-color: #E56108;
          border-radius: 50%;
          animation: permissionSpin 0.8s linear infinite;
        }

        @keyframes permissionSpin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 768px) {
  
        /* Table alignment improvements */
        .permissions-page .table-wrapper {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .permissions-page .permissions-table {
          width: 100%;
          min-width: 1320px;
          table-layout: fixed;
          border-collapse: separate;
          border-spacing: 0;
        }

        .permissions-page .permissions-table th,
        .permissions-page .permissions-table td {
          box-sizing: border-box;
          overflow-wrap: anywhere;
          word-break: normal;
          line-height: 1.5;
        }

        .permissions-page .permissions-table th:nth-child(1),
        .permissions-page .permissions-table td:nth-child(1) { width: 170px; }

        .permissions-page .permissions-table th:nth-child(2),
        .permissions-page .permissions-table td:nth-child(2) { width: 115px; }

        .permissions-page .permissions-table th:nth-child(3),
        .permissions-page .permissions-table td:nth-child(3) { width: 115px; }

        .permissions-page .permissions-table th:nth-child(4),
        .permissions-page .permissions-table td:nth-child(4) { width: 145px; }

        .permissions-page .permissions-table th:nth-child(5),
        .permissions-page .permissions-table td:nth-child(5) { width: 110px; }

        .permissions-page .permissions-table th:nth-child(6),
        .permissions-page .permissions-table td:nth-child(6) { width: 230px; }

        .permissions-page .permissions-table th:nth-child(7),
        .permissions-page .permissions-table td:nth-child(7) { width: 115px; }

        .permissions-page .permissions-table th:nth-child(8),
        .permissions-page .permissions-table td:nth-child(8) { width: 145px; }

        .permissions-page .permissions-table th:nth-child(9),
        .permissions-page .permissions-table td:nth-child(9) { width: 175px; }

        .permissions-page .permissions-table td:nth-child(4),
        .permissions-page .permissions-table td:nth-child(5),
        .permissions-page .permissions-table td:nth-child(7) {
          white-space: normal;
        }

        .permissions-page .permissions-table .action-buttons {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 7px;
          margin-bottom: 7px;
        }

        .permissions-page .permissions-table .view-button,
        .permissions-page .permissions-table .approve-button,
        .permissions-page .permissions-table .reject-button,
        .permissions-page .permissions-table .undo-button {
          box-sizing: border-box;
          min-height: 34px;
          margin: 0;
          white-space: nowrap;
        }

        .permissions-page .permissions-table tbody tr:hover {
          background: #f8fafc;
        }

        @media (max-width: 768px) {
          .permissions-page .permissions-table {
            min-width: 1320px;
          }
        }
        .permissions-page {
            padding: 18px 14px;
          }

          .permissions-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .permissions-header h1 {
            font-size: 24px;
          }

          .permission-summary {
            width: 100%;
            box-sizing: border-box;
          }

          .card-top {
            align-items: flex-start;
            flex-direction: column;
          }

          .refresh-button {
            width: 100%;
          }
        }
      `}</style>

      {rejectPermissionItem && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.55)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '20px'
        }}>
          <div role="dialog" aria-modal="true"
            aria-labelledby="reject-modal-title"
            style={{
              width: '100%', maxWidth: '460px',
              background: '#fff', borderRadius: '14px',
              padding: '26px', boxShadow: '0 20px 60px rgba(0,0,0,.2)'
            }}>
            <h2 id="reject-modal-title"
              style={{ margin: '0 0 8px', color: '#172033' }}>
              Reject Permission Request
            </h2>
            <p style={{ color: '#64748b', marginBottom: '18px' }}>
              Enter a reason for rejecting this request.
            </p>
            <textarea
              autoFocus
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Enter rejection reason..."
              rows={4}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px', border: '1px solid #cbd5e1',
                borderRadius: '8px', resize: 'vertical',
                font: 'inherit', marginBottom: '20px'
              }}
            />
            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: '10px'
            }}>
              <button type="button"
                disabled={actionLoading === rejectPermissionItem.id}
                onClick={() => {
                  setRejectPermissionItem(null);
                  setRejectionReason('');
                }}
                style={{
                  padding: '10px 18px', borderRadius: '8px',
                  border: '1px solid #cbd5e1', background: '#fff',
                  cursor: 'pointer'
                }}>
                Cancel
              </button>
              <button type="button"
                disabled={!rejectionReason.trim() || actionLoading === rejectPermissionItem.id}
                onClick={() => void submitRejection()}
                style={{
                  padding: '10px 18px', borderRadius: '8px',
                  border: 'none', background: '#dc2626',
                  color: '#fff', fontWeight: 600, cursor: 'pointer',
                  opacity: (!rejectionReason.trim() || actionLoading === rejectPermissionItem.id) ? 0.6 : 1
                }}>
                {actionLoading === rejectPermissionItem.id ? 'Rejecting...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Permissions;











