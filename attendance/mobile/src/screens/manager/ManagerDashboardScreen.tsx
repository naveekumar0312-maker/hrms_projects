import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Users,
  Award,
  UserCheck,
  Clock,
  UserX,
  Calendar,
  Building,
  ChevronRight,
  ListTodo,
  CalendarCheck,
  LogOut,
} from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { getManagerDashboardSummary, ManagerSummary } from '../../services/managerService';
import { fetchPendingActionsReminder } from '../../services/adminHRService';
import {
  MobileRolePendingActionsModal,
  MobilePendingActionItem,
  MobilePendingActionsSummary,
} from '../../components/MobileRolePendingActionsModal';
import * as SecureStore from 'expo-secure-store';
import { COLORS } from '../../constants/theme';

export default function ManagerDashboardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, employee, logout } = useContext(AuthContext);

  const [summary, setSummary] = useState<ManagerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  // Hourly / mount reminder for Manager
  useEffect(() => {
    let active = true;

    const checkReminder = async (force: boolean = false) => {
      try {
        const storeKey = `pending_reminder_ts_MGR_${user?.id || '0'}`;
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
        console.error('Error fetching manager pending actions reminder:', err);
      }
    };

    checkReminder(false);

    const interval = setInterval(() => {
      checkReminder(true);
    }, 60 * 60 * 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getManagerDashboardSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load manager dashboard summary:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const isTeamLeader = user?.role === 'TEAM_LEADER';
  const roleTitle = isTeamLeader ? 'Team Leader' : 'Reporting Manager';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" hidden={false} />

      {/* HEADER SECTION */}
      <View style={[styles.headerArea, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.companyName}>
              {summary?.company_name || employee?.company_name || 'Attendance Portal'}
            </Text>
            <Text style={styles.roleBadge}>{roleTitle}</Text>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <LogOut size={18} color={COLORS.primary} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <View style={styles.greetingBlock}>
          <Text style={styles.greetingTitle}>
            Hi, {summary?.manager_name || employee?.full_name || user?.username}
          </Text>
          <Text style={styles.greetingSub}>
            {summary?.designation || employee?.designation || 'Team Overview & Management'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {loading && !summary ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading Manager Overview...</Text>
          </View>
        ) : (
          <>
            {/* QUICK ACTIONS BANNER */}
            <View style={styles.quickNavRow}>
              <TouchableOpacity
                style={[styles.quickNavCard, { backgroundColor: '#F5F5F5', borderColor: '#E5E5E5' }]}
                onPress={() => navigation.navigate('ManagerTeamTab')}
              >
                <Users size={22} color="#0056B3" strokeWidth={2.2} />
                <Text style={[styles.quickNavText, { color: '#0056B3' }]}>My Team</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickNavCard, { backgroundColor: '#F5F5F5', borderColor: '#E5E5E5' }]}
                onPress={() => navigation.navigate('ManagerTasksTab')}
              >
                <ListTodo size={22} color="#000000" strokeWidth={2.2} />
                <Text style={[styles.quickNavText, { color: '#000000' }]}>Tasks</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickNavCard, { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' }]}
                onPress={() => navigation.navigate('ManagerAttendance')}
              >
                <CalendarCheck size={22} color="#7E22CE" strokeWidth={2.2} />
                <Text style={[styles.quickNavText, { color: '#7E22CE' }]}>Attendance</Text>
              </TouchableOpacity>
            </View>

            {/* TEAM METRICS SECTION */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Team Overview</Text>
            </View>

            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, { backgroundColor: '#F5F5F5' }]}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(0, 86, 179, 0.12)' }]}>
                  <Users size={20} color="#0056B3" strokeWidth={2.2} />
                </View>
                <Text style={styles.metricVal}>{summary?.total_employees ?? 0}</Text>
                <Text style={styles.metricLabel}>Total Members</Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: '#F5F5F5' }]}>
                <View style={[styles.iconBox, { backgroundColor: '#F5F5F5' }]}>
                  <Award size={20} color="#000000" strokeWidth={2.2} />
                </View>
                <Text style={styles.metricVal}>{summary?.total_team_leaders ?? 0}</Text>
                <Text style={styles.metricLabel}>Team Leaders</Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: '#F5F5F5' }]}>
                <View style={[styles.iconBox, { backgroundColor: '#E5E5E5' }]}>
                  <Users size={20} color="#000000" strokeWidth={2.2} />
                </View>
                <Text style={styles.metricVal}>{summary?.direct_employees ?? 0}</Text>
                <Text style={styles.metricLabel}>Direct Reports</Text>
              </View>
            </View>

            {/* TODAY'S ATTENDANCE SECTION */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today's Attendance Status</Text>
              <Text style={styles.dateLabel}>{summary?.date || new Date().toISOString().split('T')[0]}</Text>
            </View>

            <View style={styles.attendanceGrid}>
              <View style={[styles.attendBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                <UserCheck size={22} color="#16A34A" strokeWidth={2.2} />
                <Text style={[styles.attendVal, { color: '#16A34A' }]}>{summary?.present_today ?? 0}</Text>
                <Text style={styles.attendLabel}>Present</Text>
              </View>

              <View style={[styles.attendBox, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                <Clock size={22} color="#D97706" strokeWidth={2.2} />
                <Text style={[styles.attendVal, { color: '#D97706' }]}>{summary?.late_today ?? 0}</Text>
                <Text style={styles.attendLabel}>Late</Text>
              </View>

              <View style={[styles.attendBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                <UserX size={22} color="#DC2626" strokeWidth={2.2} />
                <Text style={[styles.attendVal, { color: '#DC2626' }]}>{summary?.absent_today ?? 0}</Text>
                <Text style={styles.attendLabel}>Absent</Text>
              </View>

              <View style={[styles.attendBox, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                <CalendarCheck size={22} color="#0056CF" strokeWidth={2.2} />
                <Text style={[styles.attendVal, { color: '#0056CF' }]}>{summary?.pending_approvals ?? 0}</Text>
                <Text style={styles.attendLabel}>Pending</Text>
              </View>
            </View>

            {/* RECENT NAVIGATION LINKS */}
            <View style={styles.actionList}>
              <TouchableOpacity
                style={styles.actionListItem}
                onPress={() => navigation.navigate('ManagerTeamTab')}
              >
                <View style={styles.actionListLeft}>
                  <Users size={18} color={COLORS.primary} strokeWidth={2.2} />
                  <Text style={styles.actionListText}>View Team Roster & Manage Leads</Text>
                </View>
                <ChevronRight size={18} color="#888888" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionListItem}
                onPress={() => navigation.navigate('ManagerAttendance')}
              >
                <View style={styles.actionListLeft}>
                  <CalendarCheck size={18} color={COLORS.primary} strokeWidth={2.2} />
                  <Text style={styles.actionListText}>Check Real-Time Team Attendance</Text>
                </View>
                <ChevronRight size={18} color="#888888" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionListItem}
                onPress={() => navigation.navigate('ManagerTasksTab')}
              >
                <View style={styles.actionListLeft}>
                  <ListTodo size={18} color={COLORS.primary} strokeWidth={2.2} />
                  <Text style={styles.actionListText}>Assign & Track Team Tasks</Text>
                </View>
                <ChevronRight size={18} color="#888888" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      <MobileRolePendingActionsModal
        visible={reminderModalVisible}
        role="REPORTING_MANAGER"
        totalCount={reminderData.totalCount}
        summary={reminderData.summary}
        items={reminderData.items}
        onClose={() => setReminderModalVisible(false)}
        onNavigateAction={(item) => {
          setReminderModalVisible(false);
          switch (item.type) {
            case 'ATTENDANCE_PUNCH':
              navigation.navigate('ManagerAttendance');
              break;
            case 'TASK':
              navigation.navigate('ManagerTasksTab');
              break;
            default:
              navigation.navigate('ManagerAttendance');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  headerArea: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  companyName: {
    fontSize: 18,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.dark,
    letterSpacing: -0.3,
  },
  roleBadge: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.primary,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetingBlock: {
    marginTop: 14,
  },
  greetingTitle: {
    fontSize: 24,
    fontFamily: 'Comfortaa_700Bold',
    color: COLORS.dark,
    letterSpacing: -0.3,
  },
  greetingSub: {
    fontSize: 12,
    color: COLORS.secondary,
    marginTop: 3,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666666',
    fontSize: 14,
    fontFamily: 'Comfortaa_600SemiBold',
  },
  quickNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  quickNavCard: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickNavText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
    marginTop: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  dateLabel: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#666666',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricVal: {
    fontSize: 18,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  metricLabel: {
    fontSize: 11,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#666666',
    marginTop: 2,
    textAlign: 'center',
  },
  attendanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  attendBox: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  attendVal: {
    fontSize: 22,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
    marginVertical: 4,
  },
  attendLabel: {
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
    color: '#222222',
  },
  actionList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    overflow: 'hidden',
    marginBottom: 20,
  },
  actionListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  actionListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionListText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#000000',
  },
});

