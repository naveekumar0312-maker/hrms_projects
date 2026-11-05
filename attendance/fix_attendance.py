import os
import django
from datetime import datetime, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from attendance.models import Attendance
from django.utils import timezone

qs = Attendance.objects.all()
print(f"Total records: {qs.count()}")
updated = 0

for a in qs:
    if not a.check_in: 
        continue
    
    policy = a.employee.branch.attendance_policy if (a.employee.branch and hasattr(a.employee.branch, 'attendance_policy')) else None
    
    if a.employee.shift:
        shift_start = a.employee.shift.start_time
    elif policy:
        shift_start = policy.start_time
    else:
        shift_start = timezone.now().time() # fallback if nothing exists

    start_dt = timezone.make_aware(datetime.combine(a.date, shift_start))
    
    late_mins = 0
    if a.check_in > start_dt: 
        late_mins = int((a.check_in - start_dt).total_seconds() // 60)
        
    a.late_minutes = late_mins
    if late_mins > 0: 
        a.status = 'LATE'
    else:
        # Don't revert to ON_TIME if they are already COMPLETED, unless we want to accurately just set the check-in status...
        # Wait, if late_minutes == 0, it means they were on time. If status is LATE, we should change it.
        if a.status == 'LATE':
            if a.check_out:
                a.status = 'COMPLETED'
            else:
                a.status = 'WORKING' # or ON_TIME

    if a.check_out:
        if a.employee.shift:
            shift_end = a.employee.shift.end_time
        elif policy:
            shift_end = policy.end_time
        else:
            shift_end = timezone.now().time() # fallback if nothing exists
        end_date = a.date
        if shift_end < shift_start: 
            end_date = a.date + timedelta(days=1)
        end_dt = timezone.make_aware(datetime.combine(end_date, shift_end))
        
        early = 0
        overtime = 0
        if a.check_out < end_dt: 
            early = int((end_dt - a.check_out).total_seconds() // 60)
        elif a.check_out > end_dt: 
            overtime = int((a.check_out - end_dt).total_seconds() // 60)
            
        a.early_minutes = early
        a.overtime_minutes = overtime
        a.working_minutes = int((a.check_out - a.check_in).total_seconds() // 60)
        
    a.save()
    updated += 1
    print(f"Updated {a.employee.full_name} date {a.date}: late={a.late_minutes} early={a.early_minutes} overtime={a.overtime_minutes} working={a.working_minutes}")

print(f"Updated {updated} records")
