import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search,
  Users,
  Award,
  ChevronRight,
  Shield,
  Phone,
  Mail,
  Building,
  CheckCircle,
  X,
  UserPlus,
} from 'lucide-react-native';
import {
  getManagerTeam,
  getManagerTeamEmployeeDetail,
  promoteEmployeeToTeamLeader,
  assignTeamToLeader,
  getTeamLeaderAssignedMembers,
  ManagerTeamEmployee,
} from '../../services/managerService';
import { resolveMediaUrl } from '../../utils/imageUtils';
import { COLORS } from '../../constants/theme';
import { formatAttendanceTime } from '../../utils/dateUtils';

export default function ManagerTeamScreen() {
  const insets = useSafeAreaInsets();
  const [team, setTeam] = useState<ManagerTeamEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Details Modal
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Promotion Modal
  const [promoteCandidate, setPromoteCandidate] = useState<ManagerTeamEmployee | null>(null);
  const [promoteUsername, setPromoteUsername] = useState('');
  const [promotePassword, setPromotePassword] = useState('Password@123');
  const [promoteLoading, setPromoteLoading] = useState(false);

  // Assign to Leader Modal
  const [assigningLeader, setAssigningLeader] = useState<ManagerTeamEmployee | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  const loadTeamData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getManagerTeam(search.trim());
      const list = Array.isArray(data) ? data : [];
      // Arrange strictly by employee_id
      const sorted = [...list].sort((a, b) =>
        (a.employee_id || '').localeCompare(b.employee_id || '', undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      );
      setTeam(sorted);
    } catch (err) {
      console.error('Failed to load team:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTeamData();
  };

  const handleViewDetails = async (member: ManagerTeamEmployee) => {
    try {
      setLoadingDetails(true);
      const details = await getManagerTeamEmployeeDetail(member.id);
      setSelectedMember(details);
    } catch (err) {
      Alert.alert('Error', 'Unable to load employee details.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleOpenPromote = (member: ManagerTeamEmployee) => {
    setPromoteCandidate(member);
    const suggestedUname = member.full_name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_tl';
    setPromoteUsername(suggestedUname);
    setPromotePassword('Password@123');
  };

  const handleConfirmPromote = async () => {
    if (!promoteCandidate) return;
    try {
      setPromoteLoading(true);
      await promoteEmployeeToTeamLeader(promoteCandidate.id, {
        username: promoteUsername.trim(),
        password: promotePassword,
      });
      Alert.alert('Success', `${promoteCandidate.full_name} is now promoted to Team Leader.`);
      setPromoteCandidate(null);
      loadTeamData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Promotion failed.';
      Alert.alert('Promotion Error', msg);
    } finally {
      setPromoteLoading(false);
    }
  };

  const handleOpenAssign = async (leader: ManagerTeamEmployee) => {
    setAssigningLeader(leader);
    const existing = leader.assigned_team_members?.map((m) => m.id) || [];
    setSelectedIds(existing);
    try {
      const data = await getTeamLeaderAssignedMembers(leader.id);
      if (Array.isArray(data?.assigned_employee_ids)) {
        setSelectedIds(data.assigned_employee_ids);
      }
    } catch (e) {
      // quiet fallback
    }
  };

  const handleConfirmAssignment = async () => {
    if (!assigningLeader) return;
    try {
      setAssignLoading(true);
      await assignTeamToLeader(assigningLeader.id, selectedIds, 'assign');
      Alert.alert('Success', 'Team members assigned successfully.');
      setAssigningLeader(null);
      loadTeamData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Assignment failed.';
      Alert.alert('Assignment Error', msg);
    } finally {
      setAssignLoading(false);
    }
  };

  const toggleSelectMember = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Potential team members to assign (exclude the team leader themselves)
  const assignableCandidates = team.filter(
    (m) => assigningLeader && m.id !== assigningLeader.id
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>My Team</Text>
          <Text style={styles.headerSub}>Manage assigned employees & team leaders</Text>
        </View>
      </View>

      {/* SEARCH BAR */}
      <View style={styles.searchBar}>
        <Search size={18} color="#666666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, employee code..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#888888"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={16} color="#666666" />
          </TouchableOpacity>
        )}
      </View>

      {/* TEAM LIST */}
      {loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading team roster...</Text>
        </View>
      ) : (
        <FlatList
          data={team}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: insets.bottom + 90, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Users size={36} color="#888888" />
              <Text style={styles.emptyText}>No team members found.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isTL = item.role === 'TEAM_LEADER';
            const avatarUrl = resolveMediaUrl(item.profile_photo || (item as any).profile_photo_url);
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarText}>{item.full_name?.charAt(0) || 'U'}</Text>
                    )}
                  </View>

                  <View style={styles.cardInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {item.full_name}
                      </Text>
                      {isTL ? (
                        <View style={styles.tlBadge}>
                          <Award size={12} color="#1D4ED8" />
                          <Text style={styles.tlBadgeText}>Team Leader</Text>
                        </View>
                      ) : (
                        <View style={styles.empBadge}>
                          <Text style={styles.empBadgeText}>{item.employee_id}</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.designationText}>{item.designation || 'Staff Member'}</Text>
                    <Text style={styles.branchText}>
                      {item.company_name ? `${item.company_name} • ` : ''}
                      {item.department ? `${item.department} • ` : ''}
                      {item.branch_name || 'Main Branch'}
                    </Text>

                    {/* ASSIGNED TEAM PREVIEW IF TL */}
                    {isTL && (
                      <View style={{ marginTop: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={[
                            styles.teamCountBadge,
                            (item.team_members_count || 0) > 0 ? styles.teamCountBadgeActive : styles.teamCountBadgeEmpty
                          ]}>
                            <Users size={11} color={(item.team_members_count || 0) > 0 ? '#15803D' : '#64748B'} />
                            <Text style={[
                              styles.teamCountText,
                              (item.team_members_count || 0) > 0 ? styles.teamCountTextActive : styles.teamCountTextEmpty
                            ]}>
                              {(item.team_members_count || 0) > 0
                                ? `Team: ${item.team_members_count} member${item.team_members_count! > 1 ? 's' : ''}`
                                : 'No members assigned'}
                            </Text>
                          </View>
                        </View>

                        {item.assigned_team_members && item.assigned_team_members.length > 0 && (
                          <View style={styles.teamChipsWrapper}>
                            {item.assigned_team_members.map((tm) => (
                              <View key={tm.id} style={styles.memberChip}>
                                <Text style={styles.memberChipText}>{tm.full_name} ({tm.employee_id})</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}

                    {/* REPORTS TO TL IF NORMAL EMPLOYEE */}
                    {!isTL && item.team_leader && (
                      <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center' }}>
                        <View style={styles.reportsToBadge}>
                          <Shield size={10} color="#1D4ED8" />
                          <Text style={styles.reportsToText}>
                            TL: <Text style={{ fontWeight: '700' }}>{item.team_leader.full_name}</Text> ({item.team_leader.employee_id})
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>

                {/* ACTION BUTTONS */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.detailBtn}
                    onPress={() => handleViewDetails(item)}
                  >
                    <Text style={styles.detailBtnText}>View Profile</Text>
                  </TouchableOpacity>

                  {!isTL ? (
                    <TouchableOpacity
                      style={styles.promoteBtn}
                      onPress={() => handleOpenPromote(item)}
                    >
                      <Award size={14} color="#1D4ED8" style={{ marginRight: 4 }} />
                      <Text style={styles.promoteBtnText}>Promote to TL</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.assignBtn}
                      onPress={() => handleOpenAssign(item)}
                    >
                      <UserPlus size={14} color="#000000" style={{ marginRight: 4 }} />
                      <Text style={styles.assignBtnText}>Assign Members</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* EMPLOYEE DETAIL MODAL */}
      <Modal visible={Boolean(selectedMember)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedMember(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Employee Profile</Text>
              <TouchableOpacity onPress={() => setSelectedMember(null)}>
                <X size={20} color="#666666" />
              </TouchableOpacity>
            </View>

            {selectedMember && (
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                <View style={styles.profileHeaderBox}>
                  <View style={[styles.avatar, { width: 54, height: 54, borderRadius: 27, overflow: 'hidden' }]}>
                    {resolveMediaUrl(selectedMember.profile_photo || (selectedMember as any).profile_photo_url) ? (
                      <Image
                        source={{ uri: resolveMediaUrl(selectedMember.profile_photo || (selectedMember as any).profile_photo_url)! }}
                        style={{ width: '100%', height: '100%', borderRadius: 27 }}
                      />
                    ) : (
                      <Text style={[styles.avatarText, { fontSize: 22 }]}>
                        {selectedMember.full_name?.charAt(0) || 'U'}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.profileModalName}>{selectedMember.full_name}</Text>
                  <Text style={styles.profileModalSub}>
                    {selectedMember.employee_id} • {selectedMember.designation || 'Staff'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Department:</Text>
                  <Text style={styles.detailVal}>{selectedMember.department || '--'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Branch:</Text>
                  <Text style={styles.detailVal}>{selectedMember.branch?.branch_name || '--'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Email:</Text>
                  <Text style={styles.detailVal}>{selectedMember.email || '--'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Phone:</Text>
                  <Text style={styles.detailVal}>{selectedMember.user?.phone_number || '--'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Work Type:</Text>
                  <Text style={styles.detailVal}>{selectedMember.work_type || 'OFFICE'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Shift:</Text>
                  <Text style={styles.detailVal}>
                    {selectedMember.shift ? `${selectedMember.shift.name} (${formatAttendanceTime(selectedMember.shift.start_time)} - ${formatAttendanceTime(selectedMember.shift.end_time)})` : '--'}
                  </Text>
                </View>

                {selectedMember.team_leader_details && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Team Leader:</Text>
                    <Text style={[styles.detailVal, { color: '#1D4ED8' }]}>
                      {selectedMember.team_leader_details.full_name} ({selectedMember.team_leader_details.employee_id})
                    </Text>
                  </View>
                )}

                {selectedMember.assigned_team_members && selectedMember.assigned_team_members.length > 0 && (
                  <View style={{ marginTop: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' }}>
                    <Text style={[styles.detailLabel, { marginBottom: 4, color: '#15803D' }]}>
                      Assigned Team ({selectedMember.assigned_team_members.length}):
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                      {selectedMember.assigned_team_members.map((m: any) => (
                        <View key={m.id} style={styles.memberChip}>
                          <Text style={styles.memberChipText}>{m.full_name} ({m.employee_id})</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setSelectedMember(null)}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PROMOTE TO TEAM LEADER MODAL */}
      <Modal visible={Boolean(promoteCandidate)}
        transparent
        animationType="fade"
        onRequestClose={() => setPromoteCandidate(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Promote to Team Leader</Text>
            <Text style={styles.modalSub}>
              Promote {promoteCandidate?.full_name} and grant team leader credentials.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Login Username *</Text>
              <TextInput
                style={styles.modalInput}
                value={promoteUsername}
                onChangeText={setPromoteUsername}
                placeholder="username_tl"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Initial Password *</Text>
              <TextInput
                style={styles.modalInput}
                value={promotePassword}
                onChangeText={setPromotePassword}
                placeholder="Password"
                secureTextEntry
              />
            </View>

            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={() => setPromoteCandidate(null)}
                disabled={promoteLoading}
              >
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={handleConfirmPromote}
                disabled={promoteLoading}
              >
                {promoteLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Promote</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ASSIGN TEAM MEMBERS MODAL */}
      <Modal visible={Boolean(assigningLeader)}
        transparent
        animationType="slide"
        onRequestClose={() => setAssigningLeader(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalTitle}>Assign Team Members</Text>
              <View style={[styles.teamCountBadge, styles.teamCountBadgeActive]}>
                <Text style={styles.teamCountTextActive}>{selectedIds.length} Selected</Text>
              </View>
            </View>
            <Text style={styles.modalSub}>
              Select employees reporting directly under {assigningLeader?.full_name}:
            </Text>

            {/* Quick Actions */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <TouchableOpacity
                style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#F1F5F9', borderRadius: 6 }}
                onPress={() => setSelectedIds(assignableCandidates.map((m) => m.id))}
              >
                <Text style={{ fontSize: 11, fontFamily: 'Comfortaa_700Bold', color: '#334155' }}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#F1F5F9', borderRadius: 6 }}
                onPress={() => setSelectedIds([])}
              >
                <Text style={{ fontSize: 11, fontFamily: 'Comfortaa_700Bold', color: '#64748B' }}>Clear All</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 260, marginVertical: 8 }}>
              {assignableCandidates.length === 0 ? (
                <Text style={{ textAlign: 'center', color: '#666666', padding: 20 }}>
                  No available employees to assign.
                </Text>
              ) : (
                assignableCandidates.map((m) => {
                  const isChecked = selectedIds.includes(m.id);
                  const isAssignedToOther = m.team_leader && m.team_leader.id !== assigningLeader?.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.memberSelectRow, isChecked && styles.memberSelectRowActive]}
                      onPress={() => toggleSelectMember(m.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={styles.memberSelectName}>{m.full_name}</Text>
                          <Text style={styles.memberSelectId}>({m.employee_id})</Text>
                        </View>
                        {isAssignedToOther && (
                          <Text style={{ fontSize: 10, color: '#B45309', marginTop: 2 }}>
                            In {m.team_leader?.full_name}'s team
                          </Text>
                        )}
                      </View>
                      {isChecked && <CheckCircle size={16} color="#047857" style={{ marginLeft: 8 }} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={() => setAssigningLeader(null)}
                disabled={assignLoading}
              >
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalPrimaryBtn, { backgroundColor: '#000000' }]}
                onPress={handleConfirmAssignment}
                disabled={assignLoading}
              >
                {assignLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Save Assignment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.dark,
  },
  headerSub: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 14,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.dark,
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666666',
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
  },
  emptyCard: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 10,
    color: '#888888',
    fontSize: 14,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: {
    fontSize: 17,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.primary,
  },
  cardInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.dark,
    flex: 1,
  },
  tlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tlBadgeText: {
    fontSize: 10,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.primary,
  },
  empBadge: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  empBadgeText: {
    fontSize: 10,
    fontFamily: 'Comfortaa_700Bold',
    color: '#666666',
  },
  designationText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#222222',
    marginTop: 2,
  },
  branchText: {
    fontSize: 11,
    color: '#666666',
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  detailBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailBtnText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
    color: '#444444',
  },
  promoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  promoteBtnText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.primary,
  },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  assignBtnText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.dark,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.dark,
  },
  modalSub: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 14,
    marginTop: 2,
  },
  profileHeaderBox: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    marginBottom: 12,
  },
  profileModalName: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.dark,
    marginTop: 8,
  },
  profileModalSub: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  detailLabel: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#666666',
  },
  detailVal: {
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.dark,
    textAlign: 'right',
    flex: 1,
    marginLeft: 10,
  },
  modalCloseBtn: {
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
    color: '#444444',
  },

  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
    color: '#222222',
    marginBottom: 4,
  },
  modalInput: {
    height: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: COLORS.dark,
    backgroundColor: COLORS.background,
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalSecondaryBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    alignItems: 'center',
  },
  modalSecondaryText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
    color: '#444444',
  },
  modalPrimaryBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
  },
  modalPrimaryText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
    color: '#FFFFFF',
  },

  memberSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 6,
  },
  memberSelectRowActive: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  memberSelectName: {
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.dark,
  },
  memberSelectId: {
    fontSize: 11,
    color: '#666666',
    marginLeft: 6,
  },
  teamCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  teamCountBadgeActive: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  teamCountBadgeEmpty: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  teamCountText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
  },
  teamCountTextActive: {
    color: '#15803D',
  },
  teamCountTextEmpty: {
    color: '#64748B',
  },
  teamChipsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  memberChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  memberChipText: {
    fontSize: 10,
    color: '#334155',
    fontFamily: 'Comfortaa_600SemiBold',
  },
  reportsToBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  reportsToText: {
    fontSize: 10,
    color: '#1E40AF',
    fontFamily: 'Comfortaa_600SemiBold',
  },
});

