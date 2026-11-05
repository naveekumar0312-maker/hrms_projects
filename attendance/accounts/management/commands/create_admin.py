import os
from django.core.management.base import BaseCommand
from accounts.models import User

class Command(BaseCommand):
    help = 'Creates an initial admin user if none exists'

    def handle(self, *args, **options):
        username = os.environ.get('INITIAL_ADMIN_USERNAME', 'admin')
        password = os.environ.get('INITIAL_ADMIN_PASSWORD', 'admin@123')

        if User.objects.filter(role='SUPER_ADMIN').exists():
            self.stdout.write(self.style.SUCCESS('Super Admin account already exists. Skipping creation.'))
            return

        try:
            user = User.objects.create_superuser(
                username=username,
                password=password
            )
            user.role = 'SUPER_ADMIN'
            user.save(update_fields=['role'])
            self.stdout.write(self.style.SUCCESS('Super Admin account created successfully.'))
            self.stdout.write(self.style.SUCCESS(f'Username: {username}'))
            self.stdout.write(self.style.SUCCESS('Role: SUPER_ADMIN'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Failed to create admin: {str(e)}'))
