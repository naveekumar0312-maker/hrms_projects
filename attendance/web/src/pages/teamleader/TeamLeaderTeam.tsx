import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Eye,
  X,
} from 'lucide-react';
import api from '../../api';

interface TeamEmployee {
  id: number;
  employee_id: string;
  full_name: string;
  email: string;
  department: string;
  designation: string;
  profile_photo: string | null;
  status: boolean;
  employment_status: string;
}

const TeamLeaderTeam: React.FC = () => {
  const [team, setTeam] = useState<TeamEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<any>(null);

  const loadTeam = async () => {
    try {
      setLoading(true);
      const params = search ? { search } : {};
      const res = await api.get('/employees/team-leader/team/', { params });
      setTeam(res.data);
    } catch (err) {
      console.error('Failed to load team:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeam();
  }, [search]);

  return (
    <div className="mgr-dashboard-page">
      <div className="mgr-dash-header">
        <div>
          <h1>My Team Members</h1>
          <p>Employees assigned to your team leadership.</p>
        </div>
        <button className="rm-btn rm-btn-secondary" onClick={loadTeam}>
          <RefreshCw size={16} /> Refresh Team
        </button>
      </div>

      <div className="rm-toolbar">
        <div className="rm-search-box">
          <Search size={18} className="rm-search-icon" />
          <input
            type="text"
            className="rm-search-input"
            placeholder="Search by team member name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rm-table-card">
        {loading ? (
          <div className="rm-empty-state">
            <RefreshCw size={28} className="rm-spinner-icon" />
            <p>Loading team members...</p>
          </div>
        ) : team.length === 0 ? (
          <div className="rm-empty-state">
            <Users size={48} color="#94a3b8" />
            <h3>No Team Members Assigned</h3>
            <p>Your Reporting Manager will assign team members to your leadership.</p>
          </div>
        ) : (
          <table className="rm-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Employee Code</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="rm-profile-cell">
                      <div className="rm-avatar">
                        {m.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="rm-name">{m.full_name}</div>
                        <div className="rm-sub">{m.email || 'No email on record'}</div>
                      </div>
                    </div>
                  </td>
                  <td><code>{m.employee_id}</code></td>
                  <td>{m.department}</td>
                  <td>{m.designation}</td>
                  <td>
                    <span className={`rm-badge ${m.status ? 'rm-badge-active' : 'rm-badge-inactive'}`}>
                      {m.status ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="rm-icon-btn"
                      title="View Details"
                      onClick={() => setSelectedMember(m)}
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedMember && (
        <div className="rm-modal-backdrop" onClick={() => setSelectedMember(null)}>
          <div className="rm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rm-modal-header">
              <h2>Team Member Details</h2>
              <button type="button" className="rm-close-btn" onClick={() => setSelectedMember(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="rm-modal-body">
              <div className="rm-view-grid">
                <div className="rm-view-item">
                  <span className="rm-view-label">Full Name</span>
                  <span className="rm-view-val">{selectedMember.full_name}</span>
                </div>
                <div className="rm-view-item">
                  <span className="rm-view-label">Employee ID</span>
                  <span className="rm-view-val">{selectedMember.employee_id}</span>
                </div>
                <div className="rm-view-item">
                  <span className="rm-view-label">Department</span>
                  <span className="rm-view-val">{selectedMember.department}</span>
                </div>
                <div className="rm-view-item">
                  <span className="rm-view-label">Designation</span>
                  <span className="rm-view-val">{selectedMember.designation}</span>
                </div>
                <div className="rm-view-item">
                  <span className="rm-view-label">Status</span>
                  <span className="rm-view-val">
                    <span className={`rm-badge ${selectedMember.status ? 'rm-badge-active' : 'rm-badge-inactive'}`}>
                      {selectedMember.status ? 'Active' : 'Inactive'}
                    </span>
                  </span>
                </div>
              </div>
            </div>
            <div className="rm-modal-footer">
              <button type="button" className="rm-btn rm-btn-secondary" onClick={() => setSelectedMember(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamLeaderTeam;

