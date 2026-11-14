import { StatusBar } from 'expo-status-bar';
import React, { useContext } from 'react';
import { useFonts } from 'expo-font';
import {
  Comfortaa_400Regular,
  Comfortaa_500Medium,
  Comfortaa_600SemiBold,
  Comfortaa_700Bold,
} from '@expo-google-fonts/comfortaa';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { House, CalendarClock, CircleUserRound, Users, ListTodo, Building2 } from 'lucide-react-native';

import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { MessageProvider } from './src/context/MessageContext';
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LeaveScreen from './src/screens/LeaveScreen';
import WFHScreen from './src/screens/WFHScreen';
import PermissionScreen from './src/screens/PermissionScreen';
import PersonalInfoScreen from './src/screens/PersonalInfoScreen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';
import TasksScreen from './src/screens/TasksScreen';
import ManagerDashboardScreen from './src/screens/manager/ManagerDashboardScreen';
import ManagerTeamScreen from './src/screens/manager/ManagerTeamScreen';
import ManagerAttendanceScreen from './src/screens/manager/ManagerAttendanceScreen';
import PersonalAlarmManager from './src/components/PersonalAlarmManager';
import PushNotificationManager from './src/components/PushNotificationManager';

import { Text, TextInput } from 'react-native';

// Set Comfortaa Medium as default font globally across all text in Mobile App
if ((Text as any).defaultProps == null) {
  (Text as any).defaultProps = {};
}
(Text as any).defaultProps.style = [{ fontFamily: 'Comfortaa_500Medium' }, (Text as any).defaultProps.style];

if ((TextInput as any).defaultProps == null) {
  (TextInput as any).defaultProps = {};
}
(TextInput as any).defaultProps.style = [{ fontFamily: 'Comfortaa_500Medium' }, (TextInput as any).defaultProps.style];

// Super Admin & HR Screens
import { AdminHRDashboardScreen } from './src/screens/admin/AdminHRDashboardScreen';
import { AdminEmployeesScreen } from './src/screens/admin/AdminEmployeesScreen';
import { AdminAttendanceScreen } from './src/screens/admin/AdminAttendanceScreen';
import { AdminLeavesScreen } from './src/screens/admin/AdminLeavesScreen';
import { AdminPermissionsScreen } from './src/screens/admin/AdminPermissionsScreen';
import { AdminWFHScreen } from './src/screens/admin/AdminWFHScreen';
import { AdminBranchesScreen } from './src/screens/admin/AdminBranchesScreen';
import { AdminShiftsScreen } from './src/screens/admin/AdminShiftsScreen';
import { AdminHolidaysScreen } from './src/screens/admin/AdminHolidaysScreen';
import { AdminReportingManagersScreen } from './src/screens/admin/AdminReportingManagersScreen';
import { AdminLiveLocationsScreen } from './src/screens/admin/AdminLiveLocationsScreen';
import { AdminCompaniesScreen } from './src/screens/admin/AdminCompaniesScreen';
import { AdminHRAccountsScreen } from './src/screens/admin/AdminHRAccountsScreen';
import { colors } from './src/theme/colors';


// Pure White & Light Theme for React Navigation (Eliminates default blue or grey container bleed)
const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: '#FFFFFF',
    card: '#FFFFFF',
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.primary,
  },
};

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Clean Zomato-inspired Tab Navigation Options
const commonTabScreenOptions = {
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: '#9DA4B9',
  headerShown: false,
  tabBarStyle: {
    height: 70,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderTopColor: 'rgba(30, 34, 56, 0.05)',
    borderTopWidth: 1,
    shadowColor: '#1E2238',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 8,
  },
  tabBarLabelStyle: {
    fontSize: 11,
    fontFamily: 'Comfortaa_500Medium',
    marginTop: 2,
  },
  tabBarIconStyle: {
    marginTop: 2,
  },
};

const EmployeeTabs = () => {
  return (
    <Tab.Navigator screenOptions={commonTabScreenOptions}>
      <Tab.Screen 
        name="HomeTab" 
        component={DashboardScreen} 
        options={{ 
          title: 'Dashboard',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <House color={color} size={21} strokeWidth={2} /> 
        }} 
      />
      <Tab.Screen 
        name="TasksTab" 
        component={TasksScreen} 
        options={{ 
          title: 'My Tasks',
          tabBarLabel: 'Tasks',
          tabBarIcon: ({ color }) => <ListTodo color={color} size={21} strokeWidth={2} /> 
        }} 
      />
      <Tab.Screen 
        name="HistoryTab" 
        component={HistoryScreen} 
        options={{ 
          title: 'Attendance History',
          tabBarLabel: 'Attendance',
          tabBarIcon: ({ color }) => <CalendarClock color={color} size={21} strokeWidth={2} /> 
        }} 
      />
      <Tab.Screen 
        name="ProfileTab" 
        component={ProfileScreen} 
        options={{ 
          title: 'My Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <CircleUserRound color={color} size={21} strokeWidth={2} /> 
        }} 
      />
    </Tab.Navigator>
  );
};

