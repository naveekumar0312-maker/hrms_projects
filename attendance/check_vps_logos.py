import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('93.127.195.80', username='root', password='Aspireholidays@123', timeout=15)

commands = [
    '/var/www/attendance/venv/bin/python /var/www/hrms_Yaazh360/manage.py shell -c "from companies.models import Company; print([(c.id, c.name, c.logo.name if c.logo else None) for c in Company.objects.all()])"',
    '/var/www/attendance/venv/bin/python /var/www/hrms_Yaazh360/manage.py shell -c "from accounts.models import User; print([(u.username, u.role, u.company_id, u.company.logo.name if u.company and u.company.logo else None) for u in User.objects.filter(role=\'HR\')])"',
    'ls -la /var/www/hrms_Yaazh360/media/company_logos/'
]

for cmd in commands:
    print(f"=== {cmd} ===")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err:
        print("ERR:", err)

ssh.close()
