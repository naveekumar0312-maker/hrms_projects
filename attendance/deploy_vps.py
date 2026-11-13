import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('93.127.195.80', username='root', password='Aspireholidays@123', timeout=15)

commands = [
    'cd /var/www/hrms_Yaazh360 && git pull origin main',
    'cd /var/www/hrms_Yaazh360 && /var/www/attendance/venv/bin/python manage.py migrate',
    'cd /var/www/attendance && git pull origin main',
    'cd /var/www/attendance && /var/www/attendance/venv/bin/python manage.py migrate',
    'cd /var/www/hrms_Yaazh360/web && git pull origin main && npm run build',
    'systemctl restart hrms-yaazh360 attendance',
    'systemctl status hrms-yaazh360 --no-pager',
    'systemctl status attendance --no-pager'
]

for cmd in commands:
    print(f"\n=== Executing: {cmd} ===")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out:
        print(out)
    if err:
        print("ERR:", err)

ssh.close()
print("\n--- ALL COMPLETED ---")
