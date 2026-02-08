from django.conf import settings
from rest_framework.exceptions import NotAuthenticated
from rest_framework.permissions import BasePermission

from apps.patients.services.access_token import verify_patient_portal_token


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


class IsAuthenticatedPatientPortal(BasePermission):
    message = "Patient authentication required."

    @staticmethod
    def _extract_token(request) -> str:
        direct = (request.headers.get("X-Patient-Token") or "").strip()
        if direct:
            return direct

        auth_header = (request.headers.get("Authorization") or "").strip()
        if auth_header.lower().startswith("patient "):
            return auth_header[8:].strip()
        return ""

    def has_permission(self, request, view):
        token = self._extract_token(request)
        if not token:
            raise NotAuthenticated("Patient portal token is required.")

        payload = verify_patient_portal_token(token)
        if not payload:
            raise NotAuthenticated("Patient portal token is invalid or expired.")

        request.patient_portal_auth = payload
        return True
