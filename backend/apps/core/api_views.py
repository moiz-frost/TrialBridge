from __future__ import annotations

import re

from django.conf import settings
from django.db.models import Avg
from django.shortcuts import get_object_or_404
from rest_framework import generics, parsers, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.accounts.models import User, UserRole
from apps.core.models import Organization
from apps.core.permissions import IsAuthenticatedPatientPortal, IsCoordinatorOrAdmin
from apps.matching.models import MatchEvaluation, MatchOverallStatus, MatchingRun
from apps.matching.serializers import MatchEvaluationSerializer, MatchingRunSerializer
from apps.matching.services.engine import (
    MatchingRunAlreadyRunningError,
    evaluate_patient_against_trials,
    reconcile_stale_running_runs,
    run_full_matching_cycle,
)
from apps.outreach.models import OutreachMessage
from apps.outreach.serializers import OutreachMessageSerializer, SendOutreachSerializer
from apps.outreach.services.sender import send_outreach_message
from apps.patients.models import PatientDocument, PatientHistoryEntry, PatientProfile
from apps.patients.serializers import (
    PatientDocumentSerializer,
    PatientHistoryEntryCreateSerializer,
    PatientHistoryEntrySerializer,
    PatientIntakeSerializer,
    PatientProfileSerializer,
)
from apps.patients.services.profile import (
    compute_completeness,
    generate_patient_embedding,
    infer_structured_profile,
)
from apps.patients.services.access_token import issue_patient_portal_token
from apps.patients.services.document_extraction import extract_document_text, is_supported_text_document
from apps.trials.models import Trial
from apps.trials.serializers import TrialSerializer


def _visible_matches_queryset(queryset):
    min_eligibility = max(0, int(getattr(settings, "MATCH_MIN_ELIGIBILITY_SCORE", 35)))
    return queryset.exclude(overall_status=MatchOverallStatus.UNLIKELY).filter(eligibility_score__gte=min_eligibility)


def _build_combined_history_text(patient: PatientProfile) -> str:
    entries = patient.history_entries.order_by("created_at").values_list("entry_text", flat=True)
    cleaned = [text.strip() for text in entries if isinstance(text, str) and text.strip()]
    if cleaned:
        return "\n\n".join(cleaned)
    return (patient.story or "").strip()


def _ensure_ai_structured_profile(patient: PatientProfile) -> None:
    """
    Backfill structured profile + AI summary for legacy patients that were
    created before AI story normalization was introduced.
    """
    structured = patient.structured_profile if isinstance(patient.structured_profile, dict) else {}
    has_ai_summary = isinstance(structured.get("ai_summary"), str) and bool(str(structured.get("ai_summary")).strip())
    if has_ai_summary:
        return

    combined_story = _build_combined_history_text(patient)
    if not combined_story:
        return

    inferred = infer_structured_profile(combined_story)
    embedding = generate_patient_embedding(
        {
            "name": patient.full_name,
            "age": patient.age,
            "sex": patient.sex,
            "city": patient.city,
            "country": patient.country,
            "story": combined_story,
        },
        inferred,
    )

    patient.story = combined_story
    patient.structured_profile = inferred
    patient.embedding_vector = embedding
    if inferred.get("diagnosis"):
        patient.diagnosis = str(inferred.get("diagnosis", ""))
    if inferred.get("stage"):
        patient.stage = str(inferred.get("stage", ""))
    patient.save(
        update_fields=[
            "story",
            "structured_profile",
            "embedding_vector",
            "diagnosis",
            "stage",
            "updated_at",
        ]
    )


def _ensure_initial_history_entry(patient: PatientProfile) -> None:
    """
    Backfill initial intake history for legacy rows where story exists
    but no history entries were created.
    """
    if patient.history_entries.exists():
        return
    story = (patient.story or "").strip()
    if not story:
        return
    PatientHistoryEntry.objects.create(
        patient=patient,
        source=PatientHistoryEntry.Source.INTAKE,
        entry_text=story,
    )


