import paramiko

HOST = '93.127.195.80'
USER = 'root'
PASS = 'Aspireholidays@123'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)

cmd = """
/var/www/hrms_Yaazh360/venv/bin/python3 -c "
import os, sys, django
sys.path.insert(0, '/var/www/hrms_Yaazh360')
os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings'
django.setup()
from employees.models import Employee
from accounts.models import User
for u in User.objects.filter(role__icontains='manager'):
    print(u.id, u.username, u.role, u.company_id, getattr(u, 'employee_profile', None))
"
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print("HTTP CODE:\n", stdout.read().decode())
print("STDERR:\n", stderr.read().decode())
ssh.close()
