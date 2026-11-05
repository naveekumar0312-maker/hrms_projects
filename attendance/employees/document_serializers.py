from rest_framework import serializers
from .models import EmployeeDocument


class EmployeeDocumentSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True)
    employee_id = serializers.CharField(
        source='employee.employee_id', read_only=True
    )

    class Meta:
        model = EmployeeDocument
        fields = [
            'id', 'employee', 'employee_id', 'document_type',
            'title', 'file', 'notes', 'uploaded_by', 'uploaded_at',
        ]
        read_only_fields = ['id', 'uploaded_by', 'uploaded_at']

    def validate_file(self, file):
        if file.size > 10 * 1024 * 1024:
            raise serializers.ValidationError(
                'Maximum document size is 10 MB.'
            )
        allowed = {'pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'}
        extension = file.name.rsplit('.', 1)[-1].lower() if '.' in file.name else ''
        if extension not in allowed:
            raise serializers.ValidationError(
                'Allowed file types: PDF, JPG, JPEG, PNG, DOC, DOCX.'
            )
        return file
