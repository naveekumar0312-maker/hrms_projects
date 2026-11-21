import paramiko

HOST = '93.127.195.80'
USER = 'root'
PASS = 'Aspireholidays@123'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)

cmd = """
source /var/www/hrms_Yaazh360/venv/bin/activate
cd /var/www/hrms_Yaazh360
python3 -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
try:
    import dotenv
except ImportError:
    import sys
    from types import ModuleType
    m = ModuleType('dotenv')
    m.load_dotenv = lambda *args, **kwargs: None
    sys.modules['dotenv'] = m

django.setup()
from employees.models import Employee
print('Branches for all employees:')
for e in Employee.objects.all():
    print(e.employee_id, e.full_name, 'Branch:', e.branch.branch_name if e.branch else None, 'lat/lon:', (e.branch.latitude, e.branch.longitude) if e.branch else None)
"
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print("STDOUT:\n", stdout.read().decode())
print("STDERR:\n", stderr.read().decode())
ssh.close()
