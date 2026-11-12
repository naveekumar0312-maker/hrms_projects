from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from .models import Task, TaskComment, TaskAttachment, TaskActivity, TaskTimeLog
from employees.models import Employee


class AssignedEmployeeBriefSerializer(serializers.ModelSerializer):
    profile_photo_url = serializers.SerializerMethodField()
    role = serializers.CharField(source='user.role', read_only=True, default='EMPLOYEE')

    class Meta:
        model = Employee
        fields = [
            'id', 'full_name', 'employee_id', 'department', 'designation',
            'role', 'profile_photo_url'
        ]

    def get_profile_photo_url(self, obj):
        if obj.profile_photo:
            try:
                return obj.profile_photo.url
            except Exception:
                return None
        return None


class TaskCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_role = serializers.CharField(source='author.role', read_only=True)
    author_avatar = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = TaskComment
        fields = [
            'id', 'task', 'author', 'author_name', 'author_role', 'author_avatar',
            'comment', 'comment_type', 'attachment', 'attachment_url',
            'file_name', 'file_size', 'link_url', 'created_at'
        ]
        read_only_fields = ['id', 'task', 'author', 'created_at']

    def get_author_name(self, obj):
        if not obj.author:
            return 'System'
        emp = getattr(obj.author, 'employee_profile', None)
        if emp and emp.full_name:
            return emp.full_name
        return obj.author.get_full_name() or obj.author.username

    def get_author_avatar(self, obj):
        if not obj.author:
            return None
        emp = getattr(obj.author, 'employee_profile', None)
        if emp and emp.profile_photo:
            try:
                return emp.profile_photo.url
            except Exception:
                return None
        return None

    def get_attachment_url(self, obj):
        if obj.attachment:
            try:
                return obj.attachment.url
            except Exception:
                return None
        return None


class TaskAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = TaskAttachment
        fields = [
            'id', 'task', 'uploaded_by', 'uploaded_by_name',
            'file', 'file_url', 'file_name', 'file_type', 'file_size', 'created_at'
        ]
        read_only_fields = ['id', 'task', 'uploaded_by', 'file_name', 'file_size', 'created_at']

    def get_uploaded_by_name(self, obj):
        if not obj.uploaded_by:
            return 'System'
        emp = getattr(obj.uploaded_by, 'employee_profile', None)
        if emp and emp.full_name:
            return emp.full_name
        return obj.uploaded_by.get_full_name() or obj.uploaded_by.username

    def get_file_url(self, obj):
        if obj.file:
            try:
                return obj.file.url
            except Exception:
                return None
        return None


class TaskActivitySerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = TaskActivity
        fields = ['id', 'task', 'user', 'user_name', 'action', 'description', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']

    def get_user_name(self, obj):
        if not obj.user:
            return 'System'
        emp = getattr(obj.user, 'employee_profile', None)
        if emp and emp.full_name:
            return emp.full_name
        return obj.user.get_full_name() or obj.user.username


class TaskTimeLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = TaskTimeLog
        fields = [
            'id', 'task', 'user', 'user_name',
            'date', 'start_time', 'end_time', 'hours', 'description', 'created_at'
        ]
        read_only_fields = ['id', 'task', 'user', 'created_at']

    def get_user_name(self, obj):
        if not obj.user:
            return 'System'
        emp = getattr(obj.user, 'employee_profile', None)
        if emp and emp.full_name:
            return emp.full_name
        return obj.user.get_full_name() or obj.user.username


class TaskSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source='assigned_to.full_name', read_only=True, default='Unassigned')
    assigned_to_code = serializers.CharField(source='assigned_to.employee_id', read_only=True, default='')
    assigned_to_role = serializers.CharField(source='assigned_to.user.role', read_only=True, default='EMPLOYEE')
    assigned_to_avatar = serializers.SerializerMethodField()
    assigned_employees = AssignedEmployeeBriefSerializer(many=True, read_only=True)
    assigned_employee_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        read_only=True,
        source='assigned_employees'
    )
    assigned_by_name = serializers.SerializerMethodField()
    assigned_by_role = serializers.CharField(source='assigned_by.role', read_only=True, default='')
    company_name = serializers.CharField(source='company.name', read_only=True)
    reporting_manager_name = serializers.CharField(source='reporting_manager.full_name', read_only=True, default='')
    team_leader_name = serializers.CharField(source='team_leader.full_name', read_only=True, default='')
    
    comments = TaskCommentSerializer(many=True, read_only=True)
    task_attachments = TaskAttachmentSerializer(many=True, read_only=True)
    activities = TaskActivitySerializer(many=True, read_only=True)
    time_logs = TaskTimeLogSerializer(many=True, read_only=True)
    total_logged_hours = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id', 'company', 'company_name',
            'title', 'description', 'category',
            'assigned_to', 'assigned_to_name', 'assigned_to_code', 'assigned_to_role', 'assigned_to_avatar',
            'assigned_employees', 'assigned_employee_ids',
            'assigned_by', 'assigned_by_name', 'assigned_by_role',
            'reporting_manager', 'reporting_manager_name',
            'team_leader', 'team_leader_name',
            'priority', 'status', 'is_draft',
            'start_date', 'due_date', 'start_time', 'end_time', 'estimated_hours',
            'attachment', 'additional_instructions',
            'completion_attachment', 'completion_notes',
            'total_logged_hours', 'is_overdue',
            'comments', 'task_attachments', 'activities', 'time_logs',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'company', 'company_name', 'assigned_by', 'assigned_by_role',
            'reporting_manager', 'team_leader', 'created_at', 'updated_at'
        ]

    def get_assigned_to_avatar(self, obj):
        if obj.assigned_to and obj.assigned_to.profile_photo:
            try:
                return obj.assigned_to.profile_photo.url
            except Exception:
                return None
        return None

    def get_assigned_by_name(self, obj):
        if not obj.assigned_by:
            return 'System'
        emp = getattr(obj.assigned_by, 'employee_profile', None)
        if emp and emp.full_name:
            return emp.full_name
        return obj.assigned_by.get_full_name() or obj.assigned_by.username

    def get_total_logged_hours(self, obj):
        total = sum(tl.hours for tl in obj.time_logs.all())
        return float(total)

    def get_is_overdue(self, obj):
        if obj.status in ('COMPLETED', 'CANCELLED', 'DRAFT') or not obj.due_date:
            return False
        return obj.due_date < timezone.localdate()


