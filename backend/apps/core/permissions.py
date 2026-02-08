from rest_framework.permissions import BasePermission
from django.conf import settings


class IsCoordinatorOrAdmin(BasePermission):
    def has_permission(self, request, view):
        if settings.ALLOW_ANONYMOUS_COORDINATOR:
            return True
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in {"coordinator", "admin"}
        )


class IsPatientOrCoordinator(BasePermission):
    def has_permission(self, request, view):
        if settings.ALLOW_ANONYMOUS_COORDINATOR:
            return True
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in {"patient", "coordinator", "admin"}
        )
