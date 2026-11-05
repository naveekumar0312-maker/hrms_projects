import os
import logging
from datetime import date, datetime
from django.conf import settings
from attendance.models import Attendance
from attendance.services import get_attendance_cycle

logger = logging.getLogger(__name__)

# Canonical relative directories strictly targeted
CHECK_IN_REL_DIR = os.path.join('attendance_photos', 'check_in')
CHECK_OUT_REL_DIR = os.path.join('attendance_photos', 'check_out')


def get_previous_completed_cycle(reference_date: date = None):
    """
    Given a reference date (defaulting to today), compute the immediately preceding completed
    26th-25th monthly cycle.
    
    A cycle runs from the 26th of month M-1 to the 25th of month M.
    When reference_date is on or after the 26th of month M (e.g. Nov 26),
    the completed cycle that just finished on the 25th is:
        Start: 26th of month M-1 (e.g. Oct 26)
        End:   25th of month M   (e.g. Nov 25)
        
    If reference_date is before the 26th (e.g. Nov 10):
        The currently running cycle ends on Nov 25.
        The last completed cycle before that ended on Oct 25:
        Start: 26th of month M-2 (e.g. Sep 26)
        End:   25th of month M-1 (e.g. Oct 25)
    """
    if reference_date is None:
        reference_date = date.today()
    elif isinstance(reference_date, datetime):
        reference_date = reference_date.date()
    elif isinstance(reference_date, str):
        reference_date = datetime.strptime(reference_date, '%Y-%m-%d').date()

    if reference_date.day >= 26:
        # Completed cycle ended on the 25th of this current calendar month
        cycle_year = reference_date.year
        cycle_month = reference_date.month
    else:
        # Completed cycle ended on the 25th of the PREVIOUS calendar month
        if reference_date.month == 1:
            cycle_year = reference_date.year - 1
            cycle_month = 12
        else:
            cycle_year = reference_date.year
            cycle_month = reference_date.month - 1

    start_date, end_date = get_attendance_cycle(cycle_year, cycle_month)
    return cycle_year, cycle_month, start_date, end_date


def get_attendance_photos_base_dirs():
    """
    Returns absolute paths for media/attendance_photos/check_in and check_out.
    Enforces directory existence and normalizes paths.
    """
    media_root = os.path.abspath(settings.MEDIA_ROOT)
    check_in_dir = os.path.abspath(os.path.join(media_root, CHECK_IN_REL_DIR))
    check_out_dir = os.path.abspath(os.path.join(media_root, CHECK_OUT_REL_DIR))
    return check_in_dir, check_out_dir


def _is_safe_file_in_dir(file_path: str, allowed_dir: str) -> bool:
    """
    Safety check: Ensure file_path is strictly inside allowed_dir and not escaping
    or pointing outside.
    """
    try:
        abs_file = os.path.abspath(file_path)
        abs_allowed = os.path.abspath(allowed_dir)
        # Must start with allowed_dir + separator
        return abs_file.startswith(abs_allowed + os.sep) and os.path.isfile(abs_file)
    except Exception:
        return False


def delete_photo_file(file_path: str, allowed_dir: str, dry_run: bool = False) -> bool:
    """
    Safely delete a physical photo file if it exists and is strictly inside allowed_dir.
    Returns True if deleted (or would be deleted in dry_run), False otherwise.
    """
    if not file_path:
        return False

    abs_path = os.path.abspath(file_path)
    if not _is_safe_file_in_dir(abs_path, allowed_dir):
        return False

    if not os.path.exists(abs_path):
        return False

    if dry_run:
        return True

    try:
        os.remove(abs_path)
        return True
    except OSError as e:
        logger.error(f"[Photo Cleanup] Failed to remove file {abs_path}: {e}")
        return False


