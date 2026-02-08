from django.test import TestCase, override_settings

from apps.core.models import Organization
from apps.matching.models import MatchEvaluation
from apps.matching.services.engine import evaluate_patient_against_trials
from apps.patients.models import PatientProfile
from apps.trials.models import Trial, TrialSite


@override_settings(MATCH_TOP_K=10, MATCH_EVALUATE_TOP_N=5)
class MatchingEngineTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name="Matching Engine Org",
            slug="matching-engine-org",
            country="Pakistan",
            score_weights={"eligibility": 0.50, "feasibility": 0.25, "urgency": 0.20, "explainability": 0.05},
        )
        self.matching_trial = Trial.objects.create(
            trial_id="NCT-MATCH-001",
            title="HER2 Positive Advanced Breast Cancer Trial",
            phase="Phase 3",
            status="RECRUITING",
            source="clinicaltrials.gov",
            conditions=["Breast Cancer", "HER2 Positive"],
            interventions=["Trastuzumab Deruxtecan"],
            countries=["Pakistan"],
            summary="Study for metastatic HER2+ disease.",
            eligibility_summary="Adults 18 to 70 years with HER2 positive metastatic disease.",
            inclusion_text="Minimum age 18 years. Female participants.",
            exclusion_text="",
            embedding_text="",
            source_url="https://clinicaltrials.gov/study/NCT-MATCH-001",
        )
        TrialSite.objects.create(
            trial=self.matching_trial,
            facility="Aga Khan University Hospital",
            city="Karachi",
            country="Pakistan",
        )

        self.unrelated_trial = Trial.objects.create(
            trial_id="NCT-NONMATCH-001",
            title="Localized Dermatology Study",
            phase="Phase 2",
            status="RECRUITING",
            source="clinicaltrials.gov",
            conditions=["Atopic Dermatitis"],
            interventions=["Topical Therapy"],
            countries=["Germany"],
            summary="Dermatology-only protocol.",
            eligibility_summary="Adults with localized skin disease.",
            inclusion_text="Minimum age 18 years.",
            exclusion_text="",
            embedding_text="",
            source_url="https://clinicaltrials.gov/study/NCT-NONMATCH-001",
        )
        TrialSite.objects.create(
            trial=self.unrelated_trial,
            facility="Berlin Site",
            city="Berlin",
            country="Germany",
        )

        self.patient = PatientProfile.objects.create(
            patient_code="PAT-9001",
            organization=self.org,
            full_name="Matching Test Patient",
            age=47,
            sex="female",
            city="Karachi",
            country="Pakistan",
            language="English",
            diagnosis="HER2+ Breast Cancer",
            stage="Stage IV (Metastatic)",
            story="Metastatic HER2 positive disease progressed after trastuzumab. ECOG 1.",
            structured_profile={"markers": ["her2", "metastatic"], "stage": "Stage IV"},
            contact_channel="email",
            contact_value="matching.patient@example.com",
            consent=True,
            profile_completeness=95,
        )

    def test_engine_prioritizes_relevant_trial(self):
        updates = evaluate_patient_against_trials(self.patient)
        self.assertGreaterEqual(updates, 1)

        matches = MatchEvaluation.objects.filter(patient=self.patient).order_by("-eligibility_score")
        self.assertGreater(matches.count(), 0)

        top = matches.first()
        self.assertEqual(top.trial.trial_id, "NCT-MATCH-001")
        self.assertGreaterEqual(top.eligibility_score, 60)
        self.assertIn(top.overall_status, {"Eligible", "Possibly Eligible", "Unlikely"})

    def test_engine_skips_gibberish_story(self):
        gibberish_patient = PatientProfile.objects.create(
            patient_code="PAT-9002",
            organization=self.org,
            full_name="Gibberish Intake Patient",
            age=39,
            sex="female",
            city="Karachi",
            country="Pakistan",
            language="English",
            diagnosis="",
            stage="",
            story="asdf qwer zxcv qqqqq 12345 lorem ipsum blabla",
            structured_profile={"markers": [], "raw_story": "asdf qwer zxcv qqqqq 12345 lorem ipsum blabla"},
            contact_channel="email",
            contact_value="gibberish.patient@example.com",
            consent=True,
            profile_completeness=70,
        )

        updates = evaluate_patient_against_trials(gibberish_patient)
        self.assertEqual(updates, 0)
        self.assertFalse(MatchEvaluation.objects.filter(patient=gibberish_patient).exists())
