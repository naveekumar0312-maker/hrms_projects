import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('93.127.195.80', username='root', password='Aspireholidays@123', timeout=15)

commands = [
    'find /var/www -maxdepth 3 -name ".git"',
    'find /root -maxdepth 3 -name ".git" 2>/dev/null',
    'grep -rn "hrms-yaazh360" /etc/nginx/ 2>/dev/null',
    'cat /etc/nginx/sites-enabled/* 2>/dev/null | grep -E "server_name|proxy_pass|root"'
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
