from rest_framework import serializers
from django.utils import timezone
from companies.models import Company
from .models import (
    Attendance,
    AttendancePolicy,
    Shift,
    PermissionRequest,
    LeaveRequest,
    WFHRequest,
    Holiday,
    EmployeePersonalAlarm)

class HolidaySerializer(serializers.ModelSerializer):
    company = serializers.PrimaryKeyRelatedField(
        queryset=Company.objects.all(),
        required=False,
        allow_null=True,
        default=serializers.empty,
    )
    company_name = serializers.CharField(source='company.name', read_only=True)

    class Meta:
        model = Holiday
        fields = "__all__"
        validators = []

    def validate(self, attrs):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication is required.")

        user = request.user
        role = user.role

        if role == "EMPLOYEE":
            raise serializers.ValidationError(
                "Employees can only view holidays."
            )

        company = attrs.get(
            "company",
            getattr(self.instance, "company", None),
        )

        if role != "SUPER_ADMIN":
            user_company = getattr(user, "company", None)

            if user_company is None and hasattr(user, "employee_profile"):
                employee = user.employee_profile
                if employee.branch_id:
                    user_company = employee.branch.company

            if user_company is None:
                # Fallback to first available company
                user_company = Company.objects.first()

            if user_company is None:
                raise serializers.ValidationError(
                    "Your account is not assigned to a company."
                )

            if company is not None and company.pk != user_company.pk:
                raise serializers.ValidationError(
                    "You can only manage holidays for your own company."
                )

            company = user_company

        elif company is None:
            # For SUPER_ADMIN, default to employee branch company or first active company
            user_company = getattr(user, "company", None)
            if user_company is None and hasattr(user, "employee_profile"):
                employee = user.employee_profile
                if employee and employee.branch_id:
                    user_company = employee.branch.company
            if user_company is None:
                user_company = Company.objects.first()

            if user_company:
                company = user_company
            else:
                raise serializers.ValidationError(
                    {"company": "Select a company for this holiday."}
                )

        attrs["company"] = company

        holiday_date = attrs.get(
            "date",
            getattr(self.instance, "date", None),
        )

        if company is not None and holiday_date is not None:
            duplicates = Holiday.objects.filter(
                company=company,
                date=holiday_date,
            )
            if self.instance:
                duplicates = duplicates.exclude(pk=self.instance.pk)

            if duplicates.exists():
                raise serializers.ValidationError(
                    {"date": "A holiday already exists for this company on this date."}
                )

        return attrs


class ShiftSerializer(serializers.ModelSerializer):
    employee_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Shift
        fields = '__all__'

    def validate_code(self, value):
        if not value:
            raise serializers.ValidationError("Shift code is required.")
        return value.upper()

    def validate_name(self, value):
        if not value:
            raise serializers.ValidationError("Shift name is required.")
        return value

    def validate_grace_period(self, value):
        if value < 0:
            raise serializers.ValidationError("Grace period cannot be negative.")
        if value > 120:
            raise serializers.ValidationError("Grace period is unreasonably large.")
        return value

class EmployeePersonalAlarmSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeePersonalAlarm
        fields = ['id', 'label', 'alarm_time', 'is_enabled', 'days_of_week', 'specific_dates', 'timezone', 'updated_at']
        read_only_fields = ['id', 'updated_at']

    def validate_alarm_time(self, value):
        if not value:
            raise serializers.ValidationError("Alarm time is required.")
        return value



