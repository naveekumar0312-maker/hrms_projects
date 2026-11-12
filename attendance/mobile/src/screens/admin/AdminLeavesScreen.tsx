import { colors } from '../../theme/colors';
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  ChevronRight,
  X,
  FileText,
} from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { AdminHRHeader } from '../../components/AdminHRHeader';
import {
  fetchLeaves,
  updateLeaveStatus,
  LeaveRequestItem,
} from '../../services/adminHRService';

export const AdminLeavesScreen = ({ navigation }: any) => {
  const { user } = useContext(AuthContext);
  const isHR = user?.role === 'HR';
  const companyId = isHR ? user?.company_id : undefined;

  const [leaves, setLeaves] = useState<LeaveRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequestItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const data = await fetchLeaves(companyId, activeTab);
      setLeaves(data);
    } catch (error) {
      console.error('Failed fetching leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();
  }, [activeTab]);

  const handleAction = async (status: 'APPROVED' | 'REJECTED') => {
    if (!selectedLeave) return;
    if (status === 'REJECTED' && !rejectionReason.trim()) {
      Alert.alert('Rejection Reason Required', 'Please provide a clear reason for rejecting this leave request.');
      return;
    }

    setActionLoading(true);
    try {
      await updateLeaveStatus(selectedLeave.id, status, rejectionReason);
      Alert.alert('Success', `Leave request marked as ${status.toLowerCase()}.`);
      setModalVisible(false);
      setRejectionReason('');
      loadLeaves();
    } catch (error) {
      Alert.alert('Action Failed', 'Could not update leave request status.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return { bg: '#ECFDF5', text: '#CC5200', icon: CheckCircle };
      case 'REJECTED':
        return { bg: '#F5F5F5', text: '#000000', icon: XCircle };
      default:
        return { bg: '#F5F5F5', text: '#222222', icon: Clock };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <AdminHRHeader
        title="Leave Management"
        subtitle="Review and approve staff leaves"
        role={user?.role || 'ADMIN'}
        companyName={user?.company_name}
      />

      {/* Status Filter Tabs */}
      <View style={styles.tabContainer}>
        {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#E56108" />
          <Text style={styles.loadingText}>Fetching requests...</Text>
        </View>
      ) : (
        <FlatList
          data={leaves}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const badge = getStatusBadge(item.status);
            const BadgeIcon = badge.icon;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => {
                  setSelectedLeave(item);
                  setModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.cardTop}>
                  <View style={styles.empInfo}>
                    <Text style={styles.empName}>{item.employee_name || 'Employee'}</Text>
                    <Text style={styles.empSub}>ID: {item.employee_id_display || item.employee}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <BadgeIcon size={12} color={badge.text} />
                    <Text style={[styles.badgeText, { color: badge.text }]}>{item.status}</Text>
                  </View>
                </View>

                <View style={styles.detailsRow}>
                  <View style={styles.detailCol}>
                    <Calendar size={14} color="#666666" />
                    <Text style={styles.detailText}>
                      {item.start_date} → {item.end_date}
                    </Text>
                  </View>
                  <View style={styles.daysBadge}>
                    <Text style={styles.daysBadgeText}>
                      {item.number_of_days} {item.number_of_days === 1 ? 'Day' : 'Days'}
                    </Text>
                  </View>
                </View>

                <View style={styles.reasonRow}>
                  <FileText size={14} color="#888888" />
                  <Text style={styles.reasonText} numberOfLines={2}>
                    {item.leave_type}: {item.reason || 'No description provided'}
                  </Text>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.appliedDate}>Applied: {item.applied_at?.split('T')[0] || 'Recent'}</Text>
                  <View style={styles.reviewPrompt}>
                    <Text style={styles.reviewPromptText}>View details</Text>
                    <ChevronRight size={14} color="#E56108" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Leave Requests</Text>
              <Text style={styles.emptyDesc}>There are currently no leaves in this category.</Text>
            </View>
          }
        />
      )}

      {/* Review Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Leave Request Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color="#444444" />
              </TouchableOpacity>
            </View>

            {selectedLeave && (
              <View style={styles.modalBody}>
                <View style={styles.modalField}>
                  <Text style={styles.fieldLabel}>Applicant</Text>
                  <Text style={styles.fieldValue}>{selectedLeave.employee_name}</Text>
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.fieldLabel}>Leave Type</Text>
                  <Text style={styles.fieldValue}>{selectedLeave.leave_type}</Text>
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.fieldLabel}>Duration</Text>
                  <Text style={styles.fieldValue}>
                    {selectedLeave.start_date} to {selectedLeave.end_date} ({selectedLeave.number_of_days} days)
                  </Text>
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.fieldLabel}>Reason</Text>
                  <Text style={styles.fieldValue}>{selectedLeave.reason || 'None provided'}</Text>
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.fieldLabel}>Current Status</Text>
                  <Text style={styles.fieldValue}>{selectedLeave.status}</Text>
                </View>

                {selectedLeave.rejection_reason ? (
                  <View style={styles.modalField}>
                    <Text style={styles.fieldLabel}>Rejection Reason</Text>
                    <Text style={[styles.fieldValue, { color: '#000000' }]}>
                      {selectedLeave.rejection_reason}
                    </Text>
                  </View>
                ) : null}

                {selectedLeave.status === 'PENDING' && (
                  <>
                    <Text style={styles.reasonInputLabel}>Remarks / Rejection Reason (If rejecting)</Text>
                    <TextInput
                      style={styles.reasonInput}
                      placeholder="Optional remarks or rejection explanation..."
                      multiline
                      value={rejectionReason}
                      onChangeText={setRejectionReason}
                    />

                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.rejectBtn]}
                        onPress={() => handleAction('REJECTED')}
                        disabled={actionLoading}
                      >
                        <XCircle size={18} color="#FFFFFF" />
                        <Text style={styles.actionBtnText}>Reject</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtn, styles.approveBtn]}
                        onPress={() => handleAction('APPROVED')}
                        disabled={actionLoading}
                      >
                        <CheckCircle size={18} color="#FFFFFF" />
                        <Text style={styles.actionBtnText}>Approve</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: colors.surfaceSecondary,
  },
  tabText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#666666',
  },
  tabTextActive: {
    color: '#000000',
    fontFamily: 'Comfortaa_700Bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666666',
  },
  listContent: {
    padding: 16,
    backgroundColor: colors.surfaceSecondary,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F5F5F5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  empInfo: {
    flex: 1,
  },
  empName: {
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  empSub: {
    fontSize: 12,
    color: '#666666',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    letterSpacing: 0.5,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  detailCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#222222',
  },
  daysBadge: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  daysBadgeText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
    color: '#444444',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 4,
  },
  reasonText: {
    flex: 1,
    fontSize: 13,
    color: '#666666',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    marginTop: 10,
    paddingTop: 8,
  },
  appliedDate: {
    fontSize: 11,
    color: '#888888',
  },
  reviewPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reviewPromptText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  emptyDesc: {
    fontSize: 13,
    color: '#666666',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  modalBody: {
    marginTop: 14,
  },
  modalField: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#666666',
  },
  fieldValue: {
    fontSize: 14,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#000000',
    marginTop: 2,
  },
  reasonInputLabel: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#444444',
    marginTop: 8,
    marginBottom: 6,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    fontSize: 13,
    color: '#000000',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  approveBtn: {
    backgroundColor: '#E56108',
  },
  rejectBtn: {
    backgroundColor: '#EF4444',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_700Bold',
    fontSize: 14,
  },
});

