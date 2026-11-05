import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Users,
  UserCheck,
  Clock,
  UserX,
  Plane,
  ShieldAlert,
  Laptop,
  Building2,
  GitBranch,
  CalendarDays,
  MapPin,
  ChevronRight,
  TrendingUp,
} from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { AdminHRHeader } from '../../components/AdminHRHeader';
import { CategoryBubblesRow } from '../../components/CategoryBubblesRow';
import { AppSearchBar } from '../../components/AppSearchBar';
import {
  fetchAdminDashboardStats,
  fetchCompanies,
  fetchPendingActionsReminder,
  DashboardStats,
  CompanySummary,
} from '../../services/adminHRService';
import {
  MobileRolePendingActionsModal,
  MobilePendingActionItem,
  MobilePendingActionsSummary,
} from '../../components/MobileRolePendingActionsModal';
import * as SecureStore from 'expo-secure-store';
import { colors } from '../../theme/colors';

export const AdminHRDashboardScreen = ({ navigation }: any) => {
  const { user } = useContext(AuthContext);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const isHR = user?.role === 'HR';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [adminSearch, setAdminSearch] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | undefined>(
    isHR ? user?.company_id : undefined
  );

  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [reminderData, setReminderData] = useState<{
    totalCount: number;
    summary: MobilePendingActionsSummary;
    items: MobilePendingActionItem[];
  }>({
    totalCount: 0,
    summary: {},
    items: [],
  });

  // Check hourly / initial pending reminder for Admin & HR
  useEffect(() => {
    let active = true;

    const checkReminder = async (force: boolean = false) => {
      try {
        const storeKey = `pending_reminder_ts_${user?.role || 'ROLE'}_${user?.id || '0'}`;
        const lastShown = await SecureStore.getItemAsync(storeKey);
        const oneHourMs = 60 * 60 * 1000;
        const now = Date.now();

        if (!force && lastShown && now - parseInt(lastShown, 10) < oneHourMs) {
          return;
        }

        const data = await fetchPendingActionsReminder();
        if (!active) return;

        if (data && data.has_pending && data.total_pending_count > 0) {
          setReminderData({
            totalCount: data.total_pending_count,
            summary: data.summary || {},
            items: data.items || [],
          });
          setReminderModalVisible(true);
          await SecureStore.setItemAsync(storeKey, now.toString());
        }
      } catch (err) {
        console.error('Error fetching mobile pending actions reminder:', err);
      }
    };

    checkReminder(false);

    // 1-hour interval timer (particularly critical for HR)
    const interval = setInterval(() => {
      checkReminder(true);
    }, 60 * 60 * 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user]);

  const loadData = async (companyId?: number) => {
    try {
      if (isSuperAdmin) {
        const comps = await fetchCompanies();
        setCompanies(comps);
      }
      const activeCompId = isHR ? user?.company_id : companyId;
      const data = await fetchAdminDashboardStats(activeCompId);
      setStats(data);
    } catch (error) {
      console.error('Failed loading admin/hr dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(selectedCompanyId);
  }, [selectedCompanyId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(selectedCompanyId);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <AdminHRHeader
        title="Operations Hub"
        subtitle={`Today: ${stats?.date || new Date().toISOString().split('T')[0]}`}
        role={user?.role || 'ADMIN'}
        companyName={user?.company_name || 'Organization'}
        onNotificationsPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* Search Bar matching reference image */}
        <View style={{ marginBottom: 16 }}>
          <AppSearchBar
            value={adminSearch}
            onChangeText={setAdminSearch}
            placeholder="Search staff, leaves, branches..."
            onClear={() => setAdminSearch('')}
            onFilterPress={() => navigation.navigate('AdminEmployees')}
          />
        </View>
        {/* Company Selector for Super Admin */}
        {isSuperAdmin && companies.length > 0 && (
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Organizations</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.companyScroll}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  selectedCompanyId === undefined && styles.filterChipActive,
                ]}
                onPress={() => setSelectedCompanyId(undefined)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedCompanyId === undefined && styles.filterChipTextActive,
                  ]}
                >
                  All Organizations
                </Text>
              </TouchableOpacity>
              {companies.map((comp) => (
                <TouchableOpacity
                  key={comp.id}
                  style={[
                    styles.filterChip,
                    selectedCompanyId === comp.id && styles.filterChipActive,
                  ]}
                  onPress={() => setSelectedCompanyId(comp.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedCompanyId === comp.id && styles.filterChipTextActive,
                    ]}
                  >
                    {comp.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Live Attendance Overview Cards - Clean Minimal Zomato Style */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Attendance Overview</Text>
          <View style={styles.rateBadge}>
            <TrendingUp size={13} color={colors.success} strokeWidth={2.2} />
            <Text style={styles.rateBadgeText}>{stats?.present_percentage || 0}% Present</Text>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          {/* Card 1: Total Staff */}
          <View style={styles.metricCard}>
            <View style={styles.metricTop}>
              <Text style={styles.metricTitle}>Total Staff</Text>
              <Users size={18} color={colors.textSecondary} strokeWidth={1.8} />
            </View>
            <Text style={styles.metricVal}>{stats?.total_staff ?? 0}</Text>
          </View>

          {/* Card 2: Present */}
          <View style={styles.metricCard}>
            <View style={styles.metricTop}>
              <Text style={styles.metricTitle}>Present</Text>
              <UserCheck size={18} color={colors.success} strokeWidth={1.8} />
            </View>
            <Text style={[styles.metricVal, { color: colors.success }]}>{stats?.present_today ?? 0}</Text>
          </View>

          {/* Card 3: Late */}
          <View style={styles.metricCard}>
            <View style={styles.metricTop}>
              <Text style={styles.metricTitle}>Late Arrival</Text>
              <Clock size={18} color={colors.warning} strokeWidth={1.8} />
            </View>
            <Text style={[styles.metricVal, { color: colors.warning }]}>{stats?.late_today ?? 0}</Text>
          </View>

          {/* Card 4: Absent */}
          <View style={styles.metricCard}>
            <View style={styles.metricTop}>
              <Text style={styles.metricTitle}>Absent</Text>
              <UserX size={18} color={colors.error} strokeWidth={1.8} />
            </View>
            <Text style={[styles.metricVal, { color: colors.error }]}>{stats?.absent_today ?? 0}</Text>
          </View>
        </View>

        {/* Action Pending Approvals Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pending Approvals</Text>
          <Text style={styles.sectionSubtitle}>Immediate review</Text>
        </View>

        <View style={styles.approvalsRow}>
          <TouchableOpacity
            style={styles.approvalCard}
            onPress={() => navigation.navigate('AdminLeaves')}
            activeOpacity={0.7}
          >
            <View style={styles.approvalTop}>
              <Plane size={17} color={colors.primary} strokeWidth={1.9} />
              <Text style={styles.approvalCount}>{stats?.pending_leave_requests ?? 0}</Text>
            </View>
            <Text style={styles.approvalLabel}>Leaves</Text>
            <View style={styles.approvalAction}>
              <Text style={styles.approvalActionText}>Review</Text>
              <ChevronRight size={13} color={colors.primary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.approvalCard}
            onPress={() => navigation.navigate('AdminPermissions')}
            activeOpacity={0.7}
          >
            <View style={styles.approvalTop}>
              <ShieldAlert size={17} color={colors.warning} strokeWidth={1.9} />
              <Text style={styles.approvalCount}>{stats?.pending_permission_requests ?? 0}</Text>
            </View>
            <Text style={styles.approvalLabel}>Permissions</Text>
            <View style={styles.approvalAction}>
              <Text style={styles.approvalActionText}>Review</Text>
              <ChevronRight size={13} color={colors.primary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.approvalCard}
            onPress={() => navigation.navigate('AdminWFH')}
            activeOpacity={0.7}
          >
            <View style={styles.approvalTop}>
              <Laptop size={17} color={colors.textPrimary} strokeWidth={1.9} />
              <Text style={styles.approvalCount}>{stats?.pending_wfh_requests ?? 0}</Text>
            </View>
            <Text style={styles.approvalLabel}>Remote WFH</Text>
            <View style={styles.approvalAction}>
              <Text style={styles.approvalActionText}>Review</Text>
              <ChevronRight size={13} color={colors.primary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick Access Modules - Circular Bubbles Row */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Modules</Text>
        </View>
        <CategoryBubblesRow
          items={[
            {
              id: 'staff',
              label: 'Staff',
              icon: <Users size={22} color={colors.primary} strokeWidth={2} />,
              onPress: () => navigation.navigate('AdminEmployees'),
            },
            {
              id: 'attendance',
              label: 'Roster',
              icon: <CalendarDays size={22} color={colors.primary} strokeWidth={2} />,
              onPress: () => navigation.navigate('AdminAttendance'),
            },
            {
              id: 'branches',
              label: 'Branches',
              icon: <GitBranch size={22} color={colors.primary} strokeWidth={2} />,
              onPress: () => navigation.navigate('AdminBranches'),
            },
            {
              id: 'shifts',
              label: 'Shifts',
              icon: <Clock size={22} color={colors.primary} strokeWidth={2} />,
              onPress: () => navigation.navigate('AdminShifts'),
            },
          ]}
        />

        {/* Management Portals Navigation - Clean Minimal Row List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All Modules</Text>
        </View>

        <View style={styles.modulesContainer}>
          <TouchableOpacity
            style={styles.moduleItem}
            onPress={() => navigation.navigate('AdminEmployees')}
            activeOpacity={0.7}
          >
            <Users size={19} color={colors.iconPrimary} strokeWidth={1.8} style={styles.moduleStandaloneIcon} />
            <View style={styles.moduleInfo}>
              <Text style={styles.moduleName}>Staff Roster</Text>
              <Text style={styles.moduleDesc}>Employee profiles, details & active status</Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.moduleItem}
            onPress={() => navigation.navigate('AdminBranches')}
            activeOpacity={0.7}
          >
            <GitBranch size={19} color={colors.iconPrimary} strokeWidth={1.8} style={styles.moduleStandaloneIcon} />
            <View style={styles.moduleInfo}>
              <Text style={styles.moduleName}>Branch Geofences</Text>
              <Text style={styles.moduleDesc}>GPS coordinates, radius & active sites</Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.moduleItem}
            onPress={() => navigation.navigate('AdminShifts')}
            activeOpacity={0.7}
          >
            <Clock size={19} color={colors.iconPrimary} strokeWidth={1.8} style={styles.moduleStandaloneIcon} />
            <View style={styles.moduleInfo}>
              <Text style={styles.moduleName}>Work Shifts</Text>
              <Text style={styles.moduleDesc}>Timing schedules & grace periods</Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.moduleItem}
            onPress={() => navigation.navigate('AdminHolidays')}
            activeOpacity={0.7}
          >
            <CalendarDays size={19} color={colors.iconPrimary} strokeWidth={1.8} style={styles.moduleStandaloneIcon} />
            <View style={styles.moduleInfo}>
              <Text style={styles.moduleName}>Company Holidays</Text>
              <Text style={styles.moduleDesc}>Annual calendar & holiday schedules</Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.moduleItem}
            onPress={() => navigation.navigate('AdminReportingManagers')}
            activeOpacity={0.7}
          >
            <UserCheck size={19} color={colors.iconPrimary} strokeWidth={1.8} style={styles.moduleStandaloneIcon} />
            <View style={styles.moduleInfo}>
              <Text style={styles.moduleName}>Reporting Managers</Text>
              <Text style={styles.moduleDesc}>Manage manager assignments & team structures</Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.moduleItem}
            onPress={() => navigation.navigate('AdminLiveLocations')}
            activeOpacity={0.7}
          >
            <MapPin size={19} color={colors.iconPrimary} strokeWidth={1.8} style={styles.moduleStandaloneIcon} />
            <View style={styles.moduleInfo}>
              <Text style={styles.moduleName}>Field Live Tracking</Text>
              <Text style={styles.moduleDesc}>Real-time GPS positions & battery status</Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Super Admin Only Modules */}
          {isSuperAdmin && (
            <>
              <TouchableOpacity
                style={styles.moduleItem}
                onPress={() => navigation.navigate('AdminCompanies')}
                activeOpacity={0.7}
              >
                <Building2 size={19} color={colors.iconPrimary} strokeWidth={1.8} style={styles.moduleStandaloneIcon} />
                <View style={styles.moduleInfo}>
                  <Text style={styles.moduleName}>Organizations & Companies</Text>
                  <Text style={styles.moduleDesc}>Create and configure multi-tenant enterprises</Text>
                </View>
                <ChevronRight size={16} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.moduleItem, { borderBottomWidth: 0 }]}
                onPress={() => navigation.navigate('AdminHRAccounts')}
                activeOpacity={0.7}
              >
                <ShieldAlert size={19} color={colors.primary} strokeWidth={1.8} style={styles.moduleStandaloneIcon} />
                <View style={styles.moduleInfo}>
                  <Text style={styles.moduleName}>HR Account Provisioning</Text>
                  <Text style={styles.moduleDesc}>Manage HR login credentials by company</Text>
                </View>
                <ChevronRight size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      <MobileRolePendingActionsModal
        visible={reminderModalVisible}
        role={user?.role || 'HR'}
        totalCount={reminderData.totalCount}
        summary={reminderData.summary}
        items={reminderData.items}
        onClose={() => setReminderModalVisible(false)}
        onNavigateAction={(item) => {
          setReminderModalVisible(false);
          switch (item.type) {
            case 'LEAVE':
              navigation.navigate('AdminLeaves');
              break;
            case 'PERMISSION':
              navigation.navigate('AdminPermissions');
              break;
            case 'WFH':
              navigation.navigate('AdminWFH');
              break;
            case 'ATTENDANCE_PUNCH':
              navigation.navigate('AdminAttendance');
              break;
            default:
              navigation.navigate('AdminLeaves');
          }
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: colors.textSecondary,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  companyScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: colors.surface,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  rateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F5F5F5',
    gap: 4,
  },
  rateBadgeText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: colors.success,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#202334',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  metricTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricTitle: {
    fontSize: 12,
    fontFamily: 'Comfortaa_500Medium',
    color: colors.textSecondary,
  },
  metricVal: {
    fontSize: 22,
    fontFamily: 'Comfortaa_700Bold',
    color: colors.textPrimary,
  },
  approvalsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  approvalCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#202334',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  approvalTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  approvalCount: {
    fontSize: 17,
    fontFamily: 'Comfortaa_700Bold',
    color: colors.textPrimary,
  },
  approvalLabel: {
    fontSize: 11,
    fontFamily: 'Comfortaa_500Medium',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  approvalAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: 6,
  },
  approvalActionText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: colors.primary,
  },
  modulesContainer: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#202334',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  moduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  moduleStandaloneIcon: {
    marginRight: 12,
  },
  moduleInfo: {
    flex: 1,
  },
  moduleName: {
    fontSize: 14,
    fontFamily: 'Comfortaa_600SemiBold',
    color: colors.textPrimary,
  },
  moduleDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
});
