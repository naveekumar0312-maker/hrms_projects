from django.db import models
from accounts.models import User
from branches.models import Branch
from django.core.validators import FileExtensionValidator
from .private_storage import PrivateDocumentStorage

class Employee(models.Model):
    WORK_TYPE_CHOICES = (
        ('OFFICE', 'Office'),
        ('FIELD', 'Field / Marketing'),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='employee_profile')
    employee_id = models.CharField(max_length=50, unique=True)
    full_name = models.CharField(max_length=255)
    email = models.EmailField(unique=True, null=True, blank=True)
    profile_photo = models.ImageField(upload_to='employees/profile/', null=True, blank=True)
    office_address = models.TextField(blank=True, null=True)
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, related_name='employees')
    department = models.CharField(max_length=100)
    designation = models.CharField(max_length=100)
    work_type = models.CharField(max_length=20, choices=WORK_TYPE_CHOICES, default='OFFICE')
    shift = models.ForeignKey('attendance.Shift', on_delete=models.SET_NULL, null=True, blank=True, related_name='employees')
    # Existing joining dates are preserved by the schema migration.
    joining_date = models.DateField(default=__import__('django.utils.timezone', fromlist=['localdate']).localdate)

    # Personal and contact information
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, blank=True, default='')
    current_address = models.TextField(blank=True, default='')
    permanent_address = models.TextField(blank=True, default='')
    emergency_contact_name = models.CharField(max_length=255, blank=True, default='')
    emergency_contact_number = models.CharField(max_length=30, blank=True, default='')

    # Employment information
    reporting_manager = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='direct_reports'
    )
    team_leader = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='team_members'
    )
    employment_type = models.CharField(
        max_length=20,
        choices=[
            ('FULL_TIME', 'Full Time'),
            ('PART_TIME', 'Part Time'),
            ('CONTRACT', 'Contract'),
            ('INTERN', 'Intern'),
            ('TEMPORARY', 'Temporary'),
        ],
        default='FULL_TIME',
    )
    probation_period_months = models.PositiveSmallIntegerField(null=True, blank=True)
    confirmation_date = models.DateField(null=True, blank=True)
    notice_period_days = models.PositiveSmallIntegerField(null=True, blank=True)
    employment_status = models.CharField(
        max_length=20,
        choices=[
            ('ACTIVE', 'Active'),
            ('RESIGNED', 'Resigned'),
            ('TERMINATED', 'Terminated'),
        ],
        default='ACTIVE',
    )

    # Sensitive employee information: restrict access through authenticated APIs.
    aadhaar_number = models.CharField(max_length=20, blank=True, default='')
    pan_number = models.CharField(max_length=20, blank=True, default='')
    bank_account_holder = models.CharField(max_length=255, blank=True, default='')
    bank_account_number = models.CharField(max_length=50, blank=True, default='')
    bank_ifsc = models.CharField(max_length=20, blank=True, default='')
    bank_name = models.CharField(max_length=255, blank=True, default='')
    bank_branch = models.CharField(max_length=255, blank=True, default='')

    # Structured details supplied by HR as JSON arrays.
    education_details = models.JSONField(default=list, blank=True)
    previous_employment_details = models.JSONField(default=list, blank=True)
    status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.full_name} ({self.employee_id})"


class EmployeeIdSequence(models.Model):
    """Year-wise counter for newly generated employee IDs."""
    year = models.PositiveSmallIntegerField(unique=True)
    last_number = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.year}: {self.last_number}"


class EmployeeDocument(models.Model):
    DOCUMENT_TYPES = [
        ('AADHAAR', 'Aadhaar'),
        ('PAN', 'PAN'),
        ('BANK_PROOF', 'Bank Proof'),
        ('EDUCATION', 'Educational Certificate'),
        ('EXPERIENCE', 'Experience Certificate'),
        ('PREVIOUS_APPOINTMENT', 'Previous Appointment Letter'),
        ('OFFER_LETTER', 'Offer Letter'),
        ('RELIEVING_LETTER', 'Relieving Letter'),
        ('PASSPORT_PHOTO', 'Passport-size Photo'),
        ('OTHER', 'Other Company Document'),
    ]

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name='documents'
    )
    document_type = models.CharField(max_length=30, choices=DOCUMENT_TYPES)
    title = models.CharField(max_length=255)
    file = models.FileField(
        storage=PrivateDocumentStorage(),
        upload_to='',
        validators=[FileExtensionValidator(
            allowed_extensions=['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']
        )],
    )
    notes = models.TextField(blank=True, default='')
    uploaded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='uploaded_employee_documents'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.employee.employee_id} - {self.title}"

    def delete(self, *args, **kwargs):
        # Delete the stored file as well as its database record.
        if self.file:
            self.file.delete(save=False)
        return super().delete(*args, **kwargs)


class EmployeeLocationSharing(models.Model):
    """Explicit employee consent for location sharing."""
    employee = models.OneToOneField(
        Employee,
        on_delete=models.CASCADE,
        related_name='location_sharing',
    )
    is_enabled = models.BooleanField(default=False)
    enabled_at = models.DateTimeField(null=True, blank=True)
    disabled_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Employee Location Sharing'
        verbose_name_plural = 'Employee Location Sharing'

    def __str__(self):
        return f'{self.employee.employee_id} - Sharing: {self.is_enabled}'


class EmployeeLocation(models.Model):
    """Timestamped GPS updates, stored separately from attendance."""
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='location_updates',
    )
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    accuracy_meters = models.FloatField(null=True, blank=True)
    location_name = models.CharField(max_length=500, blank=True, default="")
    recorded_at = models.DateTimeField(default=__import__(
        'django.utils.timezone', fromlist=['now']
    ).now)

    class Meta:
        ordering = ['-recorded_at']
        indexes = [
            models.Index(
                fields=['employee', '-recorded_at'],
                name='emp_loc_time_idx',
            ),
        ]

    def __str__(self):
        return f'{self.employee.employee_id} - {self.recorded_at}'


class EmployeeLocationTrackingEvent(models.Model):
    """Explicit location-sharing changes and derived movement events."""
    EVENT_TYPES = [
        ("LOCATION_ON", "Location ON"),
        ("LOCATION_OFF", "Location OFF"),
        ("DRIVE", "Drive"),
        ("STOP", "Stop"),
    ]

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="location_tracking_events",
    )
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    recorded_at = models.DateTimeField(default=__import__(
        "django.utils.timezone", fromlist=["now"]
    ).now)
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    details = models.JSONField(default=dict, blank=True)
    location_name = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        ordering = ["-recorded_at", "-pk"]
        indexes = [
            models.Index(
                fields=["employee", "-recorded_at"],
                name="emp_track_event_idx",
            ),
        ]

    def __str__(self):
        return f"{self.employee.employee_id} - {self.event_type} - {self.recorded_at}"


class TeamAssignmentHistory(models.Model):
    """
    Audit log / assignment history tracking which Reporting Manager
    an employee is assigned to, within a company.
    Supports Phase 2 Task Management hierarchy and accountability.
    """
    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='team_assignment_history',
    )
    manager = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='manager_assignment_history',
    )
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='employee_assignment_history',
    )
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_team_assignments',
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    unassigned_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-assigned_at']
        indexes = [
            models.Index(fields=['company', 'manager', 'is_active']),
            models.Index(fields=['employee', 'is_active']),
        ]

    def __str__(self):
        return f"{self.employee.full_name} -> {self.manager.full_name} ({'Active' if self.is_active else 'Inactive'})"

