import { colors } from '../../theme/colors';
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MapPin,
  Battery,
  Building,
  Phone,
  Navigation,
  RefreshCw,
} from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { AdminHRHeader } from '../../components/AdminHRHeader';
import {
  fetchLiveLocations,
  LiveLocationItem,
} from '../../services/adminHRService';

export const AdminLiveLocationsScreen = ({ navigation }: any) => {
  const { user } = useContext(AuthContext);
  const isHR = user?.role === 'HR';
  const companyId = isHR ? user?.company_id : undefined;

  const [locations, setLocations] = useState<LiveLocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLocations = async () => {
    try {
      const data = await fetchLiveLocations(companyId);
      setLocations(data);
    } catch (error) {
      console.error('Failed fetching live locations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLocations();
    const interval = setInterval(loadLocations, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, []);

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
            onPress={() => {
              setRefreshing(true);
              loadLocations();
            }}
            activeOpacity={0.8}
          >
            <RefreshCw size={16} color="#FFFFFF" />
          </TouchableOpacity>
        }
      />

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0757B8" />
          <Text style={styles.loadingText}>Connecting to field GPS beacons...</Text>
        </View>
      ) : (
        <FlatList
          data={locations}
          keyExtractor={(item) => String(item.employee_id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {item.name
                      ?.split(' ')
                      .map((n) => n[0])
                      .join('')
                      .substring(0, 2)
                      .toUpperCase() || 'EM'}
                  </Text>
                </View>

                <View style={styles.nameCol}>
                  <Text style={styles.empName}>{item.name}</Text>
                  <Text style={styles.empSub}>
                    ID: {item.employee_code} {item.department ? `• ${item.department}` : ''}
                  </Text>
                </View>

                <View style={styles.batteryRow}>
                  <Battery size={14} color="#0056B3" />
                  <Text style={styles.batteryText}>{item.battery_level ?? 95}%</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.coordCol}>
                  <MapPin size={13} color="#0757B8" />
                  <Text style={styles.coordText}>
                    {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                  </Text>
                </View>

                <Text style={styles.updatedAt}>
                  {item.updated_at ? item.updated_at.split('T')[1]?.substring(0, 8) : 'Active'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.mapBtn}
                onPress={() => openInMaps(item.latitude, item.longitude, item.name)}
                activeOpacity={0.8}
              >
                <Navigation size={14} color="#0757B8" />
                <Text style={styles.mapBtnText}>View on External Maps</Text>
              </TouchableOpacity>
            </View>
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
    backgroundColor: colors.surfaceSecondary,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666666',
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
    alignItems: 'center',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
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
    color: '#666666',
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
    color: '#014B9D',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
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
    color: '#444444',
    fontFamily: 'Comfortaa_600SemiBold',
  },
  updatedAt: {
    fontSize: 11,
    color: '#888888',
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSecondary,
    paddingVertical: 9,
    borderRadius: 8,
    marginTop: 10,
    gap: 6,
  },
  mapBtnText: {
    color: '#000000',
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

