from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager

class CustomUserManager(BaseUserManager):
    def create_user(self, phone_number=None, username=None, password=None, **extra_fields):
        if not phone_number and not username:
            raise ValueError('Either Phone Number or Username must be set')
        user = self.model(phone_number=phone_number, username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'ADMIN')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(phone_number=None, username=username, password=password, **extra_fields)

class User(AbstractUser):
    ROLE_CHOICES = (
        ('SUPER_ADMIN', 'Super Admin'),
        ('HR', 'HR'),
        ('ADMIN', 'Legacy Admin'),
        ('REPORTING_MANAGER', 'Reporting Manager'),
        ('TEAM_LEADER', 'Team Leader'),
        ('EMPLOYEE', 'Employee'),
    )
    
    username = models.CharField(max_length=150, unique=True, null=True, blank=True)
    phone_number = models.CharField(max_length=15, unique=True, null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='EMPLOYEE')
    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users',
    )
    
    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = []

    objects = CustomUserManager()

    def __str__(self):
        return self.username or self.phone_number or str(self.id)
