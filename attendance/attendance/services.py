import json
from calendar import monthrange
from datetime import date, datetime, time, timedelta
from math import asin, cos, radians, sin, sqrt
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.db.models import Q
from django.utils import timezone


def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two GPS coordinates in meters."""
    lon1, lat1, lon2, lat2 = map(
        radians,
        [lon1, lat1, lon2, lat2]
    )

    dlon = lon2 - lon1
    dlat = lat2 - lat1

    a = (
        sin(dlat / 2) ** 2
        + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    )

    c = 2 * asin(sqrt(a))
    r = 6371

    return c * r * 1000


def calculate_distance(emp_lat, emp_lon, branch_lat, branch_lon):
    return haversine_distance(
        emp_lat,
        emp_lon,
        branch_lat,
        branch_lon
    )


def reverse_geocode(latitude, longitude):
    """
    Convert GPS coordinates to a readable location name.
    Failure here will not block attendance.
    """
    try:
        params = urlencode({
            "format": "jsonv2",
            "lat": str(latitude),
            "lon": str(longitude),
            "zoom": "18",
            "addressdetails": "1",
            "accept-language": "en",
        })

        url = (
            "https://nominatim.openstreetmap.org/reverse?"
            + params
        )

        request = Request(
            url,
            headers={
                "User-Agent": "AttendanceManagementSystem/1.0"
            },
        )

        with urlopen(request, timeout=5) as response:
            data = json.loads(
                response.read().decode("utf-8")
            )

        display_name = data.get("display_name")

        if display_name:
            return display_name

        address = data.get("address", {})

        parts = [
            address.get("road"),
            address.get("suburb"),
            address.get("city"),
            address.get("town"),
            address.get("village"),
            address.get("state"),
            address.get("postcode"),
        ]

        parts = [
            str(part).strip()
            for part in parts
            if part
        ]

        return ", ".join(dict.fromkeys(parts)) if parts else None

    except Exception as exc:
        print(f"Reverse geocoding failed: {exc}")
        return None


def update_location_name_async(attendance_id, latitude, longitude, is_check_in=True):
    """
    Run reverse geocoding asynchronously in a background thread so check-in/out returns instantly.
    """
    import threading

    def _worker():
        try:
            from attendance.models import Attendance
            loc_name = reverse_geocode(latitude, longitude)
            if loc_name:
                update_fields = {}
                if is_check_in:
                    update_fields['check_in_location_name'] = loc_name
                else:
                    update_fields['check_out_location_name'] = loc_name
                Attendance.objects.filter(pk=attendance_id).update(**update_fields)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Async reverse geocode update failed: %s", e)

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def normalize_image_orientation(uploaded_file):
    """
    Ensure uploaded photo has correct upright orientation according to its EXIF metadata.
    Downscales huge mobile photos to max 1280px and saves at quality 80 for blazing fast processing.
    """
    if not uploaded_file:
        return uploaded_file

    try:
        from PIL import Image, ImageOps
        import io
        from django.core.files.uploadedfile import InMemoryUploadedFile

        uploaded_file.seek(0)
        img = Image.open(uploaded_file)
        
        # ImageOps.exif_transpose rotates the image according to EXIF orientation tag
        transposed = ImageOps.exif_transpose(img)
        if transposed is None:
            transposed = img

        # Resize if dimensions are excessively large (camera photos are often 4000x3000px)
        max_dimension = 1280
        if max(transposed.size) > max_dimension:
            transposed.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

        buf = io.BytesIO()
        img_format = img.format or 'JPEG'
        save_format = img_format if img_format.upper() in ('JPEG', 'PNG', 'WEBP') else 'JPEG'
        
        if save_format.upper() == 'JPEG' and transposed.mode in ('RGBA', 'P'):
            transposed = transposed.convert('RGB')
            
        transposed.save(buf, format=save_format, quality=80, optimize=True)
        buf.seek(0)

        new_name = uploaded_file.name
        content_type = uploaded_file.content_type if hasattr(uploaded_file, 'content_type') else 'image/jpeg'

        return InMemoryUploadedFile(
            file=buf,
            field_name=getattr(uploaded_file, 'field_name', None),
            name=new_name,
            content_type=content_type,
            size=buf.getbuffer().nbytes,
            charset=getattr(uploaded_file, 'charset', None),
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Image normalization skipped: %s", e)
        if hasattr(uploaded_file, 'seek'):
            uploaded_file.seek(0)
        return uploaded_file


# -------------------------------------------------------------------------
# 26th - 25th Cycle Services
# -------------------------------------------------------------------------

def get_attendance_cycle(year: int, month: int):
    """
    Attendance / Leave / Permission calculation period:
    26th of previous month -> 25th of selected month.

    Examples:
      January cycle (month=1): Dec 26 (year-1) -> Jan 25 (year)
      February cycle (month=2): Jan 26 -> Feb 25
      March cycle (month=3): Feb 26 -> Mar 25
    """
    if month == 1:
        previous_year = year - 1
        previous_month = 12
    else:
        previous_year = year
        previous_month = month - 1

    start_date = date(previous_year, previous_month, 26)
    end_date = date(year, month, 25)

    return start_date, end_date


def get_cycle_for_date(target_date: date):
    """
    Determine which (cycle_year, cycle_month, cycle_start, cycle_end)
    contains the given target_date.

    If target_date.day >= 26:
      belongs to next month's cycle!
      e.g. 2026-10-26 belongs to November 2026 cycle (2026-10-26 to 2026-11-25)
    If target_date.day <= 25:
      belongs to current month's cycle!
      e.g. 2026-10-24 belongs to October 2026 cycle (2026-09-26 to 2026-10-25)
    """
    if isinstance(target_date, str):
        target_date = datetime.strptime(target_date, "%Y-%m-%d").date()
    elif isinstance(target_date, datetime):
        target_date = target_date.date()

    if target_date.day >= 26:
        if target_date.month == 12:
            cycle_year = target_date.year + 1
            cycle_month = 1
        else:
            cycle_year = target_date.year
            cycle_month = target_date.month + 1
    else:
        cycle_year = target_date.year
        cycle_month = target_date.month

    start_date, end_date = get_attendance_cycle(cycle_year, cycle_month)
    return cycle_year, cycle_month, start_date, end_date


# -------------------------------------------------------------------------
# Leave & Permission Usage Calculations within a 26th-25th Cycle
# -------------------------------------------------------------------------

def calculate_leave_usage_for_cycle(employee, cycle_year: int, cycle_month: int):
    """
    Calculate leave usage for an employee in a given 26th-25th cycle.
    Splits any leave request that crosses the cycle boundaries so that
    only the days falling within [cycle_start, cycle_end] are counted.
    """
    from attendance.models import LeaveRequest

    cycle_start, cycle_end = get_attendance_cycle(cycle_year, cycle_month)

    # Approved leaves that overlap with [cycle_start, cycle_end]
    leaves = LeaveRequest.objects.filter(
        employee=employee,
        status='APPROVED',
        start_date__lte=cycle_end,
        end_date__gte=cycle_start,
    )

    total_days = 0.0
    by_type = {}

    for leave in leaves:
        curr = max(leave.start_date, cycle_start)
        last = min(leave.end_date, cycle_end)

        if leave.leave_type == 'HALF_DAY':
            # Half day counts as 0.5 day
            days = 0.5
        else:
            days = float((last - curr).days + 1)

        total_days += days
        by_type[leave.leave_type] = by_type.get(leave.leave_type, 0.0) + days

    return {
        "cycle_year": cycle_year,
        "cycle_month": cycle_month,
        "cycle_start": cycle_start.isoformat(),
        "cycle_end": cycle_end.isoformat(),
        "used_days": total_days,
        "by_type": by_type,
    }


def calculate_permission_usage_for_cycle(employee, cycle_year: int, cycle_month: int):
    """
    Calculate permission usage for an employee in a given 26th-25th cycle.
    Only APPROVED permissions count towards usage.
    Limit is 180 minutes per cycle.
    """
    from attendance.models import PermissionRequest

    cycle_start, cycle_end = get_attendance_cycle(cycle_year, cycle_month)

    permissions = PermissionRequest.objects.filter(
        employee=employee,
        status='APPROVED',
        date__gte=cycle_start,
        date__lte=cycle_end,
    )

    used_minutes = sum(p.duration_minutes for p in permissions)
    limit_minutes = 180
    remaining_minutes = max(0, limit_minutes - used_minutes)

    return {
        "cycle_year": cycle_year,
        "cycle_month": cycle_month,
        "cycle_start": cycle_start.isoformat(),
        "cycle_end": cycle_end.isoformat(),
        "limit_minutes": limit_minutes,
        "used_minutes": used_minutes,
        "remaining_minutes": remaining_minutes,
    }


# -------------------------------------------------------------------------
# Centralized Attendance Status Resolution & Reporting Service
# -------------------------------------------------------------------------

def resolve_holiday_map(start_date: date, end_date: date, company=None, branch=None):
    """
    Query active holidays in [start_date, end_date] for the given company or branch.
    Returns dict mapping date_str (YYYY-MM-DD) -> Holiday model instance.
    """
    from attendance.models import Holiday

    qs = Holiday.objects.filter(
        date__range=[start_date, end_date],
        is_active=True,
    )

    if company:
        qs = qs.filter(company=company)
    elif branch and branch.company_id:
        qs = qs.filter(company=branch.company)

    return {str(h.date): h for h in qs}


def get_employee_attendance_status(
    record,
    employee,
    target_date: date,
    holiday=None,
    approved_leave=None,
    now=None,
    approved_wfh=None,
):
    """
    Single source of truth for an employee's attendance status on a specific date.

    Status precedence:
      1. If real attendance record exists (employee checked in):
         - If check_in is rejected or check_out is rejected -> 'REJECTED'
         - If check_in is late (late_minutes > 0 or status == 'LATE') -> 'LATE'
         - If checked in and checked out or working -> 'PRESENT'
      2. If approved WFH covers this date and no punch yet:
         - 'WFH'
      3. If approved leave covers this date:
         - 'HALF DAY' if leave_type == 'HALF_DAY' else 'ON_LEAVE'
      4. If holiday covers this date:
         - 'HOLIDAY'
      5. If weekly off (Sunday):
         - 'WEEKLY_OFF'
      6. If date is in the future:
         - 'FUTURE'
      7. If date is today:
         - If employee's shift end time has passed -> 'ABSENT'
         - Else -> 'PENDING'
      8. If date is in the past:
         - 'ABSENT'
    """
    if now is None:
        now = timezone.localtime()
    today = now.date()

    if record is not None:
        # Check explicit rejections
        check_in_appr = getattr(record, 'check_in_approval_status', None)
        check_out_appr = getattr(record, 'check_out_approval_status', None)
        if check_in_appr == 'REJECTED' or check_out_appr == 'REJECTED':
            return 'REJECTED'

        # If employee was late
        late_mins = getattr(record, 'late_minutes', 0) or 0
        rec_status = getattr(record, 'status', None) or ''
        if late_mins > 0 or rec_status == 'LATE':
            return 'LATE'

        # If they had half day leave and checked in
        if approved_leave and approved_leave.leave_type == 'HALF_DAY':
            return 'HALF DAY'

        if approved_wfh is not None:
            return 'WFH'

        return 'PRESENT'

    # No attendance record was punched:
    if approved_wfh is not None:
        return 'WFH'

    if approved_leave is not None:
        if approved_leave.leave_type == 'HALF_DAY':
            return 'HALF DAY'
        return 'ON_LEAVE'

    if holiday is not None:
        return 'HOLIDAY'

    # Sunday as weekly off
    if target_date.weekday() == 6:
        return 'WEEKLY_OFF'

    if target_date > today:
        return 'FUTURE'

    if target_date == today:
        shift = getattr(employee, 'shift', None) if employee else None
        if not shift or not shift.end_time:
            return 'PENDING'

        shift_end_datetime = timezone.make_aware(
            datetime.combine(target_date, shift.end_time)
        )
        if now < shift_end_datetime:
            return 'PENDING'
        return 'ABSENT'

    # Past date with no attendance, no leave, no holiday
    return 'ABSENT'


def build_employee_attendance_report(
    employee,
    start_date: date,
    end_date: date,
    now=None,
):
    """
    Build a comprehensive, unified attendance calendar and summary for an employee
    over [start_date, end_date]. Used by Web Reports, Mobile Attendance History,
    and Admin dashboards.
    """
    from attendance.models import Attendance, LeaveRequest, PermissionRequest, WFHRequest

    if now is None:
        now = timezone.localtime()
    today = now.date()

    company = employee.branch.company if employee.branch else None
    holidays_by_date = resolve_holiday_map(start_date, end_date, company=company)

    # Approved leaves
    approved_leaves = LeaveRequest.objects.filter(
        employee=employee,
        start_date__lte=end_date,
        end_date__gte=start_date,
    )
    leave_by_date = {}
    for leave in approved_leaves:
        curr = max(leave.start_date, start_date)
        last = min(leave.end_date, end_date)
        while curr <= last:
            # Prioritize APPROVED leave over pending/rejected
            existing_lev = leave_by_date.get(str(curr))
            if not existing_lev or (existing_lev.status != 'APPROVED' and leave.status == 'APPROVED'):
                leave_by_date[str(curr)] = leave
            curr += timedelta(days=1)

    # Permissions in cycle (mapped by date, can have multiple)
    permissions = PermissionRequest.objects.filter(
        employee=employee,
        date__range=[start_date, end_date],
    )
    permissions_by_date = {}
    for perm in permissions:
        d_k = str(perm.date)
        if d_k not in permissions_by_date:
            permissions_by_date[d_k] = []
        permissions_by_date[d_k].append(perm)

    # WFH requests in cycle
    wfh_requests = WFHRequest.objects.filter(
        employee=employee,
        date__range=[start_date, end_date],
    )
    wfh_by_date = {}
    for w in wfh_requests:
        existing_wfh = wfh_by_date.get(str(w.date))
        if not existing_wfh or (existing_wfh.status != 'APPROVED' and w.status == 'APPROVED'):
            wfh_by_date[str(w.date)] = w

    # Actual attendance records
    records = Attendance.objects.filter(
        employee=employee,
        date__range=[start_date, end_date],
    ).select_related('employee', 'employee__branch', 'employee__shift')

    records_by_date = {str(r.date): r for r in records}

    calendar = []
    present_count = 0
    late_count = 0
    absent_count = 0
    holiday_count = 0
    on_leave_count = 0
    weekly_off_count = 0
    half_day_count = 0
    wfh_count = 0
    permission_count = 0
    total_working_seconds = 0

    curr = start_date
    while curr <= end_date:
        d_str = str(curr)
        rec = records_by_date.get(d_str)
        hol = holidays_by_date.get(d_str)
        lev = leave_by_date.get(d_str)
        wfh = wfh_by_date.get(d_str)
        perms = permissions_by_date.get(d_str, [])

        approved_lev = lev if (lev and lev.status == 'APPROVED') else None
        approved_wfh = wfh if (wfh and wfh.status == 'APPROVED') else None

        calculated_status = get_employee_attendance_status(
            record=rec,
            employee=employee,
            target_date=curr,
            holiday=hol,
            approved_leave=approved_lev,
            now=now,
            approved_wfh=approved_wfh,
        )

        working_hours_str = "00:00"
        check_in_time_iso = None
        check_out_time_iso = None
        late_minutes = 0
        early_minutes = 0
        overtime_minutes = 0
        approval_status = None
        rejection_reason = None
        check_in_photo = None
        check_out_photo = None
        check_in_loc = None
        check_out_loc = None

        if rec is not None:
            if rec.check_in and rec.check_out:
                diff = rec.check_out - rec.check_in
                ts = int(diff.total_seconds())
                total_working_seconds += ts
                working_hours_str = f"{ts // 3600:02d}:{(ts % 3600) // 60:02d}"

            check_in_time_iso = rec.check_in.isoformat() if rec.check_in else None
            check_out_time_iso = rec.check_out.isoformat() if rec.check_out else None
            late_minutes = rec.late_minutes
            early_minutes = rec.early_minutes
            overtime_minutes = rec.overtime_minutes
            approval_status = rec.approval_status
            rejection_reason = rec.rejection_reason
            check_in_photo = rec.check_in_photo.url if rec.check_in_photo else None
            check_out_photo = rec.check_out_photo.url if rec.check_out_photo else None

            if rec.check_in_latitude and rec.check_in_longitude:
                check_in_loc = {
                    "latitude": float(rec.check_in_latitude),
                    "longitude": float(rec.check_in_longitude),
                    "accuracy": rec.check_in_accuracy,
                    "location_name": rec.check_in_location_name,
                }
            if rec.check_out_latitude and rec.check_out_longitude:
                check_out_loc = {
                    "latitude": float(rec.check_out_latitude),
                    "longitude": float(rec.check_out_longitude),
                    "accuracy": rec.check_out_accuracy,
                    "location_name": rec.check_out_location_name,
                }

        # Count summaries
        if calculated_status == 'PRESENT':
            present_count += 1
        elif calculated_status == 'LATE':
            late_count += 1
            present_count += 1  # Late employees were present at work
        elif calculated_status == 'WFH':
            wfh_count += 1
            present_count += 1  # WFH is counted towards working attendance
        elif calculated_status == 'ABSENT':
            absent_count += 1
        elif calculated_status == 'HOLIDAY':
            holiday_count += 1
        elif calculated_status == 'ON_LEAVE':
            on_leave_count += 1
        elif calculated_status == 'WEEKLY_OFF':
            weekly_off_count += 1
        elif calculated_status == 'HALF DAY':
            half_day_count += 1
            present_count += 0.5
            on_leave_count += 0.5

        if any(p.status == 'APPROVED' for p in perms):
            permission_count += 1

        day_item = {
            "id": rec.id if rec else f"{calculated_status.lower()}-{d_str}",
            "date": d_str,
            "status": calculated_status,
            "approval_status": approval_status if rec else (
                approved_lev.status if approved_lev else (
                    approved_wfh.status if approved_wfh else None
                )
            ),
            "rejection_reason": rejection_reason,
            "check_in_time": check_in_time_iso,
            "check_out_time": check_out_time_iso,
            "working_hours": working_hours_str,
            "late_minutes": late_minutes,
            "late_reason": getattr(rec, 'late_reason', None) if rec else None,
            "early_minutes": early_minutes,
            "overtime_minutes": overtime_minutes,
            "check_in_photo": check_in_photo,
            "check_out_photo": check_out_photo,
            "check_in_location": check_in_loc,
            "check_out_location": check_out_loc,
        }

        if hol:
            day_item["holiday_name"] = hol.name
            day_item["holiday_description"] = hol.description

        if lev:
            day_item["leave"] = {
                "id": lev.id,
                "leave_type": lev.leave_type,
                "start_date": str(lev.start_date),
                "end_date": str(lev.end_date),
                "reason": lev.reason,
                "status": lev.status,
            }

        if perms:
            day_item["permissions"] = [
                {
                    "id": p.id,
                    "date": str(p.date),
                    "duration_minutes": p.duration_minutes,
                    "start_time": str(p.start_time) if p.start_time else None,
                    "end_time": str(p.end_time) if p.end_time else None,
                    "reason": p.reason,
                    "status": p.status,
                }
                for p in perms
            ]

        if wfh:
            day_item["wfh"] = {
                "id": wfh.id,
                "date": str(wfh.date),
                "reason": wfh.reason,
                "status": wfh.status,
            }

        calendar.append(day_item)
        curr += timedelta(days=1)

    wh_h = total_working_seconds // 3600
    wh_m = (total_working_seconds % 3600) // 60
    total_wh_str = f"{wh_h:02d}:{wh_m:02d}"

    # Attendance percentage based on scheduled working days (present / (present + absent))
    scheduled_days = present_count + absent_count
    attendance_pct = round((present_count / scheduled_days * 100), 1) if scheduled_days > 0 else 0.0

    return {
        "start_date": str(start_date),
        "end_date": str(end_date),
        "summary": {
            "present": present_count,
            "late": late_count,
            "absent": absent_count,
            "holidays": holiday_count,
            "approved_leaves": on_leave_count,
            "weekly_offs": weekly_off_count,
            "half_days": half_day_count,
            "working_days": present_count,
            "attendance_percentage": attendance_pct,
            "total_working_hours": total_wh_str,
        },
        "calendar": calendar,
    }