def _resolve_intake_organization(payload: dict) -> Organization:
    requested_slug = str(payload.get("organizationSlug", "") or "").strip()
    if requested_slug:
        selected = Organization.objects.filter(slug=requested_slug).first()
        if selected:
            return selected

    default_slug = str(getattr(settings, "INTAKE_DEFAULT_ORGANIZATION_SLUG", "") or "").strip()
    if default_slug:
        selected = Organization.objects.filter(slug=default_slug).first()
        if selected:
            return selected

    country = str(payload.get("country", "") or "").strip()
    if country:
        selected = (
            Organization.objects.filter(country__iexact=country, users__role=UserRole.COORDINATOR)
            .distinct()
            .order_by("created_at")
            .first()
        )
        if selected:
            return selected

        selected = Organization.objects.filter(country__iexact=country).order_by("created_at").first()
        if selected:
            return selected

    selected = (
        Organization.objects.filter(users__role=UserRole.COORDINATOR)
        .distinct()
        .order_by("created_at")
        .first()
    )
    if selected:
        return selected

    selected = Organization.objects.order_by("created_at").first()
    if selected:
        return selected

    return Organization.objects.create(
        name="Default Hospital Organization",
        slug="default-hospital",
        country=country or "",
        score_weights={"eligibility": 0.45, "feasibility": 0.30, "urgency": 0.20, "explainability": 0.05},
    )


def _assert_patient_portal_scope(request, patient_id: int) -> None:
    portal_auth = getattr(request, "patient_portal_auth", None)
    payload = portal_auth if isinstance(portal_auth, dict) else {}
    token_patient_id = payload.get("patient_id")
    if int(token_patient_id or -1) != int(patient_id):
        raise PermissionDenied("You are not allowed to access this patient profile.")


class HealthCheckView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({"status": "ok"})


class TrialBridgeTokenView(TokenObtainPairView):
    serializer_class = TokenObtainPairSerializer


class MeView(APIView):
    def get(self, request):
        user: User = request.user
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "organization": user.organization.name if user.organization else None,
            }
        )


class CoordinatorDashboardView(APIView):
    permission_classes = [IsCoordinatorOrAdmin]

    def get(self, request):
        reconcile_stale_running_runs()
        org = getattr(request.user, "organization", None)
        if not org:
            return Response({"detail": "User has no organization"}, status=400)
        qs = MatchEvaluation.objects.filter(organization=org) if org else MatchEvaluation.objects.all()
        qs = _visible_matches_queryset(qs)

        pending = qs.filter(outreach_status__in=["pending", "draft"]).count()
        avg_elig = qs.aggregate(v=Avg("eligibility_score"))["v"] or 0
        run_queryset = MatchingRun.objects.order_by("-started_at")
        latest_run = run_queryset.first()
        running_run = run_queryset.filter(status="running").first()
        completed_run = run_queryset.filter(status="completed", finished_at__isnull=False).order_by("-finished_at").first()
        latest_match_evaluated = qs.order_by("-last_evaluated").values_list("last_evaluated", flat=True).first()

        data = {
            "newMatches": qs.filter(is_new=True).count(),
            "highUrgency": qs.filter(urgency_flag="high").count(),
            "awaitingInfo": qs.exclude(missing_info=[]).count(),
            "outreachPending": pending,
            "totalPatients": PatientProfile.objects.filter(organization=org).count() if org else PatientProfile.objects.count(),
            "totalTrials": Trial.objects.count(),
            "avgEligibility": round(avg_elig),
            "matching": {
                "is_running": bool(running_run),
                "running_run_id": running_run.id if running_run else None,
                "running_started_at": running_run.started_at if running_run else None,
                "latest_run_status": latest_run.status if latest_run else None,
                "latest_run_started_at": latest_run.started_at if latest_run else None,
                "last_completed_at": (completed_run.finished_at if completed_run else latest_match_evaluated),
            },
        }
        return Response(data)


