from rest_framework import views, viewsets, status, permissions
from rest_framework.response import Response
from django.utils import timezone
from django.conf import settings
from datetime import datetime, timedelta
from employees.models import Employee
from .models import (
    Attendance,
    AttendancePolicy,
    Shift,
    PermissionRequest,
    LeaveRequest,
    WFHRequest,
    Holiday,
    EmployeePersonalAlarm,
)
from .serializers import (
    CheckInSerializer,
    CheckOutSerializer,
    AttendanceSerializer,
    ShiftSerializer,
    PermissionRequestSerializer,
    LeaveRequestSerializer,
    WFHRequestSerializer,
    HolidaySerializer,
    EmployeePersonalAlarmSerializer,
)
from .services import calculate_distance, reverse_geocode
from django.db.models import Sum, Count
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError, PermissionDenied
from notifications.services import (
    notify_admins_request_submitted,
    notify_employee_request_decision,
)

class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (
                user.role in ('SUPER_ADMIN', 'ADMIN', 'REPORTING_MANAGER')
                or (user.role == 'HR' and user.company_id is not None)
            )
        )

class IsPlatformAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.role in ("SUPER_ADMIN", "ADMIN")
        )


class IsAdminOrAssignedShiftReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if user.role in ("SUPER_ADMIN", "ADMIN"):
            return True

        if user.role == "HR" and user.company_id is not None:
            return True

        if request.method in ("GET", "HEAD", "OPTIONS"):
            return getattr(user, "employee_profile", None) is not None

        return False

    def has_object_permission(self, request, view, obj):
        user = request.user

        if user.role in ("SUPER_ADMIN", "ADMIN"):
            return True

        if user.role == "HR" and user.company_id is not None:
            return True

        if request.method not in ("GET", "HEAD", "OPTIONS"):
            return False

        employee = getattr(user, "employee_profile", None)
        return employee is not None and employee.shift_id == obj.pk


class ShiftViewSet(viewsets.ModelViewSet):
    serializer_class = ShiftSerializer
    permission_classes = [IsAdminUser]

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return [IsAdminOrAssignedShiftReadOnly()]
        return [IsPlatformAdmin()]

    def get_queryset(self):
        queryset = Shift.objects.annotate(
            employee_count=Count('employees')
        ).order_by('-created_at')

        user = self.request.user

        # Preserve existing shift visibility for admins and authorized HR.
        if (
            user.role in ("SUPER_ADMIN", "ADMIN")
            or (user.role == "HR" and user.company_id is not None)
        ):
            return queryset

        # Employees can see only their own assigned shift.
        employee = getattr(user, "employee_profile", None)
        shift_id = getattr(employee, "shift_id", None)

        if not shift_id:
            return queryset.none()

        return queryset.filter(pk=shift_id)

    @action(detail=False, methods=['get'])
    def active(self, request):
        active_shifts = self.get_queryset().filter(is_active=True)
        serializer = self.get_serializer(active_shifts, many=True)
        return Response(serializer.data)

    def perform_destroy(self, instance):
        if instance.employees.exists():
            instance.is_active = False
            instance.save()
            raise ValidationError({"detail": "Shift is currently assigned to employees and has been deactivated."})
        else:
            instance.delete()


