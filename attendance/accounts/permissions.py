from rest_framework.permissions import BasePermission


def is_super_admin(user):
    return bool(
        user
        and user.is_authenticated
        and user.role == "SUPER_ADMIN"
    )


def is_legacy_admin(user):
    return bool(
        user
        and user.is_authenticated
        and user.role == "ADMIN"
    )


def is_company_hr(user):
    return bool(
        user
        and user.is_authenticated
        and user.role == "HR"
        and user.company_id is not None
    )


def can_manage_all_companies(user):
    return is_super_admin(user) or is_legacy_admin(user)


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_super_admin(request.user)


class IsSuperAdminOrLegacyAdmin(BasePermission):
    def has_permission(self, request, view):
        return can_manage_all_companies(request.user)


class IsCompanyHR(BasePermission):
    def has_permission(self, request, view):
        return is_company_hr(request.user)


class IsSuperAdminOrCompanyHR(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return (
            is_super_admin(user)
            or is_legacy_admin(user)
            or is_company_hr(user)
        )
