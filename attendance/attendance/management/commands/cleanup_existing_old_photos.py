import sys
from django.core.management.base import BaseCommand
from attendance.photo_cleanup_service import cleanup_all_existing_old_photos


class Command(BaseCommand):
    help = (
        "One-time cleanup command to safely delete all existing physical Check-In and Check-Out "
        "attendance photos in media/attendance_photos/check_in/ and check_out/. "
        "Preserves all database attendance records, employees, shifts, and timestamps."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulate cleanup without actually deleting any files or updating the database.'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Execute cleanup without interactive confirmation prompt.'
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        force = options.get('force', False)

        mode_str = "DRY-RUN (PREVIEW ONLY)" if dry_run else "REAL DELETION"
        self.stdout.write(self.style.WARNING(f"\n=== ONE-TIME ATTENDANCE PHOTO CLEANUP [{mode_str}] ==="))
        self.stdout.write("Target directories:")
        self.stdout.write("  - media/attendance_photos/check_in/")
        self.stdout.write("  - media/attendance_photos/check_out/\n")

        # Run preview first if not forced
        preview = cleanup_all_existing_old_photos(dry_run=True)
        mb_freed = preview['total_bytes_freed'] / (1024 * 1024)

        self.stdout.write(f"Check-In photos found:  {preview['check_in_files_found']}")
        self.stdout.write(f"Check-Out photos found: {preview['check_out_files_found']}")
        self.stdout.write(f"Total photos found:     {preview['total_physical_deleted']}")
        self.stdout.write(f"Total disk space:       {mb_freed:.2f} MB")
        self.stdout.write(f"Database records with photo fields: {preview['db_records_cleared']}\n")

        if dry_run:
            self.stdout.write(self.style.SUCCESS("[OK] Dry run complete. No files or database records were modified."))
            return

        if not force:
            self.stdout.write(self.style.ERROR(
                "WARNING: You are about to permanently delete these physical attendance photo files.\n"
                "All attendance records, timestamps, and locations in the database will be preserved.\n"
            ))
            confirm = input("Type 'yes' to proceed with deletion: ").strip().lower()
            if confirm != 'yes':
                self.stdout.write(self.style.NOTICE("Operation cancelled by user."))
                return

        result = cleanup_all_existing_old_photos(dry_run=False)
        freed = result['total_bytes_freed'] / (1024 * 1024)

        self.stdout.write(self.style.SUCCESS(
            f"\n[SUCCESS] One-time cleanup completed successfully:\n"
            f"  - Check-In photos deleted:  {result['check_in_files_deleted']}\n"
            f"  - Check-Out photos deleted: {result['check_out_files_deleted']}\n"
            f"  - Total files deleted:      {result['total_physical_deleted']}\n"
            f"  - Disk space freed:         {freed:.2f} MB\n"
            f"  - DB records cleared:       {result['db_records_cleared']}\n"
            f"  - All attendance records, shifts, and timestamps remain 100% intact."
        ))

