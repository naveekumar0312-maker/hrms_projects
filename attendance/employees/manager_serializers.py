import logging
from datetime import date
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ValidationError, PermissionDenied

from accounts.models import User
from companies.models import Company
from branches.models import Branch
from .models import Employee, EmployeeIdSequence, TeamAssignmentHistory

logger = logging.getLogger(__name__)


class AssignedEmployeeBriefSerializer(serializers.ModelSerializer):
    """Compact representation of an employee assigned to a team."""
    department_name = serializers.CharField(source='department', read_only=True)
    designation_name = serializers.CharField(source='designation', read_only=True)
    branch_name = serializers.CharField(source='branch.branch_name', read_only=True, default='')
    company_name = serializers.CharField(source='branch.company.name', read_only=True, default='')
    company_id = serializers.IntegerField(source='branch.company_id', read_only=True, default=None)
    account_status = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            'id',
            'employee_id',
            'full_name',
            'email',
            'department',
            'department_name',
            'designation',
            'designation_name',
            'profile_photo',
            'branch',
            'branch_name',
            'company_id',
            'company_name',
            'status',
            'account_status',
            'employment_status',
            'work_type',
        ]

    def get_account_status(self, obj):
        if obj.user and not obj.user.is_active:
            return 'INACTIVE'
        return 'ACTIVE' if obj.status else 'INACTIVE'


class ReportingManagerSerializer(serializers.ModelSerializer):
    """
    Representation of a Reporting Manager for HR and Super Admin.
    Reuses the Employee model and links to the associated User account.
    """
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    phone_number = serializers.CharField(source='user.phone_number', read_only=True)
    role = serializers.CharField(source='user.role', read_only=True)
    is_active = serializers.BooleanField(source='user.is_active', read_only=True)
    account_status = serializers.SerializerMethodField()
    branch_name = serializers.CharField(source='branch.branch_name', read_only=True, default='')
    company_id = serializers.SerializerMethodField()
    company_name = serializers.SerializerMethodField()
    is_all_companies = serializers.SerializerMethodField()
    assigned_employee_count = serializers.SerializerMethodField()
    assigned_employees = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            'id',
            'employee_id',
            'full_name',
            'email',
            'user_id',
            'username',
            'phone_number',
            'role',
            'department',
            'designation',
            'profile_photo',
            'branch',
            'branch_name',
            'company_id',
            'company_name',
            'is_all_companies',
            'is_active',
            'account_status',
            'status',
            'assigned_employee_count',
            'assigned_employees',
            'created_at',
            'updated_at',
        ]

    def get_company_id(self, obj):
        if obj.branch and obj.branch.company_id:
            return obj.branch.company_id
        if obj.user and obj.user.company_id:
            return obj.user.company_id
        return None

    def get_company_name(self, obj):
        if obj.branch and obj.branch.company:
            return obj.branch.company.name
        if obj.user and obj.user.company:
            return obj.user.company.name
        return 'All Companies'

    def get_is_all_companies(self, obj):
        return (obj.branch is None and (obj.user is None or obj.user.company is None))

    def get_account_status(self, obj):
        if obj.user and not obj.user.is_active:
            return 'INACTIVE'
        return 'ACTIVE' if obj.status else 'INACTIVE'

    def get_assigned_employee_count(self, obj):
        return obj.direct_reports.filter(status=True).count()

    def get_assigned_employees(self, obj):
        if self.context.get('include_employees', False):
            reports = obj.direct_reports.select_related('user', 'branch', 'branch__company').all()
            return AssignedEmployeeBriefSerializer(reports, many=True).data
        return []


def generate_manager_employee_id():
    """Generates the next sequential EMP-YYYY-XXX employee ID."""
    today = timezone.localdate()
    year = today.year
    prefix = f"EMP-{year}-"
    
    sequence, _ = EmployeeIdSequence.objects.get_or_create(
        year=year, defaults={'last_number': 0}
    )
    sequence = EmployeeIdSequence.objects.select_for_update().get(pk=sequence.pk)

    numbers = []
    for existing_id in Employee.objects.filter(employee_id__startswith=prefix).values_list('employee_id', flat=True):
        try:
            numbers.append(int(existing_id.rsplit('-', 1)[1]))
        except (ValueError, IndexError):
            continue

    next_number = max([sequence.last_number, *numbers], default=0) + 1
    while Employee.objects.filter(employee_id=f"EMP-{year}-{next_number:03d}").exists():
        next_number += 1

    sequence.last_number = next_number
    sequence.save(update_fields=['last_number'])
    return f"EMP-{year}-{next_number:03d}"


