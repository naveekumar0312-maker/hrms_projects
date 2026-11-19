import { resolveMediaUrl } from '../utils/imageUtils';
import React, { useEffect, useState, useMemo, useContext } from 'react';
import './WFHManagement.css';
import { Search, RotateCcw, X, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { CustomDatePicker } from '../components/CustomDatePicker';
import {
  getWFHRequests,
  approveWFHRequest,
  rejectWFHRequest,
} from '../api/wfh';
import type { WFHRequest } from '../api/wfh';

const WFHManagement: React.FC = () => {
  const { user } = useContext(AuthContext);
  const [requests, setRequests] = useState<WFHRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadRequests = async (dateParam?: string, searchParam?: string) => {
    try {
      setLoading(true);
      setError('');

      const activeDate = dateParam !== undefined ? dateParam : selectedDate;
      const activeSearch = searchParam !== undefined ? searchParam : searchQuery;

      const data = await getWFHRequests({
        date: activeDate || undefined,
        search: activeSearch || undefined,
      });
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
  }, [selectedDate]);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (selectedDate && r.date !== selectedDate) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const empName = (r.employee_name || '').toLowerCase();
        const empId = (r.employee_id || '').toLowerCase();
        const reason = (r.reason || '').toLowerCase();
        if (!empName.includes(q) && !empId.includes(q) && !reason.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [requests, selectedDate, searchQuery]);

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

        <div className="summary" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {user?.role === 'REPORTING_MANAGER' && (
            <Link
              to="/manager/my-wfh"
              style={{
                textDecoration: 'none',
                background: '#16a34a',
                color: '#ffffff',
                padding: '8px 14px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Plus size={16} /> Apply for Myself
            </Link>
          )}
          <div>
            <strong>
              {requests.filter((item) => item.status === 'PENDING').length}
            </strong>
            <span>Pending Requests</span>
          </div>
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

        {/* Date, Search & Quick Filter Toolbar */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ minWidth: '220px' }}>
            <CustomDatePicker
              value={selectedDate}
              onChange={(val: string) => setSelectedDate(val)}
              placeholder="All Dates"
            />
          </div>

          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search
              size={16}
              color="#94a3b8"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            />
            <input
              type="text"
              placeholder="Search by employee name, ID, reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 36px 8px 36px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                outline: 'none',
                background: '#fff',
              }}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                }}
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              style={{
                padding: '7px 12px',
                borderRadius: '6px',
                border: selectedDate === new Date().toISOString().split('T')[0] ? '1px solid #22c55e' : '1px solid #e2e8f0',
                background: selectedDate === new Date().toISOString().split('T')[0] ? '#f0fdf4' : '#fff',
                color: selectedDate === new Date().toISOString().split('T')[0] ? '#16a34a' : '#475569',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Today
            </button>
            {selectedDate ? (
              <button
                type="button"
                onClick={() => setSelectedDate('')}
                style={{
                  padding: '7px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  color: '#64748b',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                All Dates
              </button>
            ) : null}
            {(selectedDate || searchQuery) ? (
              <button
                type="button"
                onClick={() => { setSelectedDate(''); setSearchQuery(''); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  color: '#ef4444',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={13} /> Reset
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="state">Loading WFH requests...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="state">
            {selectedDate
              ? `No WFH requests found for ${selectedDate}${searchQuery ? ` matching "${searchQuery}"` : ''}.`
              : 'No WFH requests match your search criteria.'}
          </div>
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
                {filteredRequests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#eff6ff',
                            color: '#22C55E',
                            fontWeight: 800,
                            flexShrink: 0,
                            overflow: 'hidden',
                          }}
                        >
                          {resolveMediaUrl(request.profile_photo) ? (
                            <img
                              src={resolveMediaUrl(request.profile_photo)!}
                              alt={request.employee_name || 'Employee'}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            (request.employee_name || 'E').charAt(0).toUpperCase()
                          )}
                        </div>
                        <strong>{request.employee_name || '--'}</strong>
                      </div>
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

