from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q, Sum
from datetime import date, timedelta
import calendar
from .models import Employee
from attendance.models import Holiday, PermissionRequest
from .serializers import EmployeeSerializer

class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (
                user.role in ('SUPER_ADMIN', 'ADMIN')
                or (user.role == 'HR' and user.company_id is not None)
            )
        )

from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAdminUser]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_permissions(self):
        if self.action == 'me':
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = super().get_queryset().select_related(
            'user', 'branch', 'branch__company', 'shift'
        )
        user = self.request.user

        if user.role == 'HR':
            queryset = queryset.filter(branch__company_id=user.company_id)
        elif user.role not in ('SUPER_ADMIN', 'ADMIN'):
            return queryset.none()

        company_id = self.request.query_params.get('company')
        branch_id = self.request.query_params.get('branch')

        if company_id is not None:
            queryset = queryset.filter(branch__company_id=company_id)
        if branch_id is not None:
            queryset = queryset.filter(branch_id=branch_id)

        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        branch = serializer.validated_data.get('branch')

        if user.role == 'HR':
            if not user.company_id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('Your account is not assigned to a company.')
            if not branch or branch.company_id != user.company_id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('You can only create employees in your assigned company.')

        serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        branch = serializer.validated_data.get(
            'branch',
            serializer.instance.branch,
        )

        if user.role == 'HR':
            if not user.company_id or not branch or branch.company_id != user.company_id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('You can only manage employees in your assigned company.')

        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        employee_id = instance.employee_id
        employee_name = instance.full_name

        instance.delete()

        return Response(
            {
                "message": "Employee permanently deleted.",
                "employee_id": employee_id,
                "employee_name": employee_name
            },
            status=status.HTTP_204_NO_CONTENT
        )

    @action(detail=False, methods=['get', 'patch'], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        employee = getattr(request.user, 'employee_profile', None)
        if not employee:
            # Auto-create profile if missing for any authenticated user so they have a full profile & photo support
            from .models import Branch, Employee
            branch = Branch.objects.first()
            role_name = getattr(request.user, 'role', None) or ('ADMIN' if request.user.is_superuser else 'EMPLOYEE')
            desig = 'Super Administrator' if role_name == 'SUPER_ADMIN' else ('HR Manager' if role_name == 'HR' else ('Reporting Manager' if role_name == 'REPORTING_MANAGER' else ('Team Leader' if role_name == 'TEAM_LEADER' else 'Staff')))
            dept = 'Administration' if role_name in ('SUPER_ADMIN', 'ADMIN') else ('Human Resources' if role_name == 'HR' else ('Management' if role_name == 'REPORTING_MANAGER' else 'General'))
            employee = Employee.objects.create(
                user=request.user,
                employee_id=f"EMP-{role_name}-{request.user.id:03d}",
                full_name=request.user.get_full_name() or request.user.username,
                email=request.user.email or f"{request.user.username}@example.com",
                branch=branch,
                department=dept,
                designation=desig
            )
            
        if request.method == 'GET':
            serializer = self.get_serializer(employee)
            return Response(serializer.data)
            
        elif request.method == 'PATCH':
            allowed_fields = ['full_name', 'profile_photo']
            data = {k: v for k, v in request.data.items() if k in allowed_fields}
            serializer = self.get_serializer(employee, data=data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)


    @action(
        detail=True,
        methods=['get'],
        url_path='monthly-attendance',
        permission_classes=[IsAdminUser]
    )
    def monthly_attendance(self, request, pk=None):
        """
        Return employee monthly attendance calendar data.

        Rules:
        - Future dates -> UPCOMING
        - Approved leave -> leave status
        - Completed attendance -> PRESENT
        - Current day checked-in without checkout -> WORKING
        - Previous working day with incomplete/no attendance -> ABSENT
        - Weekends -> WEEKEND
        - Late/early/overtime/working minutes come from Attendance
        """

        employee = self.get_object()

        # Month / year validation
        try:
            year = int(request.query_params.get('year', timezone.localdate().year))
            month = int(request.query_params.get('month', timezone.localdate().month))
        except (TypeError, ValueError):
            return Response(
                {
                    "code": "INVALID_DATE",
                    "message": "Month and year must be valid numbers."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if month < 1 or month > 12:
            return Response(
                {
                    "code": "INVALID_MONTH",
                    "message": "Month must be between 1 and 12."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if year < 2000 or year > 2100:
            return Response(
                {
                    "code": "INVALID_YEAR",
                    "message": "Invalid year."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        from attendance.services import get_attendance_cycle

        month_start, month_end = get_attendance_cycle(year, month)

        today = timezone.localdate()

        # Attendance records for this employee/month
        attendance_records = {
            attendance.date: attendance
            for attendance in employee.attendances.filter(
                date__gte=month_start,
                date__lte=month_end
            ).select_related('employee', 'employee__branch', 'employee__shift')
        }

        # Approved leaves overlapping this month
        leave_requests = employee.leave_requests.filter(
            status='APPROVED',
            start_date__lte=month_end,
            end_date__gte=month_start
        ).order_by('start_date')

        # Build leave lookup by date.
        leave_by_date = {}

        for leave in leave_requests:
            current = max(leave.start_date, month_start)
            leave_end = min(leave.end_date, month_end)

            while current <= leave_end:
                # First approved leave wins if overlapping data somehow exists.
                if current not in leave_by_date:
                    leave_by_date[current] = leave
                current += timedelta(days=1)

        # Active holidays for this employee's company/month
        holiday_records = Holiday.objects.filter(
            date__gte=month_start,
            date__lte=month_end,
            is_active=True
        )
        emp_company = employee.branch.company if employee.branch else None
        if emp_company:
            holiday_records = holiday_records.filter(company=emp_company)
        else:
            holiday_records = holiday_records.none()

        holiday_by_date = {
            holiday.date: holiday
            for holiday in holiday_records
        }

        days = []

        summary = {
            "holidays": 0,
            "grace_used_count": 0,
            "grace_used_minutes": 0,
            "grace_limit": 3,
            "grace_limit_minutes": 30,
            "monthly_permission_limit_minutes": 180,
            "monthly_permission_remaining_minutes": 180,
            "present": 0,
            "absent": 0,
            "working": 0,
            "upcoming": 0,
            "casual_leave": 0,
            "sick_leave": 0,
            "half_day_leave": 0,
            "personal_leave": 0,
            "other_leave": 0,
            "late_days": 0,
            "total_late_minutes": 0,
            "early_checkout_days": 0,
            "total_early_minutes": 0,
            "overtime_days": 0,
            "total_overtime_minutes": 0,
            "total_working_minutes": 0,
        }

        cycle_days = (month_end - month_start).days + 1

        for day_offset in range(cycle_days):
            current_date = month_start + timedelta(days=day_offset)

            attendance = attendance_records.get(current_date)
            leave = leave_by_date.get(current_date)

            item = {
                "date": current_date.isoformat(),
                "day": current_date.strftime("%A"),
                "status": None,
                "check_in": None,
                "check_out": None,
                "late_minutes": 0,
                "early_minutes": 0,
                "overtime_minutes": 0,
                "working_minutes": 0,
                "shift_name": (
                    employee.shift.name
                    if employee.shift
                    else None
                ),
                "shift_start": (
                    employee.shift.start_time.isoformat()
                    if employee.shift and employee.shift.start_time
                    else None
                ),
                "shift_end": (
                    employee.shift.end_time.isoformat()
                    if employee.shift and employee.shift.end_time
                    else None
                ),
                "leave_type": None,
                "leave_type_label": None,
                "leave_reason": None,
                "holiday_name": None,
                "holiday_description": None,
                "is_weekend": current_date.weekday() == 6,
            }

            # -------------------------------------------------
            # 1. ACTUAL ATTENDANCE RECORD HAS FIRST PRIORITY
            # (Works on Sundays/Holidays must take priority over Weekly Off or Holiday)
            # -------------------------------------------------
            if attendance and attendance.check_in:
                if attendance.check_in:
                    item["check_in"] = timezone.localtime(
                        attendance.check_in
                    ).isoformat()

                if attendance.check_out:
                    item["check_out"] = timezone.localtime(
                        attendance.check_out
                    ).isoformat()

                item["late_minutes"] = attendance.late_minutes or 0
                item["early_minutes"] = attendance.early_minutes or 0
                item["overtime_minutes"] = attendance.overtime_minutes or 0
                item["working_minutes"] = attendance.working_minutes or 0

                # Current day checked in but not checked out -> WORKING
                if (
                    current_date == today
                    and attendance.check_in
                    and not attendance.check_out
                ):
                    item["status"] = "WORKING"
                    summary["working"] += 1

                # Completed full attendance -> PRESENT
                elif attendance.check_in and attendance.check_out:
                    item["status"] = "PRESENT"
                    summary["present"] += 1

                # Checked in without checkout on past date -> PRESENT
                else:
                    item["status"] = "PRESENT"
                    summary["present"] += 1

                # Late statistics
                if attendance.late_minutes and attendance.late_minutes > 0:
                    summary["late_days"] += 1
                    summary["total_late_minutes"] += attendance.late_minutes

                # Early checkout statistics
                if attendance.early_minutes and attendance.early_minutes > 0:
                    summary["early_checkout_days"] += 1
                    summary["total_early_minutes"] += attendance.early_minutes

                # Overtime statistics
                if attendance.overtime_minutes and attendance.overtime_minutes > 0:
                    summary["overtime_days"] += 1
                    summary["total_overtime_minutes"] += attendance.overtime_minutes

                summary["total_working_minutes"] += (
                    attendance.working_minutes or 0
                )

                days.append(item)
                continue

            # -------------------------------------------------
            # 2. APPROVED LEAVE
            # -------------------------------------------------
            if leave:
                leave_type = leave.leave_type

                labels = {
                    "CASUAL": "Casual Leave",
                    "SICK": "Sick Leave",
                    "HALF_DAY": "Half Day Leave",
                    "PERSONAL": "Personal Leave",
                    "OTHER": "Other Leave",
                }

                item["leave_type"] = leave_type
                item["leave_type_label"] = labels.get(
                    leave_type,
                    leave_type.replace("_", " ").title()
                )
                item["leave_reason"] = leave.reason

                if leave_type == "CASUAL":
                    item["status"] = "CASUAL_LEAVE"
                    summary["casual_leave"] += 1

                elif leave_type == "SICK":
                    item["status"] = "SICK_LEAVE"
                    summary["sick_leave"] += 1

                elif leave_type == "HALF_DAY":
                    item["status"] = "HALF_DAY"
                    summary["half_day_leave"] += 1

                elif leave_type == "PERSONAL":
                    item["status"] = "PERSONAL_LEAVE"
                    summary["personal_leave"] += 1

                else:
                    item["status"] = "OTHER_LEAVE"
                    summary["other_leave"] += 1

                days.append(item)
                continue

            # -------------------------------------------------
            # 3. HOLIDAY
            # -------------------------------------------------
            holiday = holiday_by_date.get(current_date)

            if holiday:
                item["status"] = "HOLIDAY"
                item["holiday_name"] = holiday.name
                item["holiday_description"] = holiday.description
                summary["holidays"] += 1

                days.append(item)
                continue

            # -------------------------------------------------
            # 4. FUTURE DATE
            # -------------------------------------------------
            if current_date > today:
                item["status"] = "UPCOMING"
                summary["upcoming"] += 1
                days.append(item)
                continue

            # -------------------------------------------------
            # 5. WEEKEND (Sunday)
            # -------------------------------------------------
            if current_date.weekday() == 6:
                item["status"] = "WEEKEND"
                days.append(item)
                continue

            # -------------------------------------------------
            # 6. NO ATTENDANCE = ABSENT
            # -------------------------------------------------
            item["status"] = "ABSENT"
            summary["absent"] += 1

            days.append(item)

        # Approved leave and permission totals for the selected month
        approved_permissions = PermissionRequest.objects.filter(
            employee=employee,
            status="APPROVED",
            date__gte=month_start,
            date__lte=month_end,
        )

        summary["approved_leave_requests"] = leave_requests.count()
        summary["approved_permission_count"] = approved_permissions.count()
        summary["approved_permission_minutes"] = (
            approved_permissions.aggregate(total=Sum("duration_minutes"))["total"] or 0
        )

        # Monthly grace usage: each recorded grace use counts as 10 minutes.
        summary["grace_used_count"] = sum(
            1 for record in attendance_records.values()
            if record.grace_used
        )
        summary["grace_used_minutes"] = summary["grace_used_count"] * 10

        # Monthly 3-hour allowance includes approved permissions and grace usage.
        summary["monthly_permission_used_minutes"] = (
            summary["approved_permission_minutes"]
            + summary["grace_used_minutes"]
        )
        summary["monthly_permission_remaining_minutes"] = max(
            0,
            summary["monthly_permission_limit_minutes"]
            - summary["monthly_permission_used_minutes"]
        )

        return Response(
            {
                "employee": {
                    "id": employee.id,
                    "employee_id": employee.employee_id,
                    "name": employee.full_name,
                    "email": employee.email,
                    "department": employee.department,
                    "designation": employee.designation,
                    "work_type": employee.work_type,
                    "branch": (
                        employee.branch.branch_name
                        if employee.branch
                        else None
                    ),
                    "shift": (
                        employee.shift.name
                        if employee.shift
                        else None
                    ),
                },
                "month": month,
                "year": year,
                "month_name": month_start.strftime("%B"),
                "summary": summary,
                "days": days,
            },
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['post'], url_path='change-password', permission_classes=[permissions.IsAuthenticated])
    def change_password(self, request):
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        
        user = request.user
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')

        if not current_password:
            return Response({"current_password": ["Current password is required."]}, status=status.HTTP_400_BAD_REQUEST)
        if not new_password:
            return Response({"new_password": ["New password is required."]}, status=status.HTTP_400_BAD_REQUEST)
        if not confirm_password:
            return Response({"confirm_password": ["Confirm password is required."]}, status=status.HTTP_400_BAD_REQUEST)

        if not user.check_password(current_password):
            return Response({"current_password": ["Current password is incorrect."]}, status=status.HTTP_400_BAD_REQUEST)

        if new_password != confirm_password:
            return Response({"confirm_password": ["New passwords do not match."]}, status=status.HTTP_400_BAD_REQUEST)

        if current_password == new_password:
            return Response({"new_password": ["New password must be different from current password."]}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(new_password, user)
        except DjangoValidationError as e:
            return Response({"new_password": list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        return Response({"message": "Password changed successfully."}, status=status.HTTP_200_OK)


from django.http import FileResponse, Http404
from pathlib import Path
from .models import EmployeeDocument
from .document_serializers import EmployeeDocumentSerializer


class EmployeeDocumentViewSet(viewsets.ModelViewSet):
    queryset = EmployeeDocument.objects.select_related(
        'employee', 'uploaded_by'
    ).all()
    serializer_class = EmployeeDocumentSerializer
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        if user.role == 'HR':
            return queryset.filter(employee__branch__company_id=user.company_id)

        if user.role in ('SUPER_ADMIN', 'ADMIN'):
            return queryset

        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user
        employee = serializer.validated_data.get('employee')

        if user.role == 'HR':
            if (
                not user.company_id
                or not employee
                or not employee.branch
                or employee.branch.company_id != user.company_id
            ):
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('You can only manage documents for employees in your assigned company.')

        serializer.save(uploaded_by=user)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        document = self.get_object()
        if not document.file:
            raise Http404("Document file not found.")

        try:
            file_handle = document.file.open('rb')
        except (FileNotFoundError, OSError, ValueError):
            raise Http404("Document file not found.")

        response = FileResponse(
            file_handle,
            as_attachment=True,
            filename=Path(document.file.name).name,
        )
        response['Cache-Control'] = 'private, no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        return response
