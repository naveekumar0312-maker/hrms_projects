import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  ListTodo,
  Calendar,
  Clock,
  Plus,
} from 'lucide-react';
import api from '../../api';
import { TaskWorkspaceModal } from '../../components/TaskWorkspaceModal';
import { AuthContext } from '../../context/AuthContext';

interface EmployeeTask {
  id: number;
  title: string;
  description: string;
  category: string;
  assigned_by_name: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED' | 'DRAFT' | 'OVERDUE';
  is_draft: boolean;
  due_date: string | null;
  start_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  estimated_hours?: number;
  total_logged_hours?: number;
  is_overdue: boolean;
  completion_notes?: string;
  additional_instructions?: string;
  comments?: any[];
  created_at: string;
}

const EmployeeTasks: React.FC = () => {
  const { user } = useContext(AuthContext);
  const isTeamLeaderOrManager = ['TEAM_LEADER', 'REPORTING_MANAGER', 'HR', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role || '');
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/tasks-module/tasks/');
      setTasks(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load employee tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const renderStatusBadge = (status: string) => {
    const map: Record<string, { label: string; bg: string; color: string; border: string }> = {
      PENDING: { label: 'Pending', bg: '#fefce8', color: '#a16207', border: '#fef08a' },
      IN_PROGRESS: { label: 'In Progress', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
      UNDER_REVIEW: { label: 'Under Review', bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff' },
      COMPLETED: { label: 'Completed', bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' },
      ON_HOLD: { label: 'On Hold', bg: '#fff7ed', color: '#c2410c', border: '#ffedd5' },
      CANCELLED: { label: 'Cancelled', bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' },
      OVERDUE: { label: 'Overdue', bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
    };
    const s = map[status] || { label: status, bg: '#f8fafc', color: '#334155', border: '#e2e8f0' };
    return (
      <span style={{
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        padding: '3px 8px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
      }}>
        {s.label}
      </span>
    );
  };

  const renderPriorityBadge = (priority: string) => {
    const map: Record<string, { color: string; bg: string }> = {
      LOW: { color: '#64748b', bg: '#f1f5f9' },
      MEDIUM: { color: '#0284c7', bg: '#e0f2fe' },
      HIGH: { color: '#d97706', bg: '#fef3c7' },
      URGENT: { color: '#dc2626', bg: '#fee2e2' },
    };
    const p = map[priority] || { color: '#334155', bg: '#f1f5f9' };
    return (
      <span style={{
        background: p.bg,
        color: p.color,
        padding: '3px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 700,
      }}>
        {priority}
      </span>
    );
  };

  return (
    <div className="task-manager-page">
      <div className="rm-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>{isTeamLeaderOrManager ? 'Task Management' : 'My Assigned Tasks'}</h1>
          <p>{isTeamLeaderOrManager ? 'Assign and track tasks for company employees, collaborate, and monitor progress.' : 'View your deliverables, collaborate with your manager, and log work hours.'}</p>
        </div>
        {isTeamLeaderOrManager && (
          <button
            type="button"
            className="rm-btn rm-btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} />
            <span>Assign New Task</span>
          </button>
        )}
      </div>

      <div className="rm-table-card">
        {loading ? (
          <div className="rm-loading-state">Loading your tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="rm-empty-state">
            <ListTodo size={48} className="rm-empty-icon" />
            <p>You have no active assigned tasks at this moment.</p>
          </div>
        ) : (
          <table className="rm-table">
            <thead>
              <tr>
                <th>Task Title</th>
                <th>Category</th>
                <th>Assigned By</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Time Logged</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedTaskId(t.id)}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{t.title}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Created {new Date(t.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: '#475569', background: '#f8fafc', padding: '3px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      {t.category || 'General'}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500, color: '#334155' }}>{t.assigned_by_name}</div>
                  </td>
                  <td>{renderPriorityBadge(t.priority)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                      <Calendar size={14} color="#64748b" />
                      <span style={{ color: t.is_overdue ? '#dc2626' : '#334155', fontWeight: t.is_overdue ? 700 : 500 }}>
                        {t.due_date || 'No due date'} {t.is_overdue && '(Overdue)'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#475569' }}>
                      <Clock size={13} color="#0284c7" />
                      <span>{t.total_logged_hours || 0}h / {t.estimated_hours || 0}h</span>
                    </div>
                  </td>
                  <td>{renderStatusBadge(t.status)}</td>
                  <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="rm-btn rm-btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => setSelectedTaskId(t.id)}
                    >
                      Open Workspace
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* CREATE NEW TASK MODAL FOR TEAM LEADER / MANAGER */}
      {showCreateModal && (
        <TaskWorkspaceModal
          taskId={null}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => {
            loadTasks();
            setShowCreateModal(false);
          }}
        />
      )}

      {/* TWO-COLUMN TASK WORKSPACE MODAL */}
      {selectedTaskId && (
        <TaskWorkspaceModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onSaved={() => {
            loadTasks();
            setSelectedTaskId(null);
          }}
        />
      )}
    </div>
  );
};

export default EmployeeTasks;
