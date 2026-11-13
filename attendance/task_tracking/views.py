from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.db.models import Q
from django.utils import timezone

from .models import Task, TaskComment, TaskAttachment, TaskActivity, TaskTimeLog
from .serializers import (
    TaskSerializer,
    TaskCreateUpdateSerializer,
    TaskCommentSerializer,
    TaskAttachmentSerializer,
    TaskActivitySerializer,
    TaskTimeLogSerializer,
)
from employees.models import Employee


def check_user_task_access(task, user):
    """Enforces strict multi-tenant and role-based task read access."""
    emp = getattr(user, 'employee_profile', None)
    if user.role in ('SUPER_ADMIN', 'ADMIN'):
        return True
    if user.role == 'HR':
        if task.company_id == user.company_id:
            return True
        raise PermissionDenied("You do not have access to tasks outside your company.")
    if user.role == 'REPORTING_MANAGER':
        if not emp:
            raise PermissionDenied("Reporting Manager profile not found.")
        is_global = (emp.branch is None and (user.company_id is None))
        if not is_global and task.company_id != user.company_id and (emp.branch and task.company_id != emp.branch.company_id):
            raise PermissionDenied("You do not have access to this task.")
        if (
            is_global or
            task.assigned_by_id == user.id or
            task.reporting_manager_id == emp.id or
            (task.team_leader and task.team_leader.reporting_manager_id == emp.id) or
            (task.assigned_to and task.assigned_to.reporting_manager_id == emp.id) or
            (task.assigned_to and task.assigned_to.team_leader and task.assigned_to.team_leader.reporting_manager_id == emp.id) or
            task.assigned_employees.filter(reporting_manager=emp).exists() or
            task.assigned_employees.filter(team_leader__reporting_manager=emp).exists() or
            task.assigned_employees.filter(id=emp.id).exists()
        ):
            return True
        raise PermissionDenied("You do not have permission for this task.")
    if user.role == 'TEAM_LEADER':
        user_comp = user.company_id or (emp.branch.company_id if emp and emp.branch else None)
        if not emp or (user_comp and task.company_id != user_comp):
            raise PermissionDenied("You do not have access to this task.")
        if (
            task.assigned_by_id == user.id or
            task.team_leader_id == emp.id or
            task.assigned_to_id == emp.id or
            (task.assigned_to and task.assigned_to.team_leader_id == emp.id) or
            task.assigned_employees.filter(id=emp.id).exists() or
            task.assigned_employees.filter(team_leader=emp).exists() or
            (user_comp and task.company_id == user_comp)
        ):
            return True
        raise PermissionDenied("Team Leaders can only access their own tasks or their team's tasks.")
    if user.role == 'EMPLOYEE':
        if emp and (task.assigned_to_id == emp.id or task.assigned_employees.filter(id=emp.id).exists()) and not task.is_draft:
            return True
        raise PermissionDenied("Employees can only access their own assigned non-draft tasks.")
    raise PermissionDenied("Unauthorized.")


class TaskViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return TaskCreateUpdateSerializer
        return TaskSerializer

    def get_queryset(self):
        user = self.request.user
        emp = getattr(user, 'employee_profile', None)

        today = timezone.localdate()
        Task.objects.filter(due_date__lt=today).exclude(status__in=['COMPLETED', 'CANCELLED', 'DRAFT']).update(status='OVERDUE')

        qs = Task.objects.select_related(
            'company', 'assigned_to', 'assigned_to__user',
            'assigned_by', 'reporting_manager', 'team_leader'
        ).prefetch_related(
            'assigned_employees', 'assigned_employees__user',
            'comments', 'comments__author', 'task_attachments',
            'activities', 'time_logs', 'time_logs__user'
        )

        if user.role in ('SUPER_ADMIN', 'ADMIN'):
            company_id = self.request.query_params.get('company')
            return qs.filter(company_id=company_id) if company_id else qs

        if user.role == 'HR':
            return qs.filter(company_id=user.company_id)

        if user.role == 'REPORTING_MANAGER':
            if not emp:
                return Task.objects.none()
            is_global = (emp.branch is None and (user.company_id is None))
            if is_global:
                company_param = self.request.query_params.get('company')
                if company_param:
                    qs = qs.filter(company_id=company_param)
                return qs.distinct()
            return qs.filter(
                Q(company_id=user.company_id) & (
                    Q(reporting_manager=emp) |
                    Q(assigned_by=user) |
                    Q(team_leader__reporting_manager=emp) |
                    Q(assigned_to=emp) |
                    Q(assigned_to__reporting_manager=emp) |
                    Q(assigned_to__team_leader__reporting_manager=emp) |
                    Q(assigned_employees=emp) |
                    Q(assigned_employees__reporting_manager=emp) |
                    Q(assigned_employees__team_leader__reporting_manager=emp)
                )
            ).distinct()

        if user.role == 'TEAM_LEADER':
            if not emp:
                return Task.objects.none()
            tl_company_id = user.company_id or (emp.branch.company_id if emp.branch else None)
            return qs.filter(
                Q(company_id=tl_company_id) & (
                    Q(team_leader=emp) |
                    Q(assigned_by=user) |
                    Q(assigned_to=emp) |
                    Q(assigned_to__team_leader=emp) |
                    Q(assigned_employees=emp) |
                    Q(assigned_employees__team_leader=emp) |
                    Q(company_id=tl_company_id)
                )
            ).distinct()

        if not emp:
            return Task.objects.none()
        # Non-draft tasks assigned to this employee (either via assigned_to or assigned_employees M2M)
        return qs.filter(
            Q(assigned_to=emp) | Q(assigned_employees=emp),
            is_draft=False
        ).distinct()

    @action(detail=False, methods=['get'], url_path='assignable_members')
    def assignable_members(self, request):
        """
        Returns authorized assignable members based on the user's role:
        - Reporting Manager: Direct reports, Team Leaders, and employees under their Team Leaders.
        - Team Leader: Employees assigned to their own team only.
        """
        user = request.user
        emp = getattr(user, 'employee_profile', None)

        def _format_emp(e):
            photo_url = None
            if e.profile_photo:
                try:
                    photo_url = e.profile_photo.url
                except Exception:
                    photo_url = None
            comp_id = e.branch.company_id if e.branch and e.branch.company_id else None
            comp_name = e.branch.company.name if e.branch and e.branch.company else ''
            branch_name = e.branch.branch_name if e.branch else ''
            return {
                "id": e.id,
                "full_name": e.full_name,
                "employee_id": e.employee_id,
                "department": e.department,
                "designation": e.designation,
                "branch_name": branch_name,
                "company_id": comp_id,
                "company_name": comp_name,
                "role": e.user.role if e.user else 'EMPLOYEE',
                "team_leader_name": e.team_leader.full_name if e.team_leader else None,
                "profile_photo_url": photo_url,
            }

        if user.role == 'REPORTING_MANAGER':
            if not emp:
                return Response([])
            is_global = (emp.branch is None and (user.company_id is None))
            if is_global:
                company_param = request.query_params.get('company')
                qs = Employee.objects.filter(status=True).exclude(id=emp.id).exclude(user__role__in=['SUPER_ADMIN', 'ADMIN'])
                if company_param:
                    qs = qs.filter(branch__company_id=company_param)
                qs = qs.select_related('user', 'team_leader', 'branch', 'branch__company').order_by('branch__company__name', 'branch__branch_name', 'full_name')
                return Response([_format_emp(e) for e in qs])

            comp_id = user.company_id or (emp.branch.company_id if emp.branch else None)
            qs = Employee.objects.filter(
                Q(branch__company_id=comp_id) & (
                    Q(reporting_manager=emp) |
                    Q(team_leader__reporting_manager=emp)
                )
            ).exclude(id=emp.id).select_related('user', 'team_leader', 'branch', 'branch__company').order_by('full_name')

            return Response([_format_emp(e) for e in qs])

        elif user.role == 'TEAM_LEADER':
            if not emp:
                return Response([])
            comp_id = user.company_id or (emp.branch.company_id if emp.branch else None)
            # Team Leaders can assign tasks to employees within their company (excluding themselves and admin accounts)
            qs = Employee.objects.filter(
                branch__company_id=comp_id,
                status=True
            ).exclude(id=emp.id).exclude(user__role__in=['SUPER_ADMIN', 'ADMIN']).select_related('user', 'team_leader', 'branch', 'branch__company').order_by('full_name')

            return Response([_format_emp(e) for e in qs])

        elif user.role in ('SUPER_ADMIN', 'ADMIN', 'HR'):
            company_id = user.company_id or request.query_params.get('company')
            qs = Employee.objects.filter(branch__company_id=company_id).select_related('user').order_by('full_name')
            return Response([_format_emp(e) for e in qs])

        return Response([])

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == 'EMPLOYEE':
            raise PermissionDenied("Employees cannot create or assign tasks.")

        emp_creator = getattr(user, 'employee_profile', None)
        assigned_to = serializer.validated_data.get('assigned_to')
        assigned_employee_ids = serializer.validated_data.pop('assigned_employee_ids', None)
        is_draft = serializer.validated_data.get('is_draft', False)

        # Collect all assigned employees
        assigned_emps = []
        if assigned_employee_ids:
            assigned_emps = list(Employee.objects.filter(id__in=assigned_employee_ids))
            if assigned_emps and not assigned_to:
                assigned_to = assigned_emps[0]
                serializer.validated_data['assigned_to'] = assigned_to
        elif assigned_to:
            assigned_emps = [assigned_to]

        # Determine Reporting Manager and Team Leader references for assignment history
        if user.role == 'REPORTING_MANAGER':
            rep_mgr = emp_creator
            tl = assigned_to.team_leader if assigned_to else None
        elif user.role == 'TEAM_LEADER':
            tl = emp_creator
            rep_mgr = emp_creator.reporting_manager if emp_creator else (assigned_to.reporting_manager if assigned_to else None)
        else:
            rep_mgr = assigned_to.reporting_manager if assigned_to else None
            tl = assigned_to.team_leader if assigned_to else None

        role_display = "Reporting Manager" if user.role == 'REPORTING_MANAGER' else ("Team Leader" if user.role == 'TEAM_LEADER' else user.role)
        if len(assigned_emps) > 1:
            assignee_name = f"{len(assigned_emps)} employees ({', '.join(e.full_name for e in assigned_emps[:3])}{'...' if len(assigned_emps) > 3 else ''})"
        elif assigned_emps:
            assignee_name = assigned_emps[0].full_name
        else:
            assignee_name = 'team'

        # Determine task company
        task_company_id = user.company_id
        if not task_company_id:
            if assigned_to and assigned_to.branch and assigned_to.branch.company_id:
                task_company_id = assigned_to.branch.company_id
            elif assigned_emps and assigned_emps[0].branch and assigned_emps[0].branch.company_id:
                task_company_id = assigned_emps[0].branch.company_id
            elif emp_creator and emp_creator.branch and emp_creator.branch.company_id:
                task_company_id = emp_creator.branch.company_id

        task = serializer.save(
            company_id=task_company_id,
            assigned_by=user,
            reporting_manager=rep_mgr,
            team_leader=tl,
        )

        if assigned_emps:
            task.assigned_employees.set(assigned_emps)

        # Log Activity with clearly identified assigning role
        action_name = "Task Drafted" if is_draft else "Task Created & Assigned"
        desc = (
            f"Task drafted by {user.username} ({role_display})."
            if is_draft
            else f"Task created and assigned to {assignee_name} by {user.username} ({role_display})."
        )
        TaskActivity.objects.create(
            task=task,
            user=user,
            action=action_name,
            description=desc
        )

        # In-app notifications to all assigned employees if not draft
        if not is_draft and assigned_emps:
            try:
                from notifications.models import Notification
                for emp_item in assigned_emps:
                    if emp_item.user:
                        Notification.objects.create(
                            recipient=emp_item.user,
                            title="New Task Assigned",
                            message=f"You have been assigned: {task.title}",
                            notification_type="TASK_ASSIGNED",
                            data={"task_id": task.id}
                        )
            except Exception:
                pass

    def perform_update(self, serializer):
        user = self.request.user
        task = self.get_object()
        check_user_task_access(task, user)

        # Employees can only update task status (or add completion notes)
        if user.role == 'EMPLOYEE':
            for field, new_val in serializer.validated_data.items():
                if field in ('status',):
                    continue
                current_val = getattr(task, field, None)
                if hasattr(current_val, 'pk'):
                    current_val = current_val.pk
                if hasattr(new_val, 'pk'):
                    new_val = new_val.pk
                if current_val != new_val:
                    raise PermissionDenied("Employees can only update task status.")

        old_status = task.status
        old_is_draft = task.is_draft

        assigned_employee_ids = serializer.validated_data.pop('assigned_employee_ids', None)

        updated_task = serializer.save()

        if assigned_employee_ids is not None:
            new_emps = list(Employee.objects.filter(id__in=assigned_employee_ids))
            updated_task.assigned_employees.set(new_emps)
            if new_emps and updated_task.assigned_to not in new_emps:
                updated_task.assigned_to = new_emps[0]
                updated_task.save(update_fields=['assigned_to'])
            elif not new_emps and updated_task.assigned_to:
                updated_task.assigned_to = None
                updated_task.save(update_fields=['assigned_to'])

        # Log Status Change or Publish
        if old_is_draft and not updated_task.is_draft:
            role_display = "Reporting Manager" if user.role == 'REPORTING_MANAGER' else ("Team Leader" if user.role == 'TEAM_LEADER' else user.role)
            TaskActivity.objects.create(
                task=updated_task,
                user=user,
                action="Task Submitted",
                description=f"Task published from draft and assigned to {updated_task.assigned_to.full_name if updated_task.assigned_to else 'team'} by {user.username} ({role_display})."
            )
        elif old_status != updated_task.status:
            TaskActivity.objects.create(
                task=updated_task,
                user=user,
                action="Status Changed",
                description=f"Status changed from {old_status} to {updated_task.status} by {user.username}."
            )


