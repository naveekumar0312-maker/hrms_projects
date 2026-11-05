from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TaskViewSet,
    TaskCommentViewSet,
    TaskAttachmentViewSet,
    TaskTimeLogViewSet,
    TaskActivityListView,
    TaskDashboardSummaryView,
)

router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='tasks')

urlpatterns = [
    path('tasks/summary/', TaskDashboardSummaryView.as_view(), name='task-dashboard-summary'),
    path('tasks/<int:pk>/activities/', TaskActivityListView.as_view(), name='task-activities'),
    
    # Sub-resources for Right-hand workspace tabs
    path('tasks/<int:task_pk>/comments/', TaskCommentViewSet.as_view({'get': 'list', 'post': 'create'}), name='task-comments'),
    path('tasks/<int:task_pk>/attachments/', TaskAttachmentViewSet.as_view({'get': 'list', 'post': 'create'}), name='task-attachments'),
    path('tasks/<int:task_pk>/attachments/<int:pk>/', TaskAttachmentViewSet.as_view({'delete': 'destroy'}), name='task-attachment-detail'),
    path('tasks/<int:task_pk>/timelogs/', TaskTimeLogViewSet.as_view({'get': 'list', 'post': 'create'}), name='task-timelogs'),
    
    path('', include(router.urls)),
]
