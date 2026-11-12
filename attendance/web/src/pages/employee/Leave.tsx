import React, { useEffect, useState } from 'react';
import CustomDatePicker from '../../components/CustomDatePicker';
import { CustomSelect } from '../../components/CustomSelect';
import {
  createLeave,
  getLeaves,
  updateLeave,
  deleteLeave,
} from '../../api/leaves';
import type { LeaveRequest } from '../../api/leaves';

const Leave: React.FC = () => {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [leaveType, setLeaveType] = useState('CASUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [viewLeave, setViewLeave] = useState<LeaveRequest | null>(null);
  const [editLeave, setEditLeave] = useState<LeaveRequest | null>(null);
  const [deleteLeaveTarget, setDeleteLeaveTarget] = useState<LeaveRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [editLeaveType, setEditLeaveType] = useState('CASUAL');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editReason, setEditReason] = useState('');

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

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    const effectiveEndDate = leaveType === 'HALF_DAY' ? startDate : endDate

    if (!startDate || !effectiveEndDate || !reason.trim()) {
      setError('Please fill all required fields.');
      return;
    }

    if (effectiveEndDate < startDate) {
      setError(
        'End date cannot be earlier than start date.'
      );
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      await createLeave({
        leave_type: leaveType,
        start_date: startDate,
        end_date: effectiveEndDate,
        reason: reason.trim(),
      });

      setStartDate('');
      setEndDate('');
      setLeaveType('CASUAL');
      setReason('');

      setSuccess(
        'Leave request submitted successfully.'
      );

      await loadLeaves();
    } catch (err: any) {
      const data = err?.response?.data;

      setError(
        data?.detail ||
        data?.error ||
        data?.non_field_errors?.[0] ||
        data?.start_date?.[0] ||
        data?.end_date?.[0] ||
        'Failed to submit leave request.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openEditLeave = (item: LeaveRequest) => {
    if (item.status !== 'PENDING') return;

    setError('');
    setSuccess('');
    setEditLeave(item);
    setEditLeaveType(item.leave_type);
    setEditStartDate(item.start_date);
    setEditEndDate(item.end_date);
    setEditReason(item.reason);
  };

  const saveLeaveEdit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!editLeave || editLeave.status !== 'PENDING') return;

    const effectiveEndDate =
      editLeaveType === 'HALF_DAY' ? editStartDate : editEndDate;

    if (!editStartDate || !effectiveEndDate || !editReason.trim()) {
      setError('Please fill all required fields.');
      return;
    }

    if (effectiveEndDate < editStartDate) {
      setError('End date cannot be earlier than start date.');
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      setSuccess('');

      await updateLeave(editLeave.id, {
        leave_type: editLeaveType,
        start_date: editStartDate,
        end_date: effectiveEndDate,
        reason: editReason.trim(),
      });

      setEditLeave(null);
      setSuccess('Leave request updated successfully.');
      await loadLeaves();
    } catch (err: any) {
      const data = err?.response?.data;
      setError(
        data?.detail ||
        data?.error ||
        data?.non_field_errors?.[0] ||
        data?.start_date?.[0] ||
        data?.end_date?.[0] ||
        data?.reason?.[0] ||
        'Failed to update leave request.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDeleteLeave = async () => {
    if (!deleteLeaveTarget || deleteLeaveTarget.status !== 'PENDING') {
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      setSuccess('');

      await deleteLeave(deleteLeaveTarget.id);

      setDeleteLeaveTarget(null);
      setSuccess('Leave request deleted successfully.');
      await loadLeaves();
    } catch (err: any) {
      const data = err?.response?.data;
      setError(
        data?.detail ||
        data?.error ||
        'Failed to delete leave request.'
      );
    } finally {
      setActionLoading(false);
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

  const getStatusClass = (status: string) => {
    if (status === 'APPROVED') return 'approved';
    if (status === 'REJECTED') return 'rejected';
    return 'pending';
  };

  return (
    <div className="leave-page">
      <div className="leave-header">
        <div>
          <div className="leave-eyebrow">
            ATTENDANCE MANAGEMENT
          </div>

          <h1>Leave</h1>

          <p>
            Apply for leave and track your requests.
          </p>
        </div>

        <div className="leave-summary">
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
        <div className="leave-alert success">
          {success}
        </div>
      )}

      {error && (
        <div className="leave-alert error">
          {error}
        </div>
      )}

      <div className="leave-grid">
        <div className="leave-card">
          <div className="card-heading">
            <h2>Apply Leave</h2>
            <p>
              Submit your leave request for approval.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <label>
              Leave Type
            </label>

            <CustomSelect
              value={leaveType}
              onChange={setLeaveType}
              options={[
                { value: 'CASUAL', label: 'Casual Leave' },
                { value: 'SICK', label: 'Sick Leave' },
                { value: 'ANNUAL', label: 'Annual Leave' },
                { value: 'PERSONAL', label: 'Personal Leave' },
                { value: 'HALF_DAY', label: 'Half Day' },
                { value: 'OTHER', label: 'Other' },
              ]}
              placeholder="Select leave type"
            />

            <div className="date-grid">
              <div>
                <label>{leaveType === 'HALF_DAY' ? 'Half Day Date' : 'Start Date'}</label>
                <CustomDatePicker
                  value={startDate}
                  onChange={(value) => {
                    setStartDate(value);
                    if (leaveType === 'HALF_DAY') setEndDate(value);
                    else if (endDate && value > endDate) setEndDate(value);
                  }}
                  required
                />
              </div>

              {leaveType !== 'HALF_DAY' && (
                <div>
                  <label>End Date</label>
                  <CustomDatePicker
                    value={endDate}
                    onChange={setEndDate}
                    minDate={startDate}
                    required
                  />
                </div>
              )}
            </div>

            <label>Reason</label>

            <textarea
              value={reason}
              onChange={event =>
                setReason(event.target.value)
              }
              placeholder="Please explain the reason for your leave clearly, including any relevant details..."
              rows={5}
            />

            <button
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? 'Submitting...'
                : 'Apply Leave'}
            </button>
          </form>
        </div>

        <div className="leave-card">
          <div className="card-heading">
            <h2>Leave History</h2>
            <p>
              Your previous and current leave requests.
            </p>
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
            <div className="history-list">
              {leaves.map(item => (
                <div
                  className="history-item"
                  key={item.id}
                >
                  <div className="history-main">
                    <strong>
                      {item.leave_type.replace(
                        /_/g,
                        ' '
                      )}
                    </strong>

                    <span>
                      {formatDate(item.start_date)}
                      {'  '}
                      {formatDate(item.end_date)}
                    </span>

                    <p>{item.reason}</p>

                    {item.status === 'REJECTED' &&
                      item.rejection_reason && (
                        <small>
                          Rejection: {
                            item.rejection_reason
                          }
                        </small>
                      )}
                  </div>

                  <span
                    className={`status ${getStatusClass(
                      item.status
                    )}`}
                  >
                    {item.status}
                  </span>

                  <div className="leave-actions">
                    <button type="button" onClick={() => setViewLeave(item)}>View</button>
                    {item.status === 'PENDING' && (
                      <>
                        <button type="button" onClick={() => openEditLeave(item)}>Edit</button>
                        <button type="button" className="delete-action" onClick={() => setDeleteLeaveTarget(item)}>Delete</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {(viewLeave || editLeave || deleteLeaveTarget) && (
        <div className="leave-modal-backdrop" onClick={() => {
          if (!actionLoading) {
            setViewLeave(null);
            setEditLeave(null);
            setDeleteLeaveTarget(null);
          }
        }}>
          <div className="leave-modal" onClick={event => event.stopPropagation()}>
            {viewLeave && (
              <>
                <h2>Leave Request Details</h2>
                <p><strong>Leave Type:</strong> {viewLeave.leave_type.replace(/_/g, ' ')}</p>
                <p><strong>Start Date:</strong> {formatDate(viewLeave.start_date)}</p>
                <p><strong>End Date:</strong> {formatDate(viewLeave.end_date)}</p>
                <p><strong>Reason:</strong> {viewLeave.reason}</p>
                <p><strong>Status:</strong> {viewLeave.status}</p>
                <p><strong>Applied At:</strong> {viewLeave.created_at ? new Date(viewLeave.created_at).toLocaleString('en-IN') : '--'}</p>
                {viewLeave.rejection_reason && <p><strong>Remarks:</strong> {viewLeave.rejection_reason}</p>}
                <button type="button" onClick={() => setViewLeave(null)}>Close</button>
              </>
            )}

            {editLeave && (
              <>
                <h2>Edit Leave Request</h2>
                <form onSubmit={saveLeaveEdit}>
                  <label>Leave Type</label>
                  <CustomSelect
                    value={editLeaveType}
                    onChange={setEditLeaveType}
                    options={[
                      { value: 'CASUAL', label: 'Casual Leave' },
                      { value: 'SICK', label: 'Sick Leave' },
                      { value: 'ANNUAL', label: 'Annual Leave' },
                      { value: 'PERSONAL', label: 'Personal Leave' },
                      { value: 'HALF_DAY', label: 'Half Day' },
                      { value: 'OTHER', label: 'Other' },
                    ]}
                    placeholder="Select leave type"
                  />
                  <label>{editLeaveType === 'HALF_DAY' ? 'Half Day Date' : 'Start Date'}</label>
                  <CustomDatePicker
                    value={editStartDate}
                    onChange={(value) => {
                      setEditStartDate(value);
                      if (editLeaveType === 'HALF_DAY' || (editEndDate && value > editEndDate)) setEditEndDate(value);
                    }}
                    required
                  />
                  {editLeaveType !== 'HALF_DAY' && <>
                    <label>End Date</label>
                    <CustomDatePicker
                      value={editEndDate}
                      onChange={setEditEndDate}
                      minDate={editStartDate}
                      required
                    />
                  </>}
                  <label>Reason</label>
                  <textarea value={editReason} required onChange={event => setEditReason(event.target.value)} rows={4} placeholder="Please explain the reason for your leave clearly, including any relevant details..." />
                  <div className="leave-modal-actions">
                    <button type="submit" disabled={actionLoading}>{actionLoading ? 'Saving...' : 'Save Changes'}</button>
                    <button type="button" disabled={actionLoading} onClick={() => setEditLeave(null)}>Cancel</button>
                  </div>
                </form>
              </>
            )}

            {deleteLeaveTarget && (
              <>
                <h2>Delete Leave Request?</h2>
                <p>This will permanently delete your pending leave request. This action cannot be undone.</p>
                <div className="leave-modal-actions">
                  <button type="button" disabled={actionLoading} onClick={confirmDeleteLeave}>{actionLoading ? 'Deleting...' : 'Confirm Delete'}</button>
                  <button type="button" disabled={actionLoading} onClick={() => setDeleteLeaveTarget(null)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <style>{`
        .leave-page {
          min-height: 100%;
          padding: 28px;
          background: #f8fafc;
          color: #0f172a;
        }

        .leave-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .leave-eyebrow {
          color: #0757B8;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.5px;
          margin-bottom: 7px;
        }

        .leave-header h1 {
          margin: 0;
          font-size: 30px;
          font-weight: 800;
        }

        .leave-header p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .leave-summary {
          min-width: 150px;
          padding: 17px 20px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
        }

        .leave-summary strong {
          color: #0757B8;
          font-size: 26px;
        }

        .leave-summary span {
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
        }

        .leave-alert {
          padding: 13px 16px;
          border-radius: 12px;
          margin-bottom: 18px;
          font-size: 13px;
          font-weight: 600;
        }

        .leave-alert.success {
          background: #eff6ff;
          color: #0757B8;
        }

        .leave-alert.error {
          background: #fff0f0;
          color: #b23b3b;
        }

        .leave-grid {
          display: grid;
          grid-template-columns: minmax(300px, 0.8fr) minmax(420px, 1.2fr);
          gap: 20px;
        }

        .leave-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 22px;
          box-shadow: 0 8px 28px rgba(7, 87, 184, 0.05);
        }

        .card-heading {
          margin-bottom: 20px;
        }

        .card-heading h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
        }

        .card-heading p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 12px;
        }

        form label {
          display: block;
          margin: 0 0 7px;
          color: #334155;
          font-size: 12px;
          font-weight: 700;
        }

        select,
        input,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: #ffffff;
          color: #0f172a;
          padding: 11px 12px;
          font: inherit;
          font-size: 13px;
          outline: none;
          margin-bottom: 16px;
        }

        select:focus,
        input:focus,
        textarea:focus {
          border-color: #0757B8;
          box-shadow: 0 0 0 3px rgba(7, 87, 184, 0.12);
        }

        textarea {
          resize: vertical;
        }

        .date-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        form button {
          width: 100%;
          border: none;
          border-radius: 10px;
          padding: 12px;
          background: #0757B8;
          color: white;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        form button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .history-item {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          padding: 15px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #ffffff;
        }

        .history-main {
          min-width: 0;
        }

        .history-main strong {
          display: block;
          color: #0f172a;
          font-size: 13px;
          text-transform: capitalize;
        }

        .history-main span {
          display: block;
          margin-top: 4px;
          color: #64748b;
          font-size: 11px;
        }

        .history-main p {
          margin: 8px 0 0;
          color: #475569;
          font-size: 12px;
          line-height: 1.45;
        }

        .history-main small {
          display: block;
          margin-top: 7px;
          color: #b23b3b;
          font-size: 11px;
        }

        .status {
          flex-shrink: 0;
          padding: 6px 9px;
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

        .state {
          min-height: 250px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          font-size: 13px;
        }

        @media (max-width: 900px) {
          .leave-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .leave-page {
            padding: 18px 14px;
          }

          .leave-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .leave-summary {
            width: 100%;
            box-sizing: border-box;
          }

          .date-grid {
            grid-template-columns: 1fr;
            gap: 0;
          }

          .history-item {
            flex-direction: column;
          }
        }
        .leave-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .leave-actions button, .leave-modal button { border: 1px solid #cbd5e1; border-radius: 8px; padding: 7px 10px; background: #fff; color: #0757B8; font-size: 12px; font-weight: 700; cursor: pointer; }
        .leave-actions .delete-action { color: #b23b3b; }
        .leave-modal-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(15, 23, 42, .48); display: flex; align-items: center; justify-content: center; padding: 18px; }
        .leave-modal { width: 100%; max-width: 480px; max-height: 85vh; overflow-y: auto; box-sizing: border-box; padding: 24px; border-radius: 16px; background: #fff; box-shadow: 0 20px 70px rgba(0,0,0,.2); }
        .leave-modal h2 { margin: 0 0 18px; font-size: 20px; color: #0f172a; }
        .leave-modal p { font-size: 13px; line-height: 1.6; color: #475569; overflow-wrap: anywhere; }
        .leave-modal label { display: block; margin: 12px 0 6px; font-size: 12px; font-weight: 700; color: #334155; }
        .leave-modal input, .leave-modal select, .leave-modal textarea { width: 100%; box-sizing: border-box; margin-bottom: 10px; }
        .leave-modal-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
        .leave-modal-actions button:first-child { background: #0757B8; color: #fff; }
        .leave-modal button:disabled { opacity: .6; cursor: not-allowed; }
      
        /* Consistent professional typography and message fields */
        .leave-page {
          font-family: Inter, "Segoe UI", Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .leave-page textarea,
        .leave-modal textarea {
          font-family: Inter, "Segoe UI", Arial, sans-serif;
          font-size: 14px;
          font-weight: 400;
          line-height: 1.7;
          letter-spacing: 0.1px;
          min-height: 112px;
          padding: 14px 15px;
          color: #0f172a;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          resize: vertical;
          transition: border-color .2s ease, box-shadow .2s ease;
        }

        .leave-page textarea::placeholder,
        .leave-modal textarea::placeholder {
          color: #899a91;
          opacity: 1;
          font-size: 13px;
        }

        .leave-page textarea:focus,
        .leave-modal textarea:focus {
          outline: none;
          border-color: #29945f;
          box-shadow: 0 0 0 3px rgba(41, 148, 95, .12);
        }
      `}</style>
    </div>
  );
};

export default Leave;




