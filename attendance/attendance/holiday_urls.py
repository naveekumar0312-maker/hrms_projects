from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import HolidayViewSet

router = DefaultRouter()
router.register(r'holidays', HolidayViewSet, basename='holidays')

urlpatterns = router.urls
