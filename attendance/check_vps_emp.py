import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('93.127.195.80', username='root', password='Aspireholidays@123', timeout=15)

# Check Employee 7 on VPS
check_script = """
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from employees.models import Employee
e = Employee.objects.filter(id=7).first()
if e:
    print('Found Employee:', e.id, e.employee_id, e.full_name, 'designation:', e.designation, 'user:', e.user, 'user_role:', getattr(e.user, 'role', None))
else:
    print('Employee 7 not found!')
"""

sftp = ssh.open_sftp()
with sftp.file('/var/www/hrms_Yaazh360/test_emp7.py', 'w') as f:
    f.write(check_script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('cd /var/www/hrms_Yaazh360 && /var/www/attendance/venv/bin/python test_emp7.py')
print("OUTPUT:", stdout.read().decode())
print("ERROR:", stderr.read().decode())

ssh.close()
