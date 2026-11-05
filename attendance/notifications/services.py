from django.contrib.auth import get_user_model
from django.db import transaction

from .models import Notification
from .fcm import send_web_push


def _create_and_push(recipient, employee, event, event_date, request_key, title, message):
    notification, created = Notification.objects.get_or_create(
        recipient=recipient,
        employee=employee,
        event=event,
        shift_date=event_date,
        request_key=request_key,
        defaults={'title': title, 'message': message},
    )

    if created:
        transaction.on_commit(
            lambda: send_web_push(
                recipient,
                title,
                message,
                url='/',
                event=event,
            )
        )

    return notification


def notify_admins_request_submitted(request_obj, kind):
    """Notify the relevant company administrators and HR about a request."""
    User = get_user_model()
    employee = request_obj.employee
    company_id = (
        employee.branch.company_id
        if employee.branch_id and employee.branch
        else None
    )

    if kind == 'leave':
        event = 'LEAVE_APPLIED'
        event_date = request_obj.start_date
        title = 'New Leave Request'
        message = (
            f'{employee.full_name} applied for '
            f'{request_obj.get_leave_type_display()} leave '
            f'from {request_obj.start_date} to {request_obj.end_date}.'
        )
    elif kind == 'permission':
        event = 'PERMISSION_APPLIED'
        event_date = request_obj.date
        title = 'New Permission Request'
        message = (
            f'{employee.full_name} applied for permission '
            f'on {request_obj.date} ({request_obj.duration_minutes} minutes).'
        )
    elif kind == 'wfh':
        event = 'WFH_APPLIED'
        event_date = request_obj.date
        title = 'New WFH Request'
        message = (
            f'{employee.full_name} applied to work from home '
            f'on {request_obj.date}.'
        )
    else:
        raise ValueError("kind must be 'leave', 'permission' or 'wfh'")

    if company_id is None:
        return

    # Only administrators belonging to this company, plus its HR.
    recipients = User.objects.filter(
        is_active=True,
        role__in=('SUPER_ADMIN', 'ADMIN', 'HR'),
        company_id=company_id,
    )

    key = f'{kind}:{request_obj.pk}:applied'

    for recipient in recipients.distinct().iterator():
        _create_and_push(
            recipient, employee, event, event_date, key, title, message
        )


def notify_employee_request_decision(request_obj, kind):
    """Notify the requesting employee when a request is approved or rejected."""
    employee = request_obj.employee
    recipient = employee.user

    if request_obj.status not in ('APPROVED', 'REJECTED'):
        return

    if kind == 'leave':
        event_date = request_obj.start_date
        request_label = 'Leave'
        detail = (
            f'{request_obj.get_leave_type_display()} leave, '
            f'{request_obj.start_date} to {request_obj.end_date}'
        )
    elif kind == 'permission':
        event_date = request_obj.date
        request_label = 'Permission'
        detail = f'permission on {request_obj.date}'
    elif kind == 'wfh':
        event_date = request_obj.date
        request_label = 'WFH'
        detail = f'work from home on {request_obj.date}'
    else:
        raise ValueError("kind must be 'leave', 'permission' or 'wfh'")

    event = f'{kind.upper()}_{request_obj.status}'
    title = f'{request_label} Request {request_obj.status.title()}'
    message = f'Your {detail} request was {request_obj.status.lower()}.'

    if request_obj.status == 'REJECTED' and request_obj.rejection_reason:
        message += f' Reason: {request_obj.rejection_reason}'

    key = f'{kind}:{request_obj.pk}:{request_obj.status.lower()}'

    _create_and_push(
        recipient,
        employee,
        event,
        event_date,
        key,
        title,
        message,
    )
