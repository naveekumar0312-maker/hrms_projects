from django.urls import path
from .manager_views import (
    ReportingManagerViewSet,
    ManagerActionViews,
    ManagerProfileView,
    ManagerMyTeamView,
    ManagerTeamEmployeeDetailView,
    ManagerTeamAttendanceView,
    ManagerDashboardSummaryView,
    PromoteEmployeeToTeamLeaderView,
    TeamLeaderTeamAssignmentView,
    TeamLeaderDashboardSummaryView,
    TeamLeaderMyTeamView,
)

urlpatterns = [
    # -------------------------------------------------------------------------
    # HR & Super Admin Management Routes
    # -------------------------------------------------------------------------
    path('hr/managers/', ReportingManagerViewSet.as_view({'get': 'list', 'post': 'create'}), name='hr-reporting-managers-list-create'),
    path('hr/managers/<int:pk>/', ReportingManagerViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='hr-reporting-manager-detail'),
    path('hr/managers/<int:pk>/<str:action_name>/', ManagerActionViews.as_view(), name='hr-reporting-manager-action'),

    # -------------------------------------------------------------------------
    # Reporting Manager Portal Routes (Logged-in Manager)
    # -------------------------------------------------------------------------
    path('manager/profile/', ManagerProfileView.as_view(), name='manager-portal-profile'),
    path('manager/dashboard-summary/', ManagerDashboardSummaryView.as_view(), name='manager-portal-dashboard-summary'),
    path('manager/team/', ManagerMyTeamView.as_view(), name='manager-portal-my-team'),
    path('manager/team/<int:pk>/', ManagerTeamEmployeeDetailView.as_view(), name='manager-portal-team-employee-detail'),
    path('manager/team-attendance/', ManagerTeamAttendanceView.as_view(), name='manager-portal-team-attendance'),
    path('manager/employees/<int:pk>/promote-team-leader/', PromoteEmployeeToTeamLeaderView.as_view(), name='manager-promote-team-leader'),
    path('manager/team-leaders/<int:pk>/assign-team/', TeamLeaderTeamAssignmentView.as_view(), name='manager-team-leader-assign'),

    # -------------------------------------------------------------------------
    # Team Leader Portal Routes (Logged-in Team Leader)
    # -------------------------------------------------------------------------
    path('team-leader/dashboard-summary/', TeamLeaderDashboardSummaryView.as_view(), name='team-leader-dashboard-summary'),
    path('team-leader/team/', TeamLeaderMyTeamView.as_view(), name='team-leader-my-team'),
]