class TaskCommentViewSet(viewsets.ModelViewSet):
    serializer_class = TaskCommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        task_id = self.kwargs.get('task_pk')
        task = Task.objects.get(pk=task_id)
        check_user_task_access(task, self.request.user)
        return TaskComment.objects.filter(task=task).select_related('author')

    def perform_create(self, serializer):
        task = Task.objects.get(pk=self.kwargs.get('task_pk'))
        check_user_task_access(task, self.request.user)
        comment = serializer.save(task=task, author=self.request.user)
        
        # Log Activity
        type_desc = f"{comment.comment_type.title()} comment"
        TaskActivity.objects.create(
            task=task,
            user=self.request.user,
            action="Comment Added",
            description=f"Added a {type_desc} to the task."
        )


class TaskAttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = TaskAttachmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        task_id = self.kwargs.get('task_pk')
        task = Task.objects.get(pk=task_id)
        check_user_task_access(task, self.request.user)
        return TaskAttachment.objects.filter(task=task).select_related('uploaded_by')

    def perform_create(self, serializer):
        task = Task.objects.get(pk=self.kwargs.get('task_pk'))
        check_user_task_access(task, self.request.user)
        f = self.request.FILES.get('file')
        file_name = f.name if f else 'attachment'
        file_size = f"{f.size / (1024 * 1024):.2f} MB" if f and f.size > 1024*1024 else (f"{f.size / 1024:.1f} KB" if f else '')
        
        serializer.save(
            task=task,
            uploaded_by=self.request.user,
            file_name=file_name,
            file_size=file_size,
        )

        TaskActivity.objects.create(
            task=task,
            user=self.request.user,
            action="Attachment Uploaded",
            description=f"Uploaded file {file_name}."
        )


