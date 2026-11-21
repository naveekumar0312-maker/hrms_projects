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
from companies.models import Company
from employees.models import Employee
for c in Company.objects.all():
    print('Company:', c.id, c.name, getattr(c, 'logo', None))
    if c.logo:
        try:
            print('  Logo file path:', c.logo.path, 'Exists:', os.path.exists(c.logo.path))
        except Exception as ex:
            print('  Error getting path:', ex)
for e in Employee.objects.all()[:3]:
    branch = e.branch
    company = branch.company if branch else None
    print('Emp:', e.id, e.employee_id, e.full_name, 'Branch:', branch, 'Company:', company.name if company else None)
"
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print("HTTP CODE:\n", stdout.read().decode())
print("STDERR:\n", stderr.read().decode())
ssh.close()
