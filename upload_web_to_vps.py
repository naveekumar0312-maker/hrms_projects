import paramiko
import os

HOST = "93.127.195.80"
PORT = 22
USER = "root"
PASS = "Aspireholidays@123"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASS)

# 1. Pull latest git on backend
print("Pulling latest code on VPS...")
stdin, stdout, stderr = client.exec_command("cd /var/www/hrms_Yaazh360 && git pull origin main")
print(stdout.read().decode())
print(stderr.read().decode())

# 2. Upload dist files
sftp = client.open_sftp()
local_dist = r"c:\Users\ACER\Desktop\Attendance_server\attendance\web\dist"
remote_dist = "/var/www/hrms_Yaazh360/web/dist"

def upload_dir(local_dir, remote_dir):
    try:
        sftp.mkdir(remote_dir)
    except Exception:
        pass
    for item in os.listdir(local_dir):
        lpath = os.path.join(local_dir, item)
        rpath = remote_dir + "/" + item
        if os.path.isdir(lpath):
            upload_dir(lpath, rpath)
        else:
            sftp.put(lpath, rpath)

print("Uploading built web dist to VPS...")
upload_dir(local_dist, remote_dist)
sftp.close()

# 3. Restart gunicorn
print("Restarting hrms service on VPS...")
stdin, stdout, stderr = client.exec_command("systemctl restart hrms-yaazh360.service && systemctl status hrms-yaazh360.service --no-pager | head -n 15")
print(stdout.read().decode())
print(stderr.read().decode())

client.close()
print("Deployment to VPS completed successfully!")
