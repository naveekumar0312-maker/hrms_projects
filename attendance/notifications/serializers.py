from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(
        source='employee.full_name', read_only=True
    )
    employee_id = serializers.CharField(
        source='employee.employee_id', read_only=True
    )

    class Meta:
        model = Notification
        fields = [
            'id', 'event', 'employee_name', 'employee_id',
            'title', 'message', 'is_read', 'shift_date', 'created_at',
        ]
        read_only_fields = fields
