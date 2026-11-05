from datetime import date, time, datetime
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from branches.models import Company, Branch
from employees.models import Employee
from attendance.models import Attendance, Holiday, Shift
from notifications.models import Notification


class ShiftReminderVerificationTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()

        # Use a weekday for the normal reminder tests.
        if self.today.weekday() == 6:
            from datetime import timedelta
            self.today = self.today + timedelta(days=1)

        self.company = Company.objects.create(name="Reminder Test Company")
        self.branch = Branch.objects.create(
            company=self.company,
            branch_name="Reminder Test Branch",
            latitude=10.0,
            longitude=10.0,
        )

        self.user = User.objects.create_user(
            username="reminder_employee",
            password="test-password",
            email="reminder-test@example.com",
            role="EMPLOYEE",
            phone_number="9876501234",
        )

        self.shift = Shift.objects.create(
            name="Verification Shift",
            start_time=time(9, 30),
            end_time=time(18, 30),
            is_active=True,
            reminders_enabled=True,
        )

        self.employee = Employee.objects.create(
            user=self.user,
            branch=self.branch,
            shift=self.shift,
            employee_id="REM-001",
            full_name="Reminder Test Employee",
            department="Testing",
            designation="Tester",
            work_type="OFFICE",
            employment_status="ACTIVE",
            status=True,
        )

    def run_reminder_at(self, hour, minute, *, weekday=None):
        target_date = self.today
        if weekday is not None:
            from datetime import timedelta
            while target_date.weekday() != weekday:
                target_date += timedelta(days=1)

        target = timezone.make_aware(
            datetime.combine(target_date, time(hour, minute)),
            timezone.get_current_timezone(),
        )

        with patch("notifications.management.commands.send_shift_reminders.timezone.now", return_value=target), \
             patch("notifications.management.commands.send_shift_reminders.send_web_push") as push:
            call_command("send_shift_reminders", verbosity=0)
            push_count = push.call_count

        return push_count

    def test_shift_start_reminder_when_not_checked_in(self):
        self.run_reminder_at(9, 25)
        self.assertTrue(Notification.objects.filter(
            employee=self.employee,
            event="SHIFT_START",
            shift_date=self.today,
        ).exists())

    def test_no_shift_start_reminder_if_already_checked_in(self):
        Attendance.objects.create(
            employee=self.employee,
            date=self.today,
            check_in=timezone.make_aware(
                datetime.combine(self.today, time(9, 10)),
                timezone.get_current_timezone(),
            ),
            status="ON_TIME",
        )

        self.run_reminder_at(9, 25)
        self.assertFalse(Notification.objects.filter(
            employee=self.employee,
            event="SHIFT_START",
            shift_date=self.today,
        ).exists())

    def test_shift_end_reminder_when_not_checked_out(self):
        Attendance.objects.create(
            employee=self.employee,
            date=self.today,
            check_in=timezone.make_aware(
                datetime.combine(self.today, time(9, 20)),
                timezone.get_current_timezone(),
            ),
            status="WORKING",
        )

        self.run_reminder_at(18, 30)
        self.assertTrue(Notification.objects.filter(
            employee=self.employee,
            event="SHIFT_END",
            shift_date=self.today,
        ).exists())

    def test_shift_end_reminder_when_no_attendance_record_exists(self):
        self.run_reminder_at(18, 30)
        self.assertTrue(Notification.objects.filter(
            employee=self.employee,
            event="SHIFT_END",
            shift_date=self.today,
        ).exists())

    def test_no_shift_end_reminder_if_checked_out_before_shift_end(self):
        Attendance.objects.create(
            employee=self.employee,
            date=self.today,
            check_in=timezone.make_aware(
                datetime.combine(self.today, time(9, 20)),
                timezone.get_current_timezone(),
            ),
            check_out=timezone.make_aware(
                datetime.combine(self.today, time(18, 20)),
                timezone.get_current_timezone(),
            ),
            status="COMPLETED",
        )

        self.run_reminder_at(18, 30)
        self.assertFalse(Notification.objects.filter(
            employee=self.employee,
            event="SHIFT_END",
            shift_date=self.today,
        ).exists())

    def test_no_duplicate_shift_end_notification(self):
        Notification.objects.create(
            recipient=self.user,
            employee=self.employee,
            event="SHIFT_END",
            shift_date=self.today,
            title="Existing reminder",
            message="Existing reminder",
        )

        push_count = self.run_reminder_at(18, 30)
        self.assertEqual(push_count, 0, "An existing notification must not send another push.")
        self.assertEqual(Notification.objects.filter(
            employee=self.employee,
            event="SHIFT_END",
            shift_date=self.today,
        ).count(), 1)

    def test_running_command_twice_sends_push_only_once(self):
        first_push_count = self.run_reminder_at(18, 30)
        second_push_count = self.run_reminder_at(18, 30)

        self.assertEqual(first_push_count, 1)
        self.assertEqual(second_push_count, 0)
        self.assertEqual(Notification.objects.filter(
            employee=self.employee,
            event="SHIFT_END",
            shift_date=self.today,
        ).count(), 1)

    def test_no_reminder_on_active_company_holiday(self):
        Holiday.objects.create(
            company=self.company,
            name="Test Company Holiday",
            date=self.today,
            is_active=True,
        )

        self.run_reminder_at(9, 25)
        self.assertFalse(Notification.objects.filter(
            employee=self.employee,
            shift_date=self.today,
        ).exists())

    def test_inactive_holiday_does_not_block_reminder(self):
        Holiday.objects.create(
            company=self.company,
            name="Inactive Test Holiday",
            date=self.today,
            is_active=False,
        )

        self.run_reminder_at(9, 25)
        self.assertTrue(Notification.objects.filter(
            employee=self.employee,
            event="SHIFT_START",
            shift_date=self.today,
        ).exists())

    def test_reminders_are_skipped_on_sunday(self):
        from datetime import timedelta
        sunday = self.today
        while sunday.weekday() != 6:
            sunday += timedelta(days=1)

        target = timezone.make_aware(
            datetime.combine(sunday, time(9, 25)),
            timezone.get_current_timezone(),
        )

        with patch("notifications.management.commands.send_shift_reminders.timezone.now", return_value=target), \
             patch("notifications.management.commands.send_shift_reminders.send_web_push") as push:
            call_command("send_shift_reminders", verbosity=0)

        self.assertEqual(push.call_count, 0)
        self.assertFalse(Notification.objects.filter(
            employee=self.employee,
            shift_date=sunday,
        ).exists())
