"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('api/notifications/', include('notifications.urls')),
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/attendance/', include('attendance.urls')),
    path('api/', include('attendance.holiday_urls')),
    path('api/holidays/', include('attendance.urls')),
    path('api/branches/', include('branches.urls')),
    path('api/companies/', include('companies.urls')),
    path('api/employees/', include('employees.manager_urls')),
    path('api/employees/', include('employees.urls')),
    path('api/tracking/', include('employees.tracking_urls')),
    path('api/tasks-module/', include('task_tracking.urls')),
    path('api/shifts/', include('attendance.shift_urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