class TaskTimeLogViewSet(viewsets.ModelViewSet):
    serializer_class = TaskTimeLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        task_id = self.kwargs.get('task_pk')
        task = Task.objects.get(pk=task_id)
        check_user_task_access(task, self.request.user)
        return TaskTimeLog.objects.filter(task=task).select_related('user')

    def perform_create(self, serializer):
        task = Task.objects.get(pk=self.kwargs.get('task_pk'))
        check_user_task_access(task, self.request.user)
        log = serializer.save(task=task, user=self.request.user)

        TaskActivity.objects.create(
            task=task,
            user=self.request.user,
            action="Time Logged",
            description=f"Logged {log.hours} hours on {log.date}."
        )


class TaskActivityListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        task = Task.objects.get(pk=pk)
        check_user_task_access(task, request.user)
        activities = TaskActivity.objects.filter(task=task).select_related('user').order_by('-created_at')
        serializer = TaskActivitySerializer(activities, many=True)
        return Response(serializer.data)


class TaskDashboardSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        emp = getattr(user, 'employee_profile', None)

        today = timezone.localdate()
        Task.objects.filter(due_date__lt=today).exclude(status__in=['COMPLETED', 'CANCELLED', 'DRAFT']).update(status='OVERDUE')

        qs = Task.objects.all()
        if user.role == 'HR':
            qs = qs.filter(company_id=user.company_id)
        elif user.role == 'REPORTING_MANAGER' and emp:
            qs = qs.filter(
                Q(company_id=user.company_id) & (
                    Q(reporting_manager=emp) |
                    Q(assigned_by=user) |
                    Q(team_leader__reporting_manager=emp) |
                    Q(assigned_to=emp) |
                    Q(assigned_to__reporting_manager=emp) |
                    Q(assigned_to__team_leader__reporting_manager=emp)
                )
            ).distinct()
        elif user.role == 'TEAM_LEADER' and emp:
            qs = qs.filter(
                Q(company_id=user.company_id) & (
                    Q(team_leader=emp) |
                    Q(assigned_by=user) |
                    Q(assigned_to=emp) |
                    Q(assigned_to__team_leader=emp)
                )
            ).distinct()
        elif user.role == 'EMPLOYEE' and emp:
            qs = qs.filter(assigned_to=emp, is_draft=False)
        elif user.role not in ('SUPER_ADMIN', 'ADMIN'):
            return Response({})

        return Response({
            "total": qs.count(),
            "pending": qs.filter(status='PENDING').count(),
            "in_progress": qs.filter(status='IN_PROGRESS').count(),
            "under_review": qs.filter(status='UNDER_REVIEW').count(),
            "completed": qs.filter(status='COMPLETED').count(),
            "on_hold": qs.filter(status='ON_HOLD').count(),
            "cancelled": qs.filter(status='CANCELLED').count(),
            "overdue": qs.filter(status='OVERDUE').count(),
            "draft": qs.filter(status='DRAFT').count(),
        })


