import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('93.127.195.80', username='root', password='Aspireholidays@123', timeout=15)

stdin, stdout, stderr = ssh.exec_command('sed -n "1,35p" /var/www/hrms_Yaazh360/accounts/serializers.py')
print(stdout.read().decode())

ssh.close()
