import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('93.127.195.80', username='root', password='Aspireholidays@123', timeout=15)

commands = [
    '/var/www/attendance/venv/bin/python /var/www/hrms_Yaazh360/manage.py shell -c "from accounts.models import User; u = User.objects.get(username=\'hr@yaal\'); print(\'password:\', u.password[:20], \'is_active:\', u.is_active)"',
]

for cmd in commands:
    print(f"=== {cmd} ===")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err:
        print("ERR:", err)

ssh.close()