class TaskCreateUpdateSerializer(serializers.ModelSerializer):
    assigned_employee_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True
    )

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'category',
            'assigned_to', 'assigned_employee_ids', 'priority', 'status', 'is_draft',
            'start_date', 'due_date', 'start_time', 'end_time', 'estimated_hours',
            'attachment', 'additional_instructions'
        ]

    def validate(self, attrs):
        # When updating an existing instance (e.g. PATCH), fallback to existing instance attributes if not provided
        is_create = (self.instance is None)
        start_date = attrs.get('start_date') if 'start_date' in attrs else (self.instance.start_date if self.instance else None)
        due_date = attrs.get('due_date') if 'due_date' in attrs else (self.instance.due_date if self.instance else None)
        is_draft = attrs.get('is_draft') if 'is_draft' in attrs else (self.instance.is_draft if self.instance else False)

        if start_date and due_date and start_date > due_date:
            raise ValidationError({"due_date": "Due date cannot be earlier than start date."})

        if not is_draft and not due_date:
            raise ValidationError({"due_date": "Due date is required for submitted tasks."})

        request = self.context.get('request')
        user = request.user
        emp = getattr(user, 'employee_profile', None)

        # 1. Reject task creation by regular Employees
        if is_create and user.role == 'EMPLOYEE':
            raise ValidationError("Employees are not authorized to create or assign tasks.")

        is_global_mgr = (user.role == 'REPORTING_MANAGER' and emp and emp.branch is None and user.company_id is None)

        if not user.company_id and not is_global_mgr and user.role not in ('SUPER_ADMIN', 'ADMIN'):
            raise ValidationError("User account is not linked to any company.")

        assigned_employee_ids = attrs.get('assigned_employee_ids', None)
        assigned_to = attrs.get('assigned_to', None)

        # If assigned_employee_ids provided, validate every employee
        employees_to_check = []
        if assigned_employee_ids:
            employees_to_check = list(Employee.objects.filter(id__in=assigned_employee_ids))
            if len(employees_to_check) != len(set(assigned_employee_ids)):
                raise ValidationError({"assigned_employee_ids": "One or more employee IDs are invalid."})
            if not assigned_to and employees_to_check:
                attrs['assigned_to'] = employees_to_check[0]
        elif assigned_to:
            employees_to_check = [assigned_to]

        if employees_to_check and (is_create or 'assigned_employee_ids' in attrs or 'assigned_to' in attrs):
            for target_emp in employees_to_check:
                # 2. Prevent cross-company assignment (except for Global Manager who manages all companies)
                if not is_global_mgr and user.company_id and target_emp.branch and target_emp.branch.company_id != user.company_id:
                    raise ValidationError({"assigned_employees": f"Cannot assign tasks to members in another company ({target_emp.full_name})."})

                # 3. Hierarchy validation for Team Leader
                if user.role == 'TEAM_LEADER':
                    if not emp:
                        raise ValidationError("Team Leader profile not found.")
                    if target_emp.team_leader_id != emp.id:
                        raise ValidationError({"assigned_employees": f"Team Leaders can only assign tasks to employees in their own team ({target_emp.full_name})."})

                # 4. Hierarchy validation for Reporting Manager
                elif user.role == 'REPORTING_MANAGER':
                    if not emp:
                        raise ValidationError("Reporting Manager profile not found.")
                    if not is_global_mgr:
                        is_direct = (target_emp.reporting_manager_id == emp.id)
                        is_sub_team = (target_emp.team_leader and target_emp.team_leader.reporting_manager_id == emp.id)
                        if not (is_direct or is_sub_team):
                            raise ValidationError({"assigned_employees": f"Reporting Managers can only assign tasks to direct reports or employees under their Team Leaders ({target_emp.full_name})."})

        return attrs