class CreateReportingManagerSerializer(serializers.Serializer):
    """
    Simplified Add Manager Serializer:
    Required Fields:
      - full_name (Manager Name)
      - username (Login Username)
      - password (Initial password)
      - status / account_status (ACTIVE or INACTIVE)
    Optional:
      - employee_id (If promoting an existing employee record, pass its PK)
    """
    full_name = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=255,
        trim_whitespace=True,
    )
    username = serializers.CharField(
        required=True,
        max_length=150,
        trim_whitespace=True,
    )
    password = serializers.CharField(
        required=True,
        min_length=6,
        write_only=True,
    )
    status = serializers.ChoiceField(
        choices=['ACTIVE', 'INACTIVE'],
        default='ACTIVE',
        required=False,
    )
    employee_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Optional: PK of existing employee to promote."
    )
    branch_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Optional: PK of the branch."
    )
    company_id = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="Optional: PK of the company or 'ALL'."
    )

    def validate_username(self, value):
        username = value.strip()
        if not username:
            raise ValidationError("Username is required.")
        employee_pk = self.initial_data.get('employee_id')
        
        qs = User.objects.filter(username__iexact=username)
        if employee_pk:
            try:
                emp = Employee.objects.select_related('user').get(pk=employee_pk)
                if emp.user:
                    qs = qs.exclude(pk=emp.user.id)
            except Employee.DoesNotExist:
                pass

        if qs.exists():
            raise ValidationError("This username is already taken. Please choose another.")
        return username

    def validate(self, attrs):
        request = self.context.get('request')
        current_user = request.user if request else None

        # Determine target company
        raw_company = self.initial_data.get('company_id') or self.initial_data.get('company') or (request.query_params.get('company') if request else None)
        is_all_companies = (str(raw_company).upper() in ('ALL', 'ALL_COMPANIES', '0', '-1'))

        company_id = None
        if current_user and current_user.role == 'HR':
            company_id = current_user.company_id
            is_all_companies = False
        elif not is_all_companies:
            if raw_company:
                try:
                    company_id = int(raw_company)
                except (ValueError, TypeError):
                    company_id = None
            if not company_id:
                first_comp = Company.objects.filter(status=True).first()
                company_id = first_comp.id if first_comp else None

        employee_pk = attrs.get('employee_id')
        employee = None
        if employee_pk:
            try:
                employee = Employee.objects.select_related('user', 'branch', 'branch__company').get(pk=employee_pk)
            except Employee.DoesNotExist:
                raise ValidationError({"employee_id": "Employee not found."})

            if not is_all_companies and company_id and employee.branch and employee.branch.company_id != int(company_id):
                raise PermissionDenied("Employee belongs to another company.")
        else:
            # Manager name required when creating new
            manager_name = (attrs.get('full_name') or '').strip()
            if not manager_name:
                raise ValidationError({"full_name": "Manager Name is required."})

        attrs['is_all_companies'] = is_all_companies
        attrs['target_company_id'] = int(company_id) if company_id else None
        attrs['existing_employee'] = employee

        branch_pk = attrs.get('branch_id') or self.initial_data.get('branch')
        if branch_pk and not is_all_companies and company_id:
            try:
                branch_obj = Branch.objects.get(pk=branch_pk, company_id=company_id)
                attrs['target_branch'] = branch_obj
            except Branch.DoesNotExist:
                raise ValidationError({"branch_id": "Selected branch does not belong to this company."})
        elif branch_pk and is_all_companies:
            try:
                branch_obj = Branch.objects.get(pk=branch_pk)
                attrs['target_branch'] = branch_obj
            except Branch.DoesNotExist:
                attrs['target_branch'] = None
        else:
            attrs['target_branch'] = None

        return attrs

    def save(self, **kwargs):
        validated_data = dict(self.validated_data)
        username = validated_data['username']
        password = validated_data['password']
        is_active = (validated_data.get('status', 'ACTIVE') == 'ACTIVE')
        is_all_companies = validated_data.get('is_all_companies', False)
        company_id = validated_data.get('target_company_id')
        employee = validated_data.get('existing_employee')
        full_name = (validated_data.get('full_name') or '').strip()
        target_branch = validated_data.get('target_branch')
        request = self.context.get('request')
        current_user = request.user if request else None

        with transaction.atomic():
            company = Company.objects.filter(pk=company_id).first() if company_id and not is_all_companies else None
            branch = target_branch
            if not is_all_companies and company and not branch:
                branch = Branch.objects.filter(company=company).first()
                if not branch:
                    branch = Branch.objects.create(
                        company=company,
                        branch_name=f"{company.name} Main Branch",
                        city="HQ",
                        state="HQ",
                        country="India"
                    )

            if employee:
                user = employee.user
                if user:
                    user.username = username
                    user.set_password(password)
                    user.role = 'REPORTING_MANAGER'
                    user.company = company
                    user.is_active = is_active
                    user.save()
                else:
                    user = User.objects.create_user(
                        username=username,
                        password=password,
                        role='REPORTING_MANAGER',
                        company=company,
                        is_active=is_active,
                    )
                    employee.user = user
                    employee.save(update_fields=['user'])

                if full_name:
                    employee.full_name = full_name
                employee.status = is_active
                employee.branch = branch
                employee.save()
            else:
                user = User.objects.create_user(
                    username=username,
                    password=password,
                    role='REPORTING_MANAGER',
                    company=company,
                    is_active=is_active,
                )
                generated_id = generate_manager_employee_id()
                employee = Employee.objects.create(
                    user=user,
                    employee_id=generated_id,
                    full_name=full_name,
                    department="Management",
                    designation="Reporting Manager",
                    branch=branch,
                    status=is_active,
                    employment_status='ACTIVE' if is_active else 'INACTIVE',
                    joining_date=timezone.localdate(),
                )

            # Auto-mapping logic
            if is_all_companies:
                unassigned_emps = Employee.objects.filter(
                    reporting_manager__isnull=True,
                    status=True
                ).exclude(pk=employee.pk).exclude(user__role__in=['SUPER_ADMIN', 'ADMIN'])
                for emp in unassigned_emps:
                    emp.reporting_manager = employee
                    emp.save(update_fields=['reporting_manager'])
                    emp_comp = (emp.branch.company if emp.branch and emp.branch.company else None)
                    TeamAssignmentHistory.objects.create(
                        company=emp_comp,
                        manager=employee,
                        employee=emp,
                        assigned_by=current_user if current_user and current_user.is_authenticated else None,
                        is_active=True
                    )
            elif company:
                unassigned_company_emps = Employee.objects.filter(
                    branch__company=company,
                    reporting_manager__isnull=True,
                    status=True
                ).exclude(pk=employee.pk).exclude(user__role__in=['SUPER_ADMIN', 'ADMIN'])

                for emp in unassigned_company_emps:
                    emp.reporting_manager = employee
                    emp.save(update_fields=['reporting_manager'])
                    TeamAssignmentHistory.objects.create(
                        company=company,
                        manager=employee,
                        employee=emp,
                        assigned_by=current_user if current_user and current_user.is_authenticated else None,
                        is_active=True
                    )

        return employee


