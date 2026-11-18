# Generated manually for personal & family details

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('employees', '0011_employee_team_leader'),
    ]

    operations = [
        migrations.AddField(
            model_name='employee',
            name='marital_status',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='employee',
            name='blood_group',
            field=models.CharField(blank=True, default='', max_length=10),
        ),
        migrations.AddField(
            model_name='employee',
            name='father_name',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='employee',
            name='mother_name',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='employee',
            name='spouse_name',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
    ]
