from django.contrib.auth.models import AbstractUser
from django.db import models


class UserRole(models.TextChoices):
    ADMIN = "admin", "Admin"
    COORDINATOR = "coordinator", "Coordinator"
    PATIENT = "patient", "Patient"


class User(AbstractUser):
    role = models.CharField(max_length=32, choices=UserRole.choices, default=UserRole.COORDINATOR)
    phone_number = models.CharField(max_length=32, blank=True)
    preferred_language = models.CharField(max_length=16, default="en")
    organization = models.ForeignKey(
        "core.Organization", null=True, blank=True, on_delete=models.SET_NULL, related_name="users"
    )

    def __str__(self) -> str:
        return f"{self.username} ({self.role})"
