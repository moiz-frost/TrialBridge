from __future__ import annotations

from typing import Any

from django.conf import settings
from django.core import signing

TOKEN_SALT = "trialbridge.patient.portal.v1"


def issue_patient_portal_token(patient_id: int, patient_code: str) -> str:
    payload = {"patient_id": int(patient_id), "patient_code": str(patient_code)}
    return signing.dumps(payload, salt=TOKEN_SALT, compress=True)


def verify_patient_portal_token(token: str) -> dict[str, Any] | None:
    raw = (token or "").strip()
    if not raw:
        return None
    try:
        payload = signing.loads(
            raw,
            salt=TOKEN_SALT,
            max_age=settings.PATIENT_PORTAL_TOKEN_MAX_AGE_SECONDS,
        )
    except signing.BadSignature:
        return None
    except signing.SignatureExpired:
        return None

    if not isinstance(payload, dict):
        return None

    patient_id = payload.get("patient_id")
    patient_code = payload.get("patient_code")
    if not isinstance(patient_id, int):
        return None
    if not isinstance(patient_code, str) or not patient_code.strip():
        return None
    return {"patient_id": patient_id, "patient_code": patient_code.strip()}
