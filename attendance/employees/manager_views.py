import logging
from datetime import date, datetime, timedelta
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, views, viewsets, permissions
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import User
from companies.models import Company
from branches.models import Branch
from attendance.models import Attendance, Holiday, LeaveRequest
from attendance.services import (
    resolve_holiday_map,
    get_employee_attendance_status,
)
from .models import Employee, TeamAssignmentHistory
from .manager_serializers import (
    ReportingManagerSerializer,
    CreateReportingManagerSerializer,
    UpdateReportingManagerSerializer,
    ResetManagerPasswordSerializer,
    AssignTeamMembersSerializer,
    AssignedEmployeeBriefSerializer,
)

logger = logging.getLogger(__name__)


# =========================================================================
# PERMISSIONS
# =========================================================================

class IsHRorSuperAdmin(permissions.BasePermission):
    """Allows access to Super Admins and HR users with assigned companies."""
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and (
                user.role in ('SUPER_ADMIN', 'ADMIN') or
                (user.role == 'HR' and user.company_id is not None)
            )
        )


class IsReportingManager(permissions.BasePermission):
    """Allows access only to active Reporting Managers."""
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and
            user.role in ('REPORTING_MANAGER', 'TEAM_LEADER') and
            user.is_active
        )


# =========================================================================
# HR / SUPER ADMIN REPORTING MANAGER MANAGEMENT VIEWS
# =========================================================================

