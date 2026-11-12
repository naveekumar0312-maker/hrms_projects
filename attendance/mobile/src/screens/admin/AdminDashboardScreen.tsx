import { colors } from '../../theme/colors';
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
  UserCheck,
  Clock,
  UserX,
  LogOut,
  TrendingUp,
} from 'lucide-react-native';
import { AuthContext, api } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme';

export default function AdminDashboardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance/dashboard/');
      setSummary(res.data?.summary || null);
    } catch (err) {
      console.error('Failed to load admin attendance dashboard:', err);
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

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <View style={styles.container}>
      <StatusBar style="dark" hidden={false} />

      {/* HEADER SECTION */}
      <View style={[styles.headerArea, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.companyName}>
              {user?.company_name || 'Organization Admin'}
            </Text>
            <Text style={styles.roleBadge}>
              {user?.role === 'SUPER_ADMIN' ? 'Super Administrator' : 'Administrator'}
            </Text>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <LogOut size={18} color="#FFFFFF" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <View style={styles.greetingBlock}>
          <Text style={styles.greetingTitle}>
            Hi, {user?.username || 'Admin'}
          </Text>
          <Text style={styles.greetingSub}>
            System Control & Organization Overview
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
            <Text style={styles.loadingText}>Loading Admin Overview...</Text>
          </View>
        ) : (
          <>
            {/* DATE BADGE */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today's Attendance Overview</Text>
              <Text style={styles.dateLabel}>{todayStr}</Text>
            </View>

            {/* STATS GRID */}
            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, { backgroundColor: colors.surfaceSecondary }]}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(0, 86, 179, 0.12)' }]}>
                  <Users size={20} color="#E56108" strokeWidth={2.2} />
                </View>
                <Text style={styles.metricVal}>{summary?.total_employees ?? 0}</Text>
                <Text style={styles.metricLabel}>Total Staff</Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: colors.surfaceSecondary }]}>
                <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
                  <UserCheck size={20} color="#000000" strokeWidth={2.2} />
                </View>
                <Text style={styles.metricVal}>{summary?.present ?? 0}</Text>
                <Text style={styles.metricLabel}>Present Today</Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: colors.surfaceSecondary }]}>
                <View style={[styles.iconBox, { backgroundColor: '#E5E5E5' }]}>
                  <Clock size={20} color="#B45309" strokeWidth={2.2} />
                </View>
                <Text style={styles.metricVal}>{summary?.late ?? 0}</Text>
                <Text style={styles.metricLabel}>Late In</Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: colors.surfaceSecondary }]}>
                <View style={[styles.iconBox, { backgroundColor: '#E5E5E5' }]}>
                  <UserX size={20} color="#000000" strokeWidth={2.2} />
                </View>
                <Text style={styles.metricVal}>{summary?.absent ?? 0}</Text>
                <Text style={styles.metricLabel}>Absent Today</Text>
              </View>
            </View>

            {/* INFO BANNER */}
            <View style={styles.infoBanner}>
              <TrendingUp size={22} color="#E56108" strokeWidth={2.2} />
              <View style={styles.infoBannerContent}>
                <Text style={styles.infoBannerTitle}>Live Web Synchronization</Text>
                <Text style={styles.infoBannerText}>
                  All attendance records, leaves, permissions, and employee logs update dynamically in real time.
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
  },
  headerArea: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  companyName: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontFamily: 'Comfortaa_600SemiBold',
    letterSpacing: 0.3,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingBlock: {
    marginTop: 18,
  },
  greetingTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'Comfortaa_700Bold',
    letterSpacing: -0.3,
  },
  greetingSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    marginTop: 3,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  centerBox: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
    fontFamily: 'Comfortaa_500Medium',
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
    color: '#666666',
    fontFamily: 'Comfortaa_600SemiBold',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricVal: {
    fontSize: 24,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  metricLabel: {
    fontSize: 12,
    color: '#444444',
    fontFamily: 'Comfortaa_600SemiBold',
    marginTop: 2,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  infoBannerContent: {
    flex: 1,
  },
  infoBannerTitle: {
    fontSize: 14,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
    marginBottom: 4,
  },
  infoBannerText: {
    fontSize: 12.5,
    color: '#666666',
    lineHeight: 18,
  },
});