class CoordinatorMatchesView(generics.ListAPIView):
    permission_classes = [IsCoordinatorOrAdmin]
    serializer_class = MatchEvaluationSerializer

    def get_queryset(self):
        org = getattr(self.request.user, "organization", None)
        if not org:
            return MatchEvaluation.objects.none()
        queryset = MatchEvaluation.objects.select_related("patient", "trial").order_by("-last_evaluated")
        queryset = _visible_matches_queryset(queryset.filter(organization=org))

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(patient__full_name__icontains=search)
        return queryset


class CoordinatorMatchDetailView(generics.RetrieveAPIView):
    permission_classes = [IsCoordinatorOrAdmin]
    serializer_class = MatchEvaluationSerializer
    lookup_field = "id"

    def get_queryset(self):
        org = getattr(self.request.user, "organization", None)
        if not org:
            return MatchEvaluation.objects.none()
        queryset = MatchEvaluation.objects.select_related("patient", "trial")
        return _visible_matches_queryset(queryset.filter(organization=org))


class CoordinatorPatientsView(generics.ListAPIView):
    permission_classes = [IsCoordinatorOrAdmin]
    serializer_class = PatientProfileSerializer

    def get_queryset(self):
        org = getattr(self.request.user, "organization", None)
        if not org:
            return PatientProfile.objects.none()
        queryset = PatientProfile.objects.filter(organization=org).order_by("-created_at")
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(full_name__icontains=search)
        return queryset


class CoordinatorPatientDetailView(APIView):
    permission_classes = [IsCoordinatorOrAdmin]

    def get(self, request, id: int):
        org = getattr(request.user, "organization", None)
        if not org:
            return Response({"detail": "User has no organization"}, status=400)

        patient = get_object_or_404(PatientProfile, id=id, organization=org)
        _ensure_ai_structured_profile(patient)
        _ensure_initial_history_entry(patient)
        documents = patient.documents.order_by("-created_at")
        history_entries = patient.history_entries.order_by("-created_at")
        matches = (
            MatchEvaluation.objects.select_related("patient", "trial")
            .filter(organization=org, patient=patient)
            .exclude(overall_status=MatchOverallStatus.UNLIKELY)
            .filter(eligibility_score__gte=max(0, int(getattr(settings, "MATCH_MIN_ELIGIBILITY_SCORE", 35))))
            .order_by("-last_evaluated")
        )

        return Response(
            {
                "patient": PatientProfileSerializer(patient).data,
                "documents": PatientDocumentSerializer(documents, many=True).data,
                "history_entries": PatientHistoryEntrySerializer(history_entries, many=True).data,
                "matches": MatchEvaluationSerializer(matches, many=True).data,
            }
        )


class CoordinatorTrialsView(generics.ListAPIView):
    permission_classes = [IsCoordinatorOrAdmin]
    serializer_class = TrialSerializer

    def get_queryset(self):
        queryset = Trial.objects.prefetch_related("sites").order_by("-updated_at")
        status_filter = self.request.query_params.get("status")
        if status_filter and status_filter != "all":
            queryset = queryset.filter(status=status_filter)
        phase = self.request.query_params.get("phase")
        if phase and phase != "all":
            queryset = queryset.filter(phase=phase)
        return queryset


class CoordinatorOutreachListView(generics.ListAPIView):
    permission_classes = [IsCoordinatorOrAdmin]
    serializer_class = OutreachMessageSerializer

    def get_queryset(self):
        org = getattr(self.request.user, "organization", None)
        if not org:
            return OutreachMessage.objects.none()
        qs = OutreachMessage.objects.select_related("match", "match__patient", "match__trial").order_by("-created_at")
        return qs.filter(match__organization=org)


class CoordinatorOutreachSendView(APIView):
    permission_classes = [IsCoordinatorOrAdmin]

    def post(self, request):
        serializer = SendOutreachSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        match = get_object_or_404(MatchEvaluation, id=serializer.validated_data["match_id"])
        org = getattr(request.user, "organization", None)
        if not org or match.organization_id != org.id:
            return Response({"detail": "Match not found"}, status=404)
        message = send_outreach_message(
            match=match,
            channel=serializer.validated_data["channel"],
            body=serializer.validated_data["body"],
        )
        return Response(OutreachMessageSerializer(message).data, status=status.HTTP_201_CREATED)


