from django.contrib import admin

from .models import PatientProfile


@admin.register(PatientProfile)
class PatientProfileAdmin(admin.ModelAdmin):
    list_display = (
        "patient_code",
        "full_name",
        "diagnosis",
        "city",
        "country",
        "contact_channel",
        "profile_completeness",
    )
    search_fields = ("patient_code", "full_name", "diagnosis", "city")
