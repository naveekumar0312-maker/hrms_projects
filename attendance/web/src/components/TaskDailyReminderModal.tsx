import React from 'react';
import {
  ListTodo,
  Calendar,
  ArrowRight,
  X,
  AlertCircle,
} from 'lucide-react';
import './TaskDailyReminderModal.css';

export interface DailyReminderTask {
  id: number;
  title: string;
  category?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: string;
  due_date?: string | null;
  is_overdue?: boolean;
}

interface TaskDailyReminderModalProps {
  isOpen: boolean;
  tasks: DailyReminderTask[];
  onClose: () => void;
  onViewTasks: () => void;
  onOpenTask: (taskId: number) => void;
}

export const TaskDailyReminderModal: React.FC<TaskDailyReminderModalProps> = ({
  isOpen,
  tasks,
  onClose,
  onViewTasks,
  onOpenTask,
}) => {
  if (!isOpen || tasks.length === 0) return null;

  const overdueCount = tasks.filter((t) => t.is_overdue).length;
  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const pendingCount = tasks.filter((t) => t.status === 'PENDING').length;

  const getPriorityBadgeStyle = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return { bg: '#fee2e2', color: '#dc2626' };
      case 'HIGH':
        return { bg: '#fef3c7', color: '#d97706' };
      case 'MEDIUM':
        return { bg: '#e0f2fe', color: '#0284c7' };
      default:
        return { bg: '#f1f5f9', color: '#64748b' };
    }
  };

  return (
    <div className="daily-task-sidebar-overlay" onClick={onClose}>
      <aside
        className="daily-task-sidebar-card"
        onClick={(e) => e.stopPropagation()}
        aria-label="Daily Task Reminders"
      >
        {/* Header */}
        <div className="daily-task-sidebar-header">
          <div className="daily-task-header-title-box">
            <div className="daily-task-icon-wrapper">
              <ListTodo size={20} color="#2563eb" />
            </div>
            <div>
              <div className="daily-task-badge">DAILY REMINDER</div>
              <h3 className="daily-task-sidebar-title">Today's Assigned Tasks</h3>
            </div>
          </div>
          <button
            type="button"
            className="daily-task-close-btn"
            onClick={onClose}
            title="Dismiss reminder"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick summary stats banner */}
        <div className="daily-task-stats-banner">
          <div className="daily-task-stat-item">
            <span className="daily-task-stat-num">{tasks.length}</span>
            <span className="daily-task-stat-label">Active</span>
          </div>
          {overdueCount > 0 && (
            <div className="daily-task-stat-item stat-overdue">
              <span className="daily-task-stat-num">{overdueCount}</span>
              <span className="daily-task-stat-label">Overdue</span>
            </div>
          )}
          {inProgressCount > 0 && (
            <div className="daily-task-stat-item stat-progress">
              <span className="daily-task-stat-num">{inProgressCount}</span>
              <span className="daily-task-stat-label">In Progress</span>
            </div>
          )}
          {pendingCount > 0 && (
            <div className="daily-task-stat-item">
              <span className="daily-task-stat-num">{pendingCount}</span>
              <span className="daily-task-stat-label">Pending</span>
            </div>
          )}
        </div>

        {/* Task list preview */}
        <div className="daily-task-list-scroll">
          {tasks.slice(0, 6).map((task) => {
            const priorityStyle = getPriorityBadgeStyle(task.priority);
            return (
              <div
                key={task.id}
                className={`daily-task-item ${task.is_overdue ? 'item-overdue' : ''}`}
                onClick={() => onOpenTask(task.id)}
              >
                <div className="daily-task-item-top">
                  <span
                    className="daily-task-priority-pill"
                    style={{ background: priorityStyle.bg, color: priorityStyle.color }}
                  >
                    {task.priority}
                  </span>
                  {task.category && (
                    <span className="daily-task-category-pill">{task.category}</span>
                  )}
                  {task.is_overdue && (
                    <span className="daily-task-overdue-tag">
                      <AlertCircle size={11} /> Overdue
                    </span>
                  )}
                </div>

                <div className="daily-task-item-title">{task.title}</div>

                <div className="daily-task-item-footer">
                  <div className="daily-task-due">
                    <Calendar size={12} />
                    <span>{task.due_date || 'No due date'}</span>
                  </div>
                  <span className="daily-task-status-pill">
                    {task.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            );
          })}
          {tasks.length > 6 && (
            <div className="daily-task-more-note">
              +{tasks.length - 6} more task{tasks.length - 6 > 1 ? 's' : ''} in your workspace
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="daily-task-sidebar-footer">
          <button
            type="button"
            className="daily-task-view-all-btn"
            onClick={onViewTasks}
          >
            <span>View All Tasks</span>
            <ArrowRight size={15} />
          </button>
          <button
            type="button"
            className="daily-task-dismiss-btn"
            onClick={onClose}
          >
            Got it, thanks!
          </button>
        </div>
      </aside>
    </div>
  );
};

export default TaskDailyReminderModal;

