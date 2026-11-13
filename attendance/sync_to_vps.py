import os
import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('93.127.195.80', username='root', password='Aspireholidays@123', timeout=15)
sftp = ssh.open_sftp()

local_base = r"C:\Users\ACER\Desktop\Attendance_server\attendance"
remote_base = "/var/www/hrms_Yaazh360"

# 1. Update specific backend files
backend_files = [
    (r"attendance\urls.py", "/var/www/hrms_Yaazh360/attendance/urls.py"),
    (r"attendance\views.py", "/var/www/hrms_Yaazh360/attendance/views.py"),
    (r"employees\manager_views.py", "/var/www/hrms_Yaazh360/employees/manager_views.py"),
    (r"employees\manager_urls.py", "/var/www/hrms_Yaazh360/employees/manager_urls.py"),
    (r"attendance\migrations\0021_alter_employeepersonalalarm_options_and_more.py", 
     "/var/www/hrms_Yaazh360/attendance/migrations/0021_alter_employeepersonalalarm_options_and_more.py"),
]

for l_rel, r_path in backend_files:
    l_path = os.path.join(local_base, l_rel)
    print(f"Uploading {l_rel} -> {r_path}")
    sftp.put(l_path, r_path)

# 2. Upload dist folder to /var/www/hrms_Yaazh360/web/dist
local_dist = os.path.join(local_base, "web", "dist")

def upload_dir(local_dir, remote_dir):
    try:
        sftp.mkdir(remote_dir)
    except Exception:
        pass
    for item in os.listdir(local_dir):
        l_item = os.path.join(local_dir, item)
        r_item = f"{remote_dir}/{item}"
        if os.path.isdir(l_item):
            upload_dir(l_item, r_item)
        else:
            print(f"Uploading dist file: {item}")
            sftp.put(l_item, r_item)

print("\nUploading built web assets to /var/www/hrms_Yaazh360/web/dist...")
upload_dir(local_dist, "/var/www/hrms_Yaazh360/web/dist")

sftp.close()

# 3. Run migration and restart service
commands = [
    'cd /var/www/hrms_Yaazh360 && /var/www/attendance/venv/bin/python manage.py migrate',
    'systemctl restart hrms-yaazh360',
    'systemctl status hrms-yaazh360 --no-pager'
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
print("\n--- DEPLOYED TO PRODUCTION SUCCESSFULLY ---")