class EmployeePersonalAlarmView(views.APIView):
    """
    Authenticated employee personal daily alarm endpoint.
    GET: Returns current configured personal alarm.
    POST / PUT: Sets or updates personal alarm time and enabled state.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        employee = getattr(user, 'employee_profile', None)
        if not employee:
            return Response(
                {"detail": "Employee profile required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        alarm, _ = EmployeePersonalAlarm.objects.get_or_create(
            employee=employee,
            defaults={'alarm_time': '08:30:00', 'is_enabled': False}
        )
        serializer = EmployeePersonalAlarmSerializer(alarm)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        return self._save_alarm(request)

    def put(self, request):
        return self._save_alarm(request)

    def _save_alarm(self, request):
        user = request.user
        employee = getattr(user, 'employee_profile', None)
        if not employee:
            return Response(
                {"detail": "Employee profile required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        alarm, _ = EmployeePersonalAlarm.objects.get_or_create(
            employee=employee,
            defaults={'alarm_time': '08:30:00', 'is_enabled': False}
        )

        serializer = EmployeePersonalAlarmSerializer(alarm, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data, status=status.HTTP_200_OK)


class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        if user.role in ('SUPER_ADMIN', 'ADMIN'):
            company_id = self.request.query_params.get('company')
            branch_id = self.request.query_params.get('branch')

            if company_id:
                queryset = queryset.filter(
                    employee__branch__company_id=company_id
                )
            if branch_id:
                queryset = queryset.filter(employee__branch_id=branch_id)

        elif user.role == 'HR':
            # HR is restricted to their assigned company
            if not user.company_id:
                return queryset.none()

            queryset = queryset.filter(
                employee__branch__company_id=user.company_id
            )

            requested_company = self.request.query_params.get('company')
            if requested_company and requested_company != str(user.company_id):
                return queryset.none()

            branch_id = self.request.query_params.get('branch')
            if branch_id:
                queryset = queryset.filter(employee__branch_id=branch_id)

        elif user.role in ('REPORTING_MANAGER', 'TEAM_LEADER'):
            # Managers and Team Leaders see attendance for their direct reporting employees
            emp = getattr(user, 'employee_profile', None)
            if not emp:
                return queryset.none()
            rep_ids = list(emp.direct_reports.filter(status=True).values_list('id', flat=True))
            queryset = queryset.filter(employee_id__in=rep_ids)

        elif hasattr(user, 'employee_profile'):
            # Regular employees can only access their own attendance
            queryset = queryset.filter(employee=user.employee_profile)

        else:
            return queryset.none()

        return queryset.order_by('-date', '-check_in')

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)

        # Regular employee users should only receive their actual attendance.
        if request.user.role not in ('SUPER_ADMIN', 'ADMIN', 'HR', 'REPORTING_MANAGER', 'TEAM_LEADER') and hasattr(request.user, 'employee_profile'):
            return response

        # ---------------------------------------------------------
        # ADMIN: Merge approved leave into attendance response
        # ---------------------------------------------------------
        params = request.query_params

        date_param = params.get('date')
        start_date_param = params.get('start_date')
        end_date_param = params.get('end_date')

        if date_param:
            try:
                selected_start = datetime.strptime(
                    date_param, '%Y-%m-%d'
                ).date()
                selected_end = selected_start
            except ValueError:
                return response

        elif start_date_param and end_date_param:
            try:
                selected_start = datetime.strptime(
                    start_date_param, '%Y-%m-%d'
                ).date()
                selected_end = datetime.strptime(
                    end_date_param, '%Y-%m-%d'
                ).date()
            except ValueError:
                return response

        else:
            selected_start = timezone.localdate()
            selected_end = selected_start

        company_id = params.get('company')
        branch_id = params.get('branch')
        department = params.get('department')
        work_type = params.get('work_type')

        approved_leaves = LeaveRequest.objects.filter(
            status='APPROVED',
            start_date__lte=selected_end,
            end_date__gte=selected_start
        ).select_related(
            'employee',
            'employee__branch',
            'employee__branch__company',
            'approved_by'
        )

        user = request.user

        if user.role == 'HR':
            if not user.company_id:
                approved_leaves = approved_leaves.none()
            else:
                approved_leaves = approved_leaves.filter(
                    employee__branch__company_id=user.company_id
                )
                if company_id and company_id != str(user.company_id):
                    approved_leaves = approved_leaves.none()
        elif user.role in ('SUPER_ADMIN', 'ADMIN'):
            if company_id:
                approved_leaves = approved_leaves.filter(
                    employee__branch__company_id=company_id
                )
        else:
            approved_leaves = approved_leaves.none()

        if branch_id:
            approved_leaves = approved_leaves.filter(
                employee__branch_id=branch_id
            )

        if department:
            approved_leaves = approved_leaves.filter(
                employee__department=department
            )

        if work_type:
            approved_leaves = approved_leaves.filter(
                employee__work_type=work_type
            )

        # Existing attendance response data
        if isinstance(response.data, dict) and 'results' in response.data:
            attendance_data = response.data['results']
        elif isinstance(response.data, list):
            attendance_data = response.data
        else:
            return response

        existing_keys = set()

        for item in attendance_data:
            employee_data = item.get('employee') or {}
            employee_id = (
                employee_data.get('id')
                or employee_data.get('employee_id')
            )

            item_date = item.get('date')

            if employee_id and item_date:
                existing_keys.add(
                    (str(employee_id), str(item_date))
                )

        leave_rows = []

        for leave in approved_leaves:
            current = max(
                leave.start_date,
                selected_start
            )
            leave_end = min(
                leave.end_date,
                selected_end
            )

            while current <= leave_end:
                key = (
                    str(leave.employee.id),
                    str(current)
                )

                # Never replace a real attendance record.
                if key not in existing_keys:
                    leave_rows.append({
                        "id": f"leave-{leave.id}-{current}",
                        "date": str(current),
                        "status": "ON_LEAVE",
                        "approval_status": "APPROVED",
                        "rejection_reason": None,

                        "check_in": None,
                        "check_out": None,
                        "check_in_time": None,
                        "check_out_time": None,

                        "check_in_latitude": None,
                        "check_in_longitude": None,
                        "check_in_accuracy": None,
                        "check_in_location_name": None,
                        "check_in_photo": None,

                        "check_out_latitude": None,
                        "check_out_longitude": None,
                        "check_out_accuracy": None,
                        "check_out_location_name": None,
                        "check_out_photo": None,

                        "late_minutes": 0,
                        "early_minutes": 0,
                        "overtime_minutes": 0,
                        "working_minutes": 0,
                        "late_display": "On Leave",
                        "working_hours": "00:00",

                        "employee": {
                            "id": leave.employee.id,
                            "full_name": leave.employee.full_name,
                            "employee_id": leave.employee.employee_id,
                            "department": leave.employee.department,
                            "designation": leave.employee.designation,
                            "phone_number": (
                                leave.employee.user.phone_number
                                if leave.employee.user
                                else None
                            ),
                            "branch": (
                                {
                                    "id": leave.employee.branch.id,
                                    "branch_name": leave.employee.branch.branch_name,
                                }
                                if leave.employee.branch
                                else None
                            ),
                            "company": (
                                {
                                    "id": leave.employee.branch.company.id,
                                    "name": leave.employee.branch.company.name,
                                }
                                if leave.employee.branch
                                and leave.employee.branch.company
                                else None
                            ),
                            "shift": (
                                {
                                    "id": leave.employee.shift.id,
                                    "name": leave.employee.shift.name,
                                    "start_time": str(
                                        leave.employee.shift.start_time
                                    ),
                                    "end_time": str(
                                        leave.employee.shift.end_time
                                    ),
                                }
                                if leave.employee.shift
                                else None
                            ),
                        },

                        "leave": {
                            "id": leave.id,
                            "leave_type": leave.leave_type,
                            "start_date": str(leave.start_date),
                            "end_date": str(leave.end_date),
                            "reason": leave.reason,
                            "status": leave.status,
                            "approved_by": (
                                leave.approved_by.get_full_name()
                                if leave.approved_by
                                else None
                            ),
                            "approved_at": (
                                leave.approved_at.isoformat()
                                if leave.approved_at
                                else None
                            ),
                        },
                    })

                current += timedelta(days=1)

        # ---------------------------------------------------------
        # Add employees with no attendance and no approved leave.
        #
        # Today:
        #   Shift not finished -> PENDING ATTENDANCE
        #   Shift finished     -> ABSENT
        #
        # Previous dates:
        #   No attendance      -> ABSENT
        #
        # Approved leave always has priority and is already added
        # above as ON_LEAVE.
        # ---------------------------------------------------------
        employee_qs = Employee.objects.filter(
            status=True
        ).select_related(
            'user',
            'branch',
            'branch__company',
            'shift',
        )

        if request.user.role == 'HR':
            if not request.user.company_id:
                employee_qs = employee_qs.none()
            else:
                employee_qs = employee_qs.filter(
                    branch__company_id=request.user.company_id
                )
                if company_id and company_id != str(request.user.company_id):
                    employee_qs = employee_qs.none()
        elif request.user.role in ('REPORTING_MANAGER', 'TEAM_LEADER'):
            mgr_emp = getattr(request.user, 'employee_profile', None)
            if mgr_emp:
                employee_qs = employee_qs.filter(reporting_manager=mgr_emp)
            else:
                employee_qs = employee_qs.none()
        elif request.user.role in ('SUPER_ADMIN', 'ADMIN'):
            if company_id:
                employee_qs = employee_qs.filter(
                    branch__company_id=company_id
                )
        else:
            employee_qs = employee_qs.none()

        if branch_id:
            employee_qs = employee_qs.filter(
                branch_id=branch_id
            )

        if department:
            employee_qs = employee_qs.filter(
                department=department
            )

        if work_type:
            employee_qs = employee_qs.filter(
                work_type=work_type
            )

        # Employees covered by approved leave for the selected date(s).
        leave_keys = set()

        for leave in approved_leaves:
            current_date = max(
                leave.start_date,
                selected_start
            )

            leave_end = min(
                leave.end_date,
                selected_end
            )

            while current_date <= leave_end:
                leave_keys.add(
                    (
                        str(leave.employee.id),
                        str(current_date)
                    )
                )
                current_date += timedelta(days=1)

        # ---------------------------------------------------------
        # Active holidays for selected date range
        # ---------------------------------------------------------
        holidays_qs = Holiday.objects.filter(
            date__range=[selected_start, selected_end],
            is_active=True
        )
        if user.role == 'HR' and user.company_id:
            holidays_qs = holidays_qs.filter(company_id=user.company_id)
        elif company_id and company_id.isdigit():
            holidays_qs = holidays_qs.filter(company_id=company_id)

        holidays_map = {}
        for h in holidays_qs:
            # Map specifically by (company_id, str(date)) only.
            # Do NOT map to None or apply across other companies!
            holidays_map[(h.company_id, str(h.date))] = h

        holiday_rows = []
        holiday_keys = set()

        for employee in employee_qs:
            emp_comp_id = employee.branch.company_id if employee.branch else None
            curr_d = selected_start
            while curr_d <= selected_end:
                d_str = str(curr_d)
                h = holidays_map.get((emp_comp_id, d_str))
                key = (str(employee.id), d_str)
                if h and key not in existing_keys and key not in leave_keys:
                    holiday_keys.add(key)
                    holiday_rows.append({
                        "id": f"holiday-{h.id}-{employee.id}-{d_str}",
                        "date": d_str,
                        "status": "HOLIDAY",
                        "approval_status": None,
                        "rejection_reason": None,
                        "check_in": None,
                        "check_out": None,
                        "check_in_time": None,
                        "check_out_time": None,
                        "check_in_latitude": None,
                        "check_in_longitude": None,
                        "check_in_accuracy": None,
                        "check_in_location_name": None,
                        "check_in_photo": None,
                        "check_out_latitude": None,
                        "check_out_longitude": None,
                        "check_out_accuracy": None,
                        "check_out_location_name": None,
                        "check_out_photo": None,
                        "late_minutes": 0,
                        "early_minutes": 0,
                        "overtime_minutes": 0,
                        "working_minutes": 0,
                        "late_display": h.name,
                        "working_hours": "00:00",
                        "holiday_name": h.name,
                        "holiday_description": h.description,
                        "employee": {
                            "id": employee.id,
                            "full_name": employee.full_name,
                            "employee_id": employee.employee_id,
                            "department": employee.department,
                            "designation": employee.designation,
                            "phone_number": employee.user.phone_number if employee.user else None,
                            "branch": {
                                "id": employee.branch.id,
                                "branch_name": employee.branch.branch_name,
                            } if employee.branch else None,
                            "company": {
                                "id": employee.branch.company.id,
                                "name": employee.branch.company.name,
                            } if employee.branch and employee.branch.company else None,
                            "shift": {
                                "id": employee.shift.id,
                                "name": employee.shift.name,
                                "start_time": str(employee.shift.start_time),
                                "end_time": str(employee.shift.end_time),
                            } if employee.shift else None,
                        }
                    })
                curr_d += timedelta(days=1)

        pending_rows = []
        absent_rows = []

        now = timezone.localtime()
        today = timezone.localdate()

        for employee in employee_qs:
            current_date = selected_start

            while current_date <= selected_end:
                key = (
                    str(employee.id),
                    str(current_date)
                )

                # Existing attendance, approved leave, or holiday already
                # handles this employee/date.
                if key in existing_keys or key in leave_keys or key in holiday_keys:
                    current_date += timedelta(days=1)
                    continue

                # -------------------------------------------------
                # Decide whether this should be WEEKLY_OFF, PENDING, or ABSENT.
                # -------------------------------------------------
                shift = employee.shift

                # Sunday is weekly off if employee has no attendance
                if current_date.weekday() == 6:
                    attendance_status = "WEEKLY_OFF"

                elif current_date < today:
                    attendance_status = "ABSENT"

                elif current_date > today:
                    # Future date should not be marked absent.
                    current_date += timedelta(days=1)
                    continue

                elif not shift or not shift.end_time:
                    # If no shift end time is available, do not
                    # prematurely mark today's employee absent.
                    attendance_status = "PENDING"

                else:
                    shift_end_datetime = timezone.make_aware(
                        datetime.combine(
                            current_date,
                            shift.end_time
                        )
                    )

                    if now < shift_end_datetime:
                        attendance_status = "PENDING"
                    else:
                        attendance_status = "ABSENT"

                employee_data = {
                    "id": employee.id,
                    "full_name": employee.full_name,
                    "employee_id": employee.employee_id,
                    "department": employee.department,
                    "designation": employee.designation,
                    "phone_number": (
                        employee.user.phone_number
                        if employee.user
                        else None
                    ),
                    "branch": (
                        {
                            "id": employee.branch.id,
                            "branch_name": employee.branch.branch_name,
                        }
                        if employee.branch
                        else None
                    ),
                    "company": (
                        {
                            "id": employee.branch.company.id,
                            "name": employee.branch.company.name,
                        }
                        if employee.branch
                        and employee.branch.company
                        else None
                    ),
                    "shift": (
                        {
                            "id": employee.shift.id,
                            "name": employee.shift.name,
                            "start_time": str(
                                employee.shift.start_time
                            ),
                            "end_time": str(
                                employee.shift.end_time
                            ),
                        }
                        if employee.shift
                        else None
                    ),
                }

                row = {
                    "id": f"{attendance_status.lower()}-{employee.id}-{current_date}",
                    "date": str(current_date),
                    "status": attendance_status,
                    "approval_status": None,
                    "rejection_reason": None,

                    "check_in": None,
                    "check_out": None,
                    "check_in_time": None,
                    "check_out_time": None,

                    "check_in_latitude": None,
                    "check_in_longitude": None,
                    "check_in_accuracy": None,
                    "check_in_location_name": None,
                    "check_in_photo": None,

                    "check_out_latitude": None,
                    "check_out_longitude": None,
                    "check_out_accuracy": None,
                    "check_out_location_name": None,
                    "check_out_photo": None,

                    "late_minutes": 0,
                    "early_minutes": 0,
                    "overtime_minutes": 0,
                    "working_minutes": 0,
                    "late_display": (
                        "Weekly Off"
                        if attendance_status == "WEEKLY_OFF"
                        else ("Pending Attendance" if attendance_status == "PENDING" else "Absent")
                    ),
                    "working_hours": "00:00",

                    "employee": employee_data,
                }

                if attendance_status == "PENDING":
                    pending_rows.append(row)
                else:
                    absent_rows.append(row)

                current_date += timedelta(days=1)

        # Add leave, holiday, pending and absent rows to existing response.
        combined = (
            attendance_data
            + leave_rows
            + holiday_rows
            + pending_rows
            + absent_rows
        )
        combined.sort(
            key=lambda item: (
                item.get('date') or '',
                item.get('check_in_time') or ''
            ),
            reverse=True
        )

        if isinstance(response.data, dict) and 'results' in response.data:
            response.data['results'] = combined
            response.data['count'] = len(combined)
        else:
            response.data = combined

        return response

    @action(detail=False, methods=['get'])
    def today(self, request):
        user = request.user
        if not hasattr(user, 'employee_profile'):
            return Response({"error": "User is not an employee."}, status=status.HTTP_400_BAD_REQUEST)
        
        employee = user.employee_profile
        today_date = timezone.localdate()
        
        attendance = Attendance.objects.filter(employee=employee, date=today_date).first()
        
        if not attendance:
            return Response({
                "date": str(today_date),
                "check_in": None,
                "check_out": None,
                "status": "NOT_CHECKED_IN"
            })
            
        serializer = self.get_serializer(attendance)
        data = serializer.data
        data["date"] = str(today_date)
        return Response(data)

    @action(detail=False, methods=['get'])
    def history(self, request):
        queryset = self.get_queryset()
        
        month_param = request.query_params.get('month')
        year_param = request.query_params.get('year')
        
        if month_param:
            queryset = queryset.filter(date__month=int(month_param))
        if year_param:
            queryset = queryset.filter(date__year=int(year_param))
            
        # Pagination
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
            
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def reports(self, request):
        from attendance.services import build_employee_attendance_report, get_attendance_cycle

        start_date_param = request.query_params.get('start_date')
        end_date_param = request.query_params.get('end_date')
        month_param = request.query_params.get('month')
        year_param = request.query_params.get('year')
        employee_param = request.query_params.get('employee')
        
        is_range = False
        start_date = None
        end_date = None

        if start_date_param and end_date_param:
            try:
                start_date = datetime.strptime(start_date_param, '%Y-%m-%d').date()
                end_date = datetime.strptime(end_date_param, '%Y-%m-%d').date()
                is_range = True
            except ValueError:
                return Response({
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid date format. Use YYYY-MM-DD."
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            try:
                if month_param is not None:
                    month = int(month_param)
                    if not (1 <= month <= 12):
                        raise ValueError
                else:
                    month = timezone.localdate().month
                    
                if year_param is not None:
                    year = int(year_param)
                else:
                    year = timezone.localdate().year
            except ValueError:
                return Response({
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid month or year."
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Use the 26th-25th calculation cycle for monthly report
            start_date, end_date = get_attendance_cycle(year, month)

        # Resolve employee
        user = request.user
        target_employee = None
        if hasattr(user, 'employee_profile'):
            target_employee = user.employee_profile
        elif employee_param:
            try:
                target_employee = Employee.objects.select_related('branch', 'branch__company', 'shift').get(pk=employee_param)
            except Employee.DoesNotExist:
                target_employee = None

        if target_employee:
            report_data = build_employee_attendance_report(
                employee=target_employee,
                start_date=start_date,
                end_date=end_date,
            )
            report_data["is_range"] = is_range
            report_data["month"] = month if not is_range else None
            report_data["year"] = year if not is_range else None
            return Response(report_data)

        # Multi-employee report for Admin / HR
        queryset = self.get_queryset().filter(date__range=[start_date, end_date])
        company_id = request.query_params.get('company')
        branch_id = request.query_params.get('branch')

        active_holidays = Holiday.objects.filter(
            date__range=[start_date, end_date],
            is_active=True
        )
        if user.role == 'HR' and user.company_id:
            active_holidays = active_holidays.filter(company_id=user.company_id)
        elif company_id and company_id.isdigit():
            active_holidays = active_holidays.filter(company_id=company_id)

        holiday_count = active_holidays.count()
        holiday_dates = set(active_holidays.values_list('date', flat=True))

        present_count = queryset.filter(
            status__in=['COMPLETED', 'ON_TIME', 'WORKING', 'LATE']
        ).count()
        late_count = queryset.filter(status='LATE').count()
        absent_count = queryset.filter(status='ABSENT').exclude(date__in=holiday_dates).count()

        total_seconds = 0
        for attendance in queryset.filter(check_in__isnull=False, check_out__isnull=False):
            diff = attendance.check_out - attendance.check_in
            total_seconds += int(diff.total_seconds())
            
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        total_working_hours = f"{hours:02d}:{minutes:02d}"

        serializer = self.get_serializer(queryset, many=True)
        return Response({
            "is_range": is_range,
            "start_date": str(start_date),
            "end_date": str(end_date),
            "month": month if not is_range else None,
            "year": year if not is_range else None,
            "summary": {
                "present": present_count,
                "late": late_count,
                "absent": absent_count,
                "holidays": holiday_count,
                "working_days": present_count,
                "total_working_hours": total_working_hours
            },
            "calendar": serializer.data
        })

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        from datetime import datetime, timedelta
        from django.db.models import Count, Q
        from django.db.models.functions import TruncDate
        
        date_filter = request.query_params.get('date_filter', 'selected_date' if request.query_params.get('date') else 'today')
        today = timezone.localdate()
        
        if date_filter == 'today':
            start_date = today
            end_date = today
        elif date_filter == 'yesterday':
            start_date = today - timedelta(days=1)
            end_date = today - timedelta(days=1)
        elif date_filter == 'this_week':
            start_date = today - timedelta(days=today.weekday())
            end_date = today
        elif date_filter == 'this_month':
            from attendance.services import get_attendance_cycle

            start_date, cycle_end = get_attendance_cycle(
                today.year,
                today.month
            )

            # Do not include future dates in the current attendance cycle.
            end_date = min(today, cycle_end)
        elif date_filter == 'custom':
            s = request.query_params.get('start_date')
            e = request.query_params.get('end_date')
            start_date = datetime.strptime(s, '%Y-%m-%d').date() if s else today
            end_date = datetime.strptime(e, '%Y-%m-%d').date() if e else today
        else:
            date_str = request.query_params.get('date')
            if date_str:
                start_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            else:
                start_date = today
            end_date = start_date

        user = request.user
        company_id = request.query_params.get('company')
        branch_id = request.query_params.get('branch')
        department = request.query_params.get('department')
        work_type = request.query_params.get('work_type')

        if user.role == 'HR':
            if not user.company_id:
                return Response(
                    {"detail": "HR account is not assigned to a company."},
                    status=status.HTTP_403_FORBIDDEN
                )
            if company_id and company_id != str(user.company_id):
                return Response(
                    {"detail": "You cannot access another company's dashboard."},
                    status=status.HTTP_403_FORBIDDEN
                )
            company_id = str(user.company_id)
        elif user.role not in ('SUPER_ADMIN', 'ADMIN'):
            return Response(
                {"detail": "You do not have permission to access this dashboard."},
                status=status.HTTP_403_FORBIDDEN
            )

        if user.role == 'HR' and branch_id:
            from branches.models import Branch
            if not Branch.objects.filter(
                pk=branch_id,
                company_id=user.company_id
            ).exists():
                return Response(
                    {"detail": "You cannot access a branch outside your company."},
                    status=status.HTTP_403_FORBIDDEN
                )

        
        employees = Employee.objects.filter(status=True)
        if company_id:
            employees = employees.filter(branch__company_id=company_id)
        if branch_id:
            employees = employees.filter(branch_id=branch_id)
        if department:
            employees = employees.filter(department=department)
        if work_type:
            employees = employees.filter(work_type=work_type)
            
        total_employees = employees.count()
        
        attendance_qs = Attendance.objects.filter(date__range=[start_date, end_date])
        if company_id:
            attendance_qs = attendance_qs.filter(employee__branch__company_id=company_id)
        if branch_id:
            attendance_qs = attendance_qs.filter(employee__branch_id=branch_id)
        if department:
            attendance_qs = attendance_qs.filter(employee__department=department)
        if work_type:
            attendance_qs = attendance_qs.filter(employee__work_type=work_type)

        days_diff = (end_date - start_date).days + 1
        expected_attendances = total_employees * days_diff
        
        # Avoid duplicate counting of employee in "Present Today" by just counting unique if range is 1 day
        if days_diff == 1:
            present = attendance_qs.filter(status__in=['COMPLETED', 'ON_TIME', 'WORKING', 'LATE']).values('employee').distinct().count()
        else:
            present = attendance_qs.filter(status__in=['COMPLETED', 'ON_TIME', 'WORKING', 'LATE']).count()
            
        late = attendance_qs.filter(status='LATE').count()
        working = attendance_qs.filter(check_out__isnull=True).count()
        checked_out = attendance_qs.filter(check_out__isnull=False).count()
        pending = attendance_qs.filter(approval_status='PENDING').count()
        approved = attendance_qs.filter(approval_status='APPROVED').count()
        rejected = attendance_qs.filter(approval_status='REJECTED').count()
        
        # ---------------------------------------------------------
        # APPROVED LEAVE SHOULD NOT COUNT AS ABSENT
        # ---------------------------------------------------------
        approved_leave_qs = LeaveRequest.objects.filter(
            status='APPROVED',
            start_date__lte=end_date,
            end_date__gte=start_date
        )

        if company_id:
            approved_leave_qs = approved_leave_qs.filter(
                employee__branch__company_id=company_id
            )
        if branch_id:
            approved_leave_qs = approved_leave_qs.filter(
                employee__branch_id=branch_id
            )
        if department:
            approved_leave_qs = approved_leave_qs.filter(
                employee__department=department
            )
        if work_type:
            approved_leave_qs = approved_leave_qs.filter(
                employee__work_type=work_type
            )

        leave_day_count = 0

        for leave in approved_leave_qs:
            leave_start = max(leave.start_date, start_date)
            leave_end = min(leave.end_date, end_date)

            if leave_start <= leave_end:
                covered_days = (leave_end - leave_start).days + 1
                leave_day_count += covered_days * (
                    0.5 if leave.leave_type == 'HALF_DAY' else 1
                )

        absent = expected_attendances - present - leave_day_count
        if absent < 0:
            absent = 0

        trend_period = request.query_params.get('trend_period', '7d')
        if trend_period == 'today':
            trend_start = end_date
        elif trend_period == '30d':
            trend_start = end_date - timedelta(days=29)
        elif trend_period == 'this_month':
            trend_start = end_date.replace(day=1)
        else: # 7d
            trend_start = end_date - timedelta(days=6)

        trend_attendance_qs = Attendance.objects.filter(date__range=[trend_start, end_date])
        if company_id:
            trend_attendance_qs = trend_attendance_qs.filter(employee__branch__company_id=company_id)
        if branch_id:
            trend_attendance_qs = trend_attendance_qs.filter(employee__branch_id=branch_id)
        if department:
            trend_attendance_qs = trend_attendance_qs.filter(employee__department=department)
        if work_type:
            trend_attendance_qs = trend_attendance_qs.filter(employee__work_type=work_type)

        trend_qs = trend_attendance_qs.values('date').annotate(
            present=Count('id', filter=Q(status__in=['COMPLETED', 'ON_TIME', 'WORKING', 'LATE'])),
            late=Count('id', filter=Q(status='LATE'))
        ).order_by('date')
        
        attendance_trend = []
        for t in trend_qs:
            attendance_trend.append({
                "date": str(t['date']),
                "present": t['present'],
                "late": t['late'],
                "absent": total_employees - t['present'] if total_employees > t['present'] else 0
            })

        status_distribution = [
            {"name": "On Time", "value": attendance_qs.filter(status='ON_TIME').count()},
            {"name": "Late", "value": late},
            {"name": "Working", "value": working},
            {"name": "Completed", "value": checked_out},
            {"name": "Absent", "value": absent},
        ]
        
        # ---------------------------------------------------------
        # BRANCH ATTENDANCE
        # ---------------------------------------------------------
        # For a single selected day:
        #   Present = unique employees with valid attendance
        #   Absent  = branch employees without attendance
        #
        # For a date range:
        #   Present = unique employees who attended at least once
        #   Absent  = branch employees who never attended in the range
        #
        # This keeps the branch card consistent with the employee
        # counts instead of multiplying employees by days_diff.
        # ---------------------------------------------------------

        branch_qs = employees.values(
            'branch_id',
            'branch__branch_name'
        ).annotate(
            total=Count('id')
        )

        branch_attendance = attendance_qs.values(
            'employee__branch_id',
            'employee__branch__branch_name'
        ).annotate(
            present=Count(
                'employee',
                filter=Q(
                    status__in=[
                        'COMPLETED',
                        'ON_TIME',
                        'WORKING',
                        'LATE'
                    ]
                ),
                distinct=True
            ),
            late=Count(
                'employee',
                filter=Q(status='LATE'),
                distinct=True
            ),
            working=Count(
                'employee',
                filter=Q(
                    status='WORKING',
                    check_out__isnull=True
                ),
                distinct=True
            )
        )

        branch_summary = []

        for b in branch_qs:
            branch_id_value = b['branch_id']
            b_name = b['branch__branch_name']

            if not branch_id_value or not b_name:
                continue

            att = next(
                (
                    a for a in branch_attendance
                    if a['employee__branch_id'] == branch_id_value
                ),
                None
            )

            present_val = att['present'] if att else 0
            late_val = att['late'] if att else 0
            working_val = att['working'] if att else 0

            # Employees who did not have valid attendance
            # during the selected period.
            absent_val = max(b['total'] - present_val, 0)

            branch_summary.append({
                "branch_name": b_name,
                "total_employees": b['total'],
                "present": present_val,
                "late": late_val,
                "working": working_val,
                "absent": absent_val
            })

        company_qs = employees.values('branch__company__name').annotate(total=Count('id'))
        company_attendance = attendance_qs.values('employee__branch__company__name').annotate(
            present=Count('employee', distinct=True) if days_diff == 1 else Count('id'),
            late=Count('id', filter=Q(status='LATE')),
            working=Count('id', filter=Q(check_out__isnull=True))
        )
        company_summary = []
        for c in company_qs:
            c_name = c['branch__company__name']
            if not c_name: continue
            att = next((a for a in company_attendance if a['employee__branch__company__name'] == c_name), None)
            present_val = att['present'] if att else 0
            late_val = att['late'] if att else 0
            working_val = att['working'] if att else 0
            c_absent = (c['total'] * days_diff) - present_val
            company_summary.append({
                "company_name": c_name,
                "total_employees": c['total'],
                "present": present_val,
                "late": late_val,
                "working": working_val,
                "absent": c_absent if c_absent > 0 else 0
            })

        dept_qs = employees.values('department').annotate(total=Count('id'))
        dept_attendance = attendance_qs.values('employee__department').annotate(
            present=Count('employee', distinct=True) if days_diff == 1 else Count('id'),
            late=Count('id', filter=Q(status='LATE'))
        )
        department_summary = []
        for d in dept_qs:
            d_name = d['department']
            if not d_name: d_name = "Unassigned"
            att = next((a for a in dept_attendance if a['employee__department'] == d['department']), None)
            present_val = att['present'] if att else 0
            late_val = att['late'] if att else 0
            d_absent = (d['total'] * days_diff) - present_val
            department_summary.append({
                "department": d_name,
                "total_employees": d['total'],
                "present": present_val,
                "late": late_val,
                "absent": d_absent if d_absent > 0 else 0
            })

        recent = attendance_qs.select_related('employee', 'employee__branch', 'employee__shift').order_by('-check_in')[:20]
        recent_data = AttendanceSerializer(recent, many=True).data

        return Response({
            "start_date": str(start_date),
            "end_date": str(end_date),
            "summary": {
                "total_employees": total_employees,
                "present": present,
                "working": working,
                "late": late,
                "absent": absent,
                "completed": checked_out,
                "pending": pending,
                "approved": approved,
                "rejected": rejected
            },
            "attendance_trend": attendance_trend,
            "status_distribution": status_distribution,
            "branch_summary": branch_summary,
            "company_summary": company_summary,
            "department_summary": department_summary,
            "recent_attendance": recent_data
        })

    @action(detail=False, methods=['get'], url_path=r'date/(?P<date>\d{4}-\d{2}-\d{2})')
    def date_detail(self, request, date=None):
        from datetime import datetime
        from attendance.services import get_employee_attendance_status, resolve_holiday_map

        user = request.user
        employee = getattr(user, 'employee_profile', None)

        try:
            target_d = datetime.strptime(date, '%Y-%m-%d').date()
        except (ValueError, TypeError):
            return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        holiday = None
        if employee and employee.branch and employee.branch.company_id:
            h_map = resolve_holiday_map(target_d, target_d, company=employee.branch.company)
            holiday = h_map.get(str(target_d))

        approved_leave = None
        if employee:
            approved_leave = LeaveRequest.objects.filter(
                employee=employee,
                status='APPROVED',
                start_date__lte=target_d,
                end_date__gte=target_d,
            ).first()

        try:
            attendance = self.get_queryset().get(date=date)
            serializer = self.get_serializer(attendance)
            data = serializer.data
            
            calculated_status = get_employee_attendance_status(
                record=attendance,
                employee=employee,
                target_date=target_d,
                holiday=holiday,
                approved_leave=approved_leave,
            )

            # Format location to match UI requirements
            response_data = {
                "date": data.get("date"),
                "status": calculated_status,
                "check_in_time": data.get("check_in_time"),
                "check_out_time": data.get("check_out_time"),
                "working_hours": data.get("working_hours", "00:00") or "00:00",
                "late_minutes": data.get("late_minutes"),
                "branch": data.get("employee", {}).get("branch"),
                "check_in_photo": data.get("check_in_photo"),
                "check_out_photo": data.get("check_out_photo")
            }
            if holiday:
                response_data["holiday_name"] = holiday.name
                response_data["holiday_description"] = holiday.description
            if approved_leave:
                response_data["leave"] = {
                    "id": approved_leave.id,
                    "leave_type": approved_leave.leave_type,
                    "reason": approved_leave.reason,
                }
            
            if data.get("check_in_latitude") and data.get("check_in_longitude"):
                response_data["check_in_location"] = {
                    "latitude": data.get("check_in_latitude"),
                    "longitude": data.get("check_in_longitude"),
                    "accuracy": data.get("check_in_accuracy")
                }
            if data.get("check_out_latitude") and data.get("check_out_longitude"):
                response_data["check_out_location"] = {
                    "latitude": data.get("check_out_latitude"),
                    "longitude": data.get("check_out_longitude"),
                    "accuracy": data.get("check_out_accuracy")
                }
                
            return Response(response_data)
        except Attendance.DoesNotExist:
            calculated_status = get_employee_attendance_status(
                record=None,
                employee=employee,
                target_date=target_d,
                holiday=holiday,
                approved_leave=approved_leave,
            )

            resp = {
                "date": date,
                "status": calculated_status,
                "check_in_time": None,
                "check_out_time": None,
                "working_hours": "00:00",
                "late_minutes": 0,
                "branch": (
                    {
                        "id": employee.branch.id,
                        "branch_name": employee.branch.branch_name,
                    }
                    if employee and employee.branch else None
                ),
                "check_in_photo": None,
                "check_out_photo": None
            }
            if holiday:
                resp["holiday_name"] = holiday.name
                resp["holiday_description"] = holiday.description
            if approved_leave:
                resp["leave"] = {
                    "id": approved_leave.id,
                    "leave_type": approved_leave.leave_type,
                    "reason": approved_leave.reason,
                }
            return Response(resp)

    @action(
        detail=True,
        methods=['patch', 'post'],
        url_path='check-in-approve',
        permission_classes=[IsAdminUser]
    )
    def check_in_approve(self, request, pk=None):
        attendance = self.get_object()

        if not attendance.check_in:
            return Response(
                {"error": "Punch In does not exist."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if attendance.check_in_approval_status != 'PENDING':
            return Response(
                {"error": "Punch In is already processed."},
                status=status.HTTP_400_BAD_REQUEST
            )

        attendance.check_in_approval_status = 'APPROVED'
        attendance.check_in_rejection_reason = None

        # Overall attendance is approved only after BOTH
        # Punch In and Punch Out are approved.
        if attendance.check_out:
            if attendance.check_out_approval_status == 'APPROVED':
                attendance.approval_status = 'APPROVED'
            elif attendance.check_out_approval_status == 'REJECTED':
                attendance.approval_status = 'REJECTED'
            else:
                attendance.approval_status = 'PENDING'
        else:
            attendance.approval_status = 'PENDING'

        attendance.save(update_fields=[
            'check_in_approval_status',
            'check_in_rejection_reason',
            'approval_status',
        ])

        return Response(
            AttendanceSerializer(
                attendance,
                context={'request': request}
            ).data
        )

    @action(
        detail=True,
        methods=['patch', 'post'],
        url_path='check-in-reject',
        permission_classes=[IsAdminUser]
    )
    def check_in_reject(self, request, pk=None):
        attendance = self.get_object()
        reason = str(request.data.get('reason') or '').strip()

        if not attendance.check_in:
            return Response(
                {"error": "Punch In does not exist."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if attendance.check_in_approval_status != 'PENDING':
            return Response(
                {"error": "Punch In is already processed."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not reason:
            return Response(
                {"error": "Rejection reason is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        attendance.check_in_approval_status = 'REJECTED'
        attendance.check_in_rejection_reason = reason
        attendance.approval_status = 'REJECTED'

        attendance.save(update_fields=[
            'check_in_approval_status',
            'check_in_rejection_reason',
            'approval_status',
        ])

        return Response(
            AttendanceSerializer(
                attendance,
                context={'request': request}
            ).data
        )

    @action(
        detail=True,
        methods=['patch', 'post'],
        url_path='check-out-approve',
        permission_classes=[IsAdminUser]
    )
    def check_out_approve(self, request, pk=None):
        attendance = self.get_object()

        if not attendance.check_out:
            return Response(
                {"error": "Punch Out does not exist."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if attendance.check_out_approval_status != 'PENDING':
            return Response(
                {"error": "Punch Out is already processed."},
                status=status.HTTP_400_BAD_REQUEST
            )

        attendance.check_out_approval_status = 'APPROVED'
        attendance.check_out_rejection_reason = None

        # Overall attendance becomes approved ONLY when
        # both Punch In and Punch Out are approved.
        if attendance.check_in_approval_status == 'APPROVED':
            attendance.approval_status = 'APPROVED'
        elif attendance.check_in_approval_status == 'REJECTED':
            attendance.approval_status = 'REJECTED'
        else:
            attendance.approval_status = 'PENDING'

        attendance.save(update_fields=[
            'check_out_approval_status',
            'check_out_rejection_reason',
            'approval_status',
        ])

        return Response(
            AttendanceSerializer(
                attendance,
                context={'request': request}
            ).data
        )

    @action(
        detail=True,
        methods=['patch', 'post'],
        url_path='check-out-reject',
        permission_classes=[IsAdminUser]
    )
    def check_out_reject(self, request, pk=None):
        attendance = self.get_object()
        reason = str(request.data.get('reason') or '').strip()

        if not attendance.check_out:
            return Response(
                {"error": "Punch Out does not exist."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if attendance.check_out_approval_status != 'PENDING':
            return Response(
                {"error": "Punch Out is already processed."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not reason:
            return Response(
                {"error": "Rejection reason is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        attendance.check_out_approval_status = 'REJECTED'
        attendance.check_out_rejection_reason = reason
        attendance.approval_status = 'REJECTED'

        attendance.save(update_fields=[
            'check_out_approval_status',
            'check_out_rejection_reason',
            'approval_status',
        ])

        return Response(
            AttendanceSerializer(
                attendance,
                context={'request': request}
            ).data
        )

    @action(detail=True, methods=['patch', 'post'], permission_classes=[IsAdminUser])
    def approve(self, request, pk=None):
        attendance = self.get_object()
        punch_type = request.data.get('type')  # 'check_in', 'check_out', or None (both)
        
        now = timezone.now()
        if punch_type == 'check_in':
            attendance.check_in_approval_status = 'APPROVED'
            attendance.check_in_rejection_reason = None
        elif punch_type == 'check_out':
            attendance.check_out_approval_status = 'APPROVED'
            attendance.check_out_rejection_reason = None
        else:
            attendance.approval_status = 'APPROVED'
            attendance.rejection_reason = None
            attendance.check_in_approval_status = 'APPROVED'
            attendance.check_in_rejection_reason = None
            if attendance.check_out:
                attendance.check_out_approval_status = 'APPROVED'
                attendance.check_out_rejection_reason = None

        attendance.reviewed_by = request.user
        attendance.reviewed_at = now
        attendance.save()
        
        serializer = self.get_serializer(attendance, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['patch', 'post'], permission_classes=[IsAdminUser])
    def reject(self, request, pk=None):
        attendance = self.get_object()
        reason = request.data.get('reason') or request.data.get('rejection_reason')
        punch_type = request.data.get('type')  # 'check_in', 'check_out', or None
        
        if not reason:
            return Response({"error": "Rejection reason is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        now = timezone.now()
        if punch_type == 'check_in':
            attendance.check_in_approval_status = 'REJECTED'
            attendance.check_in_rejection_reason = reason
        elif punch_type == 'check_out':
            attendance.check_out_approval_status = 'REJECTED'
            attendance.check_out_rejection_reason = reason
        else:
            attendance.approval_status = 'REJECTED'
            attendance.rejection_reason = reason
            attendance.check_in_approval_status = 'REJECTED'
            attendance.check_in_rejection_reason = reason
            if attendance.check_out:
                attendance.check_out_approval_status = 'REJECTED'
                attendance.check_out_rejection_reason = reason

        attendance.reviewed_by = request.user
        attendance.reviewed_at = now
        attendance.save()
        
        serializer = self.get_serializer(attendance, context={'request': request})
        return Response(serializer.data)

from rest_framework.parsers import MultiPartParser, FormParser

class CheckInView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        user = request.user
        if not hasattr(user, 'employee_profile'):
            return Response({"error": "User is not an employee."}, status=status.HTTP_400_BAD_REQUEST)
        
        employee = user.employee_profile
        today = timezone.localdate()

        attendance = Attendance.objects.filter(employee=employee, date=today).first()
        if attendance:
            if attendance.check_out or attendance.status == 'COMPLETED':
                return Response({
                    "success": False,
                    "code": "ATTENDANCE_ALREADY_COMPLETED",
                    "message": "Today's attendance has already been completed."
                }, status=status.HTTP_400_BAD_REQUEST)
            if attendance.check_in:
                return Response({"error": "Attendance already checked in for today."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = CheckInSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "code": "VALIDATION_ERROR",
                "message": "Check-in validation failed.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        lat = serializer.validated_data['latitude']
        lon = serializer.validated_data['longitude']
        acc = serializer.validated_data['accuracy']
        photo = serializer.validated_data['photo']
        from attendance.services import normalize_image_orientation
        photo = normalize_image_orientation(photo)

        # Reverse geocoding must never block attendance marking.
        try:
            location_name = reverse_geocode(float(lat), float(lon))
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(
                "Reverse geocoding failed: %s", e
            )
            location_name = None

        max_accuracy = getattr(settings, 'ATTENDANCE_MAX_GPS_ACCURACY_METERS', 100)
        if acc > max_accuracy:
            return Response({
                "code": "GPS_ACCURACY_TOO_LOW",
                "error": "GPS accuracy is too low.",
                "accuracy": acc,
                "max_allowed_accuracy": max_accuracy
            }, status=status.HTTP_400_BAD_REQUEST)

        branch = employee.branch
        if not branch:
            return Response({"error": "No branch assigned to your profile."}, status=status.HTTP_400_BAD_REQUEST)

        policy = getattr(branch, 'attendance_policy', None)
        allowed_radius = policy.allowed_radius if policy else (branch.allowed_radius or 100)

        approved_wfh = WFHRequest.objects.filter(
            employee=employee,
            date=today,
            status='APPROVED',
        ).exists()

        if employee.work_type == 'OFFICE' and not approved_wfh:
            branch_lat = branch.latitude
            branch_lon = branch.longitude
            if branch_lat is None or branch_lon is None:
                return Response({"error": "Branch coordinates (latitude/longitude) are not configured."}, status=status.HTTP_400_BAD_REQUEST)

            distance = calculate_distance(float(lat), float(lon), float(branch_lat), float(branch_lon))
            if distance > allowed_radius:
                return Response({
                    "error": f"You are outside the allowed office location ({round(distance, 1)}m away, allowed: {allowed_radius}m). Please move closer to the office.",
                    "distance": round(distance, 2),
                    "allowed_radius": allowed_radius
                }, status=status.HTTP_400_BAD_REQUEST)

        # Calculate attendance timing with 5-minute on-time window
        # + 10-minute grace window and maximum 3 grace usages
        # per employee per attendance cycle (26th -> 25th).
        now = timezone.now()

        # Use employee shift if assigned, else fallback to branch policy or default 09:00.
        shift_start_time = employee.shift.start_time if employee.shift else (policy.start_time if policy else time(9, 0))

        start_datetime = timezone.make_aware(
            datetime.combine(today, shift_start_time)
        )

        late_minutes = 0
        attendance_status = 'WORKING'
        grace_used = False

        if now > start_datetime:
            diff = now - start_datetime
            actual_late_minutes = int(diff.total_seconds() // 60)

            # First 5 minutes after shift start are still ON TIME.
            if actual_late_minutes <= 5:
                attendance_status = 'WORKING'
                late_minutes = 0
                grace_used = False

            else:
                # Attendance cycle boundaries: 26th -> 25th.
                from attendance.services import get_cycle_for_date

                _, _, month_start, month_end = get_cycle_for_date(today)

                next_month = month_end + timedelta(days=1)

                # Count explicitly recorded grace usages.
                grace_used_count = Attendance.objects.filter(
                    employee=employee,
                    date__gte=month_start,
                    date__lt=next_month,
                    grace_used=True
                ).exclude(date=today).count()

                # Minutes 6 through 15 after shift start are the
                # grace window. Only the first 3 such occurrences
                # in the attendance cycle can use grace.
                if actual_late_minutes <= 15 and grace_used_count < 3:
                    attendance_status = 'WORKING'
                    late_minutes = 0
                    grace_used = True
                else:
                    attendance_status = 'LATE'
                    late_minutes = actual_late_minutes
                    grace_used = False

        attendance_mode = 'WFH' if approved_wfh else 'OFFICE'

        if attendance:
            attendance.attendance_mode = attendance_mode
            attendance.check_in = timezone.now()
            attendance.check_in_latitude = lat
            attendance.check_in_longitude = lon
            attendance.check_in_accuracy = acc
            attendance.check_in_location_name = location_name
            attendance.check_in_photo = photo
            attendance.status = attendance_status
            attendance.late_minutes = late_minutes
            attendance.grace_used = grace_used
            attendance.save()
        else:
            attendance = Attendance.objects.create(
                employee=employee,
                date=today,
                attendance_mode=attendance_mode,
                check_in=timezone.now(),
                check_in_latitude=lat,
                check_in_longitude=lon,
                check_in_accuracy=acc,
                check_in_location_name=location_name,
                check_in_photo=photo,
                status=attendance_status,
                late_minutes=late_minutes,
                grace_used=grace_used
            )

        return Response(AttendanceSerializer(attendance).data, status=status.HTTP_201_CREATED)


class CheckOutView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        import logging
        logger = logging.getLogger(__name__)

        try:
            return self._post_checkout(request)
        except Exception:
            logger.exception("CHECKOUT 500 ERROR")
            raise

    def _post_checkout(self, request):
        user = request.user
        if not hasattr(user, 'employee_profile'):
            return Response({"error": "User is not an employee."}, status=status.HTTP_400_BAD_REQUEST)
        
        employee = user.employee_profile
        today = timezone.localdate()

        attendance = Attendance.objects.filter(employee=employee, date=today).first()
        if not attendance or not attendance.check_in:
            return Response({"error": "Please check in first."}, status=status.HTTP_400_BAD_REQUEST)
        
        if attendance.check_out or attendance.status == 'COMPLETED':
            return Response({
                "success": False,
                "code": "ATTENDANCE_ALREADY_COMPLETED",
                "message": "Today's attendance has already been completed."
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = CheckOutSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "code": "VALIDATION_ERROR",
                "message": "Check-out validation failed.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        lat = serializer.validated_data['latitude']
        lon = serializer.validated_data['longitude']
        acc = serializer.validated_data['accuracy']
        photo = serializer.validated_data['photo']
        from attendance.services import normalize_image_orientation
        photo = normalize_image_orientation(photo)

        # Reverse geocoding must never block attendance marking.
        try:
            location_name = reverse_geocode(float(lat), float(lon))
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(
                "Reverse geocoding failed: %s", e
            )
            location_name = None
        
        max_accuracy = getattr(settings, 'ATTENDANCE_MAX_GPS_ACCURACY_METERS', 100)
        if acc > max_accuracy:
            return Response({
                "code": "GPS_ACCURACY_TOO_LOW",
                "error": "GPS accuracy is too low.",
                "accuracy": acc,
                "max_allowed_accuracy": max_accuracy
            }, status=status.HTTP_400_BAD_REQUEST)

        branch = employee.branch
        if not branch:
            return Response({"error": "No branch assigned to your profile."}, status=status.HTTP_400_BAD_REQUEST)

        policy = getattr(branch, 'attendance_policy', None)
        allowed_radius = policy.allowed_radius if policy else (branch.allowed_radius or 100)

        if employee.work_type == 'OFFICE' and attendance.attendance_mode != 'WFH':
            branch_lat = branch.latitude
            branch_lon = branch.longitude
            if branch_lat is None or branch_lon is None:
                return Response({"error": "Branch coordinates (latitude/longitude) are not configured."}, status=status.HTTP_400_BAD_REQUEST)

            distance = calculate_distance(float(lat), float(lon), float(branch_lat), float(branch_lon))
            if distance > allowed_radius:
                return Response({
                    "error": f"You are outside the allowed attendance location ({round(distance, 1)}m away, allowed: {allowed_radius}m). Please move closer to the office.",
                    "distance": round(distance, 2),
                    "allowed_radius": allowed_radius
                }, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        attendance.check_out = now
        attendance.check_out_latitude = lat
        attendance.check_out_longitude = lon
        attendance.check_out_accuracy = acc
        attendance.check_out_location_name = location_name
        attendance.check_out_photo = photo
        
        shift_start_time = employee.shift.start_time if employee.shift else (policy.start_time if policy else time(9, 0))
        shift_end_time = employee.shift.end_time if employee.shift else (policy.end_time if policy else time(18, 0))
        
        # Handle overnight shifts for end datetime
        end_date = attendance.date
        if shift_end_time < shift_start_time:
            end_date = attendance.date + timedelta(days=1)
            
        end_datetime = timezone.make_aware(datetime.combine(end_date, shift_end_time))
        
        early_minutes = 0
        overtime_minutes = 0

        if now < end_datetime:
            diff = end_datetime - now
            early_minutes = int(diff.total_seconds() // 60)
        elif now > end_datetime:
            diff = now - end_datetime
            overtime_minutes = int(diff.total_seconds() // 60)

        # ---------------------------------------------------------
        # APPROVED PERMISSION COVERAGE
        # ---------------------------------------------------------
        approved_permission_minutes = PermissionRequest.objects.filter(
            employee=employee,
            date=today,
            status='APPROVED'
        ).aggregate(
            total=Sum('duration_minutes')
        )['total'] or 0

        covered_permission_minutes = min(
            early_minutes,
            approved_permission_minutes
        )

        extra_early_minutes = max(
            early_minutes - approved_permission_minutes,
            0
        )

        attendance.early_minutes = extra_early_minutes
        attendance.overtime_minutes = overtime_minutes

        if attendance.check_in:
            working_diff = now - attendance.check_in
            attendance.working_minutes = int(
                working_diff.total_seconds() // 60
            )

        if attendance.late_minutes > 0:
            attendance.status = 'LATE'
        else:
            attendance.status = 'COMPLETED'
        attendance.save()

        # Remove this employee's pending shift-end reminder after checkout.
        from notifications.models import Notification
        Notification.objects.filter(
            employee=employee,
            event='SHIFT_END',
            shift_date=today,
        ).delete()

        response_data = AttendanceSerializer(
            attendance,
            context={'request': request}
        ).data

        response_data['permission_minutes'] = approved_permission_minutes
        response_data['permission_covered_minutes'] = covered_permission_minutes
        response_data['extra_early_minutes'] = extra_early_minutes

        return Response(response_data, status=status.HTTP_200_OK)


class IsSuperAdminForHolidayManagement(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True

        return user.role in ("SUPER_ADMIN", "HR", "ADMIN")


class HolidayViewSet(viewsets.ModelViewSet):
    serializer_class = HolidaySerializer

    def perform_create(self, serializer):
        user = self.request.user

        if user.role == "SUPER_ADMIN":
            serializer.save()
            return

        company = getattr(user, "company", None)

        if company is None:
            employee = getattr(user, "employee_profile", None)
            if employee and employee.branch_id:
                company = employee.branch.company

        if company is None:
            from companies.models import Company
            company = Company.objects.first()

        if company is None:
            raise ValidationError({
                "company": "Your account is not assigned to a company."
            })

        serializer.save(company=company)

    def perform_update(self, serializer):
        user = self.request.user

        if user.role == "SUPER_ADMIN":
            serializer.save()
            return

        company = getattr(user, "company", None)

        if company is None:
            employee = getattr(user, "employee_profile", None)
            if employee and employee.branch_id:
                company = employee.branch.company

        if company is None:
            from companies.models import Company
            company = Company.objects.first()

        if company is None:
            raise ValidationError({
                "company": "Your account is not assigned to a company."
            })

        serializer.save(company=company)

    def get_permissions(self):
        return [IsSuperAdminForHolidayManagement()]

    def get_queryset(self):
        user = self.request.user
        queryset = Holiday.objects.select_related("company").all().order_by("date")

        if not user.is_authenticated:
            return queryset.none()

        if user.role != "SUPER_ADMIN":
            company = getattr(user, "company", None)

            if company is None:
                employee = getattr(user, "employee_profile", None)
                if employee and employee.branch_id:
                    company = employee.branch.company

            if company is None:
                return queryset.none()

            queryset = queryset.filter(company=company)
        else:
            # Super Admin can filter holidays by company query param
            comp_param = self.request.query_params.get("company")
            if comp_param and comp_param.isdigit():
                queryset = queryset.filter(company_id=comp_param)

        month = self.request.query_params.get("month")
        year = self.request.query_params.get("year")

        if month and year:
            try:
                queryset = queryset.filter(
                    date__month=int(month),
                    date__year=int(year),
                    is_active=True,
                )
            except (ValueError, TypeError):
                pass

        return queryset

    def perform_destroy(self, instance):
        instance.delete()


class PermissionRequestViewSet(viewsets.ModelViewSet):
    serializer_class = PermissionRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _check_employee_request_modification(self, instance):
        user = self.request.user

        if hasattr(user, 'employee_profile'):
            if instance.status != 'PENDING':
                raise ValidationError(
                    "Only pending requests can be edited or deleted."
                )
            return

        if user.role == 'HR':
            employee = instance.employee
            if (
                not user.company_id
                or not employee.branch_id
                or employee.branch.company_id != user.company_id
            ):
                raise PermissionDenied(
                    "You cannot modify requests from another company."
                )
            return

        if user.role in ('SUPER_ADMIN', 'ADMIN'):
            return

        raise PermissionDenied(
            "Only the employee, assigned company HR, or Super Admin "
            "can modify this request."
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._check_employee_request_modification(instance)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self._check_employee_request_modification(instance)
        return super().destroy(request, *args, **kwargs)

    def get_queryset(self):
        queryset = PermissionRequest.objects.select_related(
            'employee',
            'employee__user',
            'employee__branch',
            'employee__branch__company',
            'approved_by'
        ).order_by('-date', '-created_at')

        user = self.request.user

        if hasattr(user, 'employee_profile'):
            return queryset.filter(employee=user.employee_profile)

        if user.role == 'HR':
            if not user.company_id:
                return queryset.none()
            return queryset.filter(employee__branch__company_id=user.company_id)

        if user.role in ('SUPER_ADMIN', 'ADMIN'):
            return queryset

        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user

        if not hasattr(user, 'employee_profile'):
            raise ValidationError(
                "Only employees can apply for permission."
            )

        request_obj = serializer.save(employee=user.employee_profile)
        notify_admins_request_submitted(request_obj, kind='permission')

    @action(
        detail=False,
        methods=['get'],
        url_path='summary'
    )
    def summary(self, request):
        user = request.user

        if not hasattr(user, 'employee_profile'):
            return Response(
                {"error": "Only employees can view permission summary."},
                status=status.HTTP_403_FORBIDDEN
            )

        employee = user.employee_profile

        from datetime import datetime
        from django.db.models import Sum
        from attendance.services import get_cycle_for_date

        requested_date = request.query_params.get('date')

        if requested_date:
            try:
                selected_date = datetime.strptime(
                    requested_date,
                    '%Y-%m-%d'
                ).date()
            except ValueError:
                return Response(
                    {"error": "Invalid date. Use YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            selected_date = timezone.localdate()

        cycle_year, cycle_month, cycle_start, cycle_end = get_cycle_for_date(selected_date)

        active_statuses = ['PENDING', 'APPROVED']

        daily_used = PermissionRequest.objects.filter(
            employee=employee,
            date=selected_date,
            status__in=active_statuses
        ).aggregate(
            total=Sum('duration_minutes')
        )['total'] or 0

        cycle_used = PermissionRequest.objects.filter(
            employee=employee,
            date__gte=cycle_start,
            date__lte=cycle_end,
            status__in=active_statuses
        ).aggregate(
            total=Sum('duration_minutes')
        )['total'] or 0

        daily_limit = 60
        cycle_limit = 180

        return Response({
            "date": selected_date.isoformat(),
            "daily": {
                "limit_minutes": daily_limit,
                "used_minutes": daily_used,
                "remaining_minutes": max(
                    daily_limit - daily_used,
                    0
                )
            },
            "cycle": {
                "start_date": cycle_start.isoformat(),
                "end_date": cycle_end.isoformat(),
                "limit_minutes": cycle_limit,
                "used_minutes": cycle_used,
                "remaining_minutes": max(
                    cycle_limit - cycle_used,
                    0
                )
            }
        })

    @action(
        detail=True,
        methods=['patch', 'post'],
        permission_classes=[IsAdminUser]
    )
    def approve(self, request, pk=None):
        permission_request = self.get_object()

        if permission_request.status != 'PENDING':
            return Response(
                {"error": "Only pending permission requests can be approved."},
                status=status.HTTP_400_BAD_REQUEST
            )

        permission_request.status = 'APPROVED'
        permission_request.approved_by = request.user
        permission_request.approved_at = timezone.now()
        permission_request.rejection_reason = None
        permission_request.save()
        notify_employee_request_decision(permission_request, kind='permission')

        return Response(
            PermissionRequestSerializer(
                permission_request,
                context={'request': request}
            ).data
        )

    @action(
        detail=True,
        methods=['patch', 'post'],
        permission_classes=[IsAdminUser]
    )
    def reject(self, request, pk=None):
        permission_request = self.get_object()
        reason = request.data.get('reason')

        if permission_request.status != 'PENDING':
            return Response(
                {"error": "Only pending permission requests can be rejected."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not reason:
            return Response(
                {"error": "Rejection reason is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        permission_request.status = 'REJECTED'
        permission_request.rejection_reason = reason
        permission_request.approved_by = request.user
        permission_request.approved_at = timezone.now()
        permission_request.save()
        notify_employee_request_decision(permission_request, kind='permission')

        return Response(
            PermissionRequestSerializer(
                permission_request,
                context={'request': request}
            ).data
        )

    @action(
        detail=True,
        methods=['patch'],
        permission_classes=[IsAdminUser],
        url_path='undo'
    )
    def undo(self, request, pk=None):
        permission_request = self.get_object()

        if permission_request.status not in ('APPROVED', 'REJECTED'):
            return Response(
                {"error": "Only approved or rejected permission requests can be undone."},
                status=status.HTTP_400_BAD_REQUEST
            )

        permission_request.status = 'PENDING'
        permission_request.approved_by = None
        permission_request.approved_at = None
        permission_request.rejection_reason = None
        permission_request.save()

        return Response(
            PermissionRequestSerializer(
                permission_request,
                context={'request': request}
            ).data
        )


class LeaveRequestViewSet(viewsets.ModelViewSet):
    serializer_class = LeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _check_employee_request_modification(self, instance):
        user = self.request.user

        if hasattr(user, 'employee_profile'):
            if instance.status != 'PENDING':
                raise ValidationError(
                    "Only pending requests can be edited or deleted."
                )
            return

        if user.role == 'HR':
            employee = instance.employee
            if (
                not user.company_id
                or not employee.branch_id
                or employee.branch.company_id != user.company_id
            ):
                raise PermissionDenied(
                    "You cannot modify requests from another company."
                )
            return

        if user.role in ('SUPER_ADMIN', 'ADMIN'):
            return

        raise PermissionDenied(
            "Only the employee, assigned company HR, or Super Admin "
            "can modify this request."
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._check_employee_request_modification(instance)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self._check_employee_request_modification(instance)
        return super().destroy(request, *args, **kwargs)

    def get_queryset(self):
        queryset = LeaveRequest.objects.select_related(
            'employee',
            'employee__user',
            'employee__branch',
            'employee__branch__company',
            'approved_by'
        ).order_by('-start_date', '-created_at')

        user = self.request.user

        if hasattr(user, 'employee_profile'):
            return queryset.filter(employee=user.employee_profile)

        if user.role == 'HR':
            if not user.company_id:
                return queryset.none()
            return queryset.filter(employee__branch__company_id=user.company_id)

        if user.role in ('SUPER_ADMIN', 'ADMIN'):
            return queryset

        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user

        if not hasattr(user, 'employee_profile'):
            raise ValidationError(
                "Only employees can apply for leave."
            )

        request_obj = serializer.save(employee=user.employee_profile)
        notify_admins_request_submitted(request_obj, kind='leave')

    @action(detail=False, methods=['get'])
    def summary(self, request):
        user = request.user
        if not hasattr(user, 'employee_profile'):
            return Response(
                {"error": "Only employees can view leave summary."},
                status=status.HTTP_403_FORBIDDEN
            )

        employee = user.employee_profile
        from datetime import datetime
        from attendance.services import calculate_leave_usage_for_cycle, get_cycle_for_date

        requested_date = request.query_params.get('date')
        if requested_date:
            try:
                selected_date = datetime.strptime(requested_date, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {"error": "Invalid date. Use YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            selected_date = timezone.localdate()

        cycle_year, cycle_month, cycle_start, cycle_end = get_cycle_for_date(selected_date)
        usage = calculate_leave_usage_for_cycle(employee, cycle_year, cycle_month)

        return Response({
            "date": selected_date.isoformat(),
            "cycle": {
                "year": cycle_year,
                "month": cycle_month,
                "start_date": cycle_start.isoformat(),
                "end_date": cycle_end.isoformat(),
                "used_days": usage["used_days"],
                "by_type": usage["by_type"],
            }
        })

    @action(
        detail=True,
        methods=['patch', 'post'],
        permission_classes=[IsAdminUser]
    )
    def approve(self, request, pk=None):
        leave_request = self.get_object()

        if leave_request.status != 'PENDING':
            return Response(
                {"error": "Only pending leave requests can be approved."},
                status=status.HTTP_400_BAD_REQUEST
            )

        leave_request.status = 'APPROVED'
        leave_request.approved_by = request.user
        leave_request.approved_at = timezone.now()
        leave_request.rejection_reason = None
        leave_request.save()
        notify_employee_request_decision(leave_request, kind='leave')

        return Response(
            LeaveRequestSerializer(
                leave_request,
                context={'request': request}
            ).data
        )

    @action(
        detail=True,
        methods=['patch', 'post'],
        permission_classes=[IsAdminUser]
    )
    def reject(self, request, pk=None):
        leave_request = self.get_object()
        reason = request.data.get('reason')

        if leave_request.status != 'PENDING':
            return Response(
                {"error": "Only pending leave requests can be rejected."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not reason:
            return Response(
                {"error": "Rejection reason is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        leave_request.status = 'REJECTED'
        leave_request.rejection_reason = reason
        leave_request.approved_by = request.user
        leave_request.approved_at = timezone.now()
        leave_request.save()
        notify_employee_request_decision(leave_request, kind='leave')

        return Response(
            LeaveRequestSerializer(
                leave_request,
                context={'request': request}
            ).data
        )

    @action(
        detail=True,
        methods=['patch'],
        permission_classes=[IsAdminUser],
        url_path='undo'
    )
    def undo(self, request, pk=None):
        leave_request = self.get_object()

        if leave_request.status not in ('APPROVED', 'REJECTED'):
            return Response(
                {"error": "Only approved or rejected leave requests can be undone."},
                status=status.HTTP_400_BAD_REQUEST
            )

        leave_request.status = 'PENDING'
        leave_request.approved_by = None
        leave_request.approved_at = None
        leave_request.rejection_reason = None
        leave_request.save()

        return Response(
            LeaveRequestSerializer(
                leave_request,
                context={'request': request}
            ).data
        )




class WFHRequestViewSet(viewsets.ModelViewSet):
    serializer_class = WFHRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = WFHRequest.objects.select_related(
            'employee',
            'employee__user',
            'employee__branch',
            'employee__branch__company',
            'approved_by',
        ).order_by('-date', '-created_at')

        user = self.request.user

        if hasattr(user, 'employee_profile'):
            return queryset.filter(employee=user.employee_profile)

        if user.role == 'HR':
            if not user.company_id:
                return queryset.none()
            return queryset.filter(
                employee__branch__company_id=user.company_id
            )

        if user.role in ('SUPER_ADMIN', 'ADMIN'):
            return queryset

        return queryset.none()

    def _check_modification_permission(self, instance):
        user = self.request.user

        if hasattr(user, 'employee_profile'):
            if instance.status != 'PENDING':
                raise ValidationError(
                    'Only pending WFH requests can be edited or deleted.'
                )
            return

        if user.role == 'HR':
            if (
                not user.company_id
                or not instance.employee.branch_id
                or instance.employee.branch.company_id != user.company_id
            ):
                raise PermissionDenied(
                    'You cannot modify requests from another company.'
                )
            return

        if user.role in ('SUPER_ADMIN', 'ADMIN'):
            return

        raise PermissionDenied('You cannot modify this WFH request.')

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._check_modification_permission(instance)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self._check_modification_permission(instance)
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        user = self.request.user
        if not hasattr(user, 'employee_profile'):
            raise ValidationError(
                'Only employees can apply for work from home.'
            )

        request_obj = serializer.save(employee=user.employee_profile)
        notify_admins_request_submitted(request_obj, kind='wfh')

    @action(
        detail=True,
        methods=['patch', 'post'],
        permission_classes=[IsAdminUser],
    )
    def approve(self, request, pk=None):
        wfh_request = self.get_object()

        if wfh_request.status != 'PENDING':
            return Response(
                {'error': 'Only pending WFH requests can be approved.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        wfh_request.status = 'APPROVED'
        wfh_request.approved_by = request.user
        wfh_request.approved_at = timezone.now()
        wfh_request.rejection_reason = None
        wfh_request.save()
        notify_employee_request_decision(wfh_request, kind='wfh')

        return Response(
            WFHRequestSerializer(
                wfh_request,
                context={'request': request},
            ).data
        )

    @action(
        detail=True,
        methods=['patch', 'post'],
        permission_classes=[IsAdminUser],
    )
    def reject(self, request, pk=None):
        wfh_request = self.get_object()
        reason = request.data.get('reason')

        if wfh_request.status != 'PENDING':
            return Response(
                {'error': 'Only pending WFH requests can be rejected.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(reason, str) or not reason.strip():
            return Response(
                {'error': 'Rejection reason is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        wfh_request.status = 'REJECTED'
        wfh_request.rejection_reason = reason.strip()
        wfh_request.approved_by = request.user
        wfh_request.approved_at = timezone.now()
        wfh_request.save()
        notify_employee_request_decision(wfh_request, kind='wfh')

        return Response(
            WFHRequestSerializer(
                wfh_request,
                context={'request': request},
            ).data
        )
