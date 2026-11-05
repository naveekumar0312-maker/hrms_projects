from django.db import models
from branches.models import Branch
from employees.models import Employee

class Shift(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, unique=True, null=True, blank=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    grace_period = models.PositiveIntegerField(default=0) # in minutes
    is_active = models.BooleanField(default=True)
    reminders_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class AttendancePolicy(models.Model):
    branch = models.OneToOneField(Branch, on_delete=models.CASCADE, related_name='attendance_policy')
    start_time = models.TimeField()
    end_time = models.TimeField()
    grace_period = models.IntegerField(default=0) # in minutes
    allowed_radius = models.IntegerField(default=100) # in meters
    
    def __str__(self):
        return f"Policy for {self.branch.branch_name}"

class Holiday(models.Model):
    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='holidays',
    )
    name = models.CharField(max_length=255)
    date = models.DateField()
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date']
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'date'],
                name='unique_holiday_per_company_date',
            ),
        ]

    def __str__(self):
        return f"{self.name} - {self.date}"


class Attendance(models.Model):
    STATUS_CHOICES = (
        ('ON_TIME', 'On Time'),
        ('LATE', 'Late'),
        ('WORKING', 'Working'),
        ('COMPLETED', 'Completed'),
        ('ABSENT', 'Absent'),
        ('REJECTED', 'Rejected'),
    )

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='attendances')
    date = models.DateField()

    ATTENDANCE_MODE_CHOICES = (
        ('OFFICE', 'Office'),
        ('WFH', 'Work From Home'),
    )
    attendance_mode = models.CharField(
        max_length=10,
        choices=ATTENDANCE_MODE_CHOICES,
        default='OFFICE',
    )
    
    check_in = models.DateTimeField(null=True, blank=True)
    check_in_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    check_in_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    check_in_accuracy = models.FloatField(null=True, blank=True)
    check_in_location_name = models.CharField(max_length=500, null=True, blank=True)
    check_in_photo = models.ImageField(upload_to='attendance_photos/check_in/', null=True, blank=True)

    check_out = models.DateTimeField(null=True, blank=True)
    check_out_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    check_out_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    check_out_accuracy = models.FloatField(null=True, blank=True)
    check_out_location_name = models.CharField(max_length=500, null=True, blank=True)
    check_out_photo = models.ImageField(upload_to='attendance_photos/check_out/', null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='WORKING')
    late_minutes = models.IntegerField(default=0)
    grace_used = models.BooleanField(default=False)
    early_minutes = models.IntegerField(default=0)
    overtime_minutes = models.IntegerField(default=0)
    working_minutes = models.IntegerField(default=0)

    APPROVAL_CHOICES = (
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )
    approval_status = models.CharField(max_length=20, choices=APPROVAL_CHOICES, default='PENDING')
    rejection_reason = models.TextField(null=True, blank=True)
    reviewed_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_attendances')
    reviewed_at = models.DateTimeField(null=True, blank=True)

    check_in_approval_status = models.CharField(
        max_length=20,
        choices=APPROVAL_CHOICES,
        default='PENDING'
    )
    check_in_rejection_reason = models.TextField(
        null=True,
        blank=True
    )

    check_out_approval_status = models.CharField(
        max_length=20,
        choices=APPROVAL_CHOICES,
        default='PENDING'
    )
    check_out_rejection_reason = models.TextField(
        null=True,
        blank=True
    )


    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['employee']),
            models.Index(fields=['date']),
            models.Index(fields=['status']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "date"],
                name="unique_employee_attendance_per_day"
            )
        ]

    def __str__(self):
        return f"{self.employee.full_name} - {self.date}"


class PermissionRequest(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='permission_requests'
    )
    date = models.DateField()
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    duration_minutes = models.PositiveIntegerField()
    reason = models.TextField()

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )

    approved_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_permission_requests'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['employee', 'date']),
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['date', 'status']),
        ]

    def __str__(self):
        return f"{self.employee.full_name} - {self.date} - {self.duration_minutes}m"


class LeaveRequest(models.Model):
    LEAVE_TYPE_CHOICES = (
        ('CASUAL', 'Casual Leave'),
        ('SICK', 'Sick Leave'),
        ('HALF_DAY', 'Half Day Leave'),
        ('PERSONAL', 'Personal Leave'),
        ('OTHER', 'Other'),
    )

    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='leave_requests'
    )
    leave_type = models.CharField(
        max_length=30,
        choices=LEAVE_TYPE_CHOICES
    )
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField()

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )

    approved_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_leave_requests'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['employee', 'start_date', 'end_date']),
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['start_date', 'end_date', 'status']),
        ]

    def __str__(self):
        return f"{self.employee.full_name} - {self.start_date} to {self.end_date}"

class WFHRequest(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='wfh_requests'
    )
    date = models.DateField()
    reason = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )
    approved_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_wfh_requests'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['employee', 'date']),
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['date', 'status']),
        ]

    def __str__(self):
        return f"{self.employee.full_name} - WFH - {self.date}"


class EmployeePersonalAlarm(models.Model):
    """
    Employee-controlled Daily Personal Alarm.
    Repeats every day at the employee's configured time, completely independent of assigned shifts.
    """
    employee = models.OneToOneField(
        Employee,
        on_delete=models.CASCADE,
        related_name='personal_alarm'
    )
    alarm_time = models.TimeField()
    is_enabled = models.BooleanField(default=False)
    timezone = models.CharField(max_length=50, default='Asia/Kolkata')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.employee.full_name} - Personal Alarm ({self.alarm_time}) [{'ON' if self.is_enabled else 'OFF'}]"

