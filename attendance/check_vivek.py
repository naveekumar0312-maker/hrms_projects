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

u = User.objects.get(username='Vivek_manager')
e7 = Employee.objects.get(id=7)
print("TL Employee branch:", e7.branch, "company:", e7.branch.company_id if e7.branch else None)
print("RM emp branch:", u.employee_profile.branch, "company:", u.employee_profile.branch.company_id if u.employee_profile.branch else None)
print("RM user company:", u.company_id)

client = APIClient()
client.force_authenticate(user=u)
res = client.post(f'/api/employees/manager/team-leaders/7/assign-team/', {'employee_ids': [1, 2], 'action': 'assign'}, format='json', HTTP_HOST='hrms.yaazh360digitech.in')
print("Assign test response status:", res.status_code, getattr(res, 'data', None) or getattr(res, 'content', None))
"""

sftp = ssh.open_sftp()
with sftp.file('/var/www/hrms_Yaazh360/test_vivek.py', 'w') as f:
    f.write(test_script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('cd /var/www/hrms_Yaazh360 && /var/www/attendance/venv/bin/python test_vivek.py')
print("OUTPUT:\n", stdout.read().decode())
print("ERROR:\n", stderr.read().decode())

ssh.close()
