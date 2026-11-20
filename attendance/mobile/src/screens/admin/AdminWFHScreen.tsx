import { colors } from '../../theme/colors';
import React, { useState, useEffect, useContext, useMemo } from 'react';
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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Laptop,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  FileText,
  RotateCcw,
} from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { AdminHRHeader } from '../../components/AdminHRHeader';
import {
  fetchWFHRequests,
  updateWFHStatus,
  undoWFH,
  WFHRequestItem,
} from '../../services/adminHRService';
import { resolveMediaUrl } from '../../utils/imageUtils';

export const AdminWFHScreen = ({ navigation }: any) => {
  const { user } = useContext(AuthContext);
  const isHR = user?.role === 'HR';
  const companyId = isHR ? user?.company_id : undefined;

  const [wfhList, setWfhList] = useState<WFHRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [selectedWFH, setSelectedWFH] = useState<WFHRequestItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Date and Search Filter State
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
    setIsDateFilterActive(true);
  };

  const loadWFH = async () => {
    setLoading(true);
    try {
      const activeDate = isDateFilterActive ? selectedDate : undefined;
      const data = await fetchWFHRequests(companyId, activeTab, activeDate, searchQuery.trim() || undefined);
      const sorted = (Array.isArray(data) ? [...data] : []).sort((a, b) => {
        const dateA = new Date((a as any).date || a.start_date || a.applied_at).getTime();
        const dateB = new Date((b as any).date || b.start_date || b.applied_at).getTime();
        return dateB - dateA;
      });
      setWfhList(sorted);
    } catch (error) {
      console.error('Failed fetching WFH requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWFH();
  }, [activeTab, selectedDate, isDateFilterActive]);

  const filteredWFH = useMemo(() => {
    return wfhList.filter((item) => {
      const itemDate = (item as any).date || item.start_date;
      if (isDateFilterActive && selectedDate && itemDate && itemDate !== selectedDate) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const empName = (item.employee_name || '').toLowerCase();
        const empId = (item.employee_id_display || '').toLowerCase();
        const reason = (item.reason || '').toLowerCase();
        if (!empName.includes(q) && !empId.includes(q) && !reason.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [wfhList, isDateFilterActive, selectedDate, searchQuery]);

  const handleAction = async (status: 'APPROVED' | 'REJECTED') => {
    if (!selectedWFH) return;
    if (status === 'REJECTED' && !rejectionReason.trim()) {
      Alert.alert('Rejection Reason Required', 'Please enter a rejection reason.');
      return;
    }

    setActionLoading(true);
    try {
      await updateWFHStatus(selectedWFH.id, status, rejectionReason);
      Alert.alert('Success', `WFH request ${status.toLowerCase()}.`);
      setModalVisible(false);
      setRejectionReason('');
      loadWFH();
    } catch (error) {
      Alert.alert('Error', 'Could not update WFH request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUndo = async (wfh: WFHRequestItem) => {
    Alert.alert(
      'Undo Action',
      `Revert WFH decision for ${wfh.employee_name || 'this employee'} back to Pending?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await undoWFH(wfh.id);
              Alert.alert('Success', 'WFH request reverted to pending.');
              setModalVisible(false);
              loadWFH();
            } catch (error: any) {
              Alert.alert('Undo Failed', error?.response?.data?.error || 'Could not revert WFH request.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return { bg: '#ECFDF5', text: '#16A34A', icon: CheckCircle };
      case 'REJECTED':
        return { bg: '#F5F5F5', text: '#000000', icon: XCircle };
      default:
        return { bg: '#F5F5F5', text: '#222222', icon: Clock };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <AdminHRHeader
        title="Work From Home"
        subtitle="WFH requests & approvals"
        role={user?.role || 'ADMIN'}
        companyName={user?.company_name || (user?.role === 'REPORTING_MANAGER' ? (user?.employee_profile?.branch_name ? `${user.employee_profile.branch_name} Branch` : 'All Companies') : undefined)}
        companyLogo={user?.company_logo}
        showBack={navigation?.canGoBack ? navigation.canGoBack() : true}
        onBack={() => navigation.goBack()}
      />

      {/* Date Switcher */}
      <View style={styles.datePickerContainer}>
        <View style={styles.dateNavigator}>
          <TouchableOpacity style={styles.dateArrowBtn} onPress={() => changeDate(-1)}>
            <ChevronLeft size={18} color="#475569" strokeWidth={2.2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dateDisplay}
            onPress={() => setIsDateFilterActive(!isDateFilterActive)}
            activeOpacity={0.7}
          >
            <Calendar size={14} color={isDateFilterActive ? colors.primary : '#94A3B8'} />
            <Text style={[styles.dateDisplayText, !isDateFilterActive && styles.dateTextMuted]}>
              {isDateFilterActive ? selectedDate : 'All Dates'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateArrowBtn} onPress={() => changeDate(1)}>
            <ChevronRight size={18} color="#475569" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <View style={styles.dateActionsRow}>
          <TouchableOpacity
            style={[styles.dateQuickBtn, isDateFilterActive && selectedDate === new Date().toISOString().split('T')[0] && styles.dateQuickBtnActive]}
            onPress={() => {
              setSelectedDate(new Date().toISOString().split('T')[0]);
              setIsDateFilterActive(true);
            }}
          >
            <Text style={[styles.dateQuickBtnText, isDateFilterActive && selectedDate === new Date().toISOString().split('T')[0] && styles.dateQuickBtnTextActive]}>
              Today
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dateQuickBtn, !isDateFilterActive && styles.dateQuickBtnActive]}
            onPress={() => setIsDateFilterActive(!isDateFilterActive)}
          >
            <Text style={[styles.dateQuickBtnText, !isDateFilterActive && styles.dateQuickBtnTextActive]}>
              {isDateFilterActive ? 'All Dates' : 'By Date'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={16} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search employee by name, ID or reason..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

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
          <ActivityIndicator size="large" color="#22C55E" />
          <Text style={styles.loadingText}>Loading WFH requests...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredWFH}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={[styles.centerContainer, { paddingVertical: 40 }]}>
              <Calendar size={36} color="#CBD5E1" />
              <Text style={[styles.loadingText, { marginTop: 10 }]}>
                {isDateFilterActive
                  ? `No WFH requests on ${selectedDate}${searchQuery ? ` matching "${searchQuery}"` : ''}.`
                  : 'No WFH requests match your search criteria.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const badge = getStatusBadge(item.status);
            const BadgeIcon = badge.icon;
            const photoUri = resolveMediaUrl(item.profile_photo);
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => {
                  setSelectedWFH(item);
                  setModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.cardTop}>
                  <View style={styles.avatarCircle}>
                    {photoUri ? (
                      <Image
                        source={{ uri: photoUri }}
                        style={styles.avatarImg}
                      />
                    ) : (
                      <Text style={styles.avatarText}>
                        {item.employee_name
                          ?.split(' ')
                          .map((n: string) => n[0])
                          .join('')
                          .substring(0, 2)
                          .toUpperCase() || 'EM'}
                      </Text>
                    )}
                  </View>
                  <View style={styles.empInfo}>
                    <Text style={styles.empName}>{item.employee_name || 'Staff'}</Text>
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
                  <View style={styles.modeBadge}>
                    <Laptop size={12} color="#7C3AED" />
                    <Text style={styles.modeBadgeText}>Remote</Text>
                  </View>
                </View>

                <View style={styles.reasonRow}>
                  <FileText size={14} color="#888888" />
                  <Text style={styles.reasonText} numberOfLines={2}>
                    {item.reason || 'No description provided'}
                  </Text>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.appliedDate}>Applied: {item.applied_at?.split('T')[0] || 'Recent'}</Text>
                  <View style={styles.reviewPrompt}>
                    <Text style={styles.reviewPromptText}>View details</Text>
                    <ChevronRight size={14} color="#22C55E" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
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
              <Text style={styles.modalTitle}>WFH Request Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color="#444444" />
              </TouchableOpacity>
            </View>

            {selectedWFH && (
              <View style={styles.modalBody}>
                <View style={styles.modalField}>
                  <Text style={styles.fieldLabel}>Applicant</Text>
                  <Text style={styles.fieldValue}>{selectedWFH.employee_name}</Text>
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.fieldLabel}>Period</Text>
                  <Text style={styles.fieldValue}>
                    {selectedWFH.start_date} to {selectedWFH.end_date}
                  </Text>
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.fieldLabel}>Reason</Text>
                  <Text style={styles.fieldValue}>{selectedWFH.reason || 'None provided'}</Text>
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.fieldLabel}>Status</Text>
                  <Text style={styles.fieldValue}>{selectedWFH.status}</Text>
                </View>

                {selectedWFH.rejection_reason ? (
                  <View style={styles.modalField}>
                    <Text style={styles.fieldLabel}>Rejection Reason</Text>
                    <Text style={[styles.fieldValue, { color: '#000000' }]}>
                      {selectedWFH.rejection_reason}
                    </Text>
                  </View>
                ) : null}

                {selectedWFH.status === 'PENDING' && (
                  <>
                    <Text style={styles.reasonInputLabel}>Remarks / Rejection Reason</Text>
                    <TextInput
                      style={styles.reasonInput}
                      placeholder="Remarks or rejection explanation..."
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

                {(selectedWFH.status === 'APPROVED' || selectedWFH.status === 'REJECTED') && (
                  <View style={{ marginTop: 20 }}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.undoBtn]}
                      onPress={() => handleUndo(selectedWFH)}
                      disabled={actionLoading}
                    >
                      <RotateCcw size={18} color="#475569" />
                      <Text style={styles.undoBtnText}>Undo Decision (Revert to Pending)</Text>
                    </TouchableOpacity>
                  </View>
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
  datePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  dateArrowBtn: {
    padding: 6,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  dateDisplayText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#0F172A',
  },
  dateTextMuted: {
    color: '#64748B',
  },
  dateActionsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dateQuickBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateQuickBtnActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#22C55E',
  },
  dateQuickBtnText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#475569',
  },
  dateQuickBtnTextActive: {
    color: '#15803D',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontFamily: 'Comfortaa_500Medium',
    padding: 0,
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
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 86, 179, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
    color: '#22C55E',
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
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  modeBadgeText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: '#7C3AED',
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
    backgroundColor: '#22C55E',
  },
  rejectBtn: {
    backgroundColor: '#EF4444',
  },
  undoBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  undoBtnText: {
    color: '#334155',
    fontFamily: 'Comfortaa_700Bold',
    fontSize: 13,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_700Bold',
    fontSize: 14,
  },
});

