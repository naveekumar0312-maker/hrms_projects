import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  LogOut,
  Award,
  ListTodo,
} from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './ManagerLayout.css';

const TeamLeaderLayout: React.FC = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/manager/login');
  };

  return (
    <div className="manager-layout">
      {/* SIDEBAR */}
      <aside className="manager-sidebar">
        <div className="manager-sidebar-header">
          <div className="manager-logo-icon" style={{ background: '#2563eb' }}>
            <Award size={20} />
          </div>
          <div className="manager-header-text">
            <h3>Team Leader</h3>
            <p>{user?.company_name || 'Yaazh 360'}</p>
          </div>
        </div>

        <nav className="manager-nav">
          <NavLink
            to="/team-leader/dashboard"
            className={({ isActive }) => `manager-nav-link ${isActive ? 'active' : ''}`}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/team-leader/team"
            className={({ isActive }) => `manager-nav-link ${isActive ? 'active' : ''}`}
          >
            <Users size={18} />
            <span>My Team</span>
          </NavLink>

          <NavLink
            to="/team-leader/tasks"
            className={({ isActive }) => `manager-nav-link ${isActive ? 'active' : ''}`}
          >
            <ListTodo size={18} />
            <span>Task Management</span>
          </NavLink>
        </nav>

        <div className="manager-sidebar-footer">
          <div className="manager-user-brief">
            <div className="manager-user-avatar" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="manager-user-meta">
              <span className="manager-username">{user?.username}</span>
              <span className="manager-userrole">Team Leader</span>
            </div>
          </div>

          <button className="manager-logout-btn" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="manager-main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default TeamLeaderLayout;

