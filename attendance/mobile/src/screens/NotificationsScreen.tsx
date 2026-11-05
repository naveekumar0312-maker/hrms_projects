import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Bell, CheckCheck, ArrowLeft, Clock } from 'lucide-react-native';
import { api } from '../context/AuthContext';
import { useAppMessage } from '../context/MessageContext';
import { COLORS } from '../constants/theme';
import { colors } from '../theme/colors';

interface NotificationItem {
  id: number;
  event: string;
  employee_name: string;
  employee_id: string;
  title: string;
  message: string;
  is_read: boolean;
  shift_date: string;
  created_at: string;
}

export default function NotificationsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { showSuccess, showError, showConfirm } = useAppMessage();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);

      const response = await api.get('/notifications/?limit=50');
      setNotifications(response.data?.results ?? []);
      setUnreadCount(Number(response.data?.unread_count ?? 0));
    } catch (error: any) {
      console.warn(
        '[NOTIFICATIONS] Fetch failed:',
        error?.response?.status ?? error?.message,
      );
      showError('Notifications', error?.response?.data?.detail || 'Unable to load notifications. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications(true);

      const interval = setInterval(() => {
        fetchNotifications(false);
      }, 10000);

      return () => clearInterval(interval);
    }, [fetchNotifications]),
  );

  const markAsRead = async (item: NotificationItem) => {
    if (item.is_read || updatingId !== null) return;

    setUpdatingId(item.id);

    try {
      await api.patch(`/notifications/${item.id}/read/`);

      setNotifications(current =>
        current.map(notification =>
          notification.id === item.id
            ? { ...notification, is_read: true }
            : notification,
        ),
      );

      setUnreadCount(count => Math.max(0, count - 1));
    } catch (error: any) {
      showError('Notifications', error?.response?.data?.detail || 'Unable to mark this notification as read.');
    } finally {
      setUpdatingId(null);
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0 || markingAll) return;

    setMarkingAll(true);

    try {
      await api.post('/notifications/read-all/');

      setNotifications(current =>
        current.map(item => ({ ...item, is_read: true })),
      );
      setUnreadCount(0);
    } catch (error: any) {
      showError('Notifications', error?.response?.data?.detail || 'Unable to mark notifications as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  const formatDate = (value: string) => {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString([], {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.is_read && styles.unreadCard]}
      activeOpacity={0.75}
      onPress={() => markAsRead(item)}
      disabled={updatingId !== null}
    >
      <View style={[styles.iconCircle, !item.is_read && styles.unreadIconCircle]}>
        <Bell size={19} color={item.is_read ? '#666666' : '#0757B8'} />
      </View>

      <View style={styles.notificationContent}>
        <View style={styles.titleRow}>
          <Text style={styles.notificationTitle}>{item.title || 'Notification'}</Text>
          {!item.is_read && <View style={styles.unreadDot} />}
        </View>

        <Text style={styles.notificationMessage}>{item.message}</Text>

        {!!item.employee_name && (
          <Text style={styles.employeeText}>{item.employee_name}</Text>
        )}

        <View style={styles.dateRow}>
          <Clock size={13} color="#666666" />
          <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
        </View>
      </View>

      {updatingId === item.id && (
        <ActivityIndicator size="small" color="#0757B8" />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" hidden={false} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 12, 30) }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>
            {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.markAllButton}
          onPress={markAllAsRead}
          disabled={unreadCount === 0 || markingAll}
          accessibilityLabel="Mark all as read"
        >
          {markingAll ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <CheckCheck
              size={23}
              color={unreadCount === 0 ? '#B9D0EA' : '#FFFFFF'}
            />
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#0757B8" />
          <Text style={styles.helperText}>Loading notifications...</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            notifications.length === 0 && styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchNotifications(false);
              }}
              colors={['#0757B8']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Bell size={30} color="#666666" />
              </View>
              <Text style={styles.emptyTitle}>You're all caught up</Text>
              <Text style={styles.emptyMessage}>
                New notifications will appear here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  header: {
    minHeight: 112,
    backgroundColor: '#0757B8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 30,
    paddingBottom: 18,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontFamily: 'Comfortaa_700Bold',
  },
  headerSubtitle: {
    color: '#E1EDFF',
    fontSize: 12,
    marginTop: 4,
  },
  markAllButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 30,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8EDF4',
  },
  unreadCard: {
    backgroundColor: '#F0F6FF',
    borderColor: '#C9DFFF',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  unreadIconCircle: {
    backgroundColor: '#DCEBFF',
  },
  notificationContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationTitle: {
    flex: 1,
    color: '#172033',
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0757B8',
    marginLeft: 8,
  },
  notificationMessage: {
    color: '#444444',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  employeeText: {
    color: '#222222',
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    marginTop: 7,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
  },
  dateText: {
    color: '#666666',
    fontSize: 11,
    marginLeft: 5,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    color: '#666666',
    marginTop: 12,
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#E8EEF7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#172033',
    fontSize: 17,
    fontFamily: 'Comfortaa_700Bold',
  },
  emptyMessage: {
    color: '#666666',
    fontSize: 13,
    marginTop: 7,
    textAlign: 'center',
  },
});
