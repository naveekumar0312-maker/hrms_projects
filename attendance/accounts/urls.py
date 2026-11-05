from django.urls import path
from .views import (
    LoginView,
    ManagerLoginView,
    LogoutView,
    MeView,
    HRAccountListCreateView,
    HRAccountDetailView,
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('manager/login/', ManagerLoginView.as_view(), name='manager-login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', MeView.as_view(), name='me'),
    path('hr-accounts/', HRAccountListCreateView.as_view(), name='hr-account-list-create'),
    path('hr-accounts/<int:pk>/', HRAccountDetailView.as_view(), name='hr-account-detail'),
]
