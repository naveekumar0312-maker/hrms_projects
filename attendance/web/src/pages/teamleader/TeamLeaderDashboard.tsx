import React, { useState, useEffect, useContext } from 'react';
import {
  Users,
  UserCheck,
  Clock,
  UserX,
  Calendar,
  RefreshCw,
  ArrowRight,
  Award,
  ListTodo,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { AuthContext } from '../../context/AuthContext';
import '../manager/ManagerDashboard.css';

interface LeaderDashboardSummary {
  leader_name: string;
  company_name: string;
  designation: string;
  reporting_manager_name: string;
  total_team_members: number;
  present_today: number;
  late_today: number;
  absent_today: number;
  on_leave_today: number;
  pending_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
}

interface TeamMember {
  id: number;
  employee_id: string;
  full_name: string;
  department: string;
  designation: string;
  profile_photo: string | null;
  status: boolean;
  account_status: string;
}

const TeamLeaderDashboard: React.FC = () => {
  const { user } = useContext(AuthContext);
  const [summary, setSummary] = useState<LeaderDashboardSummary | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError('');
      const [sumRes, teamRes] = await Promise.all([
        api.get('/employees/team-leader/dashboard-summary/'),
        api.get('/employees/team-leader/team/'),
      ]);
      setSummary(sumRes.data);
      setTeam(teamRes.data);
    } catch (err) {
      console.error('Failed to load Team Leader dashboard:', err);
      setError('Unable to load team metrics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const attendanceCards = [
    {
      title: 'Total Team Members',
      value: summary?.total_team_members ?? 0,
      icon: Users,
      color: '#3b82f6',
      bg: '#eff6ff',
    },
    {
      title: 'Present Today',
      value: summary?.present_today ?? 0,
      icon: UserCheck,
      color: '#0056B3',
      bg: '#f0fdf4',
    },
    {
      title: 'Late Today',
      value: summary?.late_today ?? 0,
      icon: Clock,
      color: '#f59e0b',
      bg: '#fffbeb',
    },
    {
      title: 'Absent Today',
      value: summary?.absent_today ?? 0,
      icon: UserX,
      color: '#ef4444',
      bg: '#fef2f2',
    },
    {
      title: 'On Leave Today',
      value: summary?.on_leave_today ?? 0,
      icon: Calendar,
      color: '#8b5cf6',
      bg: '#f5f3ff',
    },
  ];

  const taskCards = [
    {
      title: 'Pending Tasks',
      value: summary?.pending_tasks ?? 0,
      icon: ListTodo,
      color: '#0284c7',
      bg: '#e0f2fe',
    },
    {
      title: 'Completed Tasks',
      value: summary?.completed_tasks ?? 0,
      icon: CheckCircle2,
      color: '#0056B3',
      bg: '#ecfdf5',
    },
    {
      title: 'Overdue Tasks',
      value: summary?.overdue_tasks ?? 0,
      icon: AlertTriangle,
      color: '#dc2626',
      bg: '#fee2e2',
    },
  ];

  return (
    <div className="mgr-dashboard-page">
      {/* HEADER BANNER */}
      <div className="mgr-company-banner" style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #bfdbfe'
          }}>
            <Award size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                {summary?.company_name || user?.company_name || 'Company Portal'}
              </span>
              <span style={{
                background: '#eff6ff',
                color: '#1d4ed8',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '9999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Award size={11} /> Team Leader
              </span>
            </div>
            <div style={{ fontSize: '14px', color: '#64748b' }}>
              Team Leader: <strong>{summary?.leader_name || user?.username}</strong> &bull; Reporting Manager: <strong>{summary?.reporting_manager_name}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to="/team-leader/tasks" className="rm-btn rm-btn-primary" style={{ textDecoration: 'none' }}>
            <ListTodo size={16} /> Team Tasks
          </Link>
          <button className="rm-btn rm-btn-secondary" onClick={loadDashboard}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* ATTENDANCE SECTION */}
      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', marginBottom: '14px' }}>
        Today's Team Attendance
      </h3>
      <div className="mgr-cards-grid" style={{ marginBottom: '28px' }}>
        {attendanceCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="mgr-stat-card">
              <div className="mgr-stat-icon" style={{ background: c.bg, color: c.color }}>
                <Icon size={24} />
              </div>
              <div className="mgr-stat-content">
                <span className="mgr-stat-label">{c.title}</span>
                <span className="mgr-stat-value">{loading ? '--' : c.value}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* TASK MANAGEMENT METRICS */}
      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', marginBottom: '14px' }}>
        Team Tasks Overview
      </h3>
      <div className="mgr-cards-grid" style={{ marginBottom: '32px' }}>
        {taskCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="mgr-stat-card">
              <div className="mgr-stat-icon" style={{ background: c.bg, color: c.color }}>
                <Icon size={24} />
              </div>
              <div className="mgr-stat-content">
                <span className="mgr-stat-label">{c.title}</span>
                <span className="mgr-stat-value">{loading ? '--' : c.value}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* MY TEAM PREVIEW */}
      <div className="mgr-section-card">
        <div className="mgr-section-header">
          <div>
            <h2>My Assigned Team Members</h2>
            <p>Employees assigned to your team leadership.</p>
          </div>
          <Link to="/team-leader/team" className="mgr-link-btn">
            View All Team <ArrowRight size={16} />
          </Link>
        </div>

        {team.length === 0 ? (
          <div className="mgr-empty-preview">
            <Users size={36} color="#94a3b8" />
            <p>No team members are assigned to your team yet.</p>
          </div>
        ) : (
          <div className="mgr-table-responsive">
            <table className="mgr-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>ID Code</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {team.slice(0, 5).map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="mgr-emp-cell">
                        <div className="mgr-emp-avatar">
                          {m.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="mgr-emp-name">{m.full_name}</span>
                      </div>
                    </td>
                    <td><code>{m.employee_id}</code></td>
                    <td>{m.department || 'General'}</td>
                    <td>{m.designation}</td>
                    <td>
                      <span className={`rm-badge ${m.status ? 'rm-badge-active' : 'rm-badge-inactive'}`}>
                        {m.status ? 'Active' : 'Inactive'}
                      </span>
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

export default TeamLeaderDashboard;

