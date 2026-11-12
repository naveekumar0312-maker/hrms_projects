import React from 'react';
import {
  Bell,
  Calendar,
  Clock,
  ArrowRight,
  X,
  AlertCircle,
  Building,
  User,
  ShieldAlert,
} from 'lucide-react';
import './RolePendingActionsModal.css';

export interface PendingActionItem {
  id: string;
  type: 'LEAVE' | 'PERMISSION' | 'WFH' | 'ATTENDANCE_PUNCH' | 'TASK';
  badge: string;
  employee_name: string;
  employee_id?: string;
  title: string;
  detail: string;
  created_at?: string | null;
  action_url: string;
}

export interface PendingActionsSummary {
  pending_leaves?: number;
  pending_permissions?: number;
  pending_wfh?: number;
  pending_punches?: number;
  pending_tasks?: number;
}

interface RolePendingActionsModalProps {
  isOpen: boolean;
  role: string;
  totalCount: number;
  summary: PendingActionsSummary;
  items: PendingActionItem[];
  onClose: () => void;
  onNavigateAction: (url: string) => void;
}

export const RolePendingActionsModal: React.FC<RolePendingActionsModalProps> = ({
  isOpen,
  role,
  totalCount,
  summary,
  items,
  onClose,
  onNavigateAction,
}) => {
  if (!isOpen || totalCount === 0) return null;

  const getRoleTitle = () => {
    switch (role) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return 'Admin Action Reminder';
      case 'HR':
        return 'HR Approvals Reminder';
      case 'REPORTING_MANAGER':
        return 'Manager Team Approvals';
      default:
        return 'Pending Approvals';
    }
  };

  const getRoleSub = () => {
    if (role === 'HR') {
      return 'Employees are waiting for your approval. Reminding you every hour.';
    }
    if (role === 'REPORTING_MANAGER') {
      return 'Team attendance punches, requests, and tasks need your review.';
    }
    return 'Overall overview of pending approvals and action items across all modules.';
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'LEAVE':
        return <Calendar size={15} color="#ea580c" />;
      case 'PERMISSION':
        return <Clock size={15} color="#2563eb" />;
      case 'WFH':
        return <Building size={15} color="#7c3aed" />;
      case 'ATTENDANCE_PUNCH':
        return <ShieldAlert size={15} color="#dc2626" />;
      default:
        return <AlertCircle size={15} color="#059669" />;
    }
  };

  const getItemBadgeStyle = (type: string) => {
    switch (type) {
      case 'LEAVE':
        return { bg: '#fff7ed', color: '#c2410c', border: '#ffedd5' };
      case 'PERMISSION':
        return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
      case 'WFH':
        return { bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff' };
      case 'ATTENDANCE_PUNCH':
        return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
      default:
        return { bg: '#eff6ff', color: '#0757B8', border: '#bfdbfe' };
    }
  };

  return (
    <div className="role-reminder-overlay" onClick={onClose}>
      <aside
        className="role-reminder-card"
        onClick={(e) => e.stopPropagation()}
        aria-label="Pending Approvals Reminder"
      >
        {/* Header */}
        <div className="role-reminder-header">
          <div className="role-reminder-title-box">
            <div className="role-reminder-bell-wrap">
              <Bell size={20} color="#ea580c" />
              <span className="role-reminder-ping" />
            </div>
            <div>
              <div className="role-reminder-eyebrow">
                {role === 'HR' ? 'HOURLY APPROVAL REMINDER' : 'SYSTEM OVERVIEW REMINDER'}
              </div>
              <h3 className="role-reminder-title">{getRoleTitle()}</h3>
            </div>
          </div>
          <button
            type="button"
            className="role-reminder-close-btn"
            onClick={onClose}
            title="Dismiss reminder"
          >
            <X size={18} />
          </button>
        </div>

        {/* Subtitle notice */}
        <div className="role-reminder-notice">
          <p>{getRoleSub()}</p>
        </div>

        {/* Stats Summary Strip */}
        <div className="role-reminder-stats-grid">
          {summary.pending_leaves !== undefined && summary.pending_leaves > 0 && (
            <div className="role-reminder-stat-box stat-orange" onClick={() => onNavigateAction('/admin/leaves')}>
              <span className="role-reminder-stat-num">{summary.pending_leaves}</span>
              <span className="role-reminder-stat-lbl">Leaves</span>
            </div>
          )}
          {summary.pending_permissions !== undefined && summary.pending_permissions > 0 && (
            <div className="role-reminder-stat-box stat-blue" onClick={() => onNavigateAction('/admin/permissions')}>
              <span className="role-reminder-stat-num">{summary.pending_permissions}</span>
              <span className="role-reminder-stat-lbl">Permissions</span>
            </div>
          )}
          {summary.pending_wfh !== undefined && summary.pending_wfh > 0 && (
            <div className="role-reminder-stat-box stat-purple" onClick={() => onNavigateAction('/admin/wfh')}>
              <span className="role-reminder-stat-num">{summary.pending_wfh}</span>
              <span className="role-reminder-stat-lbl">WFH</span>
            </div>
          )}
          {summary.pending_punches !== undefined && summary.pending_punches > 0 && (
            <div className="role-reminder-stat-box stat-red" onClick={() => onNavigateAction(role === 'REPORTING_MANAGER' ? '/manager/team-attendance' : '/admin/attendance')}>
              <span className="role-reminder-stat-num">{summary.pending_punches}</span>
              <span className="role-reminder-stat-lbl">Punches</span>
            </div>
          )}
          {summary.pending_tasks !== undefined && summary.pending_tasks > 0 && (
            <div className="role-reminder-stat-box stat-green" onClick={() => onNavigateAction(role === 'REPORTING_MANAGER' ? '/manager/tasks' : '/admin/tasks')}>
              <span className="role-reminder-stat-num">{summary.pending_tasks}</span>
              <span className="role-reminder-stat-lbl">Tasks</span>
            </div>
          )}
        </div>

        {/* Action Items List */}
        <div className="role-reminder-scroll-area">
          <div className="role-reminder-list-label">
            PENDING APPROVAL LIST ({totalCount})
          </div>

          {items.map((item) => {
            const badgeStyle = getItemBadgeStyle(item.type);
            return (
              <div
                key={item.id}
                className="role-reminder-item"
                onClick={() => onNavigateAction(item.action_url)}
              >
                <div className="role-reminder-item-top">
                  <span
                    className="role-reminder-type-badge"
                    style={{
                      background: badgeStyle.bg,
                      color: badgeStyle.color,
                      borderColor: badgeStyle.border,
                    }}
                  >
                    {getItemIcon(item.type)}
                    <span>{item.badge}</span>
                  </span>
                  <div className="role-reminder-emp-tag">
                    <User size={11} color="#64748b" />
                    <span>{item.employee_name}</span>
                  </div>
                </div>

                <div className="role-reminder-item-title">{item.title}</div>
                <div className="role-reminder-item-detail">{item.detail}</div>

                <div className="role-reminder-item-cta">
                  <span>Review & Approve</span>
                  <ArrowRight size={13} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="role-reminder-footer">
          <button
            type="button"
            className="role-reminder-main-action-btn"
            onClick={() => onNavigateAction(role === 'REPORTING_MANAGER' ? '/manager/team-attendance' : (role === 'HR' ? '/admin/leaves' : '/admin/attendance'))}
          >
            <span>Open Approvals Center</span>
            <ArrowRight size={15} />
          </button>
          <button
            type="button"
            className="role-reminder-dismiss-btn"
            onClick={onClose}
          >
            Dismiss (Remind in 1 Hour)
          </button>
        </div>
      </aside>
    </div>
  );
};

export default RolePendingActionsModal;
