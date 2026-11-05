from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from unittest.mock import patch
from datetime import datetime, date, time
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from branches.models import Company, Branch
from accounts.models import User
from employees.models import Employee
from attendance.models import Shift, Attendance, AttendancePolicy, WFHRequest

class AttendanceCheckInTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create Company & Branch
        self.company = Company.objects.create(name="Test Company")
        self.branch = Branch.objects.create(
            company=self.company,
            branch_name="Main Branch",
            latitude=10.0,
            longitude=10.0
        )
        
        # Create Attendance Policy (Not really used due to employee shift, but good to have)
        self.policy = AttendancePolicy.objects.create(
            branch=self.branch,
            start_time=time(9, 30),
            end_time=time(18, 30),
            allowed_radius=1000
        )
        
        # Create Shift 09:30 AM -> 06:30 PM
        self.shift = Shift.objects.create(
            name="Morning Shift",
            start_time=time(9, 30),
            end_time=time(18, 30)
        )
        
        # Create User
        self.user = User.objects.create_user(
            username="testuser",
            password="password123",
            email="testuser@test.com",
            role="EMPLOYEE",
            phone_number="1234567890"
        )
        
        # Create Employee
        self.employee = Employee.objects.create(
            user=self.user,
            branch=self.branch,
            shift=self.shift,
            employee_id="EMP001",
            full_name="Test User",
            work_type="OFFICE"
        )
        
        self.checkin_url = reverse('check-in')
        self.checkout_url = reverse('check-out')
        self.client.force_authenticate(user=self.user)

    def run_checkin_test(self, checkin_time, expected_status, expected_late_minutes):
        Attendance.objects.all().delete()
        today = timezone.now().date()
        mocked_dt = timezone.make_aware(datetime.combine(today, checkin_time))
        valid_image = b'GIF89a\x01\x00\x01\x00\x00\xff\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x00;'
        dummy_photo = SimpleUploadedFile("photo.gif", valid_image, content_type="image/gif")
        
        with patch('django.utils.timezone.now', return_value=mocked_dt):
            response = self.client.post(self.checkin_url, {
                'latitude': '10.0',
                'longitude': '10.0',
                'accuracy': '10.0',
                'photo': dummy_photo,
            }, format='multipart')
            
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        attendance = Attendance.objects.first()
        self.assertEqual(attendance.status, expected_status)
        self.assertEqual(attendance.late_minutes, expected_late_minutes)

    def run_checkout_test(self, checkout_time, expected_early, expected_overtime):
        Attendance.objects.all().delete()
        today = timezone.now().date()
        
        # Create an existing checkin at 9:30 AM
        checkin_dt = timezone.make_aware(datetime.combine(today, time(9, 30)))
        Attendance.objects.create(
            employee=self.employee,
            date=today,
            check_in=checkin_dt,
            status='ON_TIME'
        )
        
        mocked_dt = timezone.make_aware(datetime.combine(today, checkout_time))
        valid_image = b'GIF89a\x01\x00\x01\x00\x00\xff\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x00;'
        dummy_photo = SimpleUploadedFile("photo.gif", valid_image, content_type="image/gif")
        
        with patch('django.utils.timezone.now', return_value=mocked_dt):
            response = self.client.post(self.checkout_url, {
                'latitude': '10.0',
                'longitude': '10.0',
                'accuracy': '10.0',
                'photo': dummy_photo,
            }, format='multipart')
            
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        attendance = Attendance.objects.first()
        self.assertEqual(attendance.early_minutes, expected_early)
        self.assertEqual(attendance.overtime_minutes, expected_overtime)

    def test_checkin_09_29(self):
        self.run_checkin_test(time(9, 29), 'ON_TIME', 0)
        
    def test_checkin_09_30(self):
        self.run_checkin_test(time(9, 30), 'ON_TIME', 0)
        
    def test_checkin_09_31(self):
        self.run_checkin_test(time(9, 31), 'LATE', 1)
        
    def test_checkin_10_00(self):
        self.run_checkin_test(time(10, 0), 'LATE', 30)
        
    def test_checkin_11_00(self):
        self.run_checkin_test(time(11, 0), 'LATE', 90)
        
    def test_checkin_11_01(self):
        self.run_checkin_test(time(11, 1), 'LATE', 91)
        
    def test_checkout_06_29_pm(self):
        self.run_checkout_test(time(18, 29), 1, 0)
        
    def test_checkout_06_30_pm(self):
        self.run_checkout_test(time(18, 30), 0, 0)
        
    def test_checkout_06_31_pm(self):
        self.run_checkout_test(time(18, 31), 0, 1)
        
    def test_checkout_07_00_pm(self):
        self.run_checkout_test(time(19, 0), 0, 30)

class AttendanceStrictCalendarTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.company = Company.objects.create(name="Test Company")
        self.branch = Branch.objects.create(
            company=self.company,
            branch_name="Main Branch",
            latitude=10.0,
            longitude=10.0
        )
        self.policy = AttendancePolicy.objects.create(
            branch=self.branch,
            start_time=time(9, 30),
            end_time=time(18, 30),
            allowed_radius=1000
        )
        self.shift = Shift.objects.create(
            name="Morning Shift",
            start_time=time(9, 30),
            end_time=time(18, 30)
        )
        self.user = User.objects.create_user(
            username="testuser",
            password="password123",
            email="testuser@test.com",
            role="EMPLOYEE",
            phone_number="1234567890"
        )
        self.employee = Employee.objects.create(
            user=self.user,
            branch=self.branch,
            shift=self.shift,
            employee_id="EMP002",
            full_name="EMP-002",
            work_type="OFFICE"
        )
        self.checkin_url = reverse('check-in')
        self.checkout_url = reverse('check-out')
        self.client.force_authenticate(user=self.user)
        self.valid_image = b'GIF89a\x01\x00\x01\x00\x00\xff\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x00;'
    
    def get_dummy_photo(self):
        return SimpleUploadedFile("photo.gif", self.valid_image, content_type="image/gif")

    def test_strict_calendar_flow(self):
        # 1. Date: 02-10-2026. No attendance. Check-in -> SUCCESS
        dt_day1 = timezone.make_aware(datetime(2026, 10, 2, 9, 30))
        with patch('django.utils.timezone.localdate', return_value=dt_day1.date()), \
             patch('django.utils.timezone.now', return_value=dt_day1):
            res = self.client.post(self.checkin_url, {
                'latitude': '10.0', 'longitude': '10.0', 'accuracy': '10.0', 'photo': self.get_dummy_photo(),
            }, format='multipart')
            self.assertEqual(res.status_code, status.HTTP_201_CREATED)
            
        # 2. Same date: Check-in again -> REJECT
        with patch('django.utils.timezone.localdate', return_value=dt_day1.date()), \
             patch('django.utils.timezone.now', return_value=dt_day1):
            res = self.client.post(self.checkin_url, {
                'latitude': '10.0', 'longitude': '10.0', 'accuracy': '10.0', 'photo': self.get_dummy_photo(),
            }, format='multipart')
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("already checked in", str(res.data))

        # 3. Same date: Check-out -> SUCCESS
        dt_day1_out = timezone.make_aware(datetime(2026, 10, 2, 18, 30))
        with patch('django.utils.timezone.localdate', return_value=dt_day1.date()), \
             patch('django.utils.timezone.now', return_value=dt_day1_out):
            res = self.client.post(self.checkout_url, {
                'latitude': '10.0', 'longitude': '10.0', 'accuracy': '10.0', 'photo': self.get_dummy_photo(),
            }, format='multipart')
            self.assertEqual(res.status_code, status.HTTP_200_OK)

        # 4. Same date: Check-out again -> REJECT
        with patch('django.utils.timezone.localdate', return_value=dt_day1.date()), \
             patch('django.utils.timezone.now', return_value=dt_day1_out):
            res = self.client.post(self.checkout_url, {
                'latitude': '10.0', 'longitude': '10.0', 'accuracy': '10.0', 'photo': self.get_dummy_photo(),
            }, format='multipart')
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("already completed", str(res.data))

        # 5. Same date after checkout: Check-in again -> REJECT
        with patch('django.utils.timezone.localdate', return_value=dt_day1.date()), \
             patch('django.utils.timezone.now', return_value=dt_day1_out):
            res = self.client.post(self.checkin_url, {
                'latitude': '10.0', 'longitude': '10.0', 'accuracy': '10.0', 'photo': self.get_dummy_photo(),
            }, format='multipart')
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("already completed", str(res.data))

        # 6. Change server/current date to 03-10-2026. Check today's attendance. -> NO attendance
        dt_day2 = timezone.make_aware(datetime(2026, 10, 3, 9, 30))
        with patch('django.utils.timezone.localdate', return_value=dt_day2.date()), \
             patch('django.utils.timezone.now', return_value=dt_day2):
            res = self.client.get('/api/attendance/today/')
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertEqual(res.data['status'], 'NOT_CHECKED_IN')

        # 7. 03-10-2026: Check-in. -> SUCCESS. NEW record created.
        with patch('django.utils.timezone.localdate', return_value=dt_day2.date()), \
             patch('django.utils.timezone.now', return_value=dt_day2):
            res = self.client.post(self.checkin_url, {
                'latitude': '10.0', 'longitude': '10.0', 'accuracy': '10.0', 'photo': self.get_dummy_photo(),
            }, format='multipart')
            self.assertEqual(res.status_code, status.HTTP_201_CREATED)
            
        # 8. Verify 02-10-2026 record is unchanged and there are 2 separate records
        records = Attendance.objects.filter(employee=self.employee).order_by('date')
        self.assertEqual(records.count(), 2)
        self.assertEqual(records[0].date.strftime('%Y-%m-%d'), '2026-10-02')
        self.assertEqual(records[0].status, 'COMPLETED')
        self.assertEqual(records[1].date.strftime('%Y-%m-%d'), '2026-10-03')
        self.assertEqual(records[1].status, 'ON_TIME')

class AttendanceApprovalTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.company = Company.objects.create(name="Test Company")
        self.branch = Branch.objects.create(
            company=self.company,
            branch_name="Main Branch",
            latitude=10.0,
            longitude=10.0
        )
        self.policy = AttendancePolicy.objects.create(
            branch=self.branch,
            start_time=time(9, 30),
            end_time=time(18, 30),
            allowed_radius=1000
        )
        self.shift = Shift.objects.create(
            name="Morning Shift",
            start_time=time(9, 30),
            end_time=time(18, 30)
        )
        self.admin_user = User.objects.create_superuser(
            username="admin",
            password="password123",
            email="admin@test.com"
        )
        self.employee_user = User.objects.create_user(
            username="empuser",
            password="password123",
            email="emp@test.com",
            role="EMPLOYEE"
        )
        self.employee = Employee.objects.create(
            user=self.employee_user,
            branch=self.branch,
            shift=self.shift,
            employee_id="EMP003",
            full_name="EMP-003"
        )
        self.attendance = Attendance.objects.create(
            employee=self.employee,
            date=timezone.now().date(),
            check_in=timezone.now(),
            check_out=timezone.now(),
            status='COMPLETED'
        )
        self.approve_url = reverse('attendance-approve', kwargs={'pk': self.attendance.id})
        self.reject_url = reverse('attendance-reject', kwargs={'pk': self.attendance.id})

    def test_employee_cannot_approve(self):
        self.client.force_authenticate(user=self.employee_user)
        res = self.client.patch(self.approve_url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_approve(self):
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.patch(self.approve_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.attendance.refresh_from_db()
        self.assertEqual(self.attendance.approval_status, 'APPROVED')
        self.assertIsNone(self.attendance.rejection_reason)
        self.assertEqual(self.attendance.reviewed_by, self.admin_user)

    def test_admin_can_reject(self):
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.patch(self.reject_url, {"reason": "Test Reject"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.attendance.refresh_from_db()
        self.assertEqual(self.attendance.approval_status, 'REJECTED')
        self.assertEqual(self.attendance.rejection_reason, "Test Reject")
        self.assertEqual(self.attendance.reviewed_by, self.admin_user)


class WFHRequestTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.today = timezone.localdate()
        self.company = Company.objects.create(name="WFH Test Company")
        self.branch = Branch.objects.create(
            company=self.company,
            branch_name="WFH Test Branch",
            office_address="Test Address",
            latitude=10.0,
            longitude=10.0,
        )
        self.employee_user = User.objects.create_user(
            username="wfh_employee",
            password="password123",
            email="wfh_employee@test.com",
            role="EMPLOYEE",
            company=self.company,
        )
        self.employee = Employee.objects.create(
            user=self.employee_user,
            branch=self.branch,
            employee_id="WFH-EMP-001",
            full_name="WFH Test Employee",
            department="IT",
            designation="Developer",
        )
        self.admin_user = User.objects.create_user(
            username="wfh_admin",
            password="password123",
            email="wfh_admin@test.com",
            role="ADMIN",
            company=self.company,
            is_staff=True,
        )
        self.wfh_url = reverse("wfh-list")

    @patch("attendance.views.notify_admins_request_submitted")
    def test_employee_can_submit_wfh_request(self, mock_notify):
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.post(
            self.wfh_url,
            {
                "date": (self.today + timezone.timedelta(days=1)).isoformat(),
                "reason": "Personal work",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        request_obj = WFHRequest.objects.get(employee=self.employee)
        self.assertEqual(request_obj.status, "PENDING")
        mock_notify.assert_called_once_with(request_obj, kind="wfh")

    @patch("attendance.views.notify_admins_request_submitted")
    def test_employee_cannot_submit_past_date(self, mock_notify):
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.post(
            self.wfh_url,
            {
                "date": (self.today - timezone.timedelta(days=1)).isoformat(),
                "reason": "Past date",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        mock_notify.assert_not_called()

    @patch("attendance.views.notify_admins_request_submitted")
    def test_duplicate_pending_request_is_rejected(self, mock_notify):
        WFHRequest.objects.create(
            employee=self.employee,
            date=self.today + timezone.timedelta(days=1),
            reason="First request",
        )
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.post(
            self.wfh_url,
            {
                "date": (self.today + timezone.timedelta(days=1)).isoformat(),
                "reason": "Duplicate request",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(WFHRequest.objects.filter(employee=self.employee).count(), 1)
        mock_notify.assert_not_called()

    def test_employee_sees_only_own_requests(self):
        other_user = User.objects.create_user(
            username="wfh_other",
            password="password123",
            email="wfh_other@test.com",
            role="EMPLOYEE",
        )
        other_employee = Employee.objects.create(
            user=other_user,
            branch=self.branch,
            employee_id="WFH-EMP-002",
            full_name="Other Employee",
            department="HR",
            designation="Executive",
        )
        WFHRequest.objects.create(
            employee=self.employee,
            date=self.today + timezone.timedelta(days=1),
            reason="My request",
        )
        WFHRequest.objects.create(
            employee=other_employee,
            date=self.today + timezone.timedelta(days=2),
            reason="Other request",
        )
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get(self.wfh_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["results"] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["employee"], self.employee.id)

    def test_employee_cannot_approve_wfh_request(self):
        request_obj = WFHRequest.objects.create(
            employee=self.employee,
            date=self.today + timezone.timedelta(days=1),
            reason="Need approval",
        )
        self.client.force_authenticate(user=self.employee_user)
        response = self.client.patch(
            reverse("wfh-approve", kwargs={"pk": request_obj.pk})
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        request_obj.refresh_from_db()
        self.assertEqual(request_obj.status, "PENDING")

    @patch("attendance.views.notify_employee_request_decision")
    def test_admin_can_approve_wfh_request(self, mock_notify):
        request_obj = WFHRequest.objects.create(
            employee=self.employee,
            date=self.today + timezone.timedelta(days=1),
            reason="Need approval",
        )
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.patch(
            reverse("wfh-approve", kwargs={"pk": request_obj.pk})
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        request_obj.refresh_from_db()
        self.assertEqual(request_obj.status, "APPROVED")
        self.assertEqual(request_obj.approved_by, self.admin_user)
        self.assertIsNotNone(request_obj.approved_at)
        mock_notify.assert_called_once_with(request_obj, kind="wfh")

    @patch("attendance.views.notify_employee_request_decision")
    def test_admin_can_reject_wfh_request_with_reason(self, mock_notify):
        request_obj = WFHRequest.objects.create(
            employee=self.employee,
            date=self.today + timezone.timedelta(days=1),
            reason="Need approval",
        )
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.patch(
            reverse("wfh-reject", kwargs={"pk": request_obj.pk}),
            {"reason": "Insufficient details"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        request_obj.refresh_from_db()
        self.assertEqual(request_obj.status, "REJECTED")
        self.assertEqual(request_obj.rejection_reason, "Insufficient details")
        mock_notify.assert_called_once_with(request_obj, kind="wfh")

    def test_reject_requires_reason(self):
        request_obj = WFHRequest.objects.create(
            employee=self.employee,
            date=self.today + timezone.timedelta(days=1),
            reason="Need approval",
        )
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.patch(
            reverse("wfh-reject", kwargs={"pk": request_obj.pk}),
            {"reason": "   "},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        request_obj.refresh_from_db()
        self.assertEqual(request_obj.status, "PENDING")

    def test_hr_cannot_access_another_company_wfh_request(self):
        other_company = Company.objects.create(name="Another WFH Company")
        other_branch = Branch.objects.create(
            company=other_company,
            branch_name="Other Branch",
            office_address="Other Address",
            latitude=11.0,
            longitude=11.0,
        )
        other_user = User.objects.create_user(
            username="wfh_other_company",
            password="password123",
            email="wfh_other_company@test.com",
            role="EMPLOYEE",
            company=other_company,
        )
        other_employee = Employee.objects.create(
            user=other_user,
            branch=other_branch,
            employee_id="WFH-EMP-003",
            full_name="Other Company Employee",
            department="IT",
            designation="Developer",
        )
        request_obj = WFHRequest.objects.create(
            employee=other_employee,
            date=self.today + timezone.timedelta(days=1),
            reason="Other company request",
        )
        hr_user = User.objects.create_user(
            username="wfh_hr",
            password="password123",
            email="wfh_hr@test.com",
            role="HR",
            company=self.company,
        )
        self.client.force_authenticate(user=hr_user)
        response = self.client.patch(
            reverse("wfh-approve", kwargs={"pk": request_obj.pk})
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        request_obj.refresh_from_db()
        self.assertEqual(request_obj.status, "PENDING")