const TeamLeaderTabs = () => {
  return (
    <Tab.Navigator screenOptions={commonTabScreenOptions}>
      <Tab.Screen 
        name="TeamLeaderHomeTab" 
        component={DashboardScreen} 
        options={{ 
          title: 'Dashboard',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <House color={color} size={21} strokeWidth={2} /> 
        }} 
      />
      <Tab.Screen 
        name="TeamLeaderTasksTab" 
        component={TasksScreen} 
        options={{ 
          title: 'Task Management',
          tabBarLabel: 'Tasks',
          tabBarIcon: ({ color }) => <ListTodo color={color} size={21} strokeWidth={2} /> 
        }} 
      />
      <Tab.Screen 
        name="TeamLeaderHistoryTab" 
        component={HistoryScreen} 
        options={{ 
          title: 'Attendance History',
          tabBarLabel: 'Attendance',
          tabBarIcon: ({ color }) => <CalendarClock color={color} size={21} strokeWidth={2} /> 
        }} 
      />
      <Tab.Screen 
        name="TeamLeaderProfileTab" 
        component={ProfileScreen} 
        options={{ 
          title: 'My Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <CircleUserRound color={color} size={21} strokeWidth={2} /> 
        }} 
      />
    </Tab.Navigator>
  );
};

const ManagerTabs = () => {
  return (
    <Tab.Navigator screenOptions={commonTabScreenOptions}>
      <Tab.Screen 
        name="ManagerHomeTab" 
        component={ManagerDashboardScreen} 
        options={{ 
          title: 'Manager Dashboard',
          tabBarLabel: 'Overview',
          tabBarIcon: ({ color }) => <House color={color} size={21} strokeWidth={2} /> 
        }} 
      />
      <Tab.Screen 
        name="ManagerTeamTab" 
        component={ManagerTeamScreen} 
        options={{ 
          title: 'My Team',
          tabBarLabel: 'Team',
          tabBarIcon: ({ color }) => <Users color={color} size={21} strokeWidth={2} /> 
        }} 
      />
      <Tab.Screen 
        name="ManagerTasksTab" 
        component={TasksScreen} 
        options={{ 
          title: 'Team Tasks',
          tabBarLabel: 'Tasks',
          tabBarIcon: ({ color }) => <ListTodo color={color} size={21} strokeWidth={2} /> 
        }} 
      />
      <Tab.Screen 
        name="ManagerProfileTab" 
        component={ProfileScreen} 
        options={{ 
          title: 'My Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <CircleUserRound color={color} size={21} strokeWidth={2} /> 
        }} 
      />
    </Tab.Navigator>
  );
};

// Super Admin Tabs
const SuperAdminTabs = () => {
  return (
    <Tab.Navigator screenOptions={commonTabScreenOptions}>
      <Tab.Screen 
        name="SuperAdminHomeTab" 
        component={AdminHRDashboardScreen} 
        options={{ 
          title: 'Console',
          tabBarLabel: 'Console',
          tabBarIcon: ({ color }) => <House color={color} size={21} strokeWidth={2} /> 
        }} 
      />
      <Tab.Screen 
        name="SuperAdminCompaniesTab" 
        component={AdminCompaniesScreen} 
        options={{ 
          title: 'Companies',
          tabBarLabel: 'Clients',
          tabBarIcon: ({ color }) => <Building2 color={color} size={21} strokeWidth={2} /> 
        }} 
      />
      <Tab.Screen 
        name="SuperAdminStaffTab" 
        component={AdminEmployeesScreen} 
        options={{ 
          title: 'All Staff',
          tabBarLabel: 'Staff',
          tabBarIcon: ({ color }) => <Users color={color} size={21} strokeWidth={2} /> 
        }} 
      />
      <Tab.Screen 
        name="SuperAdminProfileTab" 
        component={ProfileScreen} 
        options={{ 
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <CircleUserRound color={color} size={21} strokeWidth={2} /> 
        }} 
      />
    </Tab.Navigator>
  );
};

