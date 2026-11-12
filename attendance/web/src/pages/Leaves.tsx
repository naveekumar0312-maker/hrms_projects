import React, { useEffect, useState } from 'react';
import {
  getLeaves,
  approveLeave,
  rejectLeave,
  undoLeave,
} from '../api/leaves';
import type { LeaveRequest } from '../api/leaves';

const Leaves: React.FC = () => {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [viewLeave, setViewLeave] = useState<LeaveRequest | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadLeaves = async () => {
    try {
      setLoading(true);
      setError('');

      const data = await getLeaves();

      setLeaves(
        Array.isArray(data)
          ? data
          : data?.results || []
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to load leave requests.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      setActionLoading(id);
      setError('');
      setSuccess('');

      await approveLeave(id);

      setSuccess(
        'Leave request approved successfully.'
      );

      await loadLeaves();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to approve leave request.'
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
      await undoLeave(id);
      setSuccess('Leave request restored to pending successfully.');
      await loadLeaves();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to undo leave request.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (
    leave: LeaveRequest
  ) => {
    const reason = window.prompt(
      'Enter rejection reason:'
    );

    if (!reason?.trim()) {
      return;
    }

    try {
      setActionLoading(leave.id);
      setError('');
      setSuccess('');

      await rejectLeave(
        leave.id,
        reason.trim()
      );

      setSuccess(
        'Leave request rejected successfully.'
      );

      await loadLeaves();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to reject leave request.'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date: string) => {
    if (!date) return '--';

    return new Date(
      `${date}T00:00:00`
    ).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (value?: string) => {
    if (!value) return '--';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '--'
      : date.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
  };

  const statusClass = (status: string) => {
    if (status === 'APPROVED') return 'approved';
    if (status === 'REJECTED') return 'rejected';
    return 'pending';
  };

  return (
    <div className="leaves-page">
      <div className="leaves-header">
        <div>
          <div className="eyebrow">
            ATTENDANCE MANAGEMENT
          </div>

          <h1>Leave Requests</h1>

          <p>
            Review and manage employee leave requests.
          </p>
        </div>

        <div className="summary">
          <strong>
            {
              leaves.filter(
                item => item.status === 'PENDING'
              ).length
            }
          </strong>
          <span>Pending Requests</span>
        </div>
      </div>

      {success && (
        <div className="alert success">
          {success}
        </div>
      )}

      {error && (
        <div className="alert error">
          {error}
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <div>
            <h2>All Leave Requests</h2>
            <p>
              Approve or reject employee leave applications.
            </p>
          </div>

          <button
            className="refresh"
            onClick={loadLeaves}
            disabled={loading}
          >
             Refresh
          </button>
        </div>

        {loading ? (
          <div className="state">
            Loading leave requests...
          </div>
        ) : leaves.length === 0 ? (
          <div className="state">
            No leave requests found.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Employee ID</th>
                  <th>Leave Type</th>
                  <th>Period</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {leaves.map(leave => (
                  <tr key={leave.id}>
                    <td>
                      <strong>
                        {leave.employee_name || '--'}
                      </strong>
                    </td>

                    <td>
                      {leave.employee_id || '--'}
                    </td>

                    <td>
                      {leave.leave_type.replace(
                        /_/g,
                        ' '
                      )}
                    </td>

                    <td>
                      {formatDate(leave.start_date)}
                      <br />
                      <span className="to">
                        to
                      </span>
                      <br />
                      {formatDate(leave.end_date)}
                    </td>

                    <td className="reason">
                      {leave.reason || '--'}
                    </td>

                    <td>
                      <span
                        className={`status ${statusClass(
                          leave.status
                        )}`}
                      >
                        {leave.status}
                      </span>
                    </td>

                    <td className="remarks">
                      {leave.status === 'REJECTED'
                        ? leave.rejection_reason || '--'
                        : leave.status === 'APPROVED'
                        ? leave.approved_by_name || 'Approved'
                        : '--'}
                    </td>

                    <td>
                      {leave.status === 'PENDING' ? (
                        <div className="actions">
                          <button
                            type="button"
                            className="view"
                            onClick={() => setViewLeave(leave)}
                          >
                            View
                          </button>
                          <button
                            className="approve"
                            disabled={
                              actionLoading === leave.id
                            }
                            onClick={() =>
                              handleApprove(leave.id)
                            }
                          >
                            {actionLoading === leave.id
                              ? '...'
                              : 'Approve'}
                          </button>

                          <button
                            className="reject"
                            disabled={
                              actionLoading === leave.id
                            }
                            onClick={() =>
                              handleReject(leave)
                            }
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="undo-button"
                          disabled={actionLoading === leave.id}
                          onClick={() => handleUndo(leave.id)}
                        >
                          {actionLoading === leave.id ? 'Undoing...' : 'Undo'}
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

      {viewLeave && (
        <div
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
          onClick={() => setViewLeave(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '620px',
              background: '#fff',
              borderRadius: '18px',
              padding: '24px',
              boxShadow: '0 24px 70px rgba(15,23,42,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.15rem',
                    color: '#0f172a',
                  }}
                >
                  Leave Details
                </h3>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: '0.78rem',
                    color: '#64748b',
                  }}
                >
                  Employee leave request information
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewLeave(null)}
                style={{
                  border: 'none',
                  background: '#f1f5f9',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: '#475569',
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gap: '12px',
              }}
            >
              <div>
                <strong>Employee</strong>
                <div>{viewLeave.employee_name || '--'}</div>
              </div>

              <div>
                <strong>Employee ID</strong>
                <div>{viewLeave.employee_id || '--'}</div>
              </div>

              <div>
                <strong>Leave Type</strong>
                <div>{viewLeave.leave_type || '--'}</div>
              </div>

              <div>
                <strong>Period</strong>
                <div>
                  {formatDate(viewLeave.start_date)} to{' '}
                  {formatDate(viewLeave.end_date)}
                </div>
              </div>

              <div>
                <strong>Applied At</strong>
                <div>{formatDateTime(viewLeave.created_at)}</div>
              </div>

              <div>
                <strong>Reason</strong>
                <div>{viewLeave.reason || '--'}</div>
              </div>

              <div>
                <strong>Status</strong>
                <div>{viewLeave.status || '--'}</div>
              </div>

              {viewLeave.rejection_reason && (
                <div>
                  <strong>Rejection Reason</strong>
                  <div>{viewLeave.rejection_reason}</div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setViewLeave(null)}
              style={{
                width: '100%',
                marginTop: '20px',
                padding: '10px',
                border: 'none',
                borderRadius: '9px',
                background: '#0757B8',
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

        /* Leave table alignment improvements */
        .leaves-page .table-wrap {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .leaves-page .table-wrap table {
          width: 100%;
          min-width: 1250px;
          table-layout: fixed;
          border-collapse: separate;
          border-spacing: 0;
        }

        .leaves-page .table-wrap th,
        .leaves-page .table-wrap td {
          box-sizing: border-box;
          overflow-wrap: anywhere;
          word-break: normal;
          line-height: 1.5;
        }

        .leaves-page .table-wrap th:nth-child(1),
        .leaves-page .table-wrap td:nth-child(1) { width: 150px; }

        .leaves-page .table-wrap th:nth-child(2),
        .leaves-page .table-wrap td:nth-child(2) { width: 115px; }

        .leaves-page .table-wrap th:nth-child(3),
        .leaves-page .table-wrap td:nth-child(3) { width: 125px; }

        .leaves-page .table-wrap th:nth-child(4),
        .leaves-page .table-wrap td:nth-child(4) { width: 145px; }

        .leaves-page .table-wrap th:nth-child(5),
        .leaves-page .table-wrap td:nth-child(5) { width: 230px; }

        .leaves-page .table-wrap th:nth-child(6),
        .leaves-page .table-wrap td:nth-child(6) { width: 120px; }

        .leaves-page .table-wrap th:nth-child(7),
        .leaves-page .table-wrap td:nth-child(7) { width: 160px; }

        .leaves-page .table-wrap th:nth-child(8),
        .leaves-page .table-wrap td:nth-child(8) { width: 205px; }

        .leaves-page .table-wrap td:nth-child(4) {
          white-space: normal;
          vertical-align: middle;
        }

        .leaves-page .table-wrap td:nth-child(4) .to {
          display: inline-block;
          margin: 3px 0;
        }

        .leaves-page .actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 7px;
        }

        .leaves-page .actions button,
        .leaves-page .undo-button {
          box-sizing: border-box;
          min-height: 34px;
          margin: 0;
          white-space: nowrap;
        }

        .leaves-page .table-wrap tbody tr:hover {
          background: #f8fafc;
        }

        @media (max-width: 700px) {
          .leaves-page .table-wrap table {
            min-width: 1250px;
          }
        }
        .leaves-page {
          min-height: 100%;
          padding: 28px;
          background: #f8fafc;
          color: #0f172a;
        }

        .leaves-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .eyebrow {
          color: #0757B8;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.5px;
          margin-bottom: 7px;
        }

        .leaves-header h1 {
          margin: 0;
          font-size: 30px;
          font-weight: 800;
        }

        .leaves-header p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .summary {
          min-width: 150px;
          padding: 17px 20px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
        }

        .summary strong {
          color: #0757B8;
          font-size: 26px;
        }

        .summary span {
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
        }

        .alert {
          padding: 13px 16px;
          border-radius: 12px;
          margin-bottom: 18px;
          font-size: 13px;
          font-weight: 600;
        }

        .alert.success {
          background: #eff6ff;
          color: #0757B8;
        }

        .alert.error {
          background: #fff0f0;
          color: #b23b3b;
        }

        .leaves-page .card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 8px 28px rgba(7, 87, 184, 0.05);
        }

        .leaves-page .card-head {
          padding: 21px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .leaves-page .card-head h2 {
          margin: 0;
          font-size: 17px;
          font-weight: 800;
        }

        .leaves-page .card-head p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 12px;
        }

        .leaves-page .refresh {
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          color: #0757B8;
          padding: 9px 14px;
          border-radius: 9px;
          font-weight: 700;
          cursor: pointer;
        }

        .leaves-page .table-wrap {
          overflow-x: auto;
        }

        .leaves-page .table-wrap table {
          width: 100%;
          min-width: 1050px;
          border-collapse: collapse;
        }

        .leaves-page .table-wrap th {
          padding: 14px 18px;
          text-align: left;
          background: #f8fafc;
          color: #70877d;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.7px;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        .leaves-page .table-wrap td {
          padding: 15px 18px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 13px;
          color: #334155;
          vertical-align: middle;
        }

        .leaves-page .table-wrap td strong {
          color: #0f172a;
        }

        .to {
          color: #94a3b8;
          font-size: 10px;
        }

        .reason {
          max-width: 220px;
          line-height: 1.45;
        }

        .remarks {
          max-width: 180px;
          font-size: 12px;
        }

        .status {
          display: inline-flex;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
        }

        .status.pending {
          background: #fff7df;
          color: #a16d08;
        }

        .status.approved {
          background: #eff6ff;
          color: #0757B8;
        }

        .status.rejected {
          background: #fff0f0;
          color: #b23b3b;
        }

        .actions {
          display: flex;
          gap: 7px;
        }

        .view {
          background: #f8fafc;
          color: #334155;
          border: 1px solid #dbe3e8;
          padding: 7px 11px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .view:hover {
          background: #f1f5f9;
        }

        .approve,
        .reject {
          border: none;
          padding: 7px 11px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .approve {
          background: #0757B8;
          color: white;
        }

        .reject {
          background: #fff0f0;
          color: #b23b3b;
          border: 1px solid #f0cccc;
        }

        .approve:disabled,
        .reject:disabled {
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

        .completed {
          color: #94a3b8;
          font-size: 11px;
          font-weight: 700;
        }

        .state {
          min-height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          font-size: 13px;
        }

        @media (max-width: 700px) {
  
        /* Leave table alignment improvements */
        .leaves-page .table-wrap {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .leaves-page .table-wrap table {
          width: 100%;
          min-width: 1250px;
          table-layout: fixed;
          border-collapse: separate;
          border-spacing: 0;
        }

        .leaves-page .table-wrap th,
        .leaves-page .table-wrap td {
          box-sizing: border-box;
          overflow-wrap: anywhere;
          word-break: normal;
          line-height: 1.5;
        }

        .leaves-page .table-wrap th:nth-child(1),
        .leaves-page .table-wrap td:nth-child(1) { width: 150px; }

        .leaves-page .table-wrap th:nth-child(2),
        .leaves-page .table-wrap td:nth-child(2) { width: 115px; }

        .leaves-page .table-wrap th:nth-child(3),
        .leaves-page .table-wrap td:nth-child(3) { width: 125px; }

        .leaves-page .table-wrap th:nth-child(4),
        .leaves-page .table-wrap td:nth-child(4) { width: 145px; }

        .leaves-page .table-wrap th:nth-child(5),
        .leaves-page .table-wrap td:nth-child(5) { width: 230px; }

        .leaves-page .table-wrap th:nth-child(6),
        .leaves-page .table-wrap td:nth-child(6) { width: 120px; }

        .leaves-page .table-wrap th:nth-child(7),
        .leaves-page .table-wrap td:nth-child(7) { width: 160px; }

        .leaves-page .table-wrap th:nth-child(8),
        .leaves-page .table-wrap td:nth-child(8) { width: 205px; }

        .leaves-page .table-wrap td:nth-child(4) {
          white-space: normal;
          vertical-align: middle;
        }

        .leaves-page .table-wrap td:nth-child(4) .to {
          display: inline-block;
          margin: 3px 0;
        }

        .leaves-page .actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 7px;
        }

        .leaves-page .actions button,
        .leaves-page .undo-button {
          box-sizing: border-box;
          min-height: 34px;
          margin: 0;
          white-space: nowrap;
        }

        .leaves-page .table-wrap tbody tr:hover {
          background: #f8fafc;
        }

        @media (max-width: 700px) {
          .leaves-page .table-wrap table {
            min-width: 1250px;
          }
        }
        .leaves-page {
            padding: 18px 14px;
          }

          .leaves-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .summary {
            width: 100%;
            box-sizing: border-box;
          }

          .leaves-page .card-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .leaves-page .refresh {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default Leaves;







