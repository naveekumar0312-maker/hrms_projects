from django.urls import path

from .tracking_views import (
    LiveLocationsView,
    LocationHistoryView,
    LocationSharingView,
    LocationUpdateView,
)

urlpatterns = [
    path("sharing/", LocationSharingView.as_view(), name="location-sharing"),
    path("update/", LocationUpdateView.as_view(), name="location-update"),
    path("live/", LiveLocationsView.as_view(), name="live-locations"),
    path(
        "history/<int:employee_id>/",
        LocationHistoryView.as_view(),
        name="location-history",
    ),
]
