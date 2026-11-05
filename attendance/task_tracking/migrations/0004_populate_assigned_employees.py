from django.db import migrations

def populate_assigned_employees(apps, schema_editor):
    Task = apps.get_model('task_tracking', 'Task')
    for task in Task.objects.all():
        if task.assigned_to_id:
            task.assigned_employees.add(task.assigned_to_id)

def reverse_populate(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('task_tracking', '0003_add_assigned_employees'),
    ]

    operations = [
        migrations.RunPython(populate_assigned_employees, reverse_populate),
    ]
