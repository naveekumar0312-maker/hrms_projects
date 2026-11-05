from django.urls import path

from .views import (
    NotificationListView,
    NotificationReadView,
    NotificationReadAllView,
)
from .push_views import WebPushTokenView

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification-list'),
    path('read-all/', NotificationReadAllView.as_view(), name='notification-read-all'),
    path('<int:pk>/read/', NotificationReadView.as_view(), name='notification-read'),
    path('push-token/', WebPushTokenView.as_view(), name='web-push-token'),
]
