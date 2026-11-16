import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('93.127.195.80', username='root', password='Aspireholidays@123', timeout=15)

commands = [
    '/var/www/attendance/venv/bin/python /var/www/hrms_Yaazh360/manage.py shell -c "from accounts.models import User; from accounts.serializers import UserSerializer; u = User.objects.get(username=\'hr@yaal\'); print(\'hr@yaal user:\', UserSerializer(u).data)"',
    '/var/www/attendance/venv/bin/python /var/www/hrms_Yaazh360/manage.py shell -c "from accounts.models import User; u = User.objects.get(username=\'hr@yaal\'); from employees.models import Employee; from employees.serializers import EmployeeSerializer; e = Employee.objects.filter(user=u).first(); print(\'hr@yaal employee:\', EmployeeSerializer(e).data.get(\'company_logo\') if e else \'No Employee\')"',
]

for cmd in commands:
    print(f"=== {cmd} ===")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err:
        print("ERR:", err)

ssh.close()
