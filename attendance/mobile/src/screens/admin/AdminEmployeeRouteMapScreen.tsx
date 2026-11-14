import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Path,
  Circle,
  Line,
  Rect,
  Text as SvgText,
  G,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import {
  Play,
  Pause,
  LocateFixed,
  Route,
  Navigation,
  MapPin,
  Clock,
  Radio,
  ChevronLeft,
  Calendar,
  AlertCircle,
  Share2,
} from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { AdminHRHeader } from '../../components/AdminHRHeader';
import { fetchTrackingHistory, TrackingHistoryItem } from '../../services/adminHRService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_WIDTH = SCREEN_WIDTH - 32;
const MAP_HEIGHT = 280;

export const AdminEmployeeRouteMapScreen = ({ route, navigation }: any) => {
  const { user } = React.useContext(AuthContext);
  const { employeeId, employeeName, employeeCode, branchName, isSharing } = route.params || {};

  const [history, setHistory] = useState<TrackingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPointIndex, setSelectedPointIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fitMode, setFitMode] = useState<'all' | 'selected'>('all');

  const playTimerRef = useRef<any>(null);

  const loadHistoryData = async () => {
    if (!employeeId) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchTrackingHistory(employeeId, 200);
      // Sort ascending by recorded_at for chronological route
      const sorted = [...data].sort(
        (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
      );
      setHistory(sorted);
      if (sorted.length > 0) {
        setSelectedPointIndex(sorted.length - 1); // select latest by default
      } else {
        setError('No GPS records found for this employee today.');
      }
    } catch (err: any) {
      console.warn('Failed to load tracking history:', err?.message);
      setError(err?.response?.data?.detail || 'Unable to load location route.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistoryData();
  }, [employeeId]);

  // Valid GPS coordinates
  const gpsPoints = useMemo(() => {
    return history.filter(
      (item) =>
        typeof item.latitude === 'number' &&
        !isNaN(item.latitude) &&
        typeof item.longitude === 'number' &&
        !isNaN(item.longitude)
    );
  }, [history]);

  // Bounding box for mapping coordinates to SVG canvas
  const bounds = useMemo(() => {
    if (gpsPoints.length === 0) return null;
    let minLat = gpsPoints[0].latitude!;
    let maxLat = gpsPoints[0].latitude!;
    let minLng = gpsPoints[0].longitude!;
    let maxLng = gpsPoints[0].longitude!;

    gpsPoints.forEach((p) => {
      if (p.latitude! < minLat) minLat = p.latitude!;
      if (p.latitude! > maxLat) maxLat = p.latitude!;
      if (p.longitude! < minLng) minLng = p.longitude!;
      if (p.longitude! > maxLng) maxLng = p.longitude!;
    });

    const latDelta = Math.max(maxLat - minLat, 0.005);
    const lngDelta = Math.max(maxLng - minLng, 0.005);

    return {
      minLat: minLat - latDelta * 0.15,
      maxLat: maxLat + latDelta * 0.15,
      minLng: minLng - lngDelta * 0.15,
      maxLng: maxLng + lngDelta * 0.15,
    };
  }, [gpsPoints]);

  // Function to project lat/lng to SVG x,y
  const project = (lat: number, lng: number) => {
    if (!bounds) return { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
    const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * (MAP_WIDTH - 60) + 30;
    // Latitude inverted because SVG Y is down
    const y = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * (MAP_HEIGHT - 60) + 30;
    return { x, y };
  };

  // SVG Polyline Path
  const svgPathData = useMemo(() => {
    if (gpsPoints.length < 2) return '';
    return gpsPoints.reduce((acc, p, idx) => {
      const { x, y } = project(p.latitude!, p.longitude!);
      return `${acc} ${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');
  }, [gpsPoints, bounds]);

  // Playback timer
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setInterval(() => {
        setSelectedPointIndex((prev) => {
          if (prev >= gpsPoints.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } else if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
    }
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, gpsPoints.length]);

  const togglePlay = () => {
    if (gpsPoints.length === 0) return;
    if (selectedPointIndex >= gpsPoints.length - 1) {
      setSelectedPointIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const selectedPoint = gpsPoints[selectedPointIndex] || gpsPoints[gpsPoints.length - 1];

  const openInGoogleMaps = (lat: number, lng: number, label: string) => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lng}`;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });
    if (url) Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AdminHRHeader
        title="Route Map & Timeline"
        subtitle={employeeName || 'Live Tracking'}
        role={user?.role || 'SUPER_ADMIN'}
        companyName={user?.company_name}
        showBack={true}
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#E56108" />
          <Text style={styles.loadingText}>Loading employee route history...</Text>
        </View>
      ) : error && gpsPoints.length === 0 ? (
        <View style={styles.errorBox}>
          <AlertCircle size={36} color="#DC2626" />
          <Text style={styles.errorTitle}>No Route Data</Text>
          <Text style={styles.errorDesc}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadHistoryData}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* MAP CARD */}
          <View style={styles.mapCard}>
            <View style={styles.mapHeader}>
              <View>
                <Text style={styles.mapTitle}>Route Map</Text>
                <Text style={styles.mapSubtitle}>{employeeName}</Text>
              </View>
              <View style={styles.badgeRow}>
                {isSharing ? (
                  <View style={styles.sharingBadge}>
                    <View style={styles.sharingDot} />
                    <Text style={styles.sharingText}>Sharing location</Text>
                  </View>
                ) : (
                  <View style={styles.offlineBadge}>
                    <Text style={styles.offlineText}>Offline</Text>
                  </View>
                )}
              </View>
            </View>

            {/* GPS Accuracy & Time info */}
            {selectedPoint && (
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Clock size={13} color="#15803D" />
                  <Text style={styles.metaText}>
                    {new Date(selectedPoint.recorded_at).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Radio size={13} color="#15803D" />
                  <Text style={styles.metaText}>
                    GPS accuracy: {Math.round(selectedPoint.accuracy_meters || 15)} m
                  </Text>
                </View>
              </View>
            )}

            {/* SVG Interactive Map Container */}
            <View style={styles.mapSvgContainer}>
              <Svg width={MAP_WIDTH} height={MAP_HEIGHT}>
                <Defs>
                  <LinearGradient id="routeGradient" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0%" stopColor="#EA580C" stopOpacity="0.9" />
                    <Stop offset="100%" stopColor="#DC2626" stopOpacity="0.9" />
                  </LinearGradient>
                </Defs>

                {/* Grid Lines simulating city streets */}
                <Line x1="0" y1="70" x2={MAP_WIDTH} y2="70" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4,4" />
                <Line x1="0" y1="140" x2={MAP_WIDTH} y2="140" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4,4" />
                <Line x1="0" y1="210" x2={MAP_WIDTH} y2="210" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4,4" />
                <Line x1={MAP_WIDTH * 0.3} y1="0" x2={MAP_WIDTH * 0.3} y2={MAP_HEIGHT} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4,4" />
                <Line x1={MAP_WIDTH * 0.7} y1="0" x2={MAP_WIDTH * 0.7} y2={MAP_HEIGHT} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4,4" />

                {/* Route Polyline */}
                {svgPathData ? (
                  <>
                    <Path
                      d={svgPathData}
                      fill="none"
                      stroke="#FDBA74"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.6}
                    />
                    <Path
                      d={svgPathData}
                      fill="none"
                      stroke="#EA580C"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                ) : null}

                {/* GPS Waypoints */}
                {gpsPoints.map((p, idx) => {
                  const { x, y } = project(p.latitude!, p.longitude!);
                  const isStart = idx === 0;
                  const isEnd = idx === gpsPoints.length - 1;
                  const isSelected = idx === selectedPointIndex;

                  let color = '#EA580C';
                  if (isStart) color = '#F59E0B';
                  if (isEnd) color = '#DC2626';

                  return (
                    <G key={p.id || idx}>
                      {isSelected && (
                        <Circle
                          cx={x}
                          cy={y}
                          r="16"
                          fill="#3B82F6"
                          opacity={0.25}
                        />
                      )}
                      <Circle
                        cx={x}
                        cy={y}
                        r={isSelected ? '9' : isStart || isEnd ? '7' : '4.5'}
                        fill={isSelected ? '#2563EB' : color}
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />
                    </G>
                  );
                })}
              </Svg>

              {/* Floating Action Controls on Map */}
              <View style={styles.floatingMapControls}>
                <TouchableOpacity
                  style={styles.floatingBtn}
                  onPress={() => {
                    setSelectedPointIndex(gpsPoints.length - 1);
                    setFitMode('selected');
                  }}
                  activeOpacity={0.8}
                >
                  <LocateFixed size={14} color="#0F172A" />
                  <Text style={styles.floatingBtnText}>Recenter</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.floatingBtn}
                  onPress={() => setFitMode('all')}
                  activeOpacity={0.8}
                >
                  <Route size={14} color="#0F172A" />
                  <Text style={styles.floatingBtnText}>Fit route</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Map Legend */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.legendText}>Start</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
                <Text style={styles.legendText}>End</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#2563EB' }]} />
                <Text style={styles.legendText}>Selected point</Text>
              </View>
            </View>

            {/* Route Stats & Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Route size={14} color="#EA580C" />
                  <Text style={styles.pointCountText}>
                    {gpsPoints.length} recorded GPS points connected
                  </Text>
                </View>
                <Text style={styles.stepIndexText}>
                  {gpsPoints.length > 0 ? `${selectedPointIndex + 1}/${gpsPoints.length}` : '0/0'}
                </Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${
                        gpsPoints.length > 1
                          ? ((selectedPointIndex + 1) / gpsPoints.length) * 100
                          : 100
                      }%`,
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* TIMELINE SECTION */}
          <View style={styles.timelineSection}>
            <View style={styles.timelineHeader}>
              <View>
                <Text style={styles.timelineTitle}>Location Timeline</Text>
                <Text style={styles.timelineEmployee}>
                  {employeeName} • {gpsPoints.length} records
                </Text>
              </View>

              {/* PLAY ROUTE BUTTON */}
              <TouchableOpacity
                style={[styles.playRouteBtn, isPlaying && styles.playRouteBtnActive]}
                onPress={togglePlay}
                activeOpacity={0.8}
              >
                {isPlaying ? (
                  <>
                    <Pause size={14} color="#FFFFFF" />
                    <Text style={styles.playRouteText}>Pause</Text>
                  </>
                ) : (
                  <>
                    <Play size={14} color="#FFFFFF" />
                    <Text style={styles.playRouteText}>Play route</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* TIMELINE ITEMS (Descending) */}
            {[...gpsPoints].reverse().map((point, revIdx) => {
              const origIdx = gpsPoints.length - 1 - revIdx;
              const isSelected = origIdx === selectedPointIndex;

              return (
                <TouchableOpacity
                  key={point.id || origIdx}
                  style={[styles.timelineCard, isSelected && styles.timelineCardSelected]}
                  onPress={() => setSelectedPointIndex(origIdx)}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.pointTypeRow}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: isSelected ? '#2563EB' : '#EA580C' },
                        ]}
                      />
                      <Text
                        style={[
                          styles.pointTypeTitle,
                          isSelected && { color: '#1D4ED8' },
                        ]}
                      >
                        GPS Location
                      </Text>
                    </View>
                    <View style={styles.timeBadge}>
                      <Clock size={11} color="#64748B" />
                      <Text style={styles.timeText}>
                        {new Date(point.recorded_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.addressText} numberOfLines={3}>
                    {point.location_name ||
                      `${branchName || 'Office'}, Coords: ${point.latitude?.toFixed(4)}, ${point.longitude?.toFixed(4)}`}
                  </Text>

                  <View style={styles.coordsFooter}>
                    <View style={styles.coordsLeft}>
                      <MapPin size={12} color="#64748B" />
                      <Text style={styles.coordsText}>
                        {point.latitude?.toFixed(6)}, {point.longitude?.toFixed(6)}
                      </Text>
                    </View>
                    <Text style={styles.accuracyText}>
                      GPS accuracy {Math.round(point.accuracy_meters || 16)} m
                    </Text>
                  </View>

                  {isSelected && (
                    <TouchableOpacity
                      style={styles.openMapsBtn}
                      onPress={() =>
                        openInGoogleMaps(point.latitude!, point.longitude!, employeeName)
                      }
                      activeOpacity={0.8}
                    >
                      <Navigation size={13} color="#003882" />
                      <Text style={styles.openMapsBtnText}>Open in Google Maps</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontFamily: 'Comfortaa_500Medium',
  },
  errorBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0F172A',
    marginTop: 12,
  },
  errorDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#E56108',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_700Bold',
    fontSize: 13,
  },
  mapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    marginBottom: 20,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mapTitle: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0F172A',
  },
  mapSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sharingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  sharingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  sharingText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: '#059669',
  },
  offlineBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  offlineText: {
    fontSize: 11,
    color: '#64748B',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#15803D',
    fontFamily: 'Comfortaa_600SemiBold',
  },
  mapSvgContainer: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
  },
  floatingMapControls: {
    position: 'absolute',
    top: 10,
    right: 10,
    gap: 6,
  },
  floatingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    elevation: 2,
  },
  floatingBtnText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0F172A',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 10,
    paddingVertical: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#475569',
  },
  progressContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pointCountText: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'Comfortaa_500Medium',
  },
  stepIndexText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
    color: '#EA580C',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#EA580C',
    borderRadius: 3,
  },
  timelineSection: {
    marginTop: 4,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timelineTitle: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0F172A',
  },
  timelineEmployee: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  playRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EA580C',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  playRouteBtnActive: {
    backgroundColor: '#DC2626',
  },
  playRouteText: {
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_700Bold',
    fontSize: 12,
  },
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timelineCardSelected: {
    backgroundColor: '#F0F7FF',
    borderColor: '#93C5FD',
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pointTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pointTypeTitle: {
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0F172A',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: '#64748B',
  },
  addressText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 8,
  },
  coordsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  coordsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coordsText: {
    fontSize: 11,
    color: '#64748B',
  },
  accuracyText: {
    fontSize: 11,
    color: '#64748B',
  },
  openMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#E0E7FF',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  openMapsBtnText: {
    color: '#003882',
    fontFamily: 'Comfortaa_700Bold',
    fontSize: 12,
  },
});