class UpdateReportingManagerSerializer(serializers.Serializer):
    """
    Simplified Edit Manager Serializer:
    Fields:
      - full_name (Manager Name)
      - username (Login Username)
      - password (Optional: updated only when provided)
      - status / account_status (ACTIVE or INACTIVE)
      - branch_id (Branch PK or 0/null for None)
      - company_id (Company PK or 'ALL')
    """
    full_name = serializers.CharField(required=False, max_length=255, trim_whitespace=True)
    username = serializers.CharField(required=False, max_length=150, trim_whitespace=True)
    password = serializers.CharField(required=False, allow_blank=True, min_length=6, write_only=True)
    status = serializers.ChoiceField(choices=['ACTIVE', 'INACTIVE'], required=False)
    account_status = serializers.ChoiceField(choices=['ACTIVE', 'INACTIVE'], required=False)
    branch_id = serializers.IntegerField(required=False, allow_null=True)
    company_id = serializers.CharField(required=False, allow_null=True)

    def validate_username(self, value):
        username = value.strip()
        manager = self.context.get('manager')
        user = manager.user if manager else None
        
        qs = User.objects.filter(username__iexact=username)
        if user:
            qs = qs.exclude(pk=user.id)
            
        if qs.exists():
            raise ValidationError("This username is already taken.")
        return username

    def update(self, instance, validated_data):
        with transaction.atomic():
            user = instance.user
            
            # Update Username
            if 'username' in validated_data and user:
                user.username = validated_data['username']
                user.save(update_fields=['username'])

            # Update Password if provided
            new_password = validated_data.get('password')
            if new_password and user:
                user.set_password(new_password)
                user.save()

            # Update Status (Active / Inactive)
            status_val = validated_data.get('status') or validated_data.get('account_status')
            if status_val:
                is_active = (status_val == 'ACTIVE')
                instance.status = is_active
                instance.employment_status = 'ACTIVE' if is_active else 'INACTIVE'
                instance.save(update_fields=['status', 'employment_status'])
                if user:
                    user.is_active = is_active
                    user.save(update_fields=['is_active'])

            # Update Full Name
            if 'full_name' in validated_data and validated_data['full_name']:
                instance.full_name = validated_data['full_name'].strip()
                instance.save(update_fields=['full_name'])

            # Check company update
            raw_company = self.initial_data.get('company_id') or self.initial_data.get('company')
            if raw_company is not None:
                if str(raw_company).upper() in ('ALL', 'ALL_COMPANIES', '0', '-1'):
                    instance.branch = None
                    instance.save(update_fields=['branch'])
                    if user:
                        user.company = None
                        user.save(update_fields=['company'])
                else:
                    try:
                        new_comp = Company.objects.filter(pk=int(raw_company)).first()
                        if new_comp and user:
                            user.company = new_comp
                            user.save(update_fields=['company'])
                    except (ValueError, TypeError):
                        pass

            # Update Branch if provided
            branch_id = validated_data.get('branch_id') or self.initial_data.get('branch')
            if branch_id is not None:
                if branch_id in (0, '0', -1, '-1', None, ''):
                    instance.branch = None
                    instance.save(update_fields=['branch'])
                else:
                    try:
                        new_branch = Branch.objects.filter(pk=branch_id).first()
                        if new_branch:
                            instance.branch = new_branch
                            instance.save(update_fields=['branch'])
                            if user and new_branch.company:
                                user.company = new_branch.company
                                user.save(update_fields=['company'])
                    except Exception as e:
                        logger.warning(f"Failed to update manager branch: {e}")

        return instance


class ResetManagerPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(required=True, min_length=6, write_only=True)
    confirm_password = serializers.CharField(required=True, min_length=6, write_only=True)

    def validate(self, attrs):
        if attrs.get('new_password') != attrs.get('confirm_password'):
            raise ValidationError({"confirm_password": "Passwords do not match."})
        return attrs


class AssignTeamMembersSerializer(serializers.Serializer):
    assigned_employee_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=True,
        allow_empty=True
    )

    def save(self):
        manager = self.context.get('manager')
        request = self.context.get('request')
        assigned_ids = self.validated_data.get('assigned_employee_ids', [])

        if not manager:
            return

        with transaction.atomic():
            # Find currently assigned employees not in new list
            current_ids = set(manager.direct_reports.values_list('id', flat=True))
            new_ids = set(assigned_ids)

            # Employees to unassign
            to_unassign = current_ids - new_ids
            if to_unassign:
                Employee.objects.filter(id__in=to_unassign, reporting_manager=manager).update(reporting_manager=None)
                TeamAssignmentHistory.objects.filter(
                    manager=manager,
                    employee_id__in=to_unassign,
                    is_active=True
                ).update(is_active=False, unassigned_at=timezone.now())

            # Employees to assign
            to_assign = new_ids - current_ids
            if to_assign:
                assigned_qs = Employee.objects.filter(id__in=to_assign)
                assigned_qs.update(reporting_manager=manager)
                # Resolve company from manager's branch or user, or request user
                company = None
                if getattr(manager, 'branch', None) and getattr(manager.branch, 'company', None):
                    company = manager.branch.company
                elif getattr(manager, 'user', None) and getattr(manager.user, 'company', None):
                    company = manager.user.company
                elif request and hasattr(request, 'user') and getattr(request.user, 'company', None):
                    company = request.user.company
                else:
                    from companies.models import Company
                    company = Company.objects.first()

                for emp in assigned_qs:
                    emp_company = (
                        (emp.branch.company if emp.branch and getattr(emp.branch, 'company', None) else None)
                        or (emp.user.company if emp.user and getattr(emp.user, 'company', None) else None)
                        or company
                    )
                    TeamAssignmentHistory.objects.create(
                        company=emp_company,
                        manager=manager,
                        employee=emp,
                        assigned_by=request.user if request and request.user.is_authenticated else None,
                        is_active=True
                    )
