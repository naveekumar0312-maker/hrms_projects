import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Path,
  Circle,
  G,
} from 'react-native-svg';
import {
  Play,
  Pause,
  LocateFixed,
  Route,
  MapPin,
  Clock,
  Radio,
  AlertCircle,
} from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { AdminHRHeader } from '../../components/AdminHRHeader';
import { fetchTrackingHistory, TrackingHistoryItem } from '../../services/adminHRService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_WIDTH = SCREEN_WIDTH - 32;
const MAP_HEIGHT = 280;

// Coordinate transformation math for Web Mercator (EPSG:3857) tiles
function deg2num(lat_deg: number, lon_deg: number, zoom: number) {
  const lat_rad = (lat_deg * Math.PI) / 180.0;
  const n = Math.pow(2.0, zoom);
  const xtile = ((lon_deg + 180.0) / 360.0) * n;
  const ytile = ((1.0 - Math.asinh(Math.tan(lat_rad)) / Math.PI) / 2.0) * n;
  return { x: xtile, y: ytile };
}

export const AdminEmployeeRouteMapScreen = ({ route, navigation }: any) => {
  const { user } = React.useContext(AuthContext);
  const { employeeId, employeeName, employeeCode, branchName, isSharing } = route.params || {};

  const [history, setHistory] = useState<TrackingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPointIndex, setSelectedPointIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(15);

  const playTimerRef = useRef<any>(null);

  const loadHistoryData = async () => {
    if (!employeeId) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchTrackingHistory(Number(employeeId), 200);
      const sorted = [...data].sort(
        (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
      );
      setHistory(sorted);
      if (sorted.length > 0) {
        setSelectedPointIndex(sorted.length - 1);
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

  // Selected or latest point for centering map
  const activePoint = gpsPoints[selectedPointIndex] || gpsPoints[gpsPoints.length - 1] || null;

  // Calculate Map Center & Tile Coordinates
  const tileInfo = useMemo(() => {
    if (!activePoint || !activePoint.latitude || !activePoint.longitude) {
      return null;
    }
    const centerTile = deg2num(activePoint.latitude, activePoint.longitude, zoomLevel);
    const tileX = Math.floor(centerTile.x);
    const tileY = Math.floor(centerTile.y);
    const pixelOffsetX = (centerTile.x - tileX) * 256;
    const pixelOffsetY = (centerTile.y - tileY) * 256;

    // Build 3x3 grid around center tile to smoothly cover the MAP container
    const tiles = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const curX = tileX + dx;
        const curY = tileY + dy;
        const left = (dx + 1) * 256 - pixelOffsetX - (256 * 1.5 - MAP_WIDTH / 2);
        const top = (dy + 1) * 256 - pixelOffsetY - (256 * 1.5 - MAP_HEIGHT / 2);

        tiles.push({
          key: `${zoomLevel}/${curY}/${curX}`,
          imageryUrl: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoomLevel}/${curY}/${curX}`,
          labelsUrl: `https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/${zoomLevel}/${curY}/${curX}`,
          left,
          top,
        });
      }
    }

    return { centerTile, tileX, tileY, pixelOffsetX, pixelOffsetY, tiles };
  }, [activePoint, zoomLevel]);

  // Project any lat/lng into the container's X/Y pixels based on active center
  const projectToPixels = (lat: number, lng: number) => {
    if (!activePoint) return { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
    const pTile = deg2num(lat, lng, zoomLevel);
    const cTile = deg2num(activePoint.latitude!, activePoint.longitude!, zoomLevel);
    const x = MAP_WIDTH / 2 + (pTile.x - cTile.x) * 256;
    const y = MAP_HEIGHT / 2 + (pTile.y - cTile.y) * 256;
    return { x, y };
  };

  // SVG Polyline Path overlayed precisely on top of satellite map
  const svgPathData = useMemo(() => {
    if (gpsPoints.length < 2 || !activePoint) return '';
    return gpsPoints.reduce((acc, p, idx) => {
      const { x, y } = projectToPixels(p.latitude!, p.longitude!);
      return `${acc} ${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');
  }, [gpsPoints, activePoint, zoomLevel]);

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
                    GPS accuracy: {Math.round(selectedPoint.accuracy_meters || 16)} m
                  </Text>
                </View>
              </View>
            )}

            {/* REAL SATELLITE TILE MAP CONTAINER (ESRI ArcGIS World Imagery & Street Labels) */}
            <View style={styles.mapContainer}>
              {/* 1. Satellite Base Tiles */}
              {tileInfo?.tiles.map((t) => (
                <Image
                  key={`img-${t.key}`}
                  source={{ uri: t.imageryUrl }}
                  style={[styles.tileImage, { left: t.left, top: t.top }]}
                  resizeMode="cover"
                />
              ))}

              {/* 2. Road Network & Labels Overlay */}
              {tileInfo?.tiles.map((t) => (
                <Image
                  key={`lbl-${t.key}`}
                  source={{ uri: t.labelsUrl }}
                  style={[styles.tileImage, { left: t.left, top: t.top }]}
                  resizeMode="cover"
                />
              ))}

              {/* 3. SVG Route & Waypoints Overlay */}
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Svg width={MAP_WIDTH} height={MAP_HEIGHT}>
                  {svgPathData ? (
                    <>
                      <Path
                        d={svgPathData}
                        fill="none"
                        stroke="#FED7AA"
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.7}
                      />
                      <Path
                        d={svgPathData}
                        fill="none"
                        stroke="#EA580C"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </>
                  ) : null}

                  {/* Waypoints */}
                  {gpsPoints.map((p, idx) => {
                    const { x, y } = projectToPixels(p.latitude!, p.longitude!);
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
                            r="18"
                            fill="#3B82F6"
                            opacity={0.35}
                          />
                        )}
                        <Circle
                          cx={x}
                          cy={y}
                          r={isSelected ? '9' : isStart || isEnd ? '7' : '4.5'}
                          fill={isSelected ? '#2563EB' : color}
                          stroke="#FFFFFF"
                          strokeWidth="2.5"
                        />
                      </G>
                    );
                  })}
                </Svg>
              </View>

              {/* Floating Zoom & Center Controls */}
              <View style={styles.floatingMapControls}>
                <TouchableOpacity
                  style={styles.floatingBtn}
                  onPress={() => setSelectedPointIndex(gpsPoints.length - 1)}
                  activeOpacity={0.8}
                >
                  <LocateFixed size={14} color="#0F172A" />
                  <Text style={styles.floatingBtnText}>Recenter</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.floatingBtn}
                  onPress={() => setZoomLevel((z) => Math.max(12, z - 1))}
                  activeOpacity={0.8}
                >
                  <Text style={styles.floatingBtnText}>-</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.floatingBtn}
                  onPress={() => setZoomLevel((z) => Math.min(18, z + 1))}
                  activeOpacity={0.8}
                >
                  <Text style={styles.floatingBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              {/* ESRI Attribution Badge */}
              <View style={styles.esriBadge}>
                <Text style={styles.esriText}>Esri World Imagery</Text>
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
  mapContainer: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    position: 'relative',
    overflow: 'hidden',
  },
  tileImage: {
    position: 'absolute',
    width: 256,
    height: 256,
  },
  floatingMapControls: {
    position: 'absolute',
    top: 10,
    right: 10,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  floatingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    elevation: 2,
  },
  floatingBtnText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
    color: '#0F172A',
  },
  esriBadge: {
    position: 'absolute',
    bottom: 4,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  esriText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_400Regular',
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
});
