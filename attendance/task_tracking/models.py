from django.db import models
from django.conf import settings
from companies.models import Company
from employees.models import Employee


class Task(models.Model):
    PRIORITY_CHOICES = (
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('URGENT', 'Urgent'),
    )

    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('UNDER_REVIEW', 'Under Review'),
        ('COMPLETED', 'Completed'),
        ('ON_HOLD', 'On Hold'),
        ('CANCELLED', 'Cancelled'),
        ('DRAFT', 'Draft'),
        ('OVERDUE', 'Overdue'),
    )

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='tasks'
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    category = models.CharField(max_length=100, blank=True, default='General')
    
    assigned_to = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='assigned_tasks',
        null=True,
        blank=True
    )
    assigned_employees = models.ManyToManyField(
        Employee,
        related_name='multi_assigned_tasks',
        blank=True
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_tasks'
    )
    
    reporting_manager = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='manager_tasks'
    )
    team_leader = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='leader_tasks'
    )

    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='MEDIUM')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='PENDING')
    is_draft = models.BooleanField(default=False)
    
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    estimated_hours = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)
    
    attachment = models.FileField(upload_to='tasks/attachments/', null=True, blank=True)
    additional_instructions = models.TextField(blank=True, default='')
    
    completion_attachment = models.FileField(upload_to='tasks/completions/', null=True, blank=True)
    completion_notes = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'status']),
            models.Index(fields=['assigned_to', 'status']),
            models.Index(fields=['due_date']),
        ]

    def __str__(self):
        assignee = self.assigned_to.full_name if self.assigned_to else 'Unassigned'
        return f"{self.title} ({self.get_status_display()}) - {assignee}"


class TaskComment(models.Model):
    COMMENT_TYPES = (
        ('TEXT', 'Text'),
        ('IMAGE', 'Image'),
        ('AUDIO', 'Audio/Voice'),
        ('LINK', 'Link'),
        ('FILE', 'File'),
    )

    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='task_comments'
    )
    comment = models.TextField(blank=True, default='')
    comment_type = models.CharField(max_length=20, choices=COMMENT_TYPES, default='TEXT')
    
    attachment = models.FileField(upload_to='tasks/comments/', null=True, blank=True)
    file_name = models.CharField(max_length=255, blank=True, default='')
    file_size = models.CharField(max_length=50, blank=True, default='')
    link_url = models.URLField(max_length=500, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Comment on {self.task.title} by {self.author} ({self.comment_type})"


class TaskAttachment(models.Model):
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='task_attachments'
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='task_uploaded_attachments'
    )
    file = models.FileField(upload_to='tasks/documents/')
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=100, blank=True, default='')
    file_size = models.CharField(max_length=50, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.file_name} on {self.task.title}"


class TaskActivity(models.Model):
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='activities'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='task_activities'
    )
    action = models.CharField(max_length=100)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action} by {self.user} on {self.task.title}"


class TaskTimeLog(models.Model):
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='time_logs'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='task_time_logs'
    )
    date = models.DateField()
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    hours = models.DecimalField(max_digits=5, decimal_places=2)
    description = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.hours} hrs on {self.task.title} by {self.user}"
