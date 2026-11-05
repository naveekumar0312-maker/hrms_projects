import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import api from '../services/api';

interface NotificationItem {
  id: number;
  event: string;
  employee_name: string;
  employee_id: string;
  title: string;
  message: string;
  is_read: boolean;
  shift_date: string;
  created_at: string;
}

interface NotificationResponse {
  unread_count: number;
  results: NotificationItem[];
}

export default function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await api.get('/notifications/?limit=50');
      const data = response.data as NotificationResponse | NotificationItem[];

      // The shared API interceptor may unwrap "results" into an array.
      const list = Array.isArray(data) ? data : data?.results;
      if (!Array.isArray(list)) return;

      setItems(list);
      setUnread(
        Array.isArray(data) && Array.isArray(list)
          ? list.filter(item => !item.is_read).length
          : (data as NotificationResponse).unread_count ??
            list.filter(item => !item.is_read).length
      );
      setError('');
    } catch {
      setError('Unable to load notifications.');
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
    const timer = window.setInterval(() => void fetchNotifications(), 10000);
    return () => window.clearInterval(timer);
  }, [fetchNotifications]);

  const markRead = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/read/`);
      await fetchNotifications();
    } catch {
      setError('Unable to update notification.');
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all/');
      await fetchNotifications();
    } catch {
      setError('Unable to update notifications.');
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        aria-label="Notifications"
        title="Notifications"
        onClick={() => { setOpen(value => !value); void fetchNotifications(); }}
        style={{ position: 'relative', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', padding: 10, cursor: 'pointer', color: '#374151' }}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 20, background: '#e56108', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown-panel" style={{ position: 'absolute', right: 0, top: 46, width: 340, maxWidth: 'calc(100vw - 24px)', maxHeight: 430, overflowY: 'auto', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 12px 35px rgba(0,0,0,.14)', zIndex: 10000, color: '#111827' }}>
          <div style={{ padding: 14, borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <strong>Notifications{unread > 0 ? ` (${unread})` : ''}</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              {unread > 0 && (
                <button type="button" title="Mark all as read" onClick={() => void markAllRead()} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#e56108' }}>
                  <CheckCheck size={18} />
                </button>
              )}
              <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
          </div>

          {error && <p style={{ padding: 12, color: '#b91c1c', fontSize: 13 }}>{error}</p>}
          {!error && items.length === 0 && <p style={{ padding: 18, color: '#6b7280', fontSize: 13 }}>No notifications yet.</p>}

          {items.map(item => (
            <div key={item.id} style={{ padding: 13, borderBottom: '1px solid #f1f1f1', background: item.is_read ? '#fff' : '#fff7ed' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ fontSize: 13 }}>{item.title}</strong>
                {!item.is_read && (
                  <button type="button" onClick={() => void markRead(item.id)} style={{ border: 0, background: 'transparent', color: '#e56108', cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}>
                    Mark read
                  </button>
                )}
              </div>
              <p style={{ margin: '6px 0', fontSize: 13, lineHeight: 1.5 }}>{item.message}</p>
              <small style={{ color: '#6b7280' }}>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
