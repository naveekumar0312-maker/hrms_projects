import { StatusBar } from 'expo-status-bar';
import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react-native';
import { AuthContext } from '../context/AuthContext';
import { COLORS } from '../constants/theme';

interface DetailRowProps {
  label: string;
  value: string | number | null | undefined;
  isLast?: boolean;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value, isLast = false }) => {
  const displayVal =
    value !== null && value !== undefined && String(value).trim() !== ''
      ? String(value)
      : '--';

  return (
    <View style={[styles.detailRow, isLast && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {displayVal}
      </Text>
    </View>
  );
};

interface SectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const ExpandableSection: React.FC<SectionProps> = ({
  title,
  isExpanded,
  onToggle,
  children,
}) => {
  return (
    <View style={styles.sectionContainer}>
      <TouchableOpacity
        style={[
          styles.sectionHeader,
          !isExpanded && styles.sectionHeaderCollapsed,
        ]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        {isExpanded ? (
          <ChevronUp size={20} color="#666666" strokeWidth={2.2} />
        ) : (
          <ChevronDown size={20} color="#666666" strokeWidth={2.2} />
        )}
      </TouchableOpacity>

      {isExpanded && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
};

export default function PersonalInfoScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { employee } = useContext(AuthContext);

  // Expandable sections states (Profile and Personal open by default)
  const [profileExpanded, setProfileExpanded] = useState(true);
  const [personalExpanded, setPersonalExpanded] = useState(true);
  const [employmentExpanded, setEmploymentExpanded] = useState(true);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" hidden={false} />

      {/* TOP APP BAR */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color="#000000" strokeWidth={2.2} />
        </TouchableOpacity>

        <Text style={styles.topBarTitle}>Personal Info</Text>

        <View style={styles.topBarRightPlaceholder} />
      </View>

      {/* MAIN CONTENT SCROLL */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 24, 40) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Profile Information Section */}
        <ExpandableSection
          title="Profile Information"
          isExpanded={profileExpanded}
          onToggle={() => setProfileExpanded(!profileExpanded)}
        >
          <DetailRow label="Name" value={employee?.full_name || employee?.name} />
          <DetailRow label="Employee ID" value={employee?.employee_id} />
          <DetailRow
            label="Contact Number"
            value={employee?.phone_number || employee?.phone}
            isLast
          />
        </ExpandableSection>

        {/* 2. Personal Information Section */}
        <ExpandableSection
          title="Personal Information"
          isExpanded={personalExpanded}
          onToggle={() => setPersonalExpanded(!personalExpanded)}
        >
          <DetailRow label="Email" value={employee?.email} />
          <DetailRow
            label="Gender"
            value={
              employee?.gender
                ? String(employee.gender).charAt(0).toUpperCase() +
                  String(employee.gender).slice(1).toLowerCase()
                : '--'
            }
          />
          <DetailRow label="Date of Birth" value={employee?.date_of_birth} />
          <DetailRow label="Marital Status" value={employee?.marital_status} />
          <DetailRow label="Blood Group" value={employee?.blood_group} />
          <DetailRow
            label="Emergency Contact"
            value={
              employee?.emergency_contact_number ||
              employee?.emergency_contact ||
              employee?.emergency_contact_name
            }
          />
          <DetailRow label="Father's Name" value={employee?.father_name} />
          <DetailRow label="Mother's Name" value={employee?.mother_name} />
          <DetailRow
            label="Spouse's Name"
            value={employee?.spouse_name}
            isLast
          />
        </ExpandableSection>

        {/* 3. Employment & Organization Section */}
        <ExpandableSection
          title="Employment Details"
          isExpanded={employmentExpanded}
          onToggle={() => setEmploymentExpanded(!employmentExpanded)}
        >
          <DetailRow
            label="Company"
            value={
              typeof employee?.company === 'object'
                ? employee?.company?.name
                : employee?.company_name
            }
          />
          <DetailRow
            label="Branch"
            value={
              typeof employee?.branch === 'object'
                ? employee?.branch?.name || employee?.branch?.branch_name
                : employee?.branch_name
            }
          />
          <DetailRow label="Department" value={employee?.department} />
          <DetailRow label="Designation" value={employee?.designation} />
          <DetailRow label="Work Type" value={employee?.work_type} />
          <DetailRow
            label="Shift"
            value={
              typeof employee?.shift === 'object'
                ? employee?.shift?.name
                : employee?.shift
            }
          />
          <DetailRow
            label="Status"
            value={
              employee?.status === true || employee?.status === 'ACTIVE'
                ? 'Active'
                : employee?.status === false
                ? 'Inactive'
                : '--'
            }
          />
          <DetailRow
            label="Office Address"
            value={employee?.office_address}
            isLast
          />
        </ExpandableSection>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Top Navigation Bar matching reference
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  topBarTitle: {
    fontSize: 18,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
    textAlign: 'center',
  },
  topBarRightPlaceholder: {
    width: 40,
  },

  // Scroll Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Expandable Section
  sectionContainer: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.surfaceSecondary, // Light grey header matching screenshot
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  sectionHeaderCollapsed: {
    borderBottomWidth: 0,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
    letterSpacing: -0.1,
  },

  // Detail rows inside white body
  sectionBody: {
    backgroundColor: '#FFFFFF',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'Comfortaa_500Medium',
    flex: 1,
    paddingRight: 12,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#000000',
    textAlign: 'right',
    flex: 1.2,
  },
});
