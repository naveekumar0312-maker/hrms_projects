from accounts.models import User

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from employees.models import Employee
from attendance.models import Attendance, Holiday
from notifications.models import Notification
from notifications.fcm import send_web_push


class Command(BaseCommand):
    help = "Create shift-start and shift-end notifications."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show reminders that would be created without saving them.",
        )

    def handle(self, *args, **options):
        # Shift-based alarms have been retired in favor of Employee Personal Daily Alarms.
        self.stdout.write(self.style.WARNING(
            "Shift-based alarms are retired. Use Employee Personal Daily Alarms instead."
        ))
        return
        matched = 0

        for employee in employees.iterator():
            shift = employee.shift

            # Skip reminders on an active holiday for the employee's company.
            company_id = (
                employee.branch.company_id
                if employee.branch_id and employee.branch
                else None
            )
            if company_id and Holiday.objects.filter(
                company_id=company_id,
                date=today,
                is_active=True,
            ).exists():
                continue

            start_minute = shift.start_time.hour * 60 + shift.start_time.minute
            end_minute = shift.end_time.hour * 60 + shift.end_time.minute

            events = []

            attendance = Attendance.objects.filter(
                employee=employee,
                date=today,
            ).first()

            # Five minutes before shift start, only if not already checked in.
            if (
                current_minute == (start_minute - 5) % 1440
                and not (attendance and attendance.check_in)
            ):
                events.append((
                    "SHIFT_START",
                    "Shift starts in 5 minutes",
                    f"Hi {employee.full_name}, your {shift.name} shift starts in 5 minutes.",
                ))

            # At shift end, remind only if the employee has not checked out.
            if current_minute == end_minute and not (
                attendance and (attendance.check_out or attendance.status == "COMPLETED")
            ):
                events.append((
                    "SHIFT_END",
                    "Your shift has ended",
                    f"Hi {employee.full_name}, your {shift.name} shift has ended. Please check out.",
                ))


            for event, title, message in events:
                matched += 1

                # The local date on which this reminder fires.
                shift_date = today

                recipients = {employee.user.id: employee.user}

                for recipient in recipients.values():
                    # Re-check the latest attendance immediately before
                    # creating a reminder or sending a push notification.
                    latest_attendance = Attendance.objects.filter(
                        employee=employee,
                        date=shift_date,
                    ).only("check_in", "check_out", "status").first()

                    if event == "SHIFT_START" and latest_attendance and latest_attendance.check_in:
                        self.stdout.write(
                            f"SKIPPED SHIFT_START: {employee.employee_id} already checked in."
                        )
                        continue

                    if event == "SHIFT_END" and latest_attendance and (
                        latest_attendance.check_out
                        or latest_attendance.status == "COMPLETED"
                    ):
                        self.stdout.write(
                            f"SKIPPED SHIFT_END: {employee.employee_id} already checked out."
                        )
                        continue

                    if dry_run:
                        self.stdout.write(
                            f"[DRY RUN] {event}: employee={employee.employee_id}, "
                            f"recipient={recipient.username or recipient.phone_number}, "
                            f"date={shift_date}"
                        )
                        continue

                    # get_or_create plus the database unique constraint prevents
                    # duplicate reminders when the scheduler runs repeatedly.
                    with transaction.atomic():
                        _, was_created = Notification.objects.get_or_create(
                            recipient=recipient,
                            employee=employee,
                            event=event,
                            shift_date=shift_date,
                            defaults={
                                "title": (
                                    f"{employee.full_name}: {title}"
                                    if recipient.role in ("SUPER_ADMIN", "ADMIN", "HR")
                                    else title
                                ),
                                "message": (
                                    f"{employee.full_name} — {message}"
                                    if recipient.role in ("SUPER_ADMIN", "ADMIN", "HR")
                                    else message
                                ),
                            },
                        )
                        if was_created:
                            created += 1

                            push_title = (
                                f"{employee.full_name}: {title}"
                                if recipient.role in ("SUPER_ADMIN", "ADMIN", "HR")
                                else title
                            )
                            push_body = (
                                f"{employee.full_name} — {message}"
                                if recipient.role in ("SUPER_ADMIN", "ADMIN", "HR")
                                else message
                            )

                            send_web_push(
                                recipient,
                                title=push_title,
                                body=push_body,
                                url="https://attendance.vibhutravelhub.com/",
                                event=event,
                            )

        mode = "DRY RUN" if dry_run else "LIVE"
        self.stdout.write(
            self.style.SUCCESS(
                f"{mode}: time={now:%Y-%m-%d %H:%M %Z}, "
                f"employees_checked={employees.count()}, "
                f"matching_reminders={matched}, notifications_created={created}"
            )
        )
