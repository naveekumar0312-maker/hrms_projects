import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  X,
  Award,
  Eye,
  CheckCircle2,
  AlertCircle,
  User,
} from 'lucide-react';
import api from '../../api';
import '../ReportingManagers.css';

interface TeamEmployee {
  id: number;
  employee_id: string;
  full_name: string;
  email: string;
  department: string;
  designation: string;
  profile_photo: string | null;
  branch_name: string;
  company_name?: string;
  company_id?: number;
  status: boolean;
  account_status: string;
  employment_status: string;
  work_type: string;
  role?: string;
}

const ManagerTeam: React.FC = () => {
  const [team, setTeam] = useState<TeamEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<any>(null);

  // Promotion Modal
  const [promoteCandidate, setPromoteCandidate] = useState<TeamEmployee | null>(null);
  const [promoteUsername, setPromoteUsername] = useState('');
  const [promotePassword, setPromotePassword] = useState('Password@123');
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Team Leader Assignment Modal
  const [assigningLeader, setAssigningLeader] = useState<TeamEmployee | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  const loadTeam = async () => {
    try {
      setLoading(true);
      const params = search ? { search } : {};
      const res = await api.get('/employees/manager/team/', { params });
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

  const viewDetails = async (member: TeamEmployee) => {
    try {
      setSelectedMember(null);
      const res = await api.get(`/employees/manager/team/${member.id}/`);
      setSelectedMember(res.data);
    } catch (err) {
      console.error('Failed to load member details:', err);
    }
  };

  // Open Promotion Modal
  const handleOpenPromote = (member: TeamEmployee) => {
    setPromoteCandidate(member);
    const suggestedUname = member.full_name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_tl';
    setPromoteUsername(suggestedUname);
    setPromotePassword('Password@123');
    setActionMsg(null);
  };

  // Confirm Promotion
  const handleConfirmPromote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoteCandidate) return;

    try {
      setPromoteLoading(true);
      setActionMsg(null);
      const res = await api.post(`/employees/manager/employees/${promoteCandidate.id}/promote-team-leader/`, {
        username: promoteUsername.trim(),
        password: promotePassword,
      });

      setActionMsg({
        type: 'success',
        text: res.data.message || `${promoteCandidate.full_name} is now a Team Leader.`,
      });
      setPromoteCandidate(null);
      loadTeam();
    } catch (err: any) {
      console.error('Promotion error:', err);
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to promote employee.';
      setActionMsg({ type: 'error', text: msg });
    } finally {
      setPromoteLoading(false);
    }
  };

  // Open Team Leader Member Assignment Modal
  const handleOpenAssign = (leader: TeamEmployee) => {
    setAssigningLeader(leader);
    setSelectedMemberIds([]);
    setActionMsg(null);
  };

  // Submit Member Assignment
  const handleSaveAssignment = async () => {
    if (!assigningLeader) return;

    try {
      setAssignLoading(true);
      const res = await api.post(`/employees/manager/team-leaders/${assigningLeader.id}/assign-team/`, {
        employee_ids: selectedMemberIds,
        action: 'assign',
      });
      setActionMsg({
        type: 'success',
        text: res.data.message || 'Assigned team members successfully.',
      });
      setAssigningLeader(null);
      loadTeam();
    } catch (err: any) {
      console.error('Assignment error:', err);
      setActionMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to assign team members.' });
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <div className="mgr-dashboard-page">
      <div className="mgr-dash-header">
        <div>
          <h1>My Assigned Team</h1>
          <p>Supervise your direct team members and designate Team Leaders.</p>
        </div>
        <button className="rm-btn rm-btn-secondary" onClick={loadTeam}>
          <RefreshCw size={16} /> Refresh Team
        </button>
      </div>

      {actionMsg && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          background: actionMsg.type === 'success' ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${actionMsg.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          color: actionMsg.type === 'success' ? '#065f46' : '#991b1b',
          fontSize: '14px',
          fontWeight: 500,
        }}>
          {actionMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="rm-toolbar">
        <div className="rm-search-box">
          <Search size={18} className="rm-search-icon" />
          <input
            type="text"
            className="rm-search-input"
            placeholder="Search by employee name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Team Table */}
      <div className="rm-table-card">
        {loading ? (
          <div className="rm-empty-state">
            <RefreshCw size={28} className="rm-spinner-icon" />
            <p>Loading assigned employees...</p>
          </div>
        ) : team.length === 0 ? (
          <div className="rm-empty-state">
            <Users size={48} color="#94a3b8" />
            <h3>No Employees Assigned</h3>
            <p>Employees assigned to you by the HR team will appear in this workspace.</p>
          </div>
        ) : (
          <table className="rm-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Employee Code</th>
                <th>Company / Branch</th>
                <th>Department</th>
                <th>Designation / Role</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {team.map((m) => {
                const isTeamLeader = m.designation?.toLowerCase().includes('team leader') || m.role === 'TEAM_LEADER';
                return (
                  <tr key={m.id}>
                    <td>
                      <div className="rm-profile-cell">
                        {m.profile_photo ? (
                          <img src={m.profile_photo} alt={m.full_name} className="rm-avatar" />
                        ) : (
                          <div className="rm-avatar" style={{ background: '#eff6ff', color: '#2563eb' }}>
                            <User size={18} strokeWidth={2.2} />
                          </div>
                        )}
                        <div>
                          <div className="rm-name">{m.full_name}</div>
                          <div className="rm-sub">{m.email || 'No email on record'}</div>
                        </div>
                      </div>
                    </td>
                    <td><code>{m.employee_id}</code></td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>
                          {m.company_name || 'Yaazh 360'}
                        </span>
                        <span style={{ color: '#64748b', fontSize: '12px' }}>
                          {m.branch_name || 'Main Branch'}
                        </span>
                      </div>
                    </td>
                    <td>{m.department || 'General'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{m.designation}</span>
                        {isTeamLeader && (
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
                            <Award size={12} /> Team Leader
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`rm-badge ${m.status ? 'rm-badge-active' : 'rm-badge-inactive'}`}>
                        {m.status ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="rm-action-btns" style={{ justifyContent: 'flex-end' }}>
                        {/* VIEW DETAILS */}
                        <button
                          type="button"
                          className="rm-icon-btn"
                          title="View Profile"
                          onClick={() => viewDetails(m)}
                        >
                          <Eye size={16} />
                        </button>

                        {/* PROMOTE TO TEAM LEADER (If not already leader) */}
                        {!isTeamLeader && (
                          <button
                            type="button"
                            className="rm-btn rm-btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '12px', gap: '4px' }}
                            title="Promote to Team Leader"
                            onClick={() => handleOpenPromote(m)}
                          >
                            <Award size={14} color="#0284c7" /> Promote TL
                          </button>
                        )}

                        {/* ASSIGN MEMBERS (If is leader) */}
                        {isTeamLeader && (
                          <button
                            type="button"
                            className="rm-btn rm-btn-primary"
                            style={{ padding: '6px 10px', fontSize: '12px', gap: '4px' }}
                            title="Assign Employees to this Team Leader"
                            onClick={() => handleOpenAssign(m)}
                          >
                            <Users size={14} /> Assign Team
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* PROMOTION MODAL */}
      {promoteCandidate && (
        <div className="rm-modal-backdrop" onClick={() => !promoteLoading && setPromoteCandidate(null)}>
          <div className="rm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rm-modal-header">
              <h2>Promote to Team Leader</h2>
              <button type="button" className="rm-close-btn" onClick={() => setPromoteCandidate(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConfirmPromote}>
              <div className="rm-modal-body">
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#0f172a' }}>
                    Promoting: <strong>{promoteCandidate.full_name}</strong> ({promoteCandidate.employee_id})
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    Employee records, attendance history, and profile data will be fully preserved.
                  </p>
                </div>

                <div className="rm-form-group">
                  <label>Team Leader Username *</label>
                  <input
                    type="text"
                    className="rm-input"
                    value={promoteUsername}
                    onChange={(e) => setPromoteUsername(e.target.value)}
                    required
                  />
                </div>

                <div className="rm-form-group">
                  <label>Initial Login Password *</label>
                  <input
                    type="password"
                    className="rm-input"
                    value={promotePassword}
                    onChange={(e) => setPromotePassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="rm-modal-footer">
                <button type="button" className="rm-btn rm-btn-secondary" onClick={() => setPromoteCandidate(null)}>
                  Cancel
                </button>
                <button type="submit" className="rm-btn rm-btn-primary" disabled={promoteLoading}>
                  {promoteLoading ? 'Promoting...' : 'Confirm Promotion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEAM ASSIGNMENT MODAL */}
      {assigningLeader && (
        <div className="rm-modal-backdrop" onClick={() => !assignLoading && setAssigningLeader(null)}>
          <div className="rm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rm-modal-header">
              <h2>Assign Employees to Team Leader</h2>
              <button type="button" className="rm-close-btn" onClick={() => setAssigningLeader(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="rm-modal-body">
              <p style={{ fontSize: '14px', color: '#334155', margin: 0 }}>
                Select employees who report to <strong>{assigningLeader.full_name}</strong>:
              </p>
              <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '8px' }}>
                {team
                  .filter((m) => m.id !== assigningLeader.id)
                  .map((m) => {
                    const isChecked = selectedMemberIds.includes(m.id);
                    return (
                      <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer', padding: '6px', background: isChecked ? '#f0fdf4' : '#fff', borderRadius: '6px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMemberIds([...selectedMemberIds, m.id]);
                            } else {
                              setSelectedMemberIds(selectedMemberIds.filter((id) => id !== m.id));
                            }
                          }}
                        />
                        <span>{m.full_name} ({m.employee_id}) — {m.department}</span>
                      </label>
                    );
                  })}
              </div>
            </div>
            <div className="rm-modal-footer">
              <button type="button" className="rm-btn rm-btn-secondary" onClick={() => setAssigningLeader(null)}>
                Cancel
              </button>
              <button type="button" className="rm-btn rm-btn-primary" onClick={handleSaveAssignment} disabled={assignLoading}>
                {assignLoading ? 'Assigning...' : 'Save Assignments'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMPLOYEE VIEW DETAILS MODAL */}
      {selectedMember && (
        <div className="rm-modal-backdrop" onClick={() => setSelectedMember(null)}>
          <div className="rm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rm-modal-header">
              <h2>Employee Details</h2>
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
                  <span className="rm-view-label">Branch</span>
                  <span className="rm-view-val">{selectedMember.branch_name || 'Main HQ'}</span>
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

export default ManagerTeam;
