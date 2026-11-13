import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('93.127.195.80', username='root', password='Aspireholidays@123', timeout=15)

test_script = """
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from employees.models import Employee
from accounts.models import User
from rest_framework.test import APIClient

managers = list(User.objects.filter(role__in=['REPORTING_MANAGER', 'ADMIN', 'SUPER_ADMIN']))
print("Managers count:", len(managers))
for m in managers:
    print("User:", m.username, "role:", m.role, "company_id:", m.company_id, "emp_profile:", getattr(m, 'employee_profile', None))
"""

sftp = ssh.open_sftp()
with sftp.file('/var/www/hrms_Yaazh360/test_managers.py', 'w') as f:
    f.write(test_script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('cd /var/www/hrms_Yaazh360 && /var/www/attendance/venv/bin/python test_managers.py')
print("OUTPUT:\n", stdout.read().decode())
print("ERROR:\n", stderr.read().decode())

ssh.close()
