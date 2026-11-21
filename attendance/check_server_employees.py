import paramiko

HOST = '93.127.195.80'
USER = 'root'
PASS = 'Aspireholidays@123'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)

cmd = """
echo "Test file" > /var/www/hrms_Yaazh360/media/test_media.txt
curl -s -o /dev/null -w "%{http_code}" https://hrms.yaazh360digitech.in/media/test_media.txt
rm /var/www/hrms_Yaazh360/media/test_media.txt
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print("HTTP CODE:\n", stdout.read().decode())
print("STDERR:\n", stderr.read().decode())
ssh.close()
