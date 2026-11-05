from django.conf import settings
from django.db import models
from employees.models import Employee


class Notification(models.Model):
    EVENT_CHOICES = [
        ('SHIFT_START', 'Shift starting soon'),
        ('SHIFT_END', 'Shift ending'),
        ('LEAVE_APPLIED', 'Leave request applied'),
        ('PERMISSION_APPLIED', 'Permission request applied'),
        ('LEAVE_APPROVED', 'Leave request approved'),
        ('LEAVE_REJECTED', 'Leave request rejected'),
        ('PERMISSION_APPROVED', 'Permission request approved'),
        ('PERMISSION_REJECTED', 'Permission request rejected'),
        ('WFH_APPLIED', 'WFH request applied'),
        ('WFH_APPROVED', 'WFH request approved'),
        ('WFH_REJECTED', 'WFH request rejected'),
    ]

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='attendance_notifications',
    )
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    event = models.CharField(max_length=20, choices=EVENT_CHOICES)
    shift_date = models.DateField()
    request_key = models.CharField(max_length=100, blank=True, default='')
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=[
                    'recipient', 'employee', 'event',
                    'shift_date', 'request_key',
                ],
                name='uniq_shift_notification_per_recipient',
            ),
        ]

    def __str__(self):
        return f'{self.title} - {self.recipient}'


class WebPushDevice(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="web_push_devices",
    )
    token = models.TextField()
    token_hash = models.CharField(max_length=64, unique=True, editable=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        import hashlib
        self.token_hash = hashlib.sha256(self.token.encode("utf-8")).hexdigest()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Web push device for user {self.user_id}"