class CoordinatorSettingsView(APIView):
    permission_classes = [IsCoordinatorOrAdmin]

    def get(self, request):
        org = getattr(request.user, "organization", None)
        if not org:
            return Response({"detail": "User has no organization"}, status=400)
        hf_configured = bool(settings.HF_LLM_ENDPOINT and settings.HF_API_TOKEN)
        gemini_configured = bool(settings.GEMINI_API_KEY)
        if settings.LLM_MODE == "gemini":
            llm_configured = gemini_configured
        elif settings.LLM_MODE == "hf":
            llm_configured = hf_configured
        elif settings.LLM_MODE == "fallback":
            llm_configured = True
        else:
            llm_configured = gemini_configured or hf_configured
        return Response(
            {
                "organization": org.name,
                "country": org.country,
                "score_weights": org.score_weights,
                "llm": {
                    "mode": settings.LLM_MODE,
                    "configured": llm_configured,
                    "providers": {"gemini": gemini_configured, "hf": hf_configured},
                },
                "outreach_delivery_mode": settings.OUTREACH_DELIVERY_MODE,
            }
        )

    def patch(self, request):
        org = getattr(request.user, "organization", None)
        if not org:
            return Response({"detail": "User has no organization"}, status=400)

        score_weights = request.data.get("score_weights")
        if isinstance(score_weights, dict):
            org.score_weights = score_weights
            org.save(update_fields=["score_weights", "updated_at"])
        return Response({"score_weights": org.score_weights})


class PatientIntakeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PatientIntakeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        story_text = str(payload.get("story", "") or "").strip()
        normalized_payload = {**payload, "story": story_text}

        org = _resolve_intake_organization(payload)

        structured = infer_structured_profile(story_text)
        embedding = generate_patient_embedding(normalized_payload, structured)

        patient_count = PatientProfile.objects.count() + 1
        patient = PatientProfile.objects.create(
            patient_code=f"PAT-{patient_count:04d}",
            organization=org,
            full_name=payload["name"],
            age=payload["age"],
            sex=payload["sex"],
            city=payload["city"],
            country=payload["country"],
            language=payload["language"],
            diagnosis=structured.get("diagnosis", ""),
            stage=structured.get("stage", ""),
            story=story_text,
            structured_profile=structured,
            contact_channel=payload["contactChannel"],
            contact_value=payload["contactInfo"],
            consent=payload["consent"],
            profile_completeness=compute_completeness(normalized_payload),
            embedding_vector=embedding,
        )
        if story_text:
            PatientHistoryEntry.objects.create(
                patient=patient,
                source=PatientHistoryEntry.Source.INTAKE,
                entry_text=story_text,
            )

        evaluate_patient_against_trials(patient)
        patient_token = issue_patient_portal_token(patient.id, patient.patient_code)

        return Response(
            {
                "patient_id": patient.id,
                "patient_code": patient.patient_code,
                "name": patient.full_name,
                "patient_token": patient_token,
            },
            status=status.HTTP_201_CREATED,
        )


