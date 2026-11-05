import React, { useState, useEffect, useCallback } from 'react';
import {
  ListTodo,
  Plus,
  Search,
  Calendar,
  Clock,
} from 'lucide-react';
import api from '../../api';
import { TaskWorkspaceModal } from '../../components/TaskWorkspaceModal';
import { CustomSelect } from '../../components/CustomSelect';
import './TaskManager.css';

interface TaskItem {
  id: number;
  title: string;
  description: string;
  category: string;
  assigned_to: number | null;
  assigned_to_name: string;
  assigned_to_code: string;
  assigned_to_role: string;
  assigned_to_avatar?: string | null;
  assigned_employees?: Array<{
    id: number;
    full_name: string;
    employee_id?: string;
    designation?: string;
    profile_photo_url?: string | null;
  }>;
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
  attachment?: string;
  additional_instructions?: string;
  completion_notes?: string;
  completion_attachment?: string;
  is_overdue: boolean;
  comments?: any[];
  created_at: string;
}

const TaskManager: React.FC = () => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Workspace Modal state
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/tasks-module/tasks/');
      setTasks(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Open Workspace for Creating a New Task
  const handleOpenCreate = () => {
    setSelectedTaskId(null);
    setShowWorkspace(true);
  };

  // Open Workspace for Viewing / Editing existing Task
  const handleOpenEdit = (taskId: number) => {
    setSelectedTaskId(taskId);
    setShowWorkspace(true);
  };

  // Status badge styling
  const renderStatusBadge = (status: string, isDraft: boolean) => {
    if (isDraft) {
      return (
        <span style={{
          background: '#f1f5f9',
          color: '#64748b',
          border: '1px solid #cbd5e1',
          padding: '3px 8px',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          DRAFT
        </span>
      );
    }

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
        letterSpacing: '0.04em',
      }}>
        {s.label}
      </span>
    );
  };

  // Priority badge styling
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

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    const assignees = t.assigned_employees && t.assigned_employees.length > 0
      ? t.assigned_employees.map((e) => e.full_name).join(' ')
      : (t.assigned_to_name || '');
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) ||
      assignees.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter || (statusFilter === 'DRAFT' && t.is_draft);
    const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="task-manager-page">
      {/* HEADER */}
      <div className="rm-header">
        <div>
          <h1>Task Management</h1>
          <p>Assign, track, and review team tasks and deliverables in real time.</p>
        </div>
        <div className="rm-actions">
          <button className="rm-btn rm-btn-primary" onClick={handleOpenCreate}>
            <Plus size={16} /> + Assign New Task
          </button>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="rm-toolbar">
        <div className="rm-search-box">
          <Search size={18} className="rm-search-icon" />
          <input
            type="text"
            className="rm-search-input"
            placeholder="Search by task title or assignee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ width: '160px' }}>
            <CustomSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'DRAFT', label: 'Draft' },
                { value: 'PENDING', label: 'Pending' },
                { value: 'IN_PROGRESS', label: 'In Progress' },
                { value: 'UNDER_REVIEW', label: 'Under Review' },
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'ON_HOLD', label: 'On Hold' },
                { value: 'CANCELLED', label: 'Cancelled' },
                { value: 'OVERDUE', label: 'Overdue' },
              ]}
              placeholder="Status"
            />
          </div>

          <div style={{ width: '160px' }}>
            <CustomSelect
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={[
                { value: 'ALL', label: 'All Priorities' },
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' },
                { value: 'URGENT', label: 'Urgent' },
              ]}
              placeholder="Priority"
            />
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="rm-table-card">
        {loading ? (
          <div className="rm-loading-state">Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="rm-empty-state">
            <ListTodo size={48} className="rm-empty-icon" />
            <p>No tasks found. Create a new task to get started.</p>
          </div>
        ) : (
          <table className="rm-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Category</th>
                <th>Assigned To</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Logged / Est.</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => (
                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => handleOpenEdit(t.id)}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{t.title}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      By {t.assigned_by_name} &bull; {new Date(t.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: '#475569', background: '#f8fafc', padding: '3px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      {t.category || 'General'}
                    </span>
                  </td>
                  <td>
                    {t.assigned_employees && t.assigned_employees.length > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Overlapping avatar stack */}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {t.assigned_employees.slice(0, 3).map((emp, idx) => (
                            <div
                              key={emp.id}
                              style={{
                                marginLeft: idx === 0 ? 0 : '-8px',
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                border: '2px solid #ffffff',
                                backgroundColor: '#0f172a',
                                color: '#ffffff',
                                fontSize: '11px',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                              }}
                              title={`${emp.full_name} (${emp.employee_id || ''})`}
                            >
                              {emp.profile_photo_url ? (
                                <img
                                  src={emp.profile_photo_url}
                                  alt={emp.full_name}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                emp.full_name.slice(0, 2).toUpperCase()
                              )}
                            </div>
                          ))}
                          {t.assigned_employees.length > 3 && (
                            <div
                              style={{
                                marginLeft: '-8px',
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                backgroundColor: '#f1f5f9',
                                color: '#0f172a',
                                fontSize: '10px',
                                fontWeight: 700,
                                border: '2px solid #ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title={`+${t.assigned_employees.length - 3} more`}
                            >
                              +{t.assigned_employees.length - 3}
                            </div>
                          )}
                        </div>

                        <div>
                          <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '13px' }}>
                            {t.assigned_employees[0].full_name}
                            {t.assigned_employees.length > 1 && (
                              <span style={{ color: '#64748b', fontWeight: 500, fontSize: '12px' }}>
                                {' '}+{t.assigned_employees.length - 1} more
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {t.assigned_employees.length} {t.assigned_employees.length === 1 ? 'assignee' : 'assignees'}
                          </div>
                        </div>
                      </div>
                    ) : t.assigned_to_name ? (
                      <>
                        <div style={{ fontWeight: 500, color: '#334155' }}>{t.assigned_to_name}</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>{t.assigned_to_code}</div>
                      </>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Unassigned (Draft)</span>
                    )}
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
                  <td>{renderStatusBadge(t.status, t.is_draft)}</td>
                  <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="rm-btn rm-btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => handleOpenEdit(t.id)}
                    >
                      Workspace
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* TWO-COLUMN PREMIUM TASK WORKSPACE MODAL */}
      {showWorkspace && (
        <TaskWorkspaceModal
          taskId={selectedTaskId}
          onClose={() => setShowWorkspace(false)}
          onSaved={() => {
            loadTasks();
            setShowWorkspace(false);
          }}
        />
      )}
    </div>
  );
};

export default TaskManager;
