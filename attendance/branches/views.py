from rest_framework import viewsets, permissions
from .models import Branch
from .serializers import BranchSerializer


class BranchAccessPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.role in ("SUPER_ADMIN", "ADMIN"):
            return True

        if user.role == "HR" and user.company_id:
            return True

        if user.role in ("REPORTING_MANAGER", "TEAM_LEADER"):
            return request.method in ("GET", "HEAD", "OPTIONS")

        return False


class BranchViewSet(viewsets.ModelViewSet):
    queryset = Branch.objects.select_related("company").all()
    serializer_class = BranchSerializer
    permission_classes = [BranchAccessPermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        if user.role == "HR":
            queryset = queryset.filter(company_id=user.company_id)
        elif user.role in ("REPORTING_MANAGER", "TEAM_LEADER"):
            emp = getattr(user, 'employee_profile', None)
            comp_id = user.company_id or (emp.branch.company_id if emp and emp.branch else None)
            if comp_id:
                queryset = queryset.filter(company_id=comp_id)
            else:
                queryset = queryset.filter(status=True)
        elif user.role not in ("SUPER_ADMIN", "ADMIN"):
            return queryset.none()

        company_id = self.request.query_params.get("company")
        if company_id is not None:
            queryset = queryset.filter(company_id=company_id)

        return queryset

    def perform_create(self, serializer):
        user = self.request.user

        if user.role == "HR":
            serializer.save(company_id=user.company_id)
        else:
            serializer.save()

    def perform_destroy(self, instance):
        # Preserve existing soft-delete behavior.
        instance.status = False
        instance.save(update_fields=["status"])
