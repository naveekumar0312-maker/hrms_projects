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
  Shield,
} from 'lucide-react';
import api from '../../api';
import '../ReportingManagers.css';

interface AssignedMemberBrief {
  id: number;
  employee_id: string;
  full_name: string;
  designation: string;
  department: string;
  profile_photo?: string | null;
}

interface TeamLeaderBrief {
  id: number;
  employee_id: string;
  full_name: string;
  designation: string;
  department?: string;
}

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
  team_leader?: TeamLeaderBrief | null;
  assigned_team_members?: AssignedMemberBrief[];
  team_members_count?: number;
}

const ManagerTeam: React.FC = () => {
  const [team, setTeam] = useState<TeamEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<any>(null);

  // Promotion state
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
      const rows: TeamEmployee[] = Array.isArray(res.data) ? res.data : [];
      // Arrange strictly by employee_id (e.g. EMP-001, EMP-002, etc.)
      const sorted = [...rows].sort((a, b) => {
        return (a.employee_id || '').localeCompare(b.employee_id || '', undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      });
      setTeam(sorted);
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

  // Direct Promote to Team Leader (No form popup - instant promotion with confirmation)
  const handleDirectPromote = async (member: TeamEmployee) => {
    const isConfirmed = window.confirm(
      `Are you sure you want to promote ${member.full_name} (${member.employee_id}) to Team Leader?`
    );
    if (!isConfirmed) return;

    try {
      setPromoteLoading(true);
      setActionMsg(null);
      const res = await api.post(`/employees/manager/employees/${member.id}/promote-team-leader/`, {});

      setActionMsg({
        type: 'success',
        text: res.data.message || `${member.full_name} has been promoted to Team Leader successfully!`,
      });
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
  const handleOpenAssign = async (leader: TeamEmployee) => {
    setAssigningLeader(leader);
    setActionMsg(null);
    const existingIds = leader.assigned_team_members?.map((m) => m.id) || [];
    setSelectedMemberIds(existingIds);

    try {
      const res = await api.get(`/employees/manager/team-leaders/${leader.id}/assign-team/`);
      if (Array.isArray(res.data?.assigned_employee_ids)) {
        setSelectedMemberIds(res.data.assigned_employee_ids);
      }
    } catch (e) {
      // quiet fallback
    }
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>{m.designation}</span>
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

                        {/* If Team Leader, show team member count & members preview */}
                        {isTeamLeader && (
                          <div style={{ marginTop: '3px' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              backgroundColor: (m.team_members_count || 0) > 0 ? '#ecfdf5' : '#f8fafc',
                              color: (m.team_members_count || 0) > 0 ? '#047857' : '#94a3b8',
                              border: (m.team_members_count || 0) > 0 ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}>
                              <Users size={11} />
                              {(m.team_members_count || 0) > 0
                                ? `Team: ${m.team_members_count} member${m.team_members_count! > 1 ? 's' : ''}`
                                : 'No members assigned'}
                            </span>

                            {m.assigned_team_members && m.assigned_team_members.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                {m.assigned_team_members.map((tm) => (
                                  <span
                                    key={tm.id}
                                    style={{
                                      fontSize: '11px',
                                      padding: '2px 7px',
                                      borderRadius: '4px',
                                      backgroundColor: '#f1f5f9',
                                      color: '#334155',
                                      border: '1px solid #e2e8f0',
                                      fontWeight: 500,
                                    }}
                                  >
                                    {tm.full_name} ({tm.employee_id})
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* If normal employee reporting to a Team Leader */}
                        {!isTeamLeader && m.team_leader && (
                          <div style={{ marginTop: '3px' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              backgroundColor: '#eff6ff',
                              color: '#1e40af',
                              border: '1px solid #bfdbfe',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}>
                              <Shield size={11} />
                              <span>TL:</span> <strong>{m.team_leader.full_name}</strong> ({m.team_leader.employee_id})
                            </span>
                          </div>
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
                            onClick={() => handleDirectPromote(m)}
                            disabled={promoteLoading}
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

      {/* TEAM ASSIGNMENT MODAL */}
      {assigningLeader && (
        <div className="rm-modal-backdrop" onClick={() => !assignLoading && setAssigningLeader(null)}>
          <div className="rm-modal" style={{ maxWidth: '620px' }} onClick={(e) => e.stopPropagation()}>
            <div className="rm-modal-header">
              <div>
                <h2>Assign Employees to Team Leader</h2>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Leader: <strong>{assigningLeader.full_name}</strong> ({assigningLeader.employee_id})
                </p>
              </div>
              <button type="button" className="rm-close-btn" onClick={() => setAssigningLeader(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="rm-modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', color: '#334155' }}>
                  Check employees who report directly to <strong>{assigningLeader.full_name}</strong>:
                </span>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  backgroundColor: '#ecfdf5',
                  color: '#047857',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  border: '1px solid #a7f3d0'
                }}>
                  Selected: {selectedMemberIds.length} members
                </span>
              </div>

              {/* Quick Select Buttons */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <button
                  type="button"
                  style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                  onClick={() => {
                    const assignable = team.filter((m) => m.id !== assigningLeader.id).map((m) => m.id);
                    setSelectedMemberIds(assignable);
                  }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                  onClick={() => setSelectedMemberIds([])}
                >
                  Clear All
                </button>
              </div>

              <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '8px' }}>
                {team
                  .filter((m) => m.id !== assigningLeader.id)
                  .map((m) => {
                    const isChecked = selectedMemberIds.includes(m.id);
                    const isOtherTL = m.role === 'TEAM_LEADER' || (m.designation || '').toLowerCase().includes('team leader');
                    const isAssignedToOther = m.team_leader && m.team_leader.id !== assigningLeader.id;
                    return (
                      <label key={m.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '13px',
                        cursor: 'pointer',
                        padding: '8px 10px',
                        background: isChecked ? '#f0fdf4' : '#fff',
                        border: isChecked ? '1px solid #86efac' : '1px solid #f1f5f9',
                        borderRadius: '6px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                          <div>
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>{m.full_name}</span>
                            <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '6px' }}>({m.employee_id})</span>
                            <span style={{ color: '#94a3b8', fontSize: '11px', marginLeft: '6px' }}>• {m.department}</span>
                          </div>
                        </div>
                        {isOtherTL ? (
                          <span style={{ fontSize: '11px', color: '#1d4ed8', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>TL</span>
                        ) : isAssignedToOther ? (
                          <span style={{ fontSize: '11px', color: '#b45309', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px' }}>In {m.team_leader?.full_name}'s team</span>
                        ) : null}
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
                {assignLoading ? 'Saving...' : `Save Team (${selectedMemberIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMPLOYEE VIEW DETAILS MODAL */}
      {selectedMember && (
        <div className="rm-modal-backdrop" onClick={() => setSelectedMember(null)}>
          <div className="rm-modal" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
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
                  <span className="rm-view-val">{selectedMember.branch?.branch_name || selectedMember.branch_name || 'Main HQ'}</span>
                </div>
                <div className="rm-view-item">
                  <span className="rm-view-label">Status</span>
                  <span className="rm-view-val">
                    <span className={`rm-badge ${selectedMember.status ? 'rm-badge-active' : 'rm-badge-inactive'}`}>
                      {selectedMember.status ? 'Active' : 'Inactive'}
                    </span>
                  </span>
                </div>

                {/* Team Leader Details */}
                {selectedMember.team_leader_details && (
                  <div className="rm-view-item" style={{ gridColumn: 'span 2' }}>
                    <span className="rm-view-label">Assigned Team Leader</span>
                    <span className="rm-view-val" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#1e40af', fontWeight: 600 }}>
                      <Shield size={14} />
                      {selectedMember.team_leader_details.full_name} ({selectedMember.team_leader_details.employee_id}) — {selectedMember.team_leader_details.designation}
                    </span>
                  </div>
                )}

                {/* Assigned Team Members (If Team Leader) */}
                {selectedMember.assigned_team_members && selectedMember.assigned_team_members.length > 0 && (
                  <div className="rm-view-item" style={{ gridColumn: 'span 2' }}>
                    <span className="rm-view-label">
                      Assigned Team ({selectedMember.assigned_team_members.length} members)
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {selectedMember.assigned_team_members.map((tm: any) => (
                        <span
                          key={tm.id}
                          style={{
                            fontSize: '12px',
                            background: '#f8fafc',
                            color: '#0f172a',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            fontWeight: 600,
                          }}
                        >
                          {tm.full_name} ({tm.employee_id}) — <span style={{ color: '#64748b', fontWeight: 400 }}>{tm.department}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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
