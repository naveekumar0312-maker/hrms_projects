from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import BasePermission

from .models import Company
from .serializers import CompanySerializer
from branches.models import Branch
from branches.serializers import BranchSerializer


class CompanyAccessPermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        # Keep legacy ADMIN access during the transition.
        if user.role in ("SUPER_ADMIN", "ADMIN"):
            return True

        # HR can only read company information.
        if user.role == "HR" and user.company_id:
            return request.method in ("GET", "HEAD", "OPTIONS")

        return False


class CompanyViewSet(viewsets.ModelViewSet):
    serializer_class = CompanySerializer
    permission_classes = [CompanyAccessPermission]

    def get_queryset(self):
        user = self.request.user
        queryset = Company.objects.all()

        if user.role == "HR":
            return queryset.filter(pk=user.company_id)

        if user.role in ("SUPER_ADMIN", "ADMIN"):
            return queryset

        return queryset.none()

    @action(detail=True, methods=["get"])
    def branches(self, request, pk=None):
        company = self.get_object()
        branches = Branch.objects.filter(company=company).order_by("id")
        serializer = BranchSerializer(branches, many=True)
        return Response(serializer.data)


from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status as http_status
from django.shortcuts import get_object_or_404
from .serializers import PublicCompanyBrandingSerializer, CompanyBrandingUpdateSerializer


@api_view(["GET"])
@permission_classes([AllowAny])
def public_company_branding(request, slug):
    company = get_object_or_404(Company, slug=slug, status=True)
    serializer = PublicCompanyBrandingSerializer(
        company,
        context={"request": request},
    )
    return Response(serializer.data)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def update_company_branding(request, pk):
    if getattr(request.user, "role", None) != "SUPER_ADMIN":
        return Response(
            {"detail": "Only Super Admin can manage company branding."},
            status=http_status.HTTP_403_FORBIDDEN,
        )

    company = get_object_or_404(Company, pk=pk)

    if request.method == "GET":
        serializer = PublicCompanyBrandingSerializer(
            company, context={"request": request}
        )
        return Response(serializer.data)

    if request.method == "DELETE":
        company.logo = None
        company.login_background = None
        company.tagline = ""
        company.primary_color = "#E56717"
        company.left_panel_heading = ""
        company.left_panel_content = ""
        company.footer_message = ""
        company.left_panel_color = "#315C55"
        company.login_button_color = "#2563EB"
        company.branding_configured = False
        company.save()
        return Response({"detail": "Branding configuration removed."})

    serializer = CompanyBrandingUpdateSerializer(
        company,
        data=request.data,
        partial=True,
        context={"request": request},
    )
    serializer.is_valid(raise_exception=True)
    serializer.save(branding_configured=True)

    return Response(
        PublicCompanyBrandingSerializer(
            company, context={"request": request}
        ).data
    )