def cleanup_completed_cycle_photos(start_date: date, end_date: date, dry_run: bool = False):
    """
    Cleans up check_in and check_out photos for attendance records falling strictly within
    the date range [start_date, end_date].
    
    1. Queries Attendance.objects.filter(date__gte=start_date, date__lte=end_date)
    2. Collects file paths for check_in_photo and check_out_photo.
    3. Deletes physical files strictly inside media/attendance_photos/check_in and check_out.
    4. Clears check_in_photo and check_out_photo fields on attendance records without modifying
       any other fields (timestamps, status, coordinates, employee, etc. remain 100% intact).
       
    Returns summary dict:
    {
        'cycle_start': start_date,
        'cycle_end': end_date,
        'dry_run': dry_run,
        'records_inspected': int,
        'check_in_photos_deleted': int,
        'check_out_photos_deleted': int,
        'physical_files_deleted': int,
        'db_fields_cleared': int,
        'errors': list
    }
    """
    check_in_dir, check_out_dir = get_attendance_photos_base_dirs()
    media_root = os.path.abspath(settings.MEDIA_ROOT)

    records = Attendance.objects.filter(date__gte=start_date, date__lte=end_date)
    records_count = records.count()

    check_in_deleted = 0
    check_out_deleted = 0
    db_fields_cleared = 0
    errors = []

    logger.info(
        f"[Photo Cleanup] Starting cycle cleanup for {start_date} -> {end_date} (dry_run={dry_run}). "
        f"Matching records: {records_count}"
    )

    records_to_update = []

    for att in records:
        updated = False

        # 1. Check-In photo
        if att.check_in_photo and att.check_in_photo.name:
            # Full path on disk
            full_path = os.path.join(media_root, att.check_in_photo.name)
            if _is_safe_file_in_dir(full_path, check_in_dir):
                if delete_photo_file(full_path, check_in_dir, dry_run=dry_run):
                    check_in_deleted += 1
            if not dry_run:
                att.check_in_photo = None
                updated = True

        # 2. Check-Out photo
        if att.check_out_photo and att.check_out_photo.name:
            full_path = os.path.join(media_root, att.check_out_photo.name)
            if _is_safe_file_in_dir(full_path, check_out_dir):
                if delete_photo_file(full_path, check_out_dir, dry_run=dry_run):
                    check_out_deleted += 1
            if not dry_run:
                att.check_out_photo = None
                updated = True

        if updated:
            records_to_update.append(att)

    if not dry_run and records_to_update:
        # Save only the image fields so other fields are NEVER touched
        for att in records_to_update:
            att.save(update_fields=['check_in_photo', 'check_out_photo'])
        db_fields_cleared = len(records_to_update)

    result = {
        'cycle_start': start_date,
        'cycle_end': end_date,
        'dry_run': dry_run,
        'records_inspected': records_count,
        'check_in_photos_deleted': check_in_deleted,
        'check_out_photos_deleted': check_out_deleted,
        'physical_files_deleted': check_in_deleted + check_out_deleted,
        'db_fields_cleared': db_fields_cleared if not dry_run else (check_in_deleted + check_out_deleted),
        'errors': errors
    }

    logger.info(
        f"[Photo Cleanup] Finished cycle cleanup: {result['physical_files_deleted']} files deleted, "
        f"{result['db_fields_cleared']} records cleared."
    )
    return result


def cleanup_all_existing_old_photos(dry_run: bool = False):
    """
    One-time cleanup for all existing old physical check-in and check-out photos.
    
    1. Scans media/attendance_photos/check_in/ and media/attendance_photos/check_out/ directly.
    2. Deletes physical files strictly inside those 2 directories only.
    3. Nulls out check_in_photo and check_out_photo on all Attendance records that reference them,
       preserving all attendance details (employee, timestamps, coordinates, status, etc.).
       
    Returns summary dict:
    {
        'dry_run': dry_run,
        'check_in_files_found': int,
        'check_in_files_deleted': int,
        'check_out_files_found': int,
        'check_out_files_deleted': int,
        'total_physical_deleted': int,
        'total_bytes_freed': int,
        'db_records_cleared': int,
        'errors': list
    }
    """
    check_in_dir, check_out_dir = get_attendance_photos_base_dirs()
    errors = []

    check_in_files = []
    if os.path.exists(check_in_dir):
        for entry in os.scandir(check_in_dir):
            if entry.is_file():
                check_in_files.append((entry.path, entry.stat().st_size))

    check_out_files = []
    if os.path.exists(check_out_dir):
        for entry in os.scandir(check_out_dir):
            if entry.is_file():
                check_out_files.append((entry.path, entry.stat().st_size))

    bytes_freed = 0
    cin_deleted = 0
    cout_deleted = 0

    # Delete check_in files
    for path, size in check_in_files:
        if delete_photo_file(path, check_in_dir, dry_run=dry_run):
            cin_deleted += 1
            bytes_freed += size

    # Delete check_out files
    for path, size in check_out_files:
        if delete_photo_file(path, check_out_dir, dry_run=dry_run):
            cout_deleted += 1
            bytes_freed += size

    # Update database records referencing any check_in_photo or check_out_photo
    db_cleared = 0
    att_with_photos = Attendance.objects.exclude(check_in_photo='').exclude(check_in_photo__isnull=True) | \
                      Attendance.objects.exclude(check_out_photo='').exclude(check_out_photo__isnull=True)
    db_count = att_with_photos.count()

    if not dry_run and db_count > 0:
        for att in att_with_photos:
            att.check_in_photo = None
            att.check_out_photo = None
            att.save(update_fields=['check_in_photo', 'check_out_photo'])
        db_cleared = db_count
    elif dry_run:
        db_cleared = db_count

    result = {
        'dry_run': dry_run,
        'check_in_files_found': len(check_in_files),
        'check_in_files_deleted': cin_deleted,
        'check_out_files_found': len(check_out_files),
        'check_out_files_deleted': cout_deleted,
        'total_physical_deleted': cin_deleted + cout_deleted,
        'total_bytes_freed': bytes_freed,
        'db_records_cleared': db_cleared,
        'errors': errors
    }

    logger.info(
        f"[One-time Cleanup] Found {result['total_physical_deleted']} photos "
        f"({result['total_bytes_freed'] / (1024*1024):.2f} MB), dry_run={dry_run}"
    )
    return result