class PatientAccessView(APIView):
    permission_classes = [permissions.AllowAny]

    @staticmethod
    def _normalize_phone(value: str, country: str | None = None) -> str:
        digits = re.sub(r"\D", "", value or "")
        if not digits:
            return ""
        if digits.startswith("00"):
            digits = digits[2:]

        country_key = (country or "").strip().lower()
        if country_key == "pakistan":
            if digits.startswith("0") and len(digits) == 11:
                digits = f"92{digits[1:]}"
            elif len(digits) == 10 and digits.startswith("3"):
                digits = f"92{digits}"
        elif country_key in {"uae", "united arab emirates"}:
            if digits.startswith("0") and len(digits) == 10:
                digits = f"971{digits[1:]}"
            elif len(digits) == 9 and digits.startswith("5"):
                digits = f"971{digits}"

        return digits

    @classmethod
    def _normalize_contact(cls, value: str, channel: str, country: str | None = None) -> str:
        if channel in {"sms", "whatsapp", "phone"}:
            return cls._normalize_phone(value, country=country)
        return (value or "").strip().lower()

    def post(self, request):
        patient_code = str(request.data.get("patient_code", "")).strip()
        contact_info = str(request.data.get("contact_info", "")).strip()
        if not patient_code:
            return Response({"detail": "patient_code is required"}, status=400)
        if not contact_info:
            return Response({"detail": "contact_info is required"}, status=400)

        patient = PatientProfile.objects.filter(patient_code__iexact=patient_code).first()
        if not patient:
            return Response({"detail": "Patient not found"}, status=404)

        expected_contact = self._normalize_contact(
            patient.contact_value,
            channel=patient.contact_channel,
            country=patient.country,
        )
        provided_contact = self._normalize_contact(
            contact_info,
            channel=patient.contact_channel,
            country=patient.country,
        )
        if not provided_contact or expected_contact != provided_contact:
            return Response({"detail": "Contact info does not match our records"}, status=403)

        patient_token = issue_patient_portal_token(patient.id, patient.patient_code)
        return Response(
            {
                "patient_id": patient.id,
                "patient_code": patient.patient_code,
                "name": patient.full_name,
                "contact_channel": patient.contact_channel,
                "patient_token": patient_token,
            }
        )


class PatientPortalMatchesView(generics.ListAPIView):
    permission_classes = [IsAuthenticatedPatientPortal]
    serializer_class = MatchEvaluationSerializer

    def get_queryset(self):
        patient_id = self.kwargs["patient_id"]
        _assert_patient_portal_scope(self.request, patient_id)
        queryset = MatchEvaluation.objects.select_related("patient", "trial").filter(patient_id=patient_id)
        return _visible_matches_queryset(queryset).order_by("-eligibility_score")


class PatientHistoryView(APIView):
    permission_classes = [IsAuthenticatedPatientPortal]

    def get(self, request, patient_id: int):
        _assert_patient_portal_scope(request, patient_id)
        patient = get_object_or_404(PatientProfile, id=patient_id)
        _ensure_initial_history_entry(patient)
        entries = patient.history_entries.order_by("-created_at")
        return Response(PatientHistoryEntrySerializer(entries, many=True).data)

    def post(self, request, patient_id: int):
        _assert_patient_portal_scope(request, patient_id)
        patient = get_object_or_404(PatientProfile, id=patient_id)
        _ensure_initial_history_entry(patient)
        serializer = PatientHistoryEntryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        entry = PatientHistoryEntry.objects.create(
            patient=patient,
            source=PatientHistoryEntry.Source.PATIENT_PORTAL,
            entry_text=serializer.validated_data["entry_text"],
        )

        combined_story = _build_combined_history_text(patient)
        structured = infer_structured_profile(combined_story)
        embedding = generate_patient_embedding(
            {
                "name": patient.full_name,
                "age": patient.age,
                "sex": patient.sex,
                "city": patient.city,
                "country": patient.country,
                "story": combined_story,
            },
            structured,
        )

        patient.story = combined_story
        patient.structured_profile = structured
        patient.embedding_vector = embedding
        if structured.get("diagnosis"):
            patient.diagnosis = str(structured.get("diagnosis", ""))
        if structured.get("stage"):
            patient.stage = str(structured.get("stage", ""))
        patient.save(
            update_fields=[
                "story",
                "structured_profile",
                "embedding_vector",
                "diagnosis",
                "stage",
                "updated_at",
            ]
        )

        updates = evaluate_patient_against_trials(patient)
        return Response(
            {
                "entry": PatientHistoryEntrySerializer(entry).data,
                "matches_updated": updates,
            },
            status=status.HTTP_201_CREATED,
        )


