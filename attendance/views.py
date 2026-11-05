from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Employee
from .serializers import EmployeeSerializer

class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'ADMIN')

from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAdminUser]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        queryset = super().get_queryset()
        company_id = self.request.query_params.get('company')
        branch_id = self.request.query_params.get('branch')
        if company_id is not None:
            queryset = queryset.filter(branch__company_id=company_id)
        if branch_id is not None:
            queryset = queryset.filter(branch_id=branch_id)
        return queryset

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.attendances.exists():
            return Response(
                {
                    "code": "EMPLOYEE_HAS_ATTENDANCE",
                    "message": "Employee cannot be permanently deleted because attendance records exist."
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        instance.delete()

    @action(detail=False, methods=['get', 'patch'], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        try:
            employee = request.user.employee_profile
        except AttributeError:
            return Response({"detail": "User is not an employee."}, status=status.HTTP_400_BAD_REQUEST)
            
        if request.method == 'GET':
            serializer = self.get_serializer(employee)
            return Response(serializer.data)
            
        elif request.method == 'PATCH':
            allowed_fields = ['full_name', 'profile_photo']
            data = {k: v for k, v in request.data.items() if k in allowed_fields}
            serializer = self.get_serializer(employee, data=data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='change-password', permission_classes=[permissions.IsAuthenticated])
    def change_password(self, request):
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        
        user = request.user
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')

        if not current_password:
            return Response({"current_password": ["Current password is required."]}, status=status.HTTP_400_BAD_REQUEST)
        if not new_password:
            return Response({"new_password": ["New password is required."]}, status=status.HTTP_400_BAD_REQUEST)
        if not confirm_password:
            return Response({"confirm_password": ["Confirm password is required."]}, status=status.HTTP_400_BAD_REQUEST)

        if not user.check_password(current_password):
            return Response({"current_password": ["Current password is incorrect."]}, status=status.HTTP_400_BAD_REQUEST)

        if new_password != confirm_password:
            return Response({"confirm_password": ["New passwords do not match."]}, status=status.HTTP_400_BAD_REQUEST)

        if current_password == new_password:
            return Response({"new_password": ["New password must be different from current password."]}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(new_password, user)
        except DjangoValidationError as e:
            return Response({"new_password": list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        return Response({"message": "Password changed successfully."}, status=status.HTTP_200_OK)