// HR Tabs
const HRTabs = () => {
  return (
    <Tab.Navigator screenOptions={commonTabScreenOptions}>
      <Tab.Screen 
        name="HRHomeTab" 
        component={AdminHRDashboardScreen} 
        options={{ 
          title: 'HR Portal',
          tabBarLabel: 'Overview',
          tabBarIcon: ({ color }) => <House color={color} size={21} strokeWidth={2} /> 
        }} 
      />
      <Tab.Screen 
        name="HREmployeesTab" 
        component={AdminEmployeesScreen} 
        options={{ 
          title: 'Company Staff',
          tabBarLabel: 'Staff',
          tabBarIcon: ({ color }) => <Users color={color} size={21} strokeWidth={2} /> 
        }} 
      />
      <Tab.Screen 
        name="HRAttendanceTab" 
        component={AdminAttendanceScreen} 
        options={{ 
          title: 'Attendance Roster',
          tabBarLabel: 'Attendance',
          tabBarIcon: ({ color }) => <CalendarClock color={color} size={21} strokeWidth={2} /> 
        }} 
      />
      <Tab.Screen 
        name="HRProfileTab" 
        component={ProfileScreen} 
        options={{ 
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <CircleUserRound color={color} size={21} strokeWidth={2} /> 
        }} 
      />
    </Tab.Navigator>
  );
};

const RoleBasedTabs = () => {
  const { user } = useContext(AuthContext);
  const role = user?.role;

  if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
    return <SuperAdminTabs />;
  }
  if (role === 'HR') {
    return <HRTabs />;
  }
  if (role === 'REPORTING_MANAGER') {
    return <ManagerTabs />;
  }
  if (role === 'TEAM_LEADER') {
    return <TeamLeaderTabs />;
  }
  return <EmployeeTabs />;
};

const RootNavigator = () => {
  const { isAuthenticated, isLoading } = useContext(AuthContext);
  const [isSplashComplete, setIsSplashComplete] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsSplashComplete(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading || !isSplashComplete) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false, statusBarHidden: false, statusBarStyle: 'dark' }}
        />
      ) : (
        <>
          <Stack.Screen name="Main" component={RoleBasedTabs} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />
          <Stack.Screen
            name="Leave"
            component={LeaveScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Permission"
            component={PermissionScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="WFH"
            component={WFHScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="PersonalInfo"
            component={PersonalInfoScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ChangePassword"
            component={ChangePasswordScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Tasks"
            component={TasksScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AttendanceHistory"
            component={HistoryScreen}
            options={{ headerShown: false }}
          />

          {/* Super Admin & HR Detailed Module Stack Routes */}
          <Stack.Screen name="AdminEmployees" component={AdminEmployeesScreen} />
          <Stack.Screen name="AdminAttendance" component={AdminAttendanceScreen} />
          <Stack.Screen name="ManagerAttendance" component={ManagerAttendanceScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AdminLeaves" component={AdminLeavesScreen} />
          <Stack.Screen name="AdminPermissions" component={AdminPermissionsScreen} />
          <Stack.Screen name="AdminWFH" component={AdminWFHScreen} />
          <Stack.Screen name="AdminBranches" component={AdminBranchesScreen} />
          <Stack.Screen name="AdminShifts" component={AdminShiftsScreen} />
          <Stack.Screen name="AdminHolidays" component={AdminHolidaysScreen} />
          <Stack.Screen name="AdminReportingManagers" component={AdminReportingManagersScreen} />
          <Stack.Screen name="AdminLiveLocations" component={AdminLiveLocationsScreen} />
          <Stack.Screen name="AdminCompanies" component={AdminCompaniesScreen} />
          <Stack.Screen name="AdminHRAccounts" component={AdminHRAccountsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

function AppContent() {
  const { isAuthenticated } = useContext(AuthContext);

  return (
    <>
      <PersonalAlarmManager />
      <PushNotificationManager isAuthenticated={isAuthenticated} />
      <NavigationContainer theme={navTheme}>
        <RootNavigator />
      </NavigationContainer>
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Comfortaa_400Regular,
    Comfortaa_500Medium,
    Comfortaa_600SemiBold,
    Comfortaa_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar
        style="dark"
        hidden={false}
      />
      <AuthProvider>
        <MessageProvider>
          <AppContent />
        </MessageProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
