from rest_framework import serializers
from .models import Employee
from accounts.models import User
from accounts.serializers import UserSerializer
import random
import re
from django.db import transaction
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

def get_company_shortform(company=None):
    """
    Returns company shortform code (e.g. 'AH', 'ACF', 'YZ', 'NEO', 'EMP').
    Uses company.code if set; otherwise generates uppercase abbreviation from company name.
    """
    if not company:
        return 'EMP'
    code = getattr(company, 'code', None)
    if code and str(code).strip():
        return re.sub(r'[^A-Za-z0-9]', '', str(code).strip()).upper()
    name = getattr(company, 'name', '') or ''
    words = [
        w for w in re.split(r'[^a-zA-Z0-9]+', name)
        if w and w.lower() not in ('india', 'private', 'limited', 'pvt', 'ltd', 'company', 'co')
    ]
    if len(words) >= 2:
        return ''.join(w[0] for w in words[:4]).upper()
    elif len(words) == 1:
        return words[0][:3].upper()
    return 'EMP'

def generate_next_employee_id(company=None, joining_date=None):
    """
    Generates the next sequential employee ID based on company shortform code and Date of Joining (DOJ).
    Format: {PREFIX}{XXX} (e.g. AH044, AH001, ACF001, YZ001, NEO001, EMP001).
    Calculates candidate sequential number from joining_date chronological order among company employees,
    skipping any numbers already taken.
    """
    prefix = get_company_shortform(company)

    # Collect existing numeric suffixes for this prefix
    used_numbers = set()
    for eid in Employee.objects.filter(employee_id__istartswith=prefix).values_list('employee_id', flat=True):
        m = re.match(rf'^{re.escape(prefix)}(\d+)$', str(eid).strip(), re.IGNORECASE)
        if m:
            used_numbers.add(int(m.group(1)))

    if company:
        company_emps = Employee.objects.filter(branch__company=company)
    else:
        company_emps = Employee.objects.filter(employee_id__istartswith=prefix)

    if joining_date:
        count_prior = company_emps.filter(joining_date__lt=joining_date).count()
        count_same = company_emps.filter(joining_date=joining_date).count()
        candidate_num = count_prior + count_same + 1
    else:
        candidate_num = company_emps.count() + 1

    while candidate_num in used_numbers:
        candidate_num += 1

    return f"{prefix}{candidate_num:03d}"

class EmployeeSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    employee_id = serializers.CharField(required=False, allow_blank=True)
    phone_number = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False)
    confirm_password = serializers.CharField(write_only=True, required=False)
    company = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = Employee
        fields = '__all__'

    def validate(self, data):
        company_id = data.pop('company', None)
        self._company_id = company_id
        branch = data.get('branch', self.instance.branch if self.instance else None)
        request = self.context.get('request')
        user = getattr(request, 'user', None)

        if company_id is not None and branch is not None:
            if branch.company_id != company_id:
                raise serializers.ValidationError({
                    "branch": "The selected branch does not belong to the selected company."
                })

        if user and user.is_authenticated and user.role == 'HR':
            if not user.company_id:
                raise serializers.ValidationError({
                    "company": "Your HR account is not assigned to a company."
                })
            if branch is None or branch.company_id != user.company_id:
                raise serializers.ValidationError({
                    "branch": "You can only manage employees in your assigned company."
                })
            if company_id is not None and company_id != user.company_id:
                raise serializers.ValidationError({
                    "company": "You can only select your assigned company."
                })
        
        email = data.get('email')
        if email:
            data['email'] = email.strip().lower()

        phone_number = data.get('phone_number')
        if phone_number:
            qs = User.objects.filter(phone_number=phone_number)
            if self.instance and self.instance.user:
                qs = qs.exclude(pk=self.instance.user.pk)
            if qs.exists():
                raise serializers.ValidationError({"phone_number": "This phone number is already registered."})
            
        password = data.get('password')
        confirm_password = data.get('confirm_password')
        
        if password:
            if confirm_password and password != confirm_password:
                raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
            try:
                validate_password(password)
            except DjangoValidationError as e:
                raise serializers.ValidationError({"password": list(e.messages)})
            
        profile_photo = data.get('profile_photo')
        if profile_photo:
            from attendance.services import normalize_image_orientation
            data['profile_photo'] = normalize_image_orientation(profile_photo)

        return data

    def validate_education_details(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Education details must be a list."
            )
        if any(not isinstance(item, dict) for item in value):
            raise serializers.ValidationError(
                "Each education entry must be an object."
            )
        return value

    def validate_previous_employment_details(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Previous employment details must be a list."
            )
        if any(not isinstance(item, dict) for item in value):
            raise serializers.ValidationError(
                "Each previous employment entry must be an object."
            )
        return value

    def create(self, validated_data):
        phone_number = validated_data.pop('phone_number', None)
        if not phone_number:
            phone_number = f"9999{random.randint(100000, 999999)}"

        password = validated_data.pop('password', None)
        validated_data.pop('confirm_password', None)
        if not password:
            password = User.objects.make_random_password()

        with transaction.atomic():
            joining_date = validated_data.get('joining_date')
            if not joining_date:
                from django.utils import timezone
                joining_date = timezone.localdate()
                validated_data['joining_date'] = joining_date

            provided_id = validated_data.get('employee_id')
            if provided_id and str(provided_id).strip() and str(provided_id).strip() not in ('Auto Generated by Server', '--'):
                provided_id = str(provided_id).strip()
                if Employee.objects.filter(employee_id=provided_id).exists():
                    raise serializers.ValidationError({"employee_id": f"Employee ID '{provided_id}' is already in use."})
                validated_data['employee_id'] = provided_id
            else:
                branch = validated_data.get('branch')
                company = None
                if branch and getattr(branch, 'company', None):
                    company = branch.company
                elif getattr(self, '_company_id', None):
                    from companies.models import Company
                    company = Company.objects.filter(id=self._company_id).first()
                validated_data['employee_id'] = generate_next_employee_id(company=company, joining_date=joining_date)

            employment_status = validated_data.get('employment_status', 'ACTIVE')
            validated_data['status'] = employment_status == 'ACTIVE'

            user = User.objects.create_user(
                phone_number=phone_number,
                password=password,
                role='EMPLOYEE',
            )
            employee = Employee.objects.create(user=user, **validated_data)

        return employee

    def update(self, instance, validated_data):
        new_emp_id = validated_data.pop('employee_id', None)
        if new_emp_id and str(new_emp_id).strip() and str(new_emp_id).strip() not in ('Auto Generated by Server', '--'):
            new_emp_id = str(new_emp_id).strip()
            if new_emp_id != instance.employee_id:
                if Employee.objects.filter(employee_id=new_emp_id).exclude(pk=instance.pk).exists():
                    raise serializers.ValidationError({"employee_id": f"Employee ID '{new_emp_id}' is already in use."})
                instance.employee_id = new_emp_id
                instance.save(update_fields=['employee_id'])

        phone_number = validated_data.pop('phone_number', None)
        password = validated_data.pop('password', None)

        if phone_number:
            instance.user.phone_number = phone_number
            instance.user.save(update_fields=['phone_number'])

        if password:
            instance.user.set_password(password)
            instance.user.save(update_fields=['password'])

        if 'employment_status' in validated_data:
            validated_data['status'] = validated_data['employment_status'] == 'ACTIVE'
        elif 'status' in validated_data:
            validated_data['employment_status'] = (
                'ACTIVE' if validated_data['status'] else 'RESIGNED'
            )

        return super().update(instance, validated_data)

    def to_representation(self, instance):
        response = super().to_representation(instance)

        response['phone_number'] = instance.user.phone_number if instance.user else None
        response['email'] = instance.email
        response['role'] = getattr(instance.user, 'role', 'EMPLOYEE')
        response['name'] = instance.full_name

        company = None
        if instance.branch and instance.branch.company:
            company = instance.branch.company
        elif instance.user and instance.user.company:
            company = instance.user.company

        request = self.context.get('request')

        logo_url = None
        if company and company.logo:
            if request:
                uri = request.build_absolute_uri(company.logo.url)
                if uri.startswith('http://hrms.yaazh360digitech.in'):
                    uri = uri.replace('http://', 'https://', 1)
                logo_url = uri
            else:
                logo_url = company.logo.url

        response['company_name'] = company.name if company else None
        response['company_logo'] = logo_url

        response['company'] = (
            {
                'id': company.id,
                'name': company.name,
                'logo': logo_url,
            }
            if company
            else None
        )

        response['branch'] = (
            {
                'id': instance.branch.id,
                'branch_name': instance.branch.branch_name,
                'office_address': instance.branch.office_address,
            }
            if instance.branch
            else None
        )

        response['shift'] = (
            {
                'id': instance.shift.id,
                'name': instance.shift.name,
                'code': instance.shift.code,
                'start_time': instance.shift.start_time.isoformat() if instance.shift.start_time else None,
                'end_time': instance.shift.end_time.isoformat() if instance.shift.end_time else None,
                'grace_period': instance.shift.grace_period,
                'is_active': instance.shift.is_active,
            }
            if instance.shift
            else None
        )

        if instance.team_leader:
            response['team_leader_details'] = {
                'id': instance.team_leader.id,
                'employee_id': instance.team_leader.employee_id,
                'full_name': instance.team_leader.full_name,
                'designation': instance.team_leader.designation,
                'department': instance.team_leader.department,
            }
        else:
            response['team_leader_details'] = None

        assigned = instance.team_members.filter(status=True)
        response['assigned_team_members'] = [
            {
                'id': m.id,
                'employee_id': m.employee_id,
                'full_name': m.full_name,
                'designation': m.designation,
                'department': m.department,
            }
            for m in assigned
        ]
        response['team_members_count'] = assigned.count()

        return response
