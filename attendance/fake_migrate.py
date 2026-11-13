import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('93.127.195.80', username='root', password='Aspireholidays@123', timeout=15)

# 1. Fake the migration 0021 since columns like late_reason already exist in VPS DB
commands = [
    'cd /var/www/hrms_Yaazh360 && /var/www/attendance/venv/bin/python manage.py migrate attendance 0021 --fake',
    'systemctl restart hrms-yaazh360',
    'systemctl status hrms-yaazh360 --no-pager'
]

for cmd in commands:
    print(f"\n=== Executing: {cmd} ===")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("OUT:", stdout.read().decode())
    print("ERR:", stderr.read().decode())

ssh.close()
