import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import {
  ListTodo,
  Calendar,
  ArrowRight,
  X,
  AlertCircle,
  Clock,
} from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { MobileTask } from '../services/taskService';

const { width } = Dimensions.get('window');

interface MobileTaskDailyReminderModalProps {
  visible: boolean;
  tasks: MobileTask[];
  onClose: () => void;
  onViewAllTasks: () => void;
}

export const MobileTaskDailyReminderModal: React.FC<MobileTaskDailyReminderModalProps> = ({
  visible,
  tasks,
  onClose,
  onViewAllTasks,
}) => {
  if (!visible || tasks.length === 0) return null;

  const overdueCount = tasks.filter((t) => t.is_overdue).length;
  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const pendingCount = tasks.filter((t) => t.status === 'PENDING').length;

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return { bg: '#fee2e2', text: '#dc2626' };
      case 'HIGH':
        return { bg: '#fef3c7', text: '#d97706' };
      case 'MEDIUM':
        return { bg: '#e0f2fe', text: '#e56108' };
      default:
        return { bg: '#f1f5f9', text: '#64748b' };
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Top Grabber */}
          <View style={styles.grabber} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <ListTodo size={20} color="#2563eb" />
              </View>
              <View>
                <Text style={styles.eyebrow}>DAILY REMINDER</Text>
                <Text style={styles.headerTitle}>Today's Assigned Tasks</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Mini Stats Banner */}
          <View style={styles.statsBanner}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{tasks.length}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            {overdueCount > 0 && (
              <View style={[styles.statBox, styles.statBoxOverdue]}>
                <Text style={[styles.statNum, { color: '#dc2626' }]}>{overdueCount}</Text>
                <Text style={[styles.statLabel, { color: '#b91c1c' }]}>Overdue</Text>
              </View>
            )}
            {inProgressCount > 0 && (
              <View style={[styles.statBox, styles.statBoxProgress]}>
                <Text style={[styles.statNum, { color: '#2563eb' }]}>{inProgressCount}</Text>
                <Text style={[styles.statLabel, { color: '#1d4ed8' }]}>In Progress</Text>
              </View>
            )}
            {pendingCount > 0 && (
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{pendingCount}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            )}
          </View>

          {/* Task List */}
          <ScrollView style={styles.taskList} showsVerticalScrollIndicator={false}>
            {tasks.slice(0, 6).map((item) => {
              const priorityStyle = getPriorityStyle(item.priority);
              return (
                <View
                  key={item.id}
                  style={[
                    styles.taskCard,
                    item.is_overdue && styles.taskCardOverdue,
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View
                      style={[
                        styles.priorityBadge,
                        { backgroundColor: priorityStyle.bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.priorityBadgeText,
                          { color: priorityStyle.text },
                        ]}
                      >
                        {item.priority}
                      </Text>
                    </View>
                    {item.category ? (
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{item.category}</Text>
                      </View>
                    ) : null}
                    {item.is_overdue && (
                      <View style={styles.overdueBadge}>
                        <AlertCircle size={10} color="#dc2626" />
                        <Text style={styles.overdueBadgeText}>Overdue</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>

                  <View style={styles.cardFooter}>
                    <View style={styles.dueRow}>
                      <Calendar size={12} color="#64748b" />
                      <Text style={styles.dueText}>
                        {item.due_date || 'No due date'}
                      </Text>
                    </View>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>
                        {item.status.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {tasks.length > 6 && (
              <Text style={styles.moreNote}>
                +{tasks.length - 6} more tasks in your workspace
              </Text>
            )}
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.viewTasksBtn}
              onPress={onViewAllTasks}
              activeOpacity={0.8}
            >
              <Text style={styles.viewTasksBtnText}>Open My Tasks</Text>
              <ArrowRight size={16} color="#ffffff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.dismissBtnText}>Dismiss for Today</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 8,
    maxHeight: '80%',
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'Comfortaa_700Bold',
    letterSpacing: 0.5,
    color: '#2563eb',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Comfortaa_700Bold',
    color: '#0f172a',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsBanner: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 6,
    alignItems: 'center',
  },
  statBoxOverdue: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  statBoxProgress: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  statNum: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Comfortaa_700Bold',
    color: '#0f172a',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    fontFamily: 'Comfortaa_500Medium',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  taskList: {
    maxHeight: 280,
  },
  taskCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  taskCardOverdue: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'Comfortaa_700Bold',
  },
  categoryBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    fontFamily: 'Comfortaa_500Medium',
    color: '#475569',
  },
  overdueBadge: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  overdueBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'Comfortaa_700Bold',
    color: '#dc2626',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#1e293b',
    marginBottom: 8,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    paddingTop: 6,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dueText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    fontFamily: 'Comfortaa_500Medium',
  },
  statusPill: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'Comfortaa_700Bold',
    color: '#2563eb',
    textTransform: 'uppercase',
  },
  moreNote: {
    textAlign: 'center',
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'Comfortaa_500Medium',
    paddingVertical: 6,
  },
  footerActions: {
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  viewTasksBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  viewTasksBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Comfortaa_700Bold',
  },
  dismissBtn: {
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  dismissBtnText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Comfortaa_500Medium',
  },
});

export default MobileTaskDailyReminderModal;

