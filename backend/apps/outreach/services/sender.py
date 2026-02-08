from __future__ import annotations

from datetime import datetime
from typing import Dict

import requests
from django.conf import settings
from django.utils import timezone

from apps.matching.models import MatchEvaluation, OutreachStatus
from apps.outreach.models import OutreachMessage


TWILIO_API_BASE = "https://api.twilio.com/2010-04-01"


def _twilio_send(to_value: str, body: str, channel: str) -> Dict[str, str]:
    account_sid = settings.TWILIO_ACCOUNT_SID
    auth_token = settings.TWILIO_AUTH_TOKEN

    if not account_sid or not auth_token:
        return {"sid": "mock-no-credentials", "status": "queued"}

    from_value = settings.TWILIO_FROM_SMS if channel == "sms" else settings.TWILIO_FROM_WHATSAPP
    target = to_value
    if channel == "whatsapp" and not target.startswith("whatsapp:"):
        target = f"whatsapp:{to_value}"
    if channel == "whatsapp" and not from_value.startswith("whatsapp:"):
        from_value = f"whatsapp:{from_value}"

    response = requests.post(
        f"{TWILIO_API_BASE}/Accounts/{account_sid}/Messages.json",
        auth=(account_sid, auth_token),
        data={
            "From": from_value,
            "To": target,
            "Body": body,
        },
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()
    return {"sid": payload.get("sid", ""), "status": payload.get("status", "queued")}


def _simulated_send(channel: str) -> Dict[str, str]:
    return {
        "sid": f"simulated-{channel}-{int(timezone.now().timestamp())}",
        "status": "sent",
        "simulated": "true",
    }


def send_outreach_message(match: MatchEvaluation, channel: str, body: str) -> OutreachMessage:
    contact_value = match.patient.contact_value
    now = timezone.now()

    message = OutreachMessage.objects.create(
        match=match,
        channel=channel,
        body=body,
        status="queued",
        sent_at=now,
    )

    try:
        live_delivery = settings.OUTREACH_DELIVERY_MODE == "live"
        if channel in {"sms", "whatsapp"}:
            twilio_result = _twilio_send(contact_value, body, channel) if live_delivery else _simulated_send(channel)
            message.provider_message_id = twilio_result.get("sid", "")
            status = twilio_result.get("status", "queued")
            if status in {"queued", "accepted", "sending", "sent"}:
                message.status = "sent"
                match.outreach_status = OutreachStatus.SENT
            else:
                message.status = "failed"
                match.outreach_status = OutreachStatus.PENDING
        else:
            simulated = _simulated_send(channel)
            message.provider_message_id = simulated["sid"]
            message.status = "sent"
            match.outreach_status = OutreachStatus.SENT

        message.status_payload = {
            "processed_at": datetime.utcnow().isoformat(),
            "channel": channel,
            "delivery_mode": settings.OUTREACH_DELIVERY_MODE,
            "simulated": settings.OUTREACH_DELIVERY_MODE != "live",
        }
    except Exception as exc:
        message.status = "failed"
        message.status_payload = {"error": str(exc)}
        match.outreach_status = OutreachStatus.PENDING

    message.save(update_fields=["provider_message_id", "status", "status_payload", "updated_at"])
    match.save(update_fields=["outreach_status", "updated_at"])
    return message
