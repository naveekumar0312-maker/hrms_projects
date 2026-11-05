from datetime import date, datetime
from django.core.management.base import BaseCommand
from attendance.photo_cleanup_service import (
    get_previous_completed_cycle,
    cleanup_completed_cycle_photos
)


class Command(BaseCommand):
    help = (
        "Automatic / scheduled cleanup of completed 26th-25th monthly cycle attendance photos. "
        "Deletes physical check_in_photo and check_out_photo files belonging to the completed cycle "
        "and clears their photo field references while preserving all attendance records, "
        "timestamps, GPS coordinates, and employee shift data."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview photos that will be deleted without deleting files or modifying the DB.'
        )
        parser.add_argument(
            '--reference-date',
            type=str,
            help='Override reference date (YYYY-MM-DD) to test specific cycle runs (default: today).'
        )
        parser.add_argument(
            '--force-any-day',
            action='store_true',
            help='Run cleanup even if today is not the 26th (for manual or custom invocation).'
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        force_any_day = options.get('force_any_day', False)
        ref_date_str = options.get('reference_date')

        if ref_date_str:
            try:
                ref_date = datetime.strptime(ref_date_str, '%Y-%m-%d').date()
            except ValueError:
                self.stdout.write(self.style.ERROR("Invalid reference-date format. Use YYYY-MM-DD."))
                return
        else:
            ref_date = date.today()

        # The scheduled monthly run trigger is on the 26th
        if not force_any_day and not ref_date_str and ref_date.day != 26:
            self.stdout.write(self.style.WARNING(
                f"Today is {ref_date} (day {ref_date.day}). "
                f"Automatic cycle cleanup runs on the 26th. Skipping. "
                f"(Use --force-any-day or --reference-date to override)."
            ))
            return

        cycle_year, cycle_month, start_date, end_date = get_previous_completed_cycle(ref_date)

        mode_str = "DRY-RUN (PREVIEW ONLY)" if dry_run else "REAL DELETION"
        self.stdout.write(self.style.WARNING(
            f"\n=== MONTHLY ATTENDANCE PHOTO CLEANUP [{mode_str}] ===\n"
            f"Reference date:        {ref_date}\n"
            f"Target Completed Cycle:{start_date} to {end_date} (Cycle {cycle_month}/{cycle_year})\n"
        ))

        result = cleanup_completed_cycle_photos(start_date, end_date, dry_run=dry_run)

        self.stdout.write(f"Attendance records inspected: {result['records_inspected']}")
        self.stdout.write(f"Check-In photos { 'previewed' if dry_run else 'deleted' }:  {result['check_in_photos_deleted']}")
        self.stdout.write(f"Check-Out photos { 'previewed' if dry_run else 'deleted' }: {result['check_out_photos_deleted']}")
        self.stdout.write(f"Total photos { 'previewed' if dry_run else 'deleted' }:     {result['physical_files_deleted']}")
        self.stdout.write(f"DB records photo fields cleared: {result['db_fields_cleared']}\n")

        if dry_run:
            self.stdout.write(self.style.SUCCESS("[OK] Dry run complete. No files or database records were modified."))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"[SUCCESS] Completed cycle cleanup for {start_date} to {end_date} finished successfully. "
                f"All attendance rows, timestamps, and locations remain 100% intact."
            ))

