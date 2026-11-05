from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CompanyViewSet, public_company_branding, update_company_branding

router = DefaultRouter()
router.register(r'', CompanyViewSet, basename='company')

urlpatterns = [
    path("<int:pk>/branding/", update_company_branding, name="update-company-branding"),
    path("public/<slug:slug>/branding/", public_company_branding, name="public-company-branding"),
    path('', include(router.urls)),
]
