import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Search, Check, X, Users, ChevronDown, Building2 } from 'lucide-react-native';
import { AssignedEmployee } from '../../services/taskService';

interface MobileEmployeeMultiSelectProps {
  members: AssignedEmployee[];
  selectedIds: number[];
  onChange: (newIds: number[]) => void;
  disabled?: boolean;
  label?: string;
}

export const MobileEmployeeMultiSelect: React.FC<MobileEmployeeMultiSelectProps> = ({
  members,
  selectedIds,
  onChange,
  disabled = false,
  label = 'Assign Employees',
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL');

  // Extract distinct companies
  const companyOptions = useMemo(() => {
    const names = Array.from(new Set(members.map((m) => m.company_name).filter(Boolean))) as string[];
    return names;
  }, [members]);

  const selectedMembers = members.filter((m) => selectedIds.includes(m.id));

  const filteredMembers = members.filter((m) => {
    if (selectedCompany !== 'ALL' && m.company_name !== selectedCompany) {
      return false;
    }
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      m.full_name?.toLowerCase().includes(term) ||
      m.employee_id?.toLowerCase().includes(term) ||
      m.designation?.toLowerCase().includes(term) ||
      m.department?.toLowerCase().includes(term) ||
      m.company_name?.toLowerCase().includes(term) ||
      m.branch_name?.toLowerCase().includes(term)
    );
  });

  const toggleMember = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const removeMember = (id: number) => {
    onChange(selectedIds.filter((item) => item !== id));
  };

  const renderAvatar = (m: AssignedEmployee, size = 26) => {
    if (m.profile_photo_url) {
      return (
        <Image
          source={{ uri: m.profile_photo_url }}
          style={[styles.avatarImg, { width: size, height: size, borderRadius: size / 2 }]}
        />
      );
    }
    const initials = m.full_name
      ? m.full_name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
      : 'U';
    return (
      <View
        style={[
          styles.avatarInitials,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <Text style={[styles.avatarInitialsText, { fontSize: Math.max(9, size * 0.38) }]}>
          {initials}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label} <Text style={styles.required}>*</Text>
      </Text>

      {/* TRIGGER BAR */}
      <TouchableOpacity
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={() => !disabled && setModalVisible(true)}
        activeOpacity={0.7}
      >
        {selectedMembers.length === 0 ? (
          <Text style={styles.placeholder}>Select employees...</Text>
        ) : (
          <View style={styles.summaryRow}>
            {/* AVATAR STACK */}
            <View style={styles.avatarStack}>
              {selectedMembers.slice(0, 4).map((m, idx) => (
                <View
                  key={m.id}
                  style={[styles.stackedAvatarWrap, { marginLeft: idx === 0 ? 0 : -8 }]}
                >
                  {renderAvatar(m, 26)}
                </View>
              ))}
              {selectedMembers.length > 4 && (
                <View style={[styles.moreBadge, { marginLeft: -8 }]}>
                  <Text style={styles.moreBadgeText}>+{selectedMembers.length - 4}</Text>
                </View>
              )}
            </View>

            <Text style={styles.summaryText}>
              {selectedMembers.length} {selectedMembers.length === 1 ? 'employee' : 'employees'} selected
            </Text>
          </View>
        )}

        <ChevronDown size={18} color="#666666" />
      </TouchableOpacity>

      {/* SELECTED PILLS */}
      {selectedMembers.length > 0 && (
        <View style={styles.pillsRow}>
          {selectedMembers.map((m) => (
            <View key={m.id} style={styles.pill}>
              {renderAvatar(m, 20)}
              <Text style={styles.pillText} numberOfLines={1}>
                {m.full_name}
              </Text>
              {!disabled && (
                <TouchableOpacity
                  onPress={() => removeMember(m.id)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <X size={12} color="#666666" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* SELECTION MODAL */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
        statusBarTranslucent
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* MODAL HEADER */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Assign Employees</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedIds.length} selected
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setModalVisible(false)}
              >
                <X size={20} color="#000000" />
              </TouchableOpacity>
            </View>

            {/* SEARCH BAR */}
            <View style={styles.searchRow}>
              <Search size={16} color="#888888" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, ID, designation..."
                placeholderTextColor="#888888"
                value={searchTerm}
                onChangeText={setSearchTerm}
              />
            </View>

            {/* COMPANY FILTER CHIPS (Visible when multiple companies available) */}
            {companyOptions.length > 1 && (
              <View style={styles.companyFilterWrapper}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.companyScrollContent}
                >
                  <TouchableOpacity
                    style={[
                      styles.companyChip,
                      selectedCompany === 'ALL' && styles.companyChipActive,
                    ]}
                    onPress={() => setSelectedCompany('ALL')}
                    activeOpacity={0.7}
                  >
                    <Building2
                      size={12}
                      color={selectedCompany === 'ALL' ? '#FFFFFF' : '#64748B'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.companyChipText,
                        selectedCompany === 'ALL' && styles.companyChipTextActive,
                      ]}
                    >
                      All ({members.length})
                    </Text>
                  </TouchableOpacity>

                  {companyOptions.map((cName) => {
                    const count = members.filter((m) => m.company_name === cName).length;
                    const isSelected = selectedCompany === cName;
                    return (
                      <TouchableOpacity
                        key={cName}
                        style={[
                          styles.companyChip,
                          isSelected && styles.companyChipActive,
                        ]}
                        onPress={() => setSelectedCompany(cName)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.companyChipText,
                            isSelected && styles.companyChipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {cName} ({count})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* EMPLOYEES LIST */}
            <FlatList
              data={filteredMembers}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.memberItem, isSelected && styles.memberItemSelected]}
                    onPress={() => toggleMember(item.id)}
                    activeOpacity={0.7}
                  >
                    {renderAvatar(item, 36)}
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{item.full_name}</Text>
                      <Text style={styles.memberMeta}>
                        {item.company_name ? `${item.company_name} • ` : ''}
                        {item.employee_id ? `${item.employee_id} • ` : ''}
                        {item.designation || item.department || 'Employee'}
                      </Text>
                    </View>
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Users size={32} color="#CCCCCC" />
                  <Text style={styles.emptyText}>No matching employees</Text>
                </View>
              }
            />

            {/* MODAL FOOTER */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.doneBtnText}>
                  Done ({selectedIds.length} Selected)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  required: {
    color: '#E11D48',
  },
  trigger: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerDisabled: {
    backgroundColor: '#F8F8F8',
    opacity: 0.7,
  },
  placeholder: {
    fontSize: 14,
    color: '#888888',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackedAvatarWrap: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 13,
  },
  moreBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Comfortaa_700Bold',
  },
  summaryText: {
    fontSize: 13.5,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#000000',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 16,
    paddingVertical: 3,
    paddingHorizontal: 8,
    gap: 6,
  },
  pillText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#222222',
    maxWidth: 130,
  },
  avatarImg: {
    resizeMode: 'cover',
  },
  avatarInitials: {
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialsText: {
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_700Bold',
  },

  /* MODAL */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '82%',
    minHeight: '50%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 10,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    paddingVertical: 0,
  },
  companyFilterWrapper: {
    marginBottom: 10,
  },
  companyScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  companyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  companyChipActive: {
    backgroundColor: '#E56108',
    borderColor: '#E56108',
  },
  companyChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  companyChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 4,
  },
  memberItemSelected: {
    backgroundColor: '#F5F5F5',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 14,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#000000',
  },
  memberMeta: {
    fontSize: 12,
    color: '#777777',
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyText: {
    fontSize: 13,
    color: '#888888',
    marginTop: 8,
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  doneBtn: {
    height: 48,
    backgroundColor: '#000000',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
  },
});