class PatientContactRequestView(APIView):
    permission_classes = [IsAuthenticatedPatientPortal]

    def post(self, request, patient_id: int):
        _assert_patient_portal_scope(request, patient_id)
        patient = get_object_or_404(PatientProfile, id=patient_id)
        match_id = request.data.get("match_id")
        channel = str(request.data.get("channel", "")).strip().lower()
        body = str(request.data.get("body", "")).strip()

        if not match_id:
            return Response({"detail": "match_id is required"}, status=400)
        if not body:
            return Response({"detail": "body is required"}, status=400)

        valid_channels = {"sms", "whatsapp", "email", "phone"}
        if channel not in valid_channels:
            return Response({"detail": f"channel must be one of {sorted(valid_channels)}"}, status=400)

        match = get_object_or_404(MatchEvaluation, id=match_id, patient=patient)
        message = OutreachMessage.objects.create(
            match=match,
            channel=channel,
            direction="inbound",
            body=body,
            provider="patient-portal",
            status="queued",
            status_payload={"source": "patient_portal"},
        )
        return Response(OutreachMessageSerializer(message).data, status=status.HTTP_201_CREATED)


class PatientDocumentUploadView(APIView):
    permission_classes = [IsAuthenticatedPatientPortal]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def get(self, request, patient_id: int):
        _assert_patient_portal_scope(request, patient_id)
        patient = get_object_or_404(PatientProfile, id=patient_id)
        docs = patient.documents.order_by("-created_at")
        return Response(PatientDocumentSerializer(docs, many=True).data)

    def post(self, request, patient_id: int):
        _assert_patient_portal_scope(request, patient_id)
        patient = get_object_or_404(PatientProfile, id=patient_id)
        incoming = request.FILES.get("document")
        if incoming is None:
            return Response({"detail": "Missing 'document' file"}, status=400)

        max_size = settings.PATIENT_UPLOAD_MAX_MB * 1024 * 1024
        if incoming.size > max_size:
            return Response(
                {"detail": f"File too large. Max allowed size is {settings.PATIENT_UPLOAD_MAX_MB}MB."},
                status=400,
            )
        if not is_supported_text_document(incoming.name, getattr(incoming, "content_type", "")):
            return Response(
                {
                    "detail": "Unsupported file type. Use text-based files only (PDF, TXT, MD, CSV, JSON, YAML, XML, LOG)."
                },
                status=400,
            )

        uploader = request.user if request.user and request.user.is_authenticated else None
        doc = PatientDocument.objects.create(
            patient=patient,
            file=incoming,
            original_name=incoming.name,
            content_type=getattr(incoming, "content_type", ""),
            size_bytes=incoming.size,
            uploaded_by=uploader,
        )

        try:
            with doc.file.open("rb") as file_obj:
                extraction = extract_document_text(
                    file_obj=file_obj,
                    original_name=doc.original_name,
                    content_type=doc.content_type,
                )
        except Exception as exc:
            extraction = None
            doc.extraction_status = PatientDocument.ExtractionStatus.FAILED
            doc.extraction_error = str(exc)
            doc.extracted_text = ""
        else:
            if extraction:
                doc.extraction_status = extraction.status
                doc.extracted_text = extraction.text
                doc.extraction_error = extraction.error

        doc.save(update_fields=["extraction_status", "extracted_text", "extraction_error", "updated_at"])
        return Response(PatientDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)


class MatchingRunNowView(APIView):
    permission_classes = [IsCoordinatorOrAdmin]

    def post(self, request):
        reconcile_stale_running_runs()
        try:
            run = run_full_matching_cycle(run_type="manual")
        except MatchingRunAlreadyRunningError as exc:
            payload = {"detail": "A matching run is already in progress."}
            if exc.running_run:
                payload["running_run"] = MatchingRunSerializer(exc.running_run).data
            return Response(payload, status=status.HTTP_409_CONFLICT)
        return Response(MatchingRunSerializer(run).data)
