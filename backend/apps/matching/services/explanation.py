import json
from typing import Any, Dict

import requests
from django.conf import settings


ELIGIBILITY_PROMPT_TEMPLATE = """
You are a clinical trial matching explanation engine.
Return strict JSON with this exact schema:
{{
  "plain_language_summary": "string",
  "reasons_matched": ["string"],
  "reasons_failed": ["string"],
  "missing_info": ["string"],
  "doctor_checklist": ["string"],
  "overall_status": "Eligible|Possibly Eligible|Unlikely",
  "confidence": 0.0
}}

Input patient profile:
{patient_json}

Input trial profile:
{trial_json}

Input rule evaluation:
{rule_json}

Rules:
- Be concise and clinically neutral.
- Mention unknowns explicitly in missing_info.
- Do not claim final medical eligibility.
- Output JSON only.
""".strip()

SUPPORTED_LLM_MODES = {"auto", "hf", "gemini", "fallback"}


def _fallback(rule_result: Dict[str, Any], reason: str) -> Dict[str, Any]:
    return {
        "plain_language_summary": (
            "Potential match identified. Coordinator and physician review is required before enrollment."
        ),
        "reasons_matched": rule_result.get("reasons_matched", []),
        "reasons_failed": rule_result.get("reasons_failed", []),
        "missing_info": rule_result.get("missing_info", []),
        "doctor_checklist": rule_result.get("doctor_checklist", []),
        "overall_status": rule_result.get("overall_status", "Possibly Eligible"),
        "confidence": float(rule_result.get("confidence", 0.6)),
        "model": "deterministic-fallback",
        "provider": "local",
        "fallback_reason": reason,
    }


def _extract_hf_text(payload: Any) -> str:
    if isinstance(payload, dict):
        generated = payload.get("generated_text")
        if isinstance(generated, str):
            return generated
        answer = payload.get("answer")
        if isinstance(answer, str):
            return answer

    if isinstance(payload, list) and payload:
        first = payload[0]
        if isinstance(first, dict):
            generated = first.get("generated_text") or first.get("summary_text")
            if isinstance(generated, str):
                return generated
        if isinstance(first, str):
            return first

    return ""


def _extract_gemini_text(payload: Any) -> str:
    if not isinstance(payload, dict):
        return ""
    candidates = payload.get("candidates")
    if not isinstance(candidates, list):
        return ""

    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        content = candidate.get("content")
        if not isinstance(content, dict):
            continue
        parts = content.get("parts")
        if not isinstance(parts, list):
            continue
        chunks: list[str] = []
        for part in parts:
            if not isinstance(part, dict):
                continue
            text = part.get("text")
            if isinstance(text, str) and text.strip():
                chunks.append(text)
        if chunks:
            return "\n".join(chunks)
    return ""


def _extract_json_object(text: str) -> Dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("no_json_object")

    parsed = json.loads(cleaned[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("json_not_object")
    return parsed


def _normalize_response(
    raw: Dict[str, Any],
    rule_result: Dict[str, Any],
    model: str,
    provider: str,
) -> Dict[str, Any]:
    return {
        "plain_language_summary": str(
            raw.get("plain_language_summary")
            or "Potential match identified. Coordinator review is required."
        ),
        "reasons_matched": list(raw.get("reasons_matched") or rule_result.get("reasons_matched", [])),
        "reasons_failed": list(raw.get("reasons_failed") or rule_result.get("reasons_failed", [])),
        "missing_info": list(raw.get("missing_info") or rule_result.get("missing_info", [])),
        "doctor_checklist": list(raw.get("doctor_checklist") or rule_result.get("doctor_checklist", [])),
        "overall_status": str(raw.get("overall_status") or rule_result.get("overall_status", "Possibly Eligible")),
        "confidence": float(raw.get("confidence", rule_result.get("confidence", 0.6))),
        "model": model,
        "provider": provider,
    }


def _build_prompt(
    patient_payload: Dict[str, Any],
    trial_payload: Dict[str, Any],
    rule_result: Dict[str, Any],
) -> str:
    return ELIGIBILITY_PROMPT_TEMPLATE.format(
        patient_json=json.dumps(patient_payload, ensure_ascii=True),
        trial_json=json.dumps(trial_payload, ensure_ascii=True),
        rule_json=json.dumps(rule_result, ensure_ascii=True),
    )


def _generate_with_hf(prompt: str, rule_result: Dict[str, Any]) -> Dict[str, Any]:
    response = requests.post(
        settings.HF_LLM_ENDPOINT,
        headers={"Authorization": f"Bearer {settings.HF_API_TOKEN}"},
        json={
            "inputs": prompt,
            "parameters": {"max_new_tokens": 800, "temperature": 0.1},
        },
        timeout=40,
    )
    response.raise_for_status()
    payload = response.json()
    text = _extract_hf_text(payload).strip()
    parsed = _extract_json_object(text)
    return _normalize_response(parsed, rule_result, model=settings.HF_LLM_ENDPOINT, provider="huggingface")


def _generate_with_gemini(prompt: str, rule_result: Dict[str, Any]) -> Dict[str, Any]:
    model = settings.GEMINI_MODEL or "gemini-2.0-flash"
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    response = requests.post(
        endpoint,
        headers={
            "Content-Type": "application/json",
            "X-goog-api-key": settings.GEMINI_API_KEY,
        },
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 800,
                "responseMimeType": "application/json",
            },
        },
        timeout=40,
    )
    response.raise_for_status()
    payload = response.json()
    text = _extract_gemini_text(payload).strip()
    parsed = _extract_json_object(text)
    return _normalize_response(parsed, rule_result, model=f"gemini:{model}", provider="gemini")


def generate_explanation(
    patient_payload: Dict[str, Any],
    trial_payload: Dict[str, Any],
    rule_result: Dict[str, Any],
    *,
    allow_llm: bool = True,
) -> Dict[str, Any]:
    if not allow_llm:
        return _fallback(rule_result, reason="llm_budget_reached")

    mode = settings.LLM_MODE if settings.LLM_MODE in SUPPORTED_LLM_MODES else "auto"
    prompt = _build_prompt(patient_payload, trial_payload, rule_result)
    hf_ready = bool(settings.HF_LLM_ENDPOINT and settings.HF_API_TOKEN)
    gemini_ready = bool(settings.GEMINI_API_KEY)

    if mode == "fallback":
        return _fallback(rule_result, reason="llm_mode_fallback")

    if mode == "gemini":
        if not gemini_ready:
            return _fallback(rule_result, reason="missing_gemini_config")
        try:
            return _generate_with_gemini(prompt, rule_result)
        except Exception:
            return _fallback(rule_result, reason="gemini_request_failed")

    if mode == "hf":
        if not hf_ready:
            return _fallback(rule_result, reason="missing_hf_config")
        try:
            return _generate_with_hf(prompt, rule_result)
        except Exception:
            return _fallback(rule_result, reason="hf_request_failed")

    # auto mode prefers Gemini when configured, then HF, then deterministic fallback
    if gemini_ready:
        try:
            return _generate_with_gemini(prompt, rule_result)
        except Exception:
            if not hf_ready:
                return _fallback(rule_result, reason="gemini_request_failed")

    if hf_ready:
        try:
            return _generate_with_hf(prompt, rule_result)
        except Exception:
            return _fallback(rule_result, reason="hf_request_failed")

    return _fallback(rule_result, reason="no_llm_provider_configured")
