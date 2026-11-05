import { useEffect, useState } from 'react';
import './WFH.css';
import { CalendarDays, Clock, Home, Send } from 'lucide-react';
import CustomDatePicker from '../../components/CustomDatePicker';
import {
  getWFHRequests,
  createWFHRequest,
  type WFHRequest,
} from '../../api/wfh';

const WFH = () => {
  const [requests, setRequests] = useState<WFHRequest[]>([]);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadRequests = async () => {
    try {
      setError('');
      const data = await getWFHRequests();
      setRequests(Array.isArray(data) ? data : data.results || []);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Unable to load WFH requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!date || !reason.trim()) {
      setError('Please select a date and enter the reason.');
      return;
    }

    try {
      setSubmitting(true);
      await createWFHRequest({ date, reason: reason.trim() });
      setSuccess('WFH request submitted successfully.');
      setDate('');
      setReason('');
      await loadRequests();
    } catch (err: any) {
      const data = err.response?.data;
      const message =
        data?.detail ||
        data?.date?.[0] ||
        data?.reason?.[0] ||
        data?.non_field_errors?.[0] ||
        'Unable to submit your WFH request.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusStyle = (status: WFHRequest['status']) => {
    if (status === 'APPROVED') {
      return { color: '#166534', background: 'rgba(0, 86, 179, 0.12)' };
    }
    if (status === 'REJECTED') {
      return { color: '#b91c1c', background: '#fee2e2' };
    }
    return { color: '#92400e', background: '#fef3c7' };
  };

  return (
    <div className="wfh-page">
      <div className="wfh-header">
        <div className="wfh-header-icon">
          <Home size={27} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700 }}>Work From Home</h1>
          <p style={{ margin: '6px 0 0', color: '#6b7280' }}>Apply for WFH and track your request status.</p>
        </div>
      </div>

      <div className="wfh-grid">
        <section className="wfh-card">
          <h2 style={{ margin: '0 0 20px', fontSize: '19px' }}>Apply for WFH</h2>

          <form onSubmit={handleSubmit}>
            <div className="wfh-field">
              <CustomDatePicker
                label="WFH Date"
                value={date}
                onChange={setDate}
                minDate={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            <div className="wfh-field">
              <label htmlFor="wfh-reason" style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                Reason
              </label>
              <textarea className="wfh-textarea"
                id="wfh-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Enter the reason for your WFH request"
                rows={4}
                required
                maxLength={1000}
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', resize: 'vertical', font: 'inherit' }}
              />
            </div>

            {error && (
              <p role="alert" style={{ color: '#b91c1c', background: '#fef2f2', padding: '10px 12px', borderRadius: '8px', fontSize: '14px' }}>
                {error}
              </p>
            )}
            {success && (
              <p role="status" style={{ color: '#166534', background: '#F8F9FC', padding: '10px 12px', borderRadius: '8px', fontSize: '14px' }}>
                {success}
              </p>
            )}

            <button type="submit" disabled={submitting} className="wfh-submit">
              <Send size={17} />
              {submitting ? 'Submitting...' : 'Submit WFH Request'}
            </button>
          </form>
        </section>

        <section className="wfh-card">
          <div className="wfh-card-head">
            <h2 style={{ margin: 0, fontSize: '19px' }}>My WFH Requests</h2>
            <button type="button" onClick={loadRequests} style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: '7px', padding: '7px 11px', cursor: 'pointer' }}>
              Refresh
            </button>
          </div>

          {loading ? (
            <p style={{ color: '#6b7280' }}>Loading requests...</p>
          ) : requests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 12px', color: '#6b7280' }}>
              <CalendarDays size={32} style={{ marginBottom: '10px', color: '#9ca3af' }} />
              <p style={{ margin: 0 }}>No WFH requests yet.</p>
            </div>
          ) : (
            <div className="wfh-request-list">
              {requests.map((request) => (
                <article key={request.id} className="wfh-request">
                  <div className="wfh-request-top">
                    <strong className="wfh-request-date">
                      <CalendarDays size={17} />
                      {request.date}
                    </strong>
                    <span style={{ ...statusStyle(request.status), padding: '5px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                      {request.status}
                    </span>
                  </div>
                  <p className="wfh-request-reason">{request.reason}</p>
                  {request.rejection_reason && (
                    <p style={{ margin: '8px 0 0', color: '#b91c1c', fontSize: '13px' }}>
                      Rejection reason: {request.rejection_reason}
                    </p>
                  )}
                  {request.approved_at && (
                    <p style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '8px 0 0', color: '#6b7280', fontSize: '12px' }}>
                      <Clock size={14} /> Updated: {new Date(request.approved_at).toLocaleDateString()}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default WFH;



