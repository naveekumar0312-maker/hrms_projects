from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CheckInView,
    CheckOutView,
    AttendanceViewSet,
    PermissionRequestViewSet,
    LeaveRequestViewSet,
    WFHRequestViewSet,
    HolidayViewSet,
    EmployeePersonalAlarmView,
)
from .reminder_views import PendingActionsReminderView

router = DefaultRouter()
router.register(r'permissions', PermissionRequestViewSet, basename='permissions')
router.register(r'leaves', LeaveRequestViewSet, basename='leaves')
router.register(r'wfh', WFHRequestViewSet, basename='wfh')
router.register(r'holidays', HolidayViewSet, basename='holidays')
router.register(r'', AttendanceViewSet, basename='attendance')

urlpatterns = [
    path('pending-actions-reminder/', PendingActionsReminderView.as_view(), name='pending-actions-reminder'),
    path('personal-alarm/', EmployeePersonalAlarmView.as_view(), name='employee-personal-alarm'),
    path('personal-alarm', EmployeePersonalAlarmView.as_view(), name='employee-personal-alarm-noslash'),
    path('check-in/', CheckInView.as_view(), name='check-in'),
    path('check-out/', CheckOutView.as_view(), name='check-out'),
    path('', include(router.urls)),
]
