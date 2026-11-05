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
