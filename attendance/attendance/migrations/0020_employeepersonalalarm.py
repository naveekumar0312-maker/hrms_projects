# Generated manually for EmployeePersonalAlarm

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0019_holiday_company_alter_holiday_date_and_more'),
        ('employees', '0011_employee_team_leader'),
    ]

    operations = [
        migrations.CreateModel(
            name='EmployeePersonalAlarm',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('alarm_time', models.TimeField()),
                ('is_enabled', models.BooleanField(default=False)),
                ('timezone', models.CharField(default='Asia/Kolkata', max_length=50)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('employee', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='personal_alarm', to='employees.employee')),
            ],
        ),
    ]

