import paramiko
import tarfile
import os

HOST = '93.127.195.80'
USER = 'root'
PASS = 'Aspireholidays@123'

dist_dir = r'C:\Users\ACER\Desktop\Attendance_server\attendance\web\dist'
tar_path = r'C:\Users\ACER\Desktop\Attendance_server\attendance\web\dist.tar.gz'

print("Creating tar archive...")
with tarfile.open(tar_path, "w:gz") as tar:
    tar.add(dist_dir, arcname='dist')

print("Connecting SSH...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)

print("Uploading tar via SFTP...")
sftp = ssh.open_sftp()
sftp.put(tar_path, '/tmp/dist.tar.gz')
sftp.close()

print("Extracting and updating web on server...")
cmd = """
rm -rf /var/www/hrms_Yaazh360/web/dist_old
if [ -d /var/www/hrms_Yaazh360/web/dist ]; then
  mv /var/www/hrms_Yaazh360/web/dist /var/www/hrms_Yaazh360/web/dist_old
fi
tar -xzf /tmp/dist.tar.gz -C /var/www/hrms_Yaazh360/web/
systemctl restart hrms-yaazh360.service
systemctl status hrms-yaazh360.service --no-pager
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print("STDOUT:\n", stdout.read().decode())
print("STDERR:\n", stderr.read().decode())

ssh.close()
if os.path.exists(tar_path):
    os.remove(tar_path)
print("Deployment completed successfully!")
