from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EmployeeViewSet, EmployeeDocumentViewSet

document_router = DefaultRouter()
document_router.register(r'', EmployeeDocumentViewSet, basename='employee-document')

router = DefaultRouter()
router.register(r'', EmployeeViewSet, basename='employee')

urlpatterns = [
    path('documents/', include(document_router.urls)),
    path('', include(router.urls)),
]