class ReportingManagerViewSet(viewsets.ViewSet):
    """
    CRUD and team management APIs for HR and Super Admins.
    Allows HR to view, create, edit, activate/deactivate, reset passwords,
    and manage teams for Reporting Managers.
    """
    permission_classes = [IsHRorSuperAdmin]

    def _get_company_id(self, request):
        user = request.user
        if user.role == 'HR':
            return user.company_id
        company_id = request.query_params.get('company')
        return int(company_id) if company_id else None

    def list(self, request):
        """List all Reporting Managers in the HR user's company (or filtered by company for Super Admin)."""
        company_id = self._get_company_id(request)
        queryset = Employee.objects.filter(
            user__role='REPORTING_MANAGER'
        ).select_related(
            'user', 'branch', 'branch__company'
        ).prefetch_related('direct_reports')

        if company_id:
            # Include managers explicitly in this company AND global managers (branch is None or user.company is None)
            queryset = queryset.filter(Q(branch__company_id=company_id) | Q(branch__isnull=True, user__company__isnull=True))
        elif request.user.role == 'HR':
            return Response([])

        search = request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(full_name__icontains=search) |
                Q(employee_id__icontains=search) |
                Q(user__username__icontains=search) |
                Q(department__icontains=search) |
                Q(designation__icontains=search)
            )

        status_param = request.query_params.get('status')
        if status_param in ('active', 'true', '1'):
            queryset = queryset.filter(status=True, user__is_active=True)
        elif status_param in ('inactive', 'false', '0'):
            queryset = queryset.filter(Q(status=False) | Q(user__is_active=False))

        serializer = ReportingManagerSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """Get full details of a specific Reporting Manager including assigned team."""
        company_id = self._get_company_id(request)
        try:
            manager = Employee.objects.select_related(
                'user', 'branch', 'branch__company'
            ).get(pk=pk, user__role='REPORTING_MANAGER')
        except Employee.DoesNotExist:
            return Response({"detail": "Reporting Manager not found."}, status=status.HTTP_404_NOT_FOUND)

        if company_id and manager.branch and manager.branch.company_id != company_id:
            raise PermissionDenied("You do not have permission to view this manager.")

        serializer = ReportingManagerSerializer(
            manager,
            context={'request': request, 'include_employees': True}
        )
        return Response(serializer.data)

    def create(self, request):
        """Create / promote an existing employee to Reporting Manager."""
        serializer = CreateReportingManagerSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        manager = serializer.save()

        # Reload with relations
        manager = Employee.objects.select_related(
            'user', 'branch', 'branch__company'
        ).get(pk=manager.pk)

        return Response(
            ReportingManagerSerializer(manager, context={'request': request, 'include_employees': True}).data,
            status=status.HTTP_201_CREATED
        )

    def partial_update(self, request, pk=None):
        """Update manager department, designation, username, or status."""
        company_id = self._get_company_id(request)
        try:
            manager = Employee.objects.select_related(
                'user', 'branch', 'branch__company'
            ).get(pk=pk, user__role='REPORTING_MANAGER')
        except Employee.DoesNotExist:
            return Response({"detail": "Reporting Manager not found."}, status=status.HTTP_404_NOT_FOUND)

        if company_id and manager.branch and manager.branch.company_id != company_id:
            raise PermissionDenied("You do not have permission to edit this manager.")

        serializer = UpdateReportingManagerSerializer(
            manager,
            data=request.data,
            partial=True,
            context={'request': request, 'manager': manager}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(ReportingManagerSerializer(manager, context={'request': request}).data)

    def destroy(self, request, pk=None):
        """
        Deactivate or demote a manager back to Employee, unassigning direct reports.
        Preserves the employee record and attendance history.
        """
        company_id = self._get_company_id(request)
        try:
            manager = Employee.objects.select_related(
                'user', 'branch', 'branch__company'
            ).get(pk=pk, user__role='REPORTING_MANAGER')
        except Employee.DoesNotExist:
            return Response({"detail": "Reporting Manager not found."}, status=status.HTTP_404_NOT_FOUND)

        if company_id and manager.branch and manager.branch.company_id != company_id:
            raise PermissionDenied("You do not have permission to delete this manager.")

        # Reassign direct reports to None and archive in TeamAssignmentHistory
        direct_report_ids = list(manager.direct_reports.values_list('id', flat=True))
        if direct_report_ids:
            TeamAssignmentHistory.objects.filter(
                employee_id__in=direct_report_ids,
                manager=manager,
                is_active=True
            ).update(is_active=False, unassigned_at=timezone.now())

            Employee.objects.filter(id__in=direct_report_ids).update(reporting_manager=None)

        if manager.user:
            manager.user.role = 'EMPLOYEE'
            manager.user.is_active = False
            manager.user.save(update_fields=['role', 'is_active'])

        manager.status = False
        manager.save(update_fields=['status'])

        return Response(
            {"message": f"{manager.full_name} has been removed from Reporting Managers and login access revoked."},
            status=status.HTTP_200_OK
        )


class ManagerActionViews(views.APIView):
    """Actions: activate, deactivate, reset-password, assign-team, remove-member."""
    permission_classes = [IsHRorSuperAdmin]

    def _get_manager(self, request, pk):
        try:
            manager = Employee.objects.select_related(
                'user', 'branch', 'branch__company'
            ).get(pk=pk, user__role='REPORTING_MANAGER')
        except Employee.DoesNotExist:
            return None

        if request.user.role == 'HR':
            if not manager.branch or manager.branch.company_id != request.user.company_id:
                raise PermissionDenied("You do not have access to this manager.")
        return manager

    def post(self, request, pk, action_name):
        manager = self._get_manager(request, pk)
        if not manager:
            return Response({"detail": "Reporting Manager not found."}, status=status.HTTP_404_NOT_FOUND)

        if action_name == 'activate':
            manager.status = True
            manager.save(update_fields=['status'])
            if manager.user:
                manager.user.is_active = True
                manager.user.save(update_fields=['is_active'])
            return Response({"message": f"{manager.full_name} has been activated."})

        elif action_name == 'deactivate':
            manager.status = False
            manager.save(update_fields=['status'])
            if manager.user:
                manager.user.is_active = False
                manager.user.save(update_fields=['is_active'])
            return Response({"message": f"{manager.full_name} has been deactivated."})

        elif action_name == 'reset-password':
            serializer = ResetManagerPasswordSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            if not manager.user:
                return Response({"detail": "Manager has no linked login account."}, status=status.HTTP_400_BAD_REQUEST)
            manager.user.set_password(serializer.validated_data['new_password'])
            manager.user.save(update_fields=['password'])
            return Response({"message": f"Password for {manager.full_name} reset successfully."})

        elif action_name == 'assign-team':
            serializer = AssignTeamMembersSerializer(
                data=request.data,
                context={'request': request, 'manager': manager}
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response({
                "message": "Team members updated successfully.",
                "manager": ReportingManagerSerializer(manager, context={'request': request, 'include_employees': True}).data
            })

        elif action_name == 'remove-member':
            employee_id = request.data.get('employee_id')
            if not employee_id:
                return Response({"employee_id": "employee_id is required."}, status=status.HTTP_400_BAD_REQUEST)

            emp = Employee.objects.filter(id=employee_id, reporting_manager=manager).first()
            if not emp:
                return Response({"detail": "Employee is not assigned to this manager."}, status=status.HTTP_404_NOT_FOUND)

            emp.reporting_manager = None
            emp.save(update_fields=['reporting_manager'])

            TeamAssignmentHistory.objects.filter(
                manager=manager,
                employee=emp,
                is_active=True
            ).update(is_active=False, unassigned_at=timezone.now())

            return Response({"message": f"{emp.full_name} removed from {manager.full_name}'s team."})

        return Response({"detail": f"Unknown action '{action_name}'."}, status=status.HTTP_400_BAD_REQUEST)


# =========================================================================
# REPORTING MANAGER PORTAL APIS (ROLE = REPORTING_MANAGER)
# =========================================================================

class ManagerPortalBaseView(views.APIView):
    permission_classes = [IsReportingManager]

    def get_manager_employee(self, request):
        employee = getattr(request.user, 'employee_profile', None)
        if not employee:
            raise PermissionDenied("No employee profile found for this Reporting Manager account.")
        return employee

    def get_manager_team_queryset(self, manager, status_filter=None):
        """
        Returns employees assigned to this manager according to the strict scope:
        1. If manager is assigned multiple managed_branches:
           Strictly returns employees belonging to those managed branches!
        2. Else if manager is assigned to a specific branch:
           Strictly returns employees belonging to that branch only!
        3. Else if manager is assigned to a specific company (no branch):
           Strictly returns employees belonging to that company only!
        4. Else (Global Access Manager - All Companies / no branch & no company):
           Returns employees across all companies/branches!
        """
        managed_branches = manager.managed_branches.all()
        if managed_branches.exists():
            qs = Employee.objects.filter(
                branch__in=managed_branches
            ).exclude(pk=manager.pk).exclude(user__role__in=['SUPER_ADMIN', 'ADMIN']).order_by('employee_id')
        elif manager.branch:
            # Strictly scoped to this branch only
            qs = Employee.objects.filter(
                branch=manager.branch
            ).exclude(pk=manager.pk).exclude(user__role__in=['SUPER_ADMIN', 'ADMIN']).order_by('employee_id')
        elif manager.user and manager.user.company_id:
            # Scoped to company
            qs = Employee.objects.filter(
                branch__company_id=manager.user.company_id
            ).exclude(pk=manager.pk).exclude(user__role__in=['SUPER_ADMIN', 'ADMIN']).order_by('employee_id')
        else:
            # Global Access: all employees across all companies ordered by employee_id
            qs = Employee.objects.filter(
            ).exclude(pk=manager.pk).exclude(user__role__in=['SUPER_ADMIN', 'ADMIN']).order_by('employee_id')

        if status_filter is True:
            qs = qs.filter(status=True)
        elif status_filter is False:
            qs = qs.filter(status=False)

        return qs


class ManagerProfileView(ManagerPortalBaseView):
    """Returns the logged-in manager's own profile and company identity."""
    def get(self, request):
        manager = self.get_manager_employee(request)
        serializer = ReportingManagerSerializer(
            manager,
            context={'request': request, 'include_employees': True}
        )
        return Response(serializer.data)


class ManagerMyTeamView(ManagerPortalBaseView):
    """
    Returns the list of employees assigned exclusively to the logged-in manager.
    Enforces that a manager can never see employees from another manager or company.
    """
    def get(self, request):
        manager = self.get_manager_employee(request)
        search = request.query_params.get('search', '').strip()
        status_param = request.query_params.get('status')

        status_filter = None
        if status_param in ('active', 'true', '1'):
            status_filter = True
        elif status_param in ('inactive', 'false', '0'):
            status_filter = False

        queryset = self.get_manager_team_queryset(manager, status_filter=status_filter).select_related(
            'user', 'branch', 'branch__company'
        )

        if search:
            queryset = queryset.filter(
                Q(full_name__icontains=search) |
                Q(employee_id__icontains=search) |
                Q(department__icontains=search) |
                Q(designation__icontains=search)
            )

        serializer = AssignedEmployeeBriefSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)


class ManagerTeamEmployeeDetailView(views.APIView):
    """
    Returns complete details of an employee for Reporting Managers and Team Leaders.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        user = request.user
        emp = getattr(user, 'employee_profile', None)
        if not emp:
            raise PermissionDenied("No employee profile found.")

        is_mgr = user.role in ('REPORTING_MANAGER', 'SUPER_ADMIN', 'ADMIN')
        is_tl = bool(
            user.role == 'TEAM_LEADER' or
            emp.team_members.exists() or
            'team leader' in (emp.designation or '').lower() or
            'lead' in (emp.designation or '').lower()
        )

        if not (is_mgr or is_tl):
            raise PermissionDenied("Access restricted to Managers and Team Leaders.")

        try:
            if is_mgr:
                employee = Employee.objects.select_related(
                    'user', 'branch', 'branch__company', 'shift'
                ).get(pk=pk)
            else:
                employee = Employee.objects.select_related(
                    'user', 'branch', 'branch__company', 'shift'
                ).filter(
                    Q(team_leader=emp) | Q(branch=emp.branch) | Q(pk=pk)
                ).get(pk=pk)
        except Employee.DoesNotExist:
            raise PermissionDenied("You do not have permission to view this employee.")

        from .serializers import EmployeeSerializer
        return Response(EmployeeSerializer(employee, context={'request': request}).data)


class ManagerTeamAttendanceView(ManagerPortalBaseView):
    """
    Returns attendance records of the manager's assigned team for a selected date
    or date range, using the centralized attendance-status engine.
    """
    def get(self, request):
        manager = self.get_manager_employee(request)
        date_str = request.query_params.get('date')
        if date_str:
            try:
                selected_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({"detail": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            selected_date = timezone.localdate()

        company_id_param = request.query_params.get('company')
        branch_id_param = request.query_params.get('branch')

        team_qs = self.get_manager_team_queryset(manager, status_filter=True).select_related(
            'branch', 'branch__company', 'shift'
        )
        if company_id_param:
            team_qs = team_qs.filter(branch__company_id=company_id_param)
        if branch_id_param:
            team_qs = team_qs.filter(branch_id=branch_id_param)

        assigned_employees = list(team_qs)

        if not assigned_employees:
            return Response({
                "date": selected_date.isoformat(),
                "team_attendance": [],
                "summary": {
                    "total": 0, "present": 0, "late": 0, "absent": 0,
                    "holiday": 0, "on_leave": 0, "half_day": 0, "weekly_off": 0,
                    "pending": 0,
                }
            })

        emp_ids = [e.id for e in assigned_employees]
        attendances = {
            att.employee_id: att
            for att in Attendance.objects.filter(employee_id__in=emp_ids, date=selected_date)
        }

        # Resolve holiday map for the company
        company = manager.branch.company if manager.branch else None
        holidays_map = resolve_holiday_map(selected_date, selected_date, company=company) if company else {}

        # Resolve leaves for selected date
        leaves_qs = LeaveRequest.objects.filter(
            employee_id__in=emp_ids,
            status='APPROVED',
            start_date__lte=selected_date,
            end_date__gte=selected_date
        )
        leaves_map = {l.employee_id: l for l in leaves_qs}

        team_rows = []
        counts = {
            "total": len(assigned_employees),
            "present": 0,
            "late": 0,
            "absent": 0,
            "holiday": 0,
            "on_leave": 0,
            "half_day": 0,
            "weekly_off": 0,
            "pending": 0,
        }

        date_str = str(selected_date)
        for emp in assigned_employees:
            att = attendances.get(emp.id)
            holiday_obj = holidays_map.get(date_str)
            leave_obj = leaves_map.get(emp.id)
            calculated_status = get_employee_attendance_status(
                record=att,
                employee=emp,
                target_date=selected_date,
                holiday=holiday_obj,
                approved_leave=leave_obj,
            )
            reason = ''
            if calculated_status == 'HOLIDAY' and holiday_obj:
                reason = holiday_obj.name
            elif calculated_status == 'ON_LEAVE' and leave_obj:
                reason = f"{leave_obj.leave_type} Leave"
            elif calculated_status == 'LATE' and att:
                h = att.late_minutes // 60
                m = att.late_minutes % 60
                if h > 0 and m > 0:
                    late_str = f"{h}h {m}m"
                elif h > 0:
                    late_str = f"{h}h"
                else:
                    late_str = f"{m}m"
                reason = f"Late by {late_str}"

            status_key = calculated_status.lower().replace(' ', '_')
            if status_key in counts:
                counts[status_key] += 1
            else:
                counts["pending"] += 1

            check_in_local = timezone.localtime(att.check_in) if att and att.check_in else None
            check_out_local = timezone.localtime(att.check_out) if att and att.check_out else None

            # Calculate working hours if both in and out present
            working_hours_calc = None
            if check_in_local and check_out_local:
                diff = check_out_local - check_in_local
                ts = int(diff.total_seconds())
                working_hours_calc = f"{ts // 3600:02d}:{(ts % 3600) // 60:02d}"

            team_rows.append({
                "employee_id": emp.id,
                "employee_code": emp.employee_id,
                "full_name": emp.full_name,
                "department": emp.department,
                "designation": emp.designation,
                "branch_name": emp.branch.branch_name if emp.branch else '',
                "branch_id": emp.branch.id if emp.branch else None,
                "company_name": emp.branch.company.name if (emp.branch and emp.branch.company) else '',
                "company_id": emp.branch.company.id if (emp.branch and emp.branch.company) else None,
                "profile_photo": emp.profile_photo.url if emp.profile_photo else None,
                "calculated_status": calculated_status,
                "status_reason": reason,
                "check_in": check_in_local.strftime('%H:%M:%S') if check_in_local else None,
                "check_out": check_out_local.strftime('%H:%M:%S') if check_out_local else None,
                "check_in_time": check_in_local.isoformat() if check_in_local else None,
                "check_out_time": check_out_local.isoformat() if check_out_local else None,
                "check_in_photo": att.check_in_photo.url if att and att.check_in_photo else None,
                "check_out_photo": att.check_out_photo.url if att and att.check_out_photo else None,
                "late_reason": getattr(att, 'late_reason', None) if att else None,
                "working_hours": working_hours_calc or (getattr(att, 'working_hours', None) if att else None),
                "late_minutes": att.late_minutes if att else 0,
                "attendance_id": att.id if att else None,
                "approval_status": att.approval_status if att else None,
                "rejection_reason": att.rejection_reason if att else None,
                "check_in_approval_status": att.check_in_approval_status if att and att.check_in else None,
                "check_in_rejection_reason": att.check_in_rejection_reason if att else None,
                "check_in_location_name": (att.check_in_location_name or (emp.branch.branch_name if emp.branch else None)) if att else None,
                "check_out_approval_status": att.check_out_approval_status if att and att.check_out else None,
                "check_out_rejection_reason": att.check_out_rejection_reason if att else None,
                "check_out_location_name": (att.check_out_location_name or (emp.branch.branch_name if emp.branch else None)) if att else None,
            })

        status_filter_param = (request.query_params.get('status') or '').strip().upper()
        if status_filter_param:
            # Map friendly status names
            if status_filter_param in ('PRESENT_TODAY', 'PRESENT'):
                team_rows = [r for r in team_rows if r['calculated_status'] in ('PRESENT', 'LATE', 'HALF DAY', 'HALF_DAY')]
            elif status_filter_param in ('LATE_TODAY', 'LATE'):
                team_rows = [r for r in team_rows if r['calculated_status'] == 'LATE' or (r['late_minutes'] and r['late_minutes'] > 0)]
            elif status_filter_param in ('ABSENT_TODAY', 'ABSENT'):
                team_rows = [r for r in team_rows if r['calculated_status'] == 'ABSENT']
            elif status_filter_param in ('ON_LEAVE_TODAY', 'ON_LEAVE', 'LEAVE'):
                team_rows = [r for r in team_rows if r['calculated_status'] in ('ON_LEAVE', 'ON LEAVE')]
            elif status_filter_param in ('HOLIDAY_TODAY', 'HOLIDAY'):
                team_rows = [r for r in team_rows if r['calculated_status'] == 'HOLIDAY']

        return Response({
            "date": selected_date.isoformat(),
            "team_attendance": team_rows,
            "summary": counts
        })


class ManagerDashboardSummaryView(ManagerPortalBaseView):
    """
    Provides top-level metrics for the Manager Dashboard:
    - Total Assigned Employees
    - Present Today
    - Late Today
    - Absent Today
    - On Leave Today
    - Holiday Today
    """
    def get(self, request):
        manager = self.get_manager_employee(request)
        today = timezone.localdate()

        company_id_param = request.query_params.get('company')
        branch_id_param = request.query_params.get('branch')

        team_qs = self.get_manager_team_queryset(manager, status_filter=True).select_related(
            'branch', 'branch__company', 'shift'
        )
        if company_id_param:
            team_qs = team_qs.filter(branch__company_id=company_id_param)
        if branch_id_param:
            team_qs = team_qs.filter(branch_id=branch_id_param)

        assigned_employees = list(team_qs)

        total_employees = len(assigned_employees)
        if total_employees == 0:
            return Response({
                "date": today.isoformat(),
                "manager_name": manager.full_name,
                "total_employees": 0,
                "present_today": 0,
                "late_today": 0,
                "absent_today": 0,
                "on_leave_today": 0,
                "holiday_today": 0,
                "pending_approvals": 0,
            })

        emp_ids = [e.id for e in assigned_employees]
        attendances = {
            att.employee_id: att
            for att in Attendance.objects.filter(employee_id__in=emp_ids, date=today)
        }

        company = manager.branch.company if manager.branch else None
        holidays_map = resolve_holiday_map(today, today, company=company) if company else {}

        leaves_qs = LeaveRequest.objects.filter(
            employee_id__in=emp_ids,
            status='APPROVED',
            start_date__lte=today,
            end_date__gte=today
        )
        leaves_map = {l.employee_id: l for l in leaves_qs}

        present = 0
        late = 0
        absent = 0
        on_leave = 0
        holiday = 0

        today_str = str(today)
        now_dt = timezone.localtime()
        is_sunday = (today.weekday() == 6)

        for emp in assigned_employees:
            att = attendances.get(emp.id)
            holiday_obj = holidays_map.get(today_str)
            leave_obj = leaves_map.get(emp.id)

            # 1. Approved Leave
            if leave_obj:
                on_leave += 1
                continue

            # 2. Holiday
            if holiday_obj:
                holiday += 1
                continue

            # 3. Punched in today (Present / Late)
            if att and att.check_in and getattr(att, 'check_in_approval_status', '') != 'REJECTED':
                present += 1
                late_mins = getattr(att, 'late_minutes', 0) or 0
                if late_mins > 0 or getattr(att, 'status', '') == 'LATE':
                    late += 1
            else:
                if is_sunday:
                    continue
                calc_status = get_employee_attendance_status(
                    record=att,
                    employee=emp,
                    target_date=today,
                    holiday=holiday_obj,
                    approved_leave=leave_obj,
                )
                if calc_status == 'ABSENT':
                    absent += 1
                elif calc_status in ('ON_LEAVE', 'HALF DAY', 'HALF_DAY'):
                    on_leave += 1
                elif calc_status == 'HOLIDAY':
                    holiday += 1
                else:
                    # If shift start has passed + 30m grace without punch, mark as absent for today
                    shift = getattr(emp, 'shift', None)
                    if shift and shift.start_time:
                        shift_start_dt = timezone.make_aware(
                            datetime.combine(today, shift.start_time),
                            timezone.get_current_timezone()
                        )
                        if now_dt > (shift_start_dt + timedelta(minutes=30)):
                            absent += 1
                    elif now_dt.hour >= 12:
                        absent += 1

        comp_name = manager.branch.company.name if (manager.branch and manager.branch.company) else (request.user.company.name if request.user.company else 'All Companies')
        tl_count = sum(1 for e in assigned_employees if e.user and e.user.role == 'TEAM_LEADER')
        dir_count = total_employees - tl_count

        pending_count = Attendance.objects.filter(
            employee_id__in=emp_ids,
            date=today,
            approval_status='PENDING'
        ).count()

        return Response({
            "date": today.isoformat(),
            "manager_name": manager.full_name,
            "company_name": comp_name,
            "designation": "Reporting Manager",
            "total_employees": total_employees,
            "total_team_leaders": tl_count,
            "direct_employees": dir_count,
            "present_today": present,
            "late_today": late,
            "absent_today": absent,
            "on_leave_today": on_leave,
            "holiday_today": holiday,
            "pending_approvals": pending_count,
        })



class IsReportingManagerOrTeamLeader(permissions.BasePermission):
    """Allows access to active Reporting Managers and Team Leaders."""
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and
            user.role in ('REPORTING_MANAGER', 'TEAM_LEADER') and
            user.is_active
        )


class PromoteEmployeeToTeamLeaderView(views.APIView):
    """
    Reporting Manager promotes an assigned employee to Team Leader.
    - Preserves employee record, ID, attendance, and leave history.
    - Upgrades or creates a linked User record with role TEAM_LEADER.
    - Associates with the same company and manager.
    """
    permission_classes = [IsReportingManager]

    def post(self, request, pk):
        manager_emp = getattr(request.user, 'employee_profile', None)
        if not manager_emp:
            raise PermissionDenied("Reporting Manager profile not found.")

        try:
            employee = Employee.objects.select_related('user', 'branch', 'branch__company').get(pk=pk)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        # Tenant and reporting hierarchy validation
        if employee.branch and employee.branch.company_id != request.user.company_id:
            raise PermissionDenied("Employee belongs to a different company.")

        if employee.reporting_manager_id != manager_emp.id and employee.id != manager_emp.id:
            raise PermissionDenied("You can only promote employees reporting to you.")

        username = (request.data.get('username') or '').strip()
        password = request.data.get('password')

        user = employee.user
        if not user:
            if not username:
                username = f"{employee.full_name.lower().replace(' ', '_')}_{employee.id}"
            if not password:
                password = 'Password@123'
            
            # Check unique username
            if User.objects.filter(username__iexact=username).exists():
                username = f"{username}_{employee.id}"

            user = User.objects.create_user(
                username=username,
                password=password,
                role='TEAM_LEADER',
                company_id=request.user.company_id,
                is_active=True
            )
            employee.user = user
            employee.save(update_fields=['user'])
        else:
            user.role = 'TEAM_LEADER'
            user.company_id = request.user.company_id
            user.is_active = True
            if username:
                user.username = username
            if password:
                user.set_password(password)
            user.save()

        # Update designation if appropriate
        if not 'lead' in employee.designation.lower():
            employee.designation = f"Team Leader - {employee.designation}"
            employee.save(update_fields=['designation'])

        return Response({
            "message": f"{employee.full_name} has been promoted to Team Leader.",
            "employee_id": employee.id,
            "username": user.username,
            "role": user.role,
        }, status=status.HTTP_200_OK)


class TeamLeaderTeamAssignmentView(views.APIView):
    """
    Reporting Manager assigns or removes employees from a Team Leader's team.
    """
    permission_classes = [IsReportingManager]

    def get(self, request, pk):
        try:
            team_leader = Employee.objects.select_related('user', 'branch').get(pk=pk)
        except Employee.DoesNotExist:
            return Response({"detail": "Team Leader not found."}, status=status.HTTP_404_NOT_FOUND)

        assigned_members = team_leader.team_members.filter(status=True).values(
            'id', 'employee_id', 'full_name', 'department', 'designation'
        )
        assigned_list = list(assigned_members)
        return Response({
            'team_leader_id': team_leader.id,
            'team_leader_name': team_leader.full_name,
            'assigned_employee_ids': [m['id'] for m in assigned_list],
            'assigned_members': assigned_list,
        })

    def post(self, request, pk):
        manager_emp = getattr(request.user, 'employee_profile', None)
        if not manager_emp:
            raise PermissionDenied("Reporting Manager profile not found.")

        try:
            team_leader = Employee.objects.select_related('user', 'branch').get(pk=pk)
            is_tl = (
                (team_leader.user and team_leader.user.role == 'TEAM_LEADER') or
                'team leader' in (team_leader.designation or '').lower() or
                'lead' in (team_leader.designation or '').lower()
            )
            if not is_tl:
                return Response({"detail": "Employee is not a Team Leader."}, status=status.HTTP_400_BAD_REQUEST)
        except Employee.DoesNotExist:
            return Response({"detail": "Team Leader not found."}, status=status.HTTP_404_NOT_FOUND)

        # Resolve manager's company ID
        manager_company_id = request.user.company_id
        if not manager_company_id and manager_emp.branch:
            manager_company_id = manager_emp.branch.company_id
        if not manager_company_id and team_leader.branch:
            # Fallback to team leader's company if manager is an overall company RM
            manager_company_id = team_leader.branch.company_id

        if team_leader.branch and manager_company_id and team_leader.branch.company_id != manager_company_id:
            raise PermissionDenied("Team Leader belongs to a different company.")

        employee_ids = request.data.get('employee_ids', [])
        action = request.data.get('action', 'assign')  # 'assign' or 'remove'

        if not isinstance(employee_ids, list):
            return Response({"detail": "employee_ids must be a list."}, status=status.HTTP_400_BAD_REQUEST)

        valid_employees = Employee.objects.filter(id__in=employee_ids)
        if manager_company_id:
            valid_employees = valid_employees.filter(branch__company_id=manager_company_id)

        if action == 'assign':
            # Synchronize: unassign any employee previously in this team who was unchecked
            team_leader.team_members.exclude(id__in=employee_ids).update(team_leader=None)
            # Assign selected employees
            valid_employees = valid_employees.exclude(id=team_leader.id)
            valid_employees.update(team_leader=team_leader)
            msg = f"{valid_employees.count()} employees assigned to Team Leader {team_leader.full_name}."
        elif action == 'remove':
            valid_employees.filter(team_leader=team_leader).update(team_leader=None)
            msg = f"{valid_employees.count()} employees removed from Team Leader {team_leader.full_name}."
        else:
            return Response({"detail": "Invalid action."}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"message": msg}, status=status.HTTP_200_OK)


class TeamLeaderDashboardSummaryView(views.APIView):
    """
    Dashboard metrics for Team Leader:
      - Team Leader Name, Company Name, Reporting Manager
      - Total Team Members, Present Today, Late Today, Absent Today, On Leave Today
      - Pending Tasks, Completed Tasks, Overdue Tasks
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        emp = getattr(user, 'employee_profile', None)
        if not emp or user.role != 'TEAM_LEADER':
            raise PermissionDenied("Access allowed only for Team Leaders.")

        today = timezone.localdate()
        company = emp.branch.company if emp.branch else None
        company_name = company.name if company else (user.company.name if user.company else 'All Companies')
        rep_mgr_name = emp.reporting_manager.full_name if emp.reporting_manager else 'N/A'

        team_members = list(emp.team_members.filter(status=True).select_related('shift', 'branch'))
        total_team = len(team_members)

        # Attendance calculation
        emp_ids = [m.id for m in team_members]
        attendances = {
            att.employee_id: att
            for att in Attendance.objects.filter(employee_id__in=emp_ids, date=today)
        }
        holidays_map = resolve_holiday_map(today, today, company=company) if company else {}
        leaves_map = {
            l.employee_id: l
            for l in LeaveRequest.objects.filter(
                employee_id__in=emp_ids, status='APPROVED',
                start_date__lte=today, end_date__gte=today
            )
        }

        present = 0
        late = 0
        absent = 0
        on_leave = 0

        today_str = str(today)
        now_dt = timezone.localtime()
        is_sunday = (today.weekday() == 6)

        for member in team_members:
            att = attendances.get(member.id)
            holiday_obj = holidays_map.get(today_str)
            leave_obj = leaves_map.get(member.id)

            if leave_obj:
                on_leave += 1
                continue

            if holiday_obj:
                continue

            if att and att.check_in and getattr(att, 'check_in_approval_status', '') != 'REJECTED':
                present += 1
                late_mins = getattr(att, 'late_minutes', 0) or 0
                if late_mins > 0 or getattr(att, 'status', '') == 'LATE':
                    late += 1
            else:
                if is_sunday:
                    continue
                calc_status = get_employee_attendance_status(
                    record=att,
                    employee=member,
                    target_date=today,
                    holiday=holiday_obj,
                    approved_leave=leave_obj,
                )
                if calc_status == 'ABSENT':
                    absent += 1
                elif calc_status in ('ON_LEAVE', 'HALF DAY', 'HALF_DAY'):
                    on_leave += 1
                else:
                    shift = getattr(member, 'shift', None)
                    if shift and shift.start_time:
                        shift_start_dt = timezone.make_aware(
                            datetime.combine(today, shift.start_time),
                            timezone.get_current_timezone()
                        )
                        if now_dt > (shift_start_dt + timedelta(minutes=30)):
                            absent += 1
                    elif now_dt.hour >= 12:
                        absent += 1

        # Task metrics
        from task_tracking.models import Task
        Task.objects.filter(due_date__lt=today).exclude(status__in=['COMPLETED']).update(status='OVERDUE')
        
        team_tasks = Task.objects.filter(
            Q(company_id=user.company_id) & (
                Q(team_leader=emp) | Q(assigned_to__team_leader=emp) | Q(assigned_to=emp)
            )
        )
        pending_tasks = team_tasks.filter(status__in=['TODO', 'IN_PROGRESS', 'PENDING_REVIEW']).count()
        completed_tasks = team_tasks.filter(status='COMPLETED').count()
        overdue_tasks = team_tasks.filter(status='OVERDUE').count()

        return Response({
            "leader_name": emp.full_name,
            "company_name": company_name,
            "designation": "Team Leader",
            "reporting_manager_name": rep_mgr_name,
            "total_team_members": total_team,
            "present_today": present,
            "late_today": late,
            "absent_today": absent,
            "on_leave_today": on_leave,
            "pending_tasks": pending_tasks,
            "completed_tasks": completed_tasks,
            "overdue_tasks": overdue_tasks,
        })


class TeamLeaderMyTeamView(views.APIView):
    """Returns only employees assigned to the logged-in Team Leader."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        emp = getattr(user, 'employee_profile', None)
        is_tl = bool(
            emp and (
                user.role == 'TEAM_LEADER' or
                emp.team_members.exists() or
                'team leader' in (emp.designation or '').lower() or
                'lead' in (emp.designation or '').lower()
            )
        )
        if not is_tl:
            raise PermissionDenied("Access allowed only for Team Leaders.")

        search = request.query_params.get('search', '').strip()
        queryset = emp.team_members.select_related('user', 'branch', 'branch__company').all()

        if search:
            queryset = queryset.filter(
                Q(full_name__icontains=search) |
                Q(employee_id__icontains=search) |
                Q(department__icontains=search) |
                Q(designation__icontains=search)
            )

        serializer = AssignedEmployeeBriefSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)
