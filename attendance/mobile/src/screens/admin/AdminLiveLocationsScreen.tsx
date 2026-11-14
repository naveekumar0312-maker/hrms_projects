import { colors } from '../../theme/colors';
import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MapPin,
  Battery,
  Navigation,
  RefreshCw,
  AlertCircle,
  BellRing,
  LocateFixed,
  Users,
  Route,
} from 'lucide-react-native';
import { AuthContext, api } from '../../context/AuthContext';
import { AdminHRHeader } from '../../components/AdminHRHeader';
import {
  fetchLiveLocations,
  fetchEmployees,
  LiveLocationItem,
  EmployeeItem,
} from '../../services/adminHRService';

export const AdminLiveLocationsScreen = ({ navigation }: any) => {
  const { user } = useContext(AuthContext);
  const isHR = user?.role === 'HR';
  const companyId = isHR ? user?.company_id : undefined;

  const [locations, setLocations] = useState<LiveLocationItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingAlertId, setSendingAlertId] = useState<number | null>(null);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [locData, empData] = await Promise.all([
        fetchLiveLocations(companyId),
        fetchEmployees(companyId),
      ]);
      setLocations(locData);
      setEmployees(empData);
    } catch (error) {
      console.error('Failed fetching live locations or employees:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(false), 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, []);

  // Filter employees whose work_type is FIELD or MARKETING
  const fieldEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const wt = ((emp as any).work_type || '').trim().toUpperCase();
      return ['FIELD', 'MARKETING'].includes(wt);
    });
  }, [employees]);

  // Employees who are NOT currently sharing location
  const notSharingEmployees = useMemo(() => {
    const sharingEmpIds = new Set(locations.map((loc) => loc.employee_id));
    const sharingCodes = new Set(locations.map((loc) => loc.employee_code));
    return fieldEmployees.filter(
      (emp) => !sharingEmpIds.has(emp.id) && !sharingCodes.has(emp.employee_id)
    );
  }, [fieldEmployees, locations]);

  const openInMaps = (lat: number, lng: number, label: string) => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lng}`;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });
    if (url) {
      Linking.openURL(url);
    }
  };

  const handleSendAlert = async (emp: EmployeeItem) => {
    if (sendingAlertId !== null) return;
    setSendingAlertId(emp.id);
    try {
      await api.post('/notifications/request-location/', {
        employee_id: emp.id,
      });
      Alert.alert(
        'Alert Sent',
        `Notification sent to ${emp.full_name} to turn on GPS location sharing!`
      );
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.response?.data?.detail || 'Failed to send notification request.'
      );
    } finally {
      setSendingAlertId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <AdminHRHeader
        title="Live Field Tracking"
        subtitle={`${locations.length} active GPS beacons`}
        role={user?.role || 'ADMIN'}
        companyName={user?.company_name}
        rightAction={
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => loadData(true)}
            activeOpacity={0.8}
            disabled={refreshing}
          >
            <RefreshCw size={16} color="#FFFFFF" />
          </TouchableOpacity>
        }
      />

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#003882" />
          <Text style={styles.loadingText}>Connecting to field GPS beacons...</Text>
        </View>
      ) : (
        <FlatList
          data={locations}
          keyExtractor={(item) => String(item.employee_id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.headerComponent}>
              {/* STATS OVERVIEW */}
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <LocateFixed size={18} color="#059669" />
                  <Text style={styles.statCount}>{locations.length}</Text>
                  <Text style={styles.statLabel}>Sharing Live</Text>
                </View>
                <View style={styles.statBox}>
                  <AlertCircle size={18} color="#DC2626" />
                  <Text style={[styles.statCount, { color: '#DC2626' }]}>
                    {notSharingEmployees.length}
                  </Text>
                  <Text style={styles.statLabel}>Location Off</Text>
                </View>
                <View style={styles.statBox}>
                  <Users size={18} color="#003882" />
                  <Text style={styles.statCount}>{fieldEmployees.length}</Text>
                  <Text style={styles.statLabel}>Total Field</Text>
                </View>
              </View>

              {/* LOCATION TURNED OFF SECTION (Exact Web Feature) */}
              {notSharingEmployees.length > 0 && (
                <View style={styles.notSharingSection}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                      <AlertCircle size={18} color="#DC2626" />
                      <Text style={styles.sectionTitleRed}>
                        Location Turned Off ({notSharingEmployees.length})
                      </Text>
                    </View>
                    <View style={styles.actionRequiredBadge}>
                      <Text style={styles.actionRequiredText}>Action Required</Text>
                    </View>
                  </View>
                  <Text style={styles.sectionSubtitle}>
                    Active field/marketing employees who have NOT enabled location sharing today
                  </Text>

                  {notSharingEmployees.map((emp) => (
                    <View key={emp.id} style={styles.notSharingCard}>
                      <View style={styles.notSharingLeft}>
                        <View style={styles.notSharingAvatar}>
                          <Text style={styles.notSharingAvatarText}>
                            {(emp.full_name || 'E').trim().charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.notSharingInfo}>
                          <Text style={styles.notSharingName}>{emp.full_name}</Text>
                          <Text style={styles.notSharingSub}>
                            {emp.employee_id} {emp.branch_name ? `• ${emp.branch_name}` : ''}
                          </Text>
                          <Text style={styles.notSharingStatus}>GPS is currently turned OFF</Text>
                        </View>
                      </View>

                      <View style={styles.notSharingActions}>
                        <TouchableOpacity
                          style={styles.historyBtn}
                          onPress={() =>
                            navigation.navigate('AdminEmployeeRouteMap', {
                              employeeId: emp.id,
                              employeeName: emp.full_name,
                              employeeCode: emp.employee_id,
                              branchName: emp.branch_name,
                              isSharing: false,
                            })
                          }
                          activeOpacity={0.85}
                        >
                          <Route size={13} color="#003882" />
                          <Text style={styles.historyBtnText}>Timeline</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.sendAlertBtn}
                          onPress={() => handleSendAlert(emp)}
                          disabled={sendingAlertId === emp.id}
                          activeOpacity={0.85}
                        >
                          {sendingAlertId === emp.id ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <BellRing size={13} color="#FFFFFF" />
                              <Text style={styles.sendAlertBtnText}>Alert</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* CURRENTLY SHARING HEADER */}
              <View style={styles.sharingHeadingRow}>
                <Text style={styles.sharingHeadingTitle}>Currently Sharing GPS</Text>
                <Text style={styles.sharingHeadingCount}>
                  {locations.length} employee{locations.length === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate('AdminEmployeeRouteMap', {
                  employeeId: item.employee_id,
                  employeeName: item.name,
                  employeeCode: item.employee_code,
                  branchName: item.branch_name,
                  isSharing: true,
                })
              }
              activeOpacity={0.9}
            >
              <View style={styles.cardTop}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {(item.name || 'E').trim().charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.nameCol}>
                  <Text style={styles.empName}>{item.name}</Text>
                  <Text style={styles.empSub}>
                    ID: {item.employee_code} {item.branch_name ? `• ${item.branch_name}` : ''}
                  </Text>
                </View>

                <View style={styles.batteryRow}>
                  <Battery size={14} color="#059669" />
                  <Text style={styles.batteryText}>{item.battery_level ?? 95}%</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.coordCol}>
                  <MapPin size={13} color="#003882" />
                  <Text style={styles.coordText}>
                    {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                  </Text>
                </View>

                <Text style={styles.updatedAt}>
                  {item.updated_at ? item.updated_at.split('T')[1]?.substring(0, 8) : 'Active'}
                </Text>
              </View>

              <View style={styles.cardActionRow}>
                <TouchableOpacity
                  style={styles.routeBtn}
                  onPress={() =>
                    navigation.navigate('AdminEmployeeRouteMap', {
                      employeeId: item.employee_id,
                      employeeName: item.name,
                      employeeCode: item.employee_code,
                      branchName: item.branch_name,
                      isSharing: true,
                    })
                  }
                  activeOpacity={0.8}
                >
                  <LocateFixed size={14} color="#FFFFFF" />
                  <Text style={styles.routeBtnText}>View Route Map</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.mapBtn}
                  onPress={() => openInMaps(item.latitude, item.longitude, item.name)}
                  activeOpacity={0.8}
                >
                  <Navigation size={14} color="#003882" />
                  <Text style={styles.mapBtnText}>Maps</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Active Trackers</Text>
              <Text style={styles.emptyDesc}>No field employees are broadcasting live coordinates.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: 'Comfortaa_500Medium',
    color: '#64748B',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    paddingBottom: 40,
  },
  headerComponent: {
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  statCount: {
    fontSize: 18,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0F172A',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Comfortaa_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  notSharingSection: {
    backgroundColor: '#FFF5F5',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    padding: 14,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitleRed: {
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
    color: '#DC2626',
  },
  actionRequiredBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  actionRequiredText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: '#DC2626',
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: 'Comfortaa_400Regular',
    color: '#64748B',
    marginBottom: 12,
  },
  notSharingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  notSharingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  notSharingAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FCA5A5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  notSharingAvatarText: {
    fontSize: 14,
    fontFamily: 'Comfortaa_700Bold',
    color: '#7F1D1D',
  },
  notSharingInfo: {
    flex: 1,
  },
  notSharingName: {
    fontSize: 13.5,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0F172A',
  },
  notSharingSub: {
    fontSize: 11,
    fontFamily: 'Comfortaa_400Regular',
    color: '#64748B',
    marginTop: 1,
  },
  notSharingStatus: {
    fontSize: 11,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#DC2626',
    marginTop: 2,
  },
  notSharingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  historyBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  historyBtnText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
  },
  sendAlertBtn: {
    backgroundColor: '#E56108',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 8,
  },
  sendAlertBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
  },
  sharingHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sharingHeadingTitle: {
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0F172A',
  },
  sharingHeadingCount: {
    fontSize: 12.5,
    fontFamily: 'Comfortaa_500Medium',
    color: '#64748B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
    color: '#003882',
  },
  nameCol: {
    flex: 1,
  },
  empName: {
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  empSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  batteryText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: '#059669',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 12,
    paddingTop: 10,
  },
  coordCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coordText: {
    fontSize: 12,
    color: '#334155',
    fontFamily: 'Comfortaa_600SemiBold',
  },
  updatedAt: {
    fontSize: 11,
    color: '#64748B',
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  routeBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EA580C',
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
  },
  routeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
  },
  mapBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
  },
  mapBtnText: {
    color: '#003882',
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
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
});
