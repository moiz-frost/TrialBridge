from __future__ import annotations

from datetime import date
from typing import Dict, Iterable, List

import requests

from apps.core.services.embedding import generate_embedding
from apps.trials.models import Trial, TrialSite

from .sample_trials import SAMPLE_TRIALS


def trial_embedding_text(payload: Dict[str, object]) -> str:
    return (
        f"Trial {payload.get('trial_id')}. Title: {payload.get('title')}. "
        f"Conditions: {', '.join(payload.get('conditions', []))}. "
        f"Interventions: {', '.join(payload.get('interventions', []))}. "
        f"Eligibility: {payload.get('eligibility_summary', '')}. "
        f"Inclusion: {payload.get('inclusion_text', '')}. "
        f"Exclusion: {payload.get('exclusion_text', '')}. "
        f"Countries: {', '.join(payload.get('countries', []))}."
    )


def upsert_trial(payload: Dict[str, object]) -> Trial:
    trial, _ = Trial.objects.update_or_create(
        trial_id=payload["trial_id"],
        defaults={
            "source": payload.get("source", "clinicaltrials.gov"),
            "title": payload.get("title", ""),
            "phase": payload.get("phase", ""),
            "status": payload.get("status", "RECRUITING"),
            "conditions": payload.get("conditions", []),
            "interventions": payload.get("interventions", []),
            "countries": payload.get("countries", []),
            "sponsor": payload.get("sponsor", ""),
            "summary": payload.get("summary", ""),
            "eligibility_summary": payload.get("eligibility_summary", ""),
            "inclusion_text": payload.get("inclusion_text", ""),
            "exclusion_text": payload.get("exclusion_text", ""),
            "eligibility_json": payload.get("eligibility_json", {}),
            "metadata": payload.get("metadata", {}),
            "source_url": payload.get("source_url", ""),
            "external_last_updated": payload.get("external_last_updated", date.today()),
        },
    )
    text = trial_embedding_text(payload)
    trial.embedding_text = text
    trial.embedding_vector = generate_embedding(text)
    trial.save(update_fields=["embedding_text", "embedding_vector", "updated_at"])

    trial.sites.all().delete()
    for site in payload.get("sites", []):
        TrialSite.objects.create(
            trial=trial,
            facility=site.get("facility", "Unknown Site"),
            city=site.get("city", ""),
            country=site.get("country", ""),
            latitude=site.get("latitude"),
            longitude=site.get("longitude"),
        )

    return trial


def ingest_sample_trials() -> List[Trial]:
    return [upsert_trial(item) for item in SAMPLE_TRIALS]


def fetch_ctgov_trials(limit: int = 20) -> Iterable[Dict[str, object]]:
    # Minimal extraction from CT.gov v2 API for hackathon MVP.
    url = "https://clinicaltrials.gov/api/v2/studies"
    params = {"pageSize": limit, "query.cond": "breast cancer"}
    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    studies = response.json().get("studies", [])

    for study in studies:
        protocol = study.get("protocolSection", {})
        id_module = protocol.get("identificationModule", {})
        status_module = protocol.get("statusModule", {})
        design_module = protocol.get("designModule", {})
        cond_module = protocol.get("conditionsModule", {})
        arms_module = protocol.get("armsInterventionsModule", {})
        eligibility_module = protocol.get("eligibilityModule", {})

        trial_id = id_module.get("nctId")
        if not trial_id:
            continue

        conditions = cond_module.get("conditions", [])
        interventions = [
            i.get("name")
            for i in arms_module.get("interventions", [])
            if i.get("name")
        ]
        phase_list = design_module.get("phases", [])

        yield {
            "trial_id": trial_id,
            "source": "clinicaltrials.gov",
            "title": id_module.get("briefTitle", ""),
            "phase": ", ".join(phase_list),
            "status": status_module.get("overallStatus", "RECRUITING"),
            "conditions": conditions,
            "interventions": interventions,
            "countries": [],
            "summary": protocol.get("descriptionModule", {}).get("briefSummary", ""),
            "eligibility_summary": eligibility_module.get("eligibilityCriteria", "")[:300],
            "inclusion_text": eligibility_module.get("eligibilityCriteria", ""),
            "exclusion_text": "",
            "sites": [],
            "source_url": f"https://clinicaltrials.gov/study/{trial_id}",
        }
