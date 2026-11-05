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
  Bell,
  Calendar,
  Clock,
  ArrowRight,
  X,
  AlertCircle,
  Building2,
  ShieldAlert,
  ListTodo,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

export interface MobilePendingActionItem {
  id: string;
  type: 'LEAVE' | 'PERMISSION' | 'WFH' | 'ATTENDANCE_PUNCH' | 'TASK';
  badge: string;
  employee_name: string;
  employee_id?: string;
  title: string;
  detail: string;
  created_at?: string | null;
  action_url: string;
}

export interface MobilePendingActionsSummary {
  pending_leaves?: number;
  pending_permissions?: number;
  pending_wfh?: number;
  pending_punches?: number;
  pending_tasks?: number;
}

interface MobileRolePendingActionsModalProps {
  visible: boolean;
  role: string;
  totalCount: number;
  summary: MobilePendingActionsSummary;
  items: MobilePendingActionItem[];
  onClose: () => void;
  onNavigateAction: (item: MobilePendingActionItem) => void;
}

export const MobileRolePendingActionsModal: React.FC<MobileRolePendingActionsModalProps> = ({
  visible,
  role,
  totalCount,
  summary,
  items,
  onClose,
  onNavigateAction,
}) => {
  if (!visible || totalCount === 0) return null;

  const getRoleTitle = () => {
    switch (role) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return 'Admin Pending Approvals';
      case 'HR':
        return 'HR Approvals Reminder';
      case 'REPORTING_MANAGER':
        return 'Manager Team Approvals';
      default:
        return 'Pending Approvals';
    }
  };

  const getRoleSub = () => {
    if (role === 'HR') {
      return 'Employees are waiting for your approval. Hourly reminder.';
    }
    if (role === 'REPORTING_MANAGER') {
      return 'Team attendance punches, requests, and tasks need your review.';
    }
    return 'Pending requests & items requiring your review across the company.';
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'LEAVE':
        return <Calendar size={14} color="#ea580c" />;
      case 'PERMISSION':
        return <Clock size={14} color="#2563eb" />;
      case 'WFH':
        return <Building2 size={14} color="#7c3aed" />;
      case 'ATTENDANCE_PUNCH':
        return <ShieldAlert size={14} color="#dc2626" />;
      default:
        return <ListTodo size={14} color="#059669" />;
    }
  };

  const getItemBadgeStyle = (type: string) => {
    switch (type) {
      case 'LEAVE':
        return { bg: '#fff7ed', text: '#c2410c' };
      case 'PERMISSION':
        return { bg: '#eff6ff', text: '#1d4ed8' };
      case 'WFH':
        return { bg: '#f5f3ff', text: '#6d28d9' };
      case 'ATTENDANCE_PUNCH':
        return { bg: '#fef2f2', text: '#b91c1c' };
      default:
        return { bg: '#ecfdf5', text: '#047857' };
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
          {/* Grabber */}
          <View style={styles.grabber} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Bell size={20} color="#ea580c" />
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={styles.badgeRow}>
                  <Text style={styles.eyebrow}>
                    {role === 'HR' ? 'HOURLY REMINDER' : 'ACTION REQUIRED'}
                  </Text>
                  <View style={styles.countPill}>
                    <Text style={styles.countPillText}>{totalCount} PENDING</Text>
                  </View>
                </View>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {getRoleTitle()}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>{getRoleSub()}</Text>

          {/* Summary Badges */}
          <View style={styles.statsRow}>
            {(summary.pending_leaves || 0) > 0 && (
              <View style={[styles.statBadge, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
                <Text style={[styles.statVal, { color: '#c2410c' }]}>{summary.pending_leaves}</Text>
                <Text style={[styles.statLbl, { color: '#9a3412' }]}>Leaves</Text>
              </View>
            )}
            {(summary.pending_permissions || 0) > 0 && (
              <View style={[styles.statBadge, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                <Text style={[styles.statVal, { color: '#1d4ed8' }]}>{summary.pending_permissions}</Text>
                <Text style={[styles.statLbl, { color: '#1e40af' }]}>Perms</Text>
              </View>
            )}
            {(summary.pending_wfh || 0) > 0 && (
              <View style={[styles.statBadge, { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' }]}>
                <Text style={[styles.statVal, { color: '#6d28d9' }]}>{summary.pending_wfh}</Text>
                <Text style={[styles.statLbl, { color: '#5b21b6' }]}>WFH</Text>
              </View>
            )}
            {(summary.pending_punches || 0) > 0 && (
              <View style={[styles.statBadge, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                <Text style={[styles.statVal, { color: '#b91c1c' }]}>{summary.pending_punches}</Text>
                <Text style={[styles.statLbl, { color: '#991b1b' }]}>Punches</Text>
              </View>
            )}
            {(summary.pending_tasks || 0) > 0 && (
              <View style={[styles.statBadge, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                <Text style={[styles.statVal, { color: '#047857' }]}>{summary.pending_tasks}</Text>
                <Text style={[styles.statLbl, { color: '#065f46' }]}>Tasks</Text>
              </View>
            )}
          </View>

          {/* List of Pending Items */}
          <ScrollView
            style={styles.itemsList}
            contentContainerStyle={styles.itemsContent}
            showsVerticalScrollIndicator={false}
          >
            {items.slice(0, 15).map((item) => {
              const badgeStyle = getItemBadgeStyle(item.type);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.itemCard}
                  activeOpacity={0.7}
                  onPress={() => onNavigateAction(item)}
                >
                  <View style={styles.itemHeader}>
                    <View style={styles.typeRow}>
                      {getItemIcon(item.type)}
                      <View style={[styles.itemTypeBadge, { backgroundColor: badgeStyle.bg }]}>
                        <Text style={[styles.itemTypeBadgeText, { color: badgeStyle.text }]}>
                          {item.badge}
                        </Text>
                      </View>
                    </View>
                    <ArrowRight size={14} color="#94a3b8" />
                  </View>

                  <Text style={styles.itemEmployee}>
                    {item.employee_name}
                    {item.employee_id ? ` • ${item.employee_id}` : ''}
                  </Text>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  {item.detail ? (
                    <Text style={styles.itemDetail} numberOfLines={2}>
                      {item.detail}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}

            {items.length > 15 && (
              <Text style={styles.moreNote}>
                + {items.length - 15} more pending items waiting in portal
              </Text>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.8}
              onPress={() => {
                if (items.length > 0) {
                  onNavigateAction(items[0]);
                } else {
                  onClose();
                }
              }}
            >
              <Text style={styles.actionBtnText}>Review Approvals Now</Text>
              <ArrowRight size={16} color="#ffffff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dismissBtn}
              activeOpacity={0.7}
              onPress={onClose}
            >
              <Text style={styles.dismissBtnText}>Remind Me Later (1 Hour)</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 10,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#ea580c',
    fontFamily: 'Comfortaa_700Bold',
  },
  countPill: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 9999,
  },
  countPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#b91c1c',
    fontFamily: 'Comfortaa_700Bold',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    fontFamily: 'Comfortaa_700Bold',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 10,
    lineHeight: 16,
    fontFamily: 'Comfortaa_500Medium',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  statBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statVal: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Comfortaa_700Bold',
  },
  statLbl: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'Comfortaa_500Medium',
  },
  itemsList: {
    maxHeight: 280,
  },
  itemsContent: {
    gap: 8,
    paddingBottom: 4,
  },
  itemCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  itemTypeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'Comfortaa_700Bold',
    textTransform: 'uppercase',
  },
  itemEmployee: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    fontFamily: 'Comfortaa_700Bold',
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    fontFamily: 'Comfortaa_500Medium',
    marginBottom: 2,
  },
  itemDetail: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'Comfortaa_500Medium',
    lineHeight: 15,
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
  actionBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 8,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnText: {
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

export default MobileRolePendingActionsModal;