class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = '__all__'

    def to_representation(self, instance):
        response = super().to_representation(instance)
        employee = getattr(instance, 'employee', None)
        if employee:
            branch = employee.branch
            company = branch.company if branch else None
            shift = employee.shift

            response['employee'] = {
                'id': employee.id,
                'full_name': employee.full_name,
                'employee_id': employee.employee_id,
                'department': getattr(employee, 'department', None),
                'designation': getattr(employee, 'designation', None),
                'work_type': getattr(employee, 'work_type', None),
                'phone_number': (
                    getattr(employee.user, 'phone_number', None)
                    if getattr(employee, 'user', None)
                    else None
                ),
                'branch': (
                    {
                        'id': branch.id,
                        'name': branch.branch_name,
                        'branch_name': branch.branch_name,
                    }
                    if branch else None
                ),
                'company': (
                    {
                        'id': company.id,
                        'name': company.name,
                    }
                    if company else None
                ),
                'shift': (
                    {
                        'id': shift.id,
                        'name': shift.name,
                    }
                    if shift else None
                ),
            }
        # Format check-in and check-out to ISO strings and map keys
        # Use timezone.localtime so timezone offset matches user's local timezone (+05:30)
        if instance.check_in:
            response['check_in_time'] = timezone.localtime(instance.check_in).isoformat()
        else:
            response['check_in_time'] = None
            
        if instance.check_out:
            response['check_out_time'] = timezone.localtime(instance.check_out).isoformat()
        else:
            response['check_out_time'] = None
            
        if 'check_in' in response:
            del response['check_in']
        if 'check_out' in response:
            del response['check_out']
            
        # Formatting utility
        def format_duration(minutes):
            if not minutes or minutes <= 0:
                return "On time"
            
            h = minutes // 60
            m = minutes % 60
            
            if h == 0:
                return f"{m}m"
            elif m == 0:
                return f"{h}h"
            else:
                return f"{h}h {m}m"

        response['late_display'] = format_duration(instance.late_minutes)

        # Consistent overall status calculation:
        from attendance.services import get_employee_attendance_status
        response['calculated_status'] = get_employee_attendance_status(
            record=instance,
            employee=employee,
            target_date=instance.date,
        )

        # Approved permission details for this attendance date.
        permission_items = []
        if employee and instance.date:
            approved_permissions = PermissionRequest.objects.filter(
                employee=employee,
                date=instance.date,
                status='APPROVED',
            ).order_by('start_time')

            for permission in approved_permissions:
                permission_items.append({
                    'id': permission.id,
                    'date': permission.date.isoformat(),
                    'status': permission.status,
                    'start_time': (
                        permission.start_time.strftime('%H:%M')
                        if permission.start_time else None
                    ),
                    'end_time': (
                        permission.end_time.strftime('%H:%M')
                        if permission.end_time else None
                    ),
                    'duration_minutes': permission.duration_minutes,
                    'approved_at': (
                        permission.approved_at.isoformat()
                        if permission.approved_at else None
                    ),
                })

        response['approved_permissions'] = permission_items
        response['permission_minutes'] = sum(
            item['duration_minutes'] for item in permission_items
        )

        if instance.check_in and instance.check_out:
            # We already calculated working_minutes in CheckOutView
            working_mins = getattr(instance, 'working_minutes', 0)
            if working_mins <= 0:
                # Fallback if working_minutes was 0 but they are checked out
                diff = instance.check_out - instance.check_in
                working_mins = int(diff.total_seconds() // 60)
            
            if working_mins <= 0:
                response['working_hours'] = "0m"
            else:
                h = working_mins // 60
                m = working_mins % 60
                if h == 0:
                    response['working_hours'] = f"{m}m"
                elif m == 0:
                    response['working_hours'] = f"{h}h 00m" # keep 00m for working hours if needed, or just h
                else:
                    response['working_hours'] = f"{h}h {m}m"
        else:
            response['working_hours'] = None

        response['late_reason'] = getattr(instance, 'late_reason', None)

        # Provide direct API endpoints for photos as robust fallbacks
        if instance.check_in_photo:
            response['check_in_photo_endpoint'] = f"/api/attendance/{instance.id}/check-in-photo/"
        else:
            response['check_in_photo_endpoint'] = None

        if instance.check_out_photo:
            response['check_out_photo_endpoint'] = f"/api/attendance/{instance.id}/check-out-photo/"
        else:
            response['check_out_photo_endpoint'] = None

        return response

class CheckInSerializer(serializers.Serializer):
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    accuracy = serializers.FloatField()
    photo = serializers.ImageField()
    late_reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)

class CheckOutSerializer(serializers.Serializer):
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    accuracy = serializers.FloatField()
    photo = serializers.ImageField()


class PermissionRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(
        source='employee.full_name',
        read_only=True
    )
    employee_id = serializers.CharField(
        source='employee.employee_id',
        read_only=True
    )
    approved_by_name = serializers.SerializerMethodField()
    duration_minutes = serializers.IntegerField(required=False)

    class Meta:
        model = PermissionRequest
        fields = '__all__'
        read_only_fields = [
            'employee',
            'status',
            'approved_by',
            'approved_at',
            'rejection_reason',
            'created_at',
            'updated_at',
        ]

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.username
        return None

    def validate_duration_minutes(self, value):
        if value not in [30, 60]:
            raise serializers.ValidationError(
                "Permission duration must be 30 or 60 minutes."
            )
        return value

    def validate(self, attrs):
        request = self.context.get('request')
        instance = self.instance
        start_time = attrs.get(
            'start_time', instance.start_time if instance else None
        )
        end_time = attrs.get(
            'end_time', instance.end_time if instance else None
        )

        if start_time is not None or end_time is not None:
            if start_time is None or end_time is None:
                raise serializers.ValidationError({
                    'start_time': 'Both start time and end time are required.'
                })

            start_minutes = start_time.hour * 60 + start_time.minute
            end_minutes = end_time.hour * 60 + end_time.minute
            duration = end_minutes - start_minutes

            if duration not in [30, 60]:
                raise serializers.ValidationError({
                    'end_time': 'Permission duration must be exactly 30 or 60 minutes.'
                })

            attrs['duration_minutes'] = duration
        elif request and request.method == 'POST':
            raise serializers.ValidationError({
                'start_time': 'Start time and end time are required.'
            })
        elif instance:
            attrs['duration_minutes'] = instance.duration_minutes

        if not request or not hasattr(request.user, 'employee_profile'):
            return attrs

        from django.db.models import Sum

        employee = request.user.employee_profile
        date = attrs.get('date', instance.date if instance else None)
        duration = attrs.get(
            'duration_minutes',
            instance.duration_minutes if instance else 0
        )

        if not date:
            raise serializers.ValidationError({
                'date': 'Permission date is required.'
            })

        daily_queryset = PermissionRequest.objects.filter(
            employee=employee,
            date=date,
            status__in=['PENDING', 'APPROVED']
        )
        if instance:
            daily_queryset = daily_queryset.exclude(pk=instance.pk)
        daily_minutes = daily_queryset.aggregate(
            total=Sum('duration_minutes')
        )['total'] or 0

        if daily_minutes + duration > 60:
            raise serializers.ValidationError({
                'duration_minutes':
                    f'Daily permission limit is 60 minutes. '
                    f'Already requested/approved: {daily_minutes} minutes.'
            })

        from attendance.services import get_cycle_for_date

        cycle_year, cycle_month, cycle_start, cycle_end = get_cycle_for_date(date)

        cycle_queryset = PermissionRequest.objects.filter(
            employee=employee,
            date__gte=cycle_start,
            date__lte=cycle_end,
            status__in=['PENDING', 'APPROVED']
        )
        if instance:
            cycle_queryset = cycle_queryset.exclude(pk=instance.pk)
        cycle_minutes = cycle_queryset.aggregate(
            total=Sum('duration_minutes')
        )['total'] or 0

        if cycle_minutes + duration > 180:
            raise serializers.ValidationError({
                'duration_minutes':
                    f'Permission limit for this attendance cycle is 180 minutes. '
                    f'Already requested/approved: {cycle_minutes} minutes.'
            })

        return attrs


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(
        source='employee.full_name',
        read_only=True
    )
    employee_id = serializers.CharField(
        source='employee.employee_id',
        read_only=True
    )
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = '__all__'
        read_only_fields = [
            'employee',
            'status',
            'approved_by',
            'approved_at',
            'rejection_reason',
            'created_at',
            'updated_at',
        ]

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.username
        return None

    def validate(self, attrs):
        instance = self.instance
        leave_type = attrs.get('leave_type', instance.leave_type if instance else None)
        start_date = attrs.get(
            'start_date', instance.start_date if instance else None
        )
        end_date = attrs.get(
            'end_date', instance.end_date if instance else None
        )

        # Automatically default end_date to start_date if HALF_DAY or omitted
        if leave_type == 'HALF_DAY' and start_date and not end_date:
            attrs['end_date'] = start_date
            end_date = start_date

        if start_date and not end_date:
            attrs['end_date'] = start_date
            end_date = start_date

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({
                'end_date': 'End date cannot be before start date.'
            })

        request = self.context.get('request')

        if request and hasattr(request.user, 'employee_profile'):
            employee = request.user.employee_profile

            overlapping = LeaveRequest.objects.filter(
                employee=employee,
                status__in=['PENDING', 'APPROVED'],
                start_date__lte=end_date,
                end_date__gte=start_date,
            )

            if self.instance:
                overlapping = overlapping.exclude(pk=self.instance.pk)

            if overlapping.exists():
                raise serializers.ValidationError({
                    'date':
                        'You already have a pending or approved leave '
                        'for one or more selected dates.'
                })

        return attrs

class WFHRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(
        source='employee.full_name',
        read_only=True
    )
    employee_id = serializers.CharField(
        source='employee.employee_id',
        read_only=True
    )
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = WFHRequest
        fields = '__all__'
        read_only_fields = [
            'employee',
            'status',
            'approved_by',
            'approved_at',
            'rejection_reason',
            'created_at',
            'updated_at',
        ]

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.username
        return None

    def validate_date(self, value):
        from django.utils import timezone

        if value < timezone.localdate():
            raise serializers.ValidationError(
                "WFH requests cannot be submitted for past dates."
            )
        return value

    def validate(self, attrs):
        request = self.context.get('request')
        if not request or not hasattr(request.user, 'employee_profile'):
            return attrs

        employee = request.user.employee_profile
        selected_date = attrs.get(
            'date',
            self.instance.date if self.instance else None
        )

        if selected_date is None:
            return attrs

        existing = WFHRequest.objects.filter(
            employee=employee,
            date=selected_date,
            status__in=['PENDING', 'APPROVED']
        )
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)

        if existing.exists():
            raise serializers.ValidationError({
                'date': 'You already have a pending or approved WFH request for this date.'
            })

        return attrs
