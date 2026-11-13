from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer


def visible_notifications_for(user):
    queryset = Notification.objects.filter(
        recipient=user
    ).select_related("employee", "employee__branch")

    request_events = ["LEAVE_APPLIED", "PERMISSION_APPLIED"]
    role = getattr(user, "role", None)

    if role == "SUPER_ADMIN":
        return queryset

    if role in ("ADMIN", "HR"):
        company_id = getattr(user, "company_id", None)
        if not company_id:
            return queryset.none()

        queryset = queryset.filter(
            employee__branch__company_id=company_id,
        )

        if role == "ADMIN":
            return queryset.filter(event__in=request_events)

        return queryset

    # Employees see their own decisions and shift notifications,
    # but not notifications about submitted requests.
    return queryset.exclude(event__in=request_events)


class NotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queryset = visible_notifications_for(request.user)

        unread_count = queryset.filter(is_read=False).count()

        # If unread_only=true, filter out seen/read notifications so they disappear
        unread_only = request.query_params.get('unread_only', '').lower() in ('true', '1')
        if unread_only:
            queryset = queryset.filter(is_read=False)

        limit = min(max(int(request.query_params.get('limit', 50)), 1), 100)
        items = queryset[:limit]

        return Response({
            'unread_count': unread_count,
            'results': NotificationSerializer(items, many=True).data,
        })


class NotificationReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        notification = get_object_or_404(
            visible_notifications_for(request.user),
            pk=pk,
        )
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response({'message': 'Notification marked as read.'})


class NotificationReadAllView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        updated = visible_notifications_for(request.user).filter(
            is_read=False,
        ).update(is_read=True)

        return Response({'updated': updated})


class RequestLocationEnableView(APIView):
    """
    Allows Admin or HR to send a notification/alert to an employee requesting them
    to enable GPS Location Sharing.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role not in ('SUPER_ADMIN', 'ADMIN', 'HR'):
            return Response(
                {"detail": "Only admins and HR can request location sharing."},
                status=status.HTTP_403_FORBIDDEN
            )

        employee_id = request.data.get('employee_id')
        custom_message = (request.data.get('message') or '').strip()

        if not employee_id:
            return Response(
                {"detail": "employee_id is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from employees.models import Employee
        employee = Employee.objects.filter(pk=employee_id).select_related('user', 'branch').first()
        if not employee:
            return Response(
                {"detail": "Employee not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        if not employee.user:
            return Response(
                {"detail": "Employee does not have an active user account."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check company restriction for HR
        if user.role == 'HR' and user.company_id:
            if not employee.branch or employee.branch.company_id != user.company_id:
                return Response(
                    {"detail": "You can only notify employees in your assigned company."},
                    status=status.HTTP_403_FORBIDDEN
                )

        from django.utils import timezone
        import time
        today = timezone.localdate()
        title = "Turn On Location Sharing"
        msg = custom_message or f"Hello {employee.full_name}, your manager/HR requests you to enable GPS location sharing in the app for live operations."
        request_key = f"loc_req_{int(time.time())}"

        from .services import _create_and_push
        notification = _create_and_push(
            recipient=employee.user,
            employee=employee,
            event='LOCATION_REQUIRED',
            event_date=today,
            request_key=request_key,
            title=title,
            message=msg,
        )

        return Response({
            "success": True,
            "message": f"Location sharing request notification sent to {employee.full_name}.",
            "notification_id": notification.id
        }, status=status.HTTP_201_CREATED)
