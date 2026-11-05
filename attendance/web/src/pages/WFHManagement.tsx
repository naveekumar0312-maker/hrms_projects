import React, { useEffect, useState } from 'react';
import './WFHManagement.css';
import {
  getWFHRequests,
  approveWFHRequest,
  rejectWFHRequest,
} from '../api/wfh';
import type { WFHRequest } from '../api/wfh';

const WFHManagement: React.FC = () => {
  const [requests, setRequests] = useState<WFHRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError('');

      const data = await getWFHRequests();
      setRequests(Array.isArray(data) ? data : data?.results || []);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to load WFH requests.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      setActionLoading(id);
      setError('');
      setSuccess('');

      await approveWFHRequest(id);
      setSuccess('WFH request approved successfully.');
      await loadRequests();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to approve WFH request.'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (request: WFHRequest) => {
    const reason = window.prompt('Enter rejection reason:');
    if (!reason?.trim()) return;

    try {
      setActionLoading(request.id);
      setError('');
      setSuccess('');

      await rejectWFHRequest(request.id, reason.trim());
      setSuccess('WFH request rejected successfully.');
      await loadRequests();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to reject WFH request.'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date: string) => {
    if (!date) return '--';

    return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
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
          <div className="eyebrow">ATTENDANCE MANAGEMENT</div>
          <h1>Work From Home Requests</h1>
          <p>Review and manage employee WFH applications.</p>
        </div>

        <div className="summary">
          <strong>
            {requests.filter((item) => item.status === 'PENDING').length}
          </strong>
          <span>Pending Requests</span>
        </div>
      </div>

      {success && <div className="alert success">{success}</div>}
      {error && <div className="alert error">{error}</div>}

      <div className="card">
        <div className="card-head">
          <div>
            <h2>All WFH Requests</h2>
            <p>Review applications and approve or reject pending requests.</p>
          </div>

          <button
            type="button"
            className="refresh"
            onClick={() => void loadRequests()}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="state">Loading WFH requests...</div>
        ) : requests.length === 0 ? (
          <div className="state">No WFH requests found.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Employee ID</th>
                  <th>Date</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <strong>{request.employee_name || '--'}</strong>
                    </td>
                    <td>{request.employee_id || '--'}</td>
                    <td>{formatDate(request.date)}</td>
                    <td className="reason">{request.reason || '--'}</td>
                    <td>
                      <span className={`status ${statusClass(request.status)}`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="remarks">
                      {request.status === 'REJECTED'
                        ? request.rejection_reason || '--'
                        : request.status === 'APPROVED'
                        ? request.approved_by_name || 'Approved'
                        : '--'}
                    </td>
                    <td>
                      {request.status === 'PENDING' ? (
                        <div className="actions">
                          <button
                            type="button"
                            className="approve"
                            disabled={actionLoading === request.id}
                            onClick={() => void handleApprove(request.id)}
                          >
                            {actionLoading === request.id ? '...' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            className="reject"
                            disabled={actionLoading === request.id}
                            onClick={() => void handleReject(request)}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span>Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default WFHManagement;