class TranscribeAudioView(APIView):
    """
    Transcribes audio from audio recordings (e.g. mobile mic / web voice notes)
    into text using SpeechRecognition and Google Speech API.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        audio_file = request.FILES.get('audio') or request.FILES.get('file')
        if not audio_file:
            return Response(
                {"error": "No audio file provided."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            import speech_recognition as sr
            import tempfile
            import os
            import subprocess

            # Save uploaded audio to temporary file
            suffix = os.path.splitext(audio_file.name)[-1] or '.m4a'
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                for chunk in audio_file.chunks():
                    tmp.write(chunk)
                tmp_path = tmp.name

            target_wav = None
            r = sr.Recognizer()

            try:
                # If already a valid wav file, open directly
                if suffix.lower() == '.wav':
                    with sr.AudioFile(tmp_path) as source:
                        audio_data = r.record(source)
                else:
                    # Attempt conversion or read using pydub or audio tools if available
                    converted = False
                    try:
                        from pydub import AudioSegment
                        sound = AudioSegment.from_file(tmp_path)
                        sound = sound.set_channels(1).set_frame_rate(16000)
                        target_wav = tmp_path + "_converted.wav"
                        sound.export(target_wav, format="wav")
                        converted = True
                    except Exception as conv_err:
                        # Fallback: check if system ffmpeg exists
                        target_wav = tmp_path + "_converted.wav"
                        res = subprocess.run(
                            ['ffmpeg', '-y', '-i', tmp_path, '-ar', '16000', '-ac', '1', target_wav],
                            capture_output=True
                        )
                        converted = (res.returncode == 0)

                    if converted and target_wav and os.path.exists(target_wav):
                        with sr.AudioFile(target_wav) as source:
                            audio_data = r.record(source)
                    else:
                        with sr.AudioFile(tmp_path) as source:
                            audio_data = r.record(source)

                # Recognize speech using Google's speech recognition
                text = r.recognize_google(audio_data)
                return Response({"text": text.strip()})

            except sr.UnknownValueError:
                return Response(
                    {"text": "", "message": "No audible speech detected in the audio."},
                    status=status.HTTP_200_OK
                )
            except sr.RequestError as e:
                return Response(
                    {"error": f"Speech recognition service error: {str(e)}"},
                    status=status.HTTP_502_BAD_GATEWAY
                )
            except Exception as e:
                return Response(
                    {"error": f"Failed to process audio: {str(e)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            finally:
                if tmp_path and os.path.exists(tmp_path):
                    try:
                        os.remove(tmp_path)
                    except Exception:
                        pass
                if target_wav and os.path.exists(target_wav):
                    try:
                        os.remove(target_wav)
                    except Exception:
                        pass

        except Exception as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
