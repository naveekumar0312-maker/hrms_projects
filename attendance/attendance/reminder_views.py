from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.utils import timezone
from django.db.models import Q

from .models import LeaveRequest, PermissionRequest, WFHRequest, Attendance
from task_tracking.models import Task
from employees.models import Employee


class PendingActionsReminderView(APIView):
    """
    Centralized API providing pending approval requests and overview reminders:
    - SUPER_ADMIN / ADMIN: System-wide counts and pending approval list (leaves, permissions, wfh, attendance punches, overdue/pending tasks).
    - HR: Company-wide pending leaves, permissions, wfh, attendance punch approvals, pending tasks.
    - REPORTING_MANAGER: Team-specific pending approvals (leaves, permissions, wfh, attendance punch checkins/checkouts, assigned pending tasks).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        role = getattr(user, 'role', 'EMPLOYEE')
        emp = getattr(user, 'employee_profile', None)

        if role not in ('SUPER_ADMIN', 'ADMIN', 'HR', 'REPORTING_MANAGER'):
            return Response({
                "role": role,
                "has_pending": False,
                "total_pending_count": 0,
                "pending_items": [],
                "summary": {},
            })

        today = timezone.localdate()

        # 1. Base Querysets based on Multi-Tenant / Scoping
        if role in ('SUPER_ADMIN', 'ADMIN'):
            company_id = request.query_params.get('company')
            if company_id:
                leaves_qs = LeaveRequest.objects.filter(employee__branch__company_id=company_id)
                permissions_qs = PermissionRequest.objects.filter(employee__branch__company_id=company_id)
                wfh_qs = WFHRequest.objects.filter(employee__branch__company_id=company_id)
                attendance_qs = Attendance.objects.filter(employee__branch__company_id=company_id)
                tasks_qs = Task.objects.filter(company_id=company_id)
            else:
                leaves_qs = LeaveRequest.objects.all()
                permissions_qs = PermissionRequest.objects.all()
                wfh_qs = WFHRequest.objects.all()
                attendance_qs = Attendance.objects.all()
                tasks_qs = Task.objects.all()

        elif role == 'HR':
            company_id = getattr(user, 'company_id', None)
            leaves_qs = LeaveRequest.objects.filter(employee__branch__company_id=company_id) if company_id else LeaveRequest.objects.none()
            permissions_qs = PermissionRequest.objects.filter(employee__branch__company_id=company_id) if company_id else PermissionRequest.objects.none()
            wfh_qs = WFHRequest.objects.filter(employee__branch__company_id=company_id) if company_id else WFHRequest.objects.none()
            attendance_qs = Attendance.objects.filter(employee__branch__company_id=company_id) if company_id else Attendance.objects.none()
            tasks_qs = Task.objects.filter(company_id=company_id) if company_id else Task.objects.none()

        elif role == 'REPORTING_MANAGER':
            if not emp:
                return Response({
                    "role": role,
                    "has_pending": False,
                    "total_pending_count": 0,
                    "pending_items": [],
                    "summary": {},
                })
            # Manager's direct & indirect reports
            team_ids = list(emp.direct_reports.values_list('id', flat=True))
            # Also include team members under their team leaders
            tl_ids = list(emp.direct_reports.filter(user__role='TEAM_LEADER').values_list('id', flat=True))
            if tl_ids:
                team_ids += list(Employee.objects.filter(team_leader_id__in=tl_ids).values_list('id', flat=True))
            team_ids = list(set(team_ids))

            leaves_qs = LeaveRequest.objects.filter(employee_id__in=team_ids)
            permissions_qs = PermissionRequest.objects.filter(employee_id__in=team_ids)
            wfh_qs = WFHRequest.objects.filter(employee_id__in=team_ids)
            attendance_qs = Attendance.objects.filter(employee_id__in=team_ids)
            tasks_qs = Task.objects.filter(
                Q(company_id=user.company_id) & (
                    Q(reporting_manager=emp) |
                    Q(assigned_by=user) |
                    Q(assigned_employees__id__in=team_ids)
                )
            ).distinct()

        # 2. Filter Pending Approvals
        pending_leaves = leaves_qs.filter(status='PENDING').select_related('employee').order_by('-created_at')
        pending_permissions = permissions_qs.filter(status='PENDING').select_related('employee').order_by('-created_at')
        pending_wfh = wfh_qs.filter(status='PENDING').select_related('employee').order_by('-created_at')
        
        # Attendance punches pending approval
        pending_punches = attendance_qs.filter(
            Q(check_in_approval_status='PENDING') | Q(check_out_approval_status='PENDING')
        ).select_related('employee').order_by('-date')

        # Overdue / Pending Tasks
        pending_tasks = tasks_qs.filter(
            status__in=['PENDING', 'OVERDUE', 'UNDER_REVIEW'],
            is_draft=False
        ).select_related('assigned_to', 'assigned_by').order_by('due_date')

        # 3. Itemize list for UI Pop-up
        items = []

        for l in pending_leaves[:8]:
            items.append({
                "id": f"leave-{l.id}",
                "type": "LEAVE",
                "badge": "Leave Request",
                "employee_name": l.employee.full_name if l.employee else "Employee",
                "employee_id": l.employee.employee_id if l.employee else "",
                "title": f"Leave: {l.leave_type}",
                "detail": f"{l.start_date} to {l.end_date} • Reason: {l.reason or 'Not specified'}",
                "created_at": l.created_at.isoformat() if l.created_at else None,
                "action_url": "/admin/leaves" if role in ('SUPER_ADMIN', 'ADMIN', 'HR') else "/manager/team-attendance",
                "mobile_screen": "AdminLeaves" if role in ('SUPER_ADMIN', 'ADMIN', 'HR') else "ManagerAttendance",
            })

        for p in pending_permissions[:8]:
            items.append({
                "id": f"perm-{p.id}",
                "type": "PERMISSION",
                "badge": "Permission Request",
                "employee_name": p.employee.full_name if p.employee else "Employee",
                "employee_id": p.employee.employee_id if p.employee else "",
                "title": f"Permission: {p.duration_minutes} mins",
                "detail": f"Date: {p.date} • {p.start_time or ''} - {p.end_time or ''} • Reason: {p.reason or 'Not specified'}",
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "action_url": "/admin/permissions" if role in ('SUPER_ADMIN', 'ADMIN', 'HR') else "/manager/team-attendance",
                "mobile_screen": "AdminPermissions" if role in ('SUPER_ADMIN', 'ADMIN', 'HR') else "ManagerAttendance",
            })

        for w in pending_wfh[:8]:
            items.append({
                "id": f"wfh-{w.id}",
                "type": "WFH",
                "badge": "WFH Request",
                "employee_name": w.employee.full_name if w.employee else "Employee",
                "employee_id": w.employee.employee_id if w.employee else "",
                "title": f"Work From Home Request",
                "detail": f"Date: {w.date} • Reason: {w.reason or 'Not specified'}",
                "created_at": w.created_at.isoformat() if w.created_at else None,
                "action_url": "/admin/wfh" if role in ('SUPER_ADMIN', 'ADMIN', 'HR') else "/manager/team-attendance",
                "mobile_screen": "AdminWFH" if role in ('SUPER_ADMIN', 'ADMIN', 'HR') else "ManagerAttendance",
            })

        for att in pending_punches[:8]:
            punch_type = "Check-In & Check-Out" if att.check_in_approval_status == 'PENDING' and att.check_out_approval_status == 'PENDING' else ("Check-In" if att.check_in_approval_status == 'PENDING' else "Check-Out")
            items.append({
                "id": f"att-{att.id}",
                "type": "ATTENDANCE_PUNCH",
                "badge": f"Punch Approval",
                "employee_name": att.employee.full_name if att.employee else "Employee",
                "employee_id": att.employee.employee_id if att.employee else "",
                "title": f"{punch_type} Approval Pending",
                "detail": f"Date: {att.date} • Status: {att.status or '--'}",
                "created_at": att.created_at.isoformat() if hasattr(att, 'created_at') and att.created_at else None,
                "action_url": "/admin/attendance" if role in ('SUPER_ADMIN', 'ADMIN', 'HR') else "/manager/team-attendance",
                "mobile_screen": "AdminAttendance" if role in ('SUPER_ADMIN', 'ADMIN', 'HR') else "ManagerAttendance",
            })

        # Add tasks for Admin & Manager
        for t in pending_tasks[:8]:
            items.append({
                "id": f"task-{t.id}",
                "type": "TASK",
                "badge": f"{t.status.replace('_', ' ')} Task",
                "employee_name": t.assigned_to.full_name if t.assigned_to else (t.assigned_by.get_full_name() if t.assigned_by else "Unassigned"),
                "employee_id": t.assigned_to.employee_id if t.assigned_to else "",
                "title": t.title,
                "detail": f"Priority: {t.priority} • Due: {t.due_date or 'No due date'}",
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "action_url": "/admin/tasks" if role in ('SUPER_ADMIN', 'ADMIN') else "/manager/tasks",
                "mobile_screen": "TasksTab" if role in ('SUPER_ADMIN', 'ADMIN') else "ManagerTasksTab",
            })

        leave_count = pending_leaves.count()
        permission_count = pending_permissions.count()
        wfh_count = pending_wfh.count()
        punch_count = pending_punches.count()
        task_count = pending_tasks.count()
        total_pending = leave_count + permission_count + wfh_count + punch_count + task_count

        return Response({
            "role": role,
            "has_pending": total_pending > 0,
            "total_pending_count": total_pending,
            "summary": {
                "pending_leaves": leave_count,
                "pending_permissions": permission_count,
                "pending_wfh": wfh_count,
                "pending_punches": punch_count,
                "pending_tasks": task_count,
            },
            "pending_items": items,
        })

