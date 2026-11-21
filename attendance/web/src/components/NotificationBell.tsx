import { useCallback, useEffect, useState, useContext } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Bell, CheckCheck, X } from 'lucide-react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';

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
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const { companySlug: routeSlug } = useParams<{ companySlug?: string }>();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const fetchNotifications = useCallback(async () => {
    // Skip if offline or not authenticated
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (!localStorage.getItem('access_token')) return;

    try {
      // unread_only=true: seen/read notifications disappear from the list
      const response = await api.get('/notifications/?limit=50&unread_only=true');
      const data = response.data as NotificationResponse | NotificationItem[];

      // The shared API interceptor may unwrap "results" into an array.
      const list = Array.isArray(data) ? data : data?.results;
      if (!Array.isArray(list)) return;

      // Filter only unread notifications so read items are removed immediately
      const unreadList = list.filter(item => !item.is_read);
      setItems(unreadList);
      setUnread(
        (data as NotificationResponse)?.unread_count ?? unreadList.length
      );
      setError('');
    } catch (err: any) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (err?.code === 'ERR_NETWORK' || err?.message?.includes('Network Error')) return;
      if (err?.response?.status === 401) return;
      setError('Unable to load notifications.');
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();

    // Poll every 30 seconds only when tab is visible and online
    const timer = window.setInterval(() => {
      if (!document.hidden && (!('onLine' in navigator) || navigator.onLine)) {
        void fetchNotifications();
      }
    }, 30000);

    const handleVisibilityChange = () => {
      if (!document.hidden && (!('onLine' in navigator) || navigator.onLine)) {
        void fetchNotifications();
      }
    };

    const handleOnline = () => {
      void fetchNotifications();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchNotifications]);

  const markRead = async (id: number) => {
    try {
      // Optimistically remove from list immediately
      setItems(prev => prev.filter(item => item.id !== id));
      setUnread(prev => Math.max(0, prev - 1));
      await api.patch(`/notifications/${id}/read/`);
      await fetchNotifications();
    } catch {
      setError('Unable to update notification.');
    }
  };

  const markAllRead = async () => {
    try {
      // Optimistically clear all notifications
      setItems([]);
      setUnread(0);
      await api.post('/notifications/read-all/');
      await fetchNotifications();
    } catch {
      setError('Unable to update notifications.');
    }
  };

  const handleItemClick = (item: NotificationItem) => {
    void markRead(item.id);
    setOpen(false);

    const role = (user?.role || '').toUpperCase();
    const isSuper = role === 'SUPER_ADMIN' || (role === 'ADMIN' && (user?.is_superuser || user?.is_staff));
    const activeSlug = routeSlug || user?.company_slug || localStorage.getItem('attendance_company_slug');
    const adminBase = isSuper
      ? (location.pathname.startsWith('/admin') ? '/admin' : '/super-admin')
      : (activeSlug ? `/${encodeURIComponent(activeSlug)}/hr` : '/admin');

    const event = item.event;

    if (event === 'TASK_ASSIGNED') {
      if (role === 'REPORTING_MANAGER') {
        navigate('/manager/tasks');
      } else if (role === 'TEAM_LEADER') {
        navigate('/team-leader/tasks');
      } else if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'HR') {
        navigate('/tasks');
      } else {
        navigate('/tasks');
      }
      return;
    }

    if (event === 'LEAVE_APPLIED') {
      if (role === 'REPORTING_MANAGER') {
        navigate('/manager/leaves');
      } else if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'HR') {
        navigate(`${adminBase}/leaves`);
      } else {
        navigate('/leave');
      }
      return;
    }

    if (event === 'LEAVE_APPROVED' || event === 'LEAVE_REJECTED') {
      navigate('/leave');
      return;
    }

    if (event === 'PERMISSION_APPLIED') {
      if (role === 'REPORTING_MANAGER') {
        navigate('/manager/permissions');
      } else if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'HR') {
        navigate(`${adminBase}/permissions`);
      } else {
        navigate('/permission');
      }
      return;
    }

    if (event === 'PERMISSION_APPROVED' || event === 'PERMISSION_REJECTED') {
      navigate('/permission');
      return;
    }

    if (event === 'WFH_APPLIED') {
      if (role === 'REPORTING_MANAGER') {
        navigate('/manager/wfh');
      } else if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'HR') {
        navigate(`${adminBase}/wfh`);
      } else {
        navigate('/wfh');
      }
      return;
    }

    if (event === 'WFH_APPROVED' || event === 'WFH_REJECTED') {
      navigate('/wfh');
      return;
    }

    if (event === 'SHIFT_START' || event === 'SHIFT_END') {
      if (role === 'REPORTING_MANAGER') {
        navigate('/manager/team-attendance');
      } else if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'HR') {
        navigate(`${adminBase}/attendance`);
      } else {
        navigate('/attendance');
      }
      return;
    }

    if (event === 'LOCATION_REQUIRED') {
      navigate('/dashboard');
      return;
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
          <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 20, background: '#22c55e', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                <button type="button" title="Mark all as read" onClick={() => void markAllRead()} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#22c55e' }}>
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
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              style={{
                padding: 13,
                borderBottom: '1px solid #f1f1f1',
                background: item.is_read ? '#fff' : '#f0fdf4',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = item.is_read ? '#f8fafc' : '#eafaf1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = item.is_read ? '#fff' : '#f0fdf4';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ fontSize: 13, color: '#0f172a' }}>{item.title}</strong>
                {!item.is_read && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void markRead(item.id);
                    }}
                    style={{ border: 0, background: 'transparent', color: '#22c55e', cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}
                  >
                    Mark read
                  </button>
                )}
              </div>
              <p style={{ margin: '6px 0', fontSize: 13, lineHeight: 1.5, color: '#334155' }}>{item.message}</p>
              <small style={{ color: '#6b7280' }}>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
