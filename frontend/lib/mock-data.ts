// Mock data for TrialBridge prototype

export interface Trial {
  id: string;
  title: string;
  phase: string;
  status: "RECRUITING" | "NOT_YET_RECRUITING" | "ACTIVE_NOT_RECRUITING";
  conditions: string[];
  interventions: string[];
  locations: { facility: string; city: string; country: string }[];
  sponsor: string;
  summary: string;
  eligibilitySummary: string;
  source: "clinicaltrials.gov" | "pakistan_ctr";
  lastUpdated: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  sex: string;
  city: string;
  country: string;
  language: string;
  diagnosis: string;
  stage: string;
  story: string;
  contactChannel: "sms" | "whatsapp" | "email" | "phone";
  contactInfo: string;
  registeredAt: string;
  profileCompleteness: number;
}

export interface MatchEvaluation {
  id: string;
  patientId: string;
  trialId: string;
  patient: Patient;
  trial: Trial;
  eligibilityScore: number;
  feasibilityScore: number;
  urgencyScore?: number;
  explainabilityScore?: number;
  urgencyFlag: "high" | "medium" | "low";
  overallStatus: "Eligible" | "Possibly Eligible" | "Unlikely";
  reasonsMatched: string[];
  reasonsFailed: string[];
  missingInfo: string[];
  doctorChecklist: string[];
  explanationSummary?: string;
  explanationLanguage?: string;
  explanationModel?: string;
  promptVersion?: string;
  confidence?: number;
  outreachStatus:
    | "pending"
    | "draft"
    | "sent"
    | "delivered"
    | "replied"
    | "no_response";
  lastEvaluated: string;
  isNew: boolean;
}

export const mockTrials: Trial[] = [
  {
    id: "NCT06812345",
    title:
      "A Phase III Study of Trastuzumab Deruxtecan vs Physician's Choice in HER2+ Metastatic Breast Cancer",
    phase: "Phase 3",
    status: "RECRUITING",
    conditions: ["Breast Cancer", "HER2+ Breast Cancer", "Metastatic"],
    interventions: ["Trastuzumab Deruxtecan", "Physician's Choice Chemo"],
    locations: [
      {
        facility: "Aga Khan University Hospital",
        city: "Karachi",
        country: "Pakistan",
      },
      {
        facility: "Shaukat Khanum Memorial",
        city: "Lahore",
        country: "Pakistan",
      },
      {
        facility: "Cleveland Clinic Abu Dhabi",
        city: "Abu Dhabi",
        country: "UAE",
      },
    ],
    sponsor: "Daiichi Sankyo",
    summary:
      "This study evaluates the efficacy and safety of trastuzumab deruxtecan versus physician's choice chemotherapy in patients with HER2-positive unresectable or metastatic breast cancer who have received prior anti-HER2 treatment.",
    eligibilitySummary:
      "Adults 18+, HER2-positive confirmed by IHC/FISH, at least one prior line of anti-HER2 therapy for metastatic disease, ECOG 0-1, adequate organ function.",
    source: "clinicaltrials.gov",
    lastUpdated: "2026-01-20",
  },
  {
    id: "NCT07234567",
    title:
      "Pembrolizumab Combined with Chemotherapy for Triple-Negative Breast Cancer (TNBC) in South Asian Population",
    phase: "Phase 2",
    status: "RECRUITING",
    conditions: [
      "Breast Cancer",
      "Triple-Negative Breast Cancer",
      "Locally Advanced",
    ],
    interventions: ["Pembrolizumab", "Nab-Paclitaxel"],
    locations: [
      {
        facility: "Pakistan Institute of Medical Sciences",
        city: "Islamabad",
        country: "Pakistan",
      },
      {
        facility: "King Faisal Specialist Hospital",
        city: "Riyadh",
        country: "Saudi Arabia",
      },
    ],
    sponsor: "Merck Sharp & Dohme",
    summary:
      "A multicenter study evaluating the combination of pembrolizumab with nab-paclitaxel as neoadjuvant therapy in patients with locally advanced triple-negative breast cancer from South Asian and Middle Eastern populations.",
    eligibilitySummary:
      "Adults 18-70, histologically confirmed TNBC, Stage IIB-IIIC, PD-L1 CPS >= 10, no prior systemic therapy for breast cancer, ECOG 0-1.",
    source: "clinicaltrials.gov",
    lastUpdated: "2026-01-15",
  },
  {
    id: "NCT07345678",
    title:
      "Ribociclib Plus Endocrine Therapy for HR+/HER2- Advanced Breast Cancer",
    phase: "Phase 3",
    status: "RECRUITING",
    conditions: [
      "Breast Cancer",
      "HR+ Breast Cancer",
      "HER2-Negative Breast Cancer",
    ],
    interventions: ["Ribociclib", "Letrozole"],
    locations: [
      {
        facility: "Indus Hospital & Health Network",
        city: "Karachi",
        country: "Pakistan",
      },
      {
        facility: "Tawam Hospital",
        city: "Al Ain",
        country: "UAE",
      },
    ],
    sponsor: "Novartis",
    summary:
      "A randomized controlled trial comparing ribociclib plus letrozole versus letrozole alone as first-line treatment for premenopausal and postmenopausal women with HR+/HER2- advanced breast cancer.",
    eligibilitySummary:
      "Women 18+, HR+/HER2-, advanced or metastatic, no prior CDK4/6 inhibitor, adequate hematologic and hepatic function, QTcF < 450ms.",
    source: "clinicaltrials.gov",
    lastUpdated: "2026-02-01",
  },
  {
    id: "DRAP-2026-0042",
    title:
      "Evaluating Sacituzumab Govitecan in Pre-Treated Metastatic Breast Cancer: Pakistan Registry Study",
    phase: "Phase 2",
    status: "RECRUITING",
    conditions: ["Breast Cancer", "Metastatic Breast Cancer"],
    interventions: ["Sacituzumab Govitecan"],
    locations: [
      {
        facility: "Combined Military Hospital",
        city: "Rawalpindi",
        country: "Pakistan",
      },
      {
        facility: "Jinnah Postgraduate Medical Centre",
        city: "Karachi",
        country: "Pakistan",
      },
    ],
    sponsor: "DRAP / Gilead Sciences",
    summary:
      "A Pakistan-specific registry study evaluating the safety and efficacy of sacituzumab govitecan in patients with previously treated metastatic breast cancer, including TNBC and HR+/HER2- subtypes.",
    eligibilitySummary:
      "Adults 18+, at least 2 prior lines of therapy for metastatic disease, measurable disease per RECIST 1.1, ECOG 0-2, no active brain metastases.",
    source: "pakistan_ctr",
    lastUpdated: "2026-01-28",
  },
  {
    id: "NCT07456789",
    title:
      "Alpelisib + Fulvestrant in PIK3CA-Mutated HR+/HER2- Breast Cancer",
    phase: "Phase 3",
    status: "NOT_YET_RECRUITING",
    conditions: ["Breast Cancer", "PIK3CA-Mutated", "HR+/HER2-"],
    interventions: ["Alpelisib", "Fulvestrant"],
    locations: [
      {
        facility: "Dubai Hospital",
        city: "Dubai",
        country: "UAE",
      },
      {
        facility: "Shifa International Hospital",
        city: "Islamabad",
        country: "Pakistan",
      },
    ],
    sponsor: "Novartis",
    summary:
      "Evaluating the efficacy of alpelisib combined with fulvestrant in patients with PIK3CA-mutated, hormone receptor-positive, HER2-negative advanced breast cancer who have progressed on or after prior endocrine therapy.",
    eligibilitySummary:
      "Men and women 18+, PIK3CA mutation confirmed, progression on prior aromatase inhibitor, HbA1c < 6.5%, fasting glucose < 140 mg/dL.",
    source: "clinicaltrials.gov",
    lastUpdated: "2026-02-05",
  },
  {
    id: "DRAP-2026-0058",
    title:
      "Olaparib Monotherapy for BRCA-Mutated Metastatic Breast Cancer in Pakistani Patients",
    phase: "Phase 2",
    status: "NOT_YET_RECRUITING",
    conditions: [
      "Breast Cancer",
      "BRCA Mutation",
      "Metastatic Breast Cancer",
    ],
    interventions: ["Olaparib"],
    locations: [
      {
        facility: "Shaukat Khanum Memorial Cancer Hospital",
        city: "Lahore",
        country: "Pakistan",
      },
    ],
    sponsor: "AstraZeneca / DRAP",
    summary:
      "A registry study evaluating olaparib in BRCA1/2-mutated HER2-negative metastatic breast cancer patients in Pakistan who have received prior chemotherapy.",
    eligibilitySummary:
      "Adults 18+, germline BRCA1 or BRCA2 pathogenic mutation, HER2-negative, at least 1 prior chemotherapy line for metastatic disease, ECOG 0-1.",
    source: "pakistan_ctr",
    lastUpdated: "2026-02-03",
  },
];

export const mockPatients: Patient[] = [
  {
    id: "PAT-001",
    name: "Fatima Zahra",
    age: 42,
    sex: "Female",
    city: "Karachi",
    country: "Pakistan",
    language: "Urdu",
    diagnosis: "HER2+ Breast Cancer",
    stage: "Stage IV (Metastatic)",
    story:
      "Fatima was diagnosed with HER2-positive breast cancer 3 years ago. She received trastuzumab + chemotherapy as first-line treatment but the disease progressed to her liver and lungs 6 months ago. She has good performance status (ECOG 1) and is eager to try new treatments. Her family is supportive and she can travel within Karachi for hospital visits.",
    contactChannel: "whatsapp",
    contactInfo: "+92-300-1234567",
    registeredAt: "2026-01-15",
    profileCompleteness: 85,
  },
  {
    id: "PAT-002",
    name: "Amna Bibi",
    age: 55,
    sex: "Female",
    city: "Lahore",
    country: "Pakistan",
    language: "Urdu",
    diagnosis: "Triple-Negative Breast Cancer",
    stage: "Stage IIIB (Locally Advanced)",
    story:
      "Amna was recently diagnosed with locally advanced triple-negative breast cancer. She has not received any prior systemic therapy. PD-L1 testing showed CPS of 15. She lives with her son in Lahore and has limited mobility due to arthritis. She cannot travel more than 30km easily.",
    contactChannel: "phone",
    contactInfo: "+92-321-9876543",
    registeredAt: "2026-01-22",
    profileCompleteness: 72,
  },
  {
    id: "PAT-003",
    name: "Sara Al-Mansouri",
    age: 38,
    sex: "Female",
    city: "Abu Dhabi",
    country: "UAE",
    language: "Arabic",
    diagnosis: "HR+/HER2- Breast Cancer",
    stage: "Stage IV (Metastatic)",
    story:
      "Sara was diagnosed with hormone receptor-positive, HER2-negative metastatic breast cancer. She progressed on letrozole after 18 months. PIK3CA mutation was detected on liquid biopsy. She has good organ function and ECOG 0. She is willing to travel within UAE for treatment.",
    contactChannel: "whatsapp",
    contactInfo: "+971-50-1234567",
    registeredAt: "2026-02-01",
    profileCompleteness: 92,
  },
  {
    id: "PAT-004",
    name: "Rehana Khatoon",
    age: 48,
    sex: "Female",
    city: "Rawalpindi",
    country: "Pakistan",
    language: "Urdu",
    diagnosis: "Metastatic Breast Cancer (TNBC)",
    stage: "Stage IV",
    story:
      "Rehana has been treated with two lines of chemotherapy for metastatic TNBC. Disease is progressing. She has heard about new antibody-drug conjugates but cannot afford private hospital care. She is being treated at CMH Rawalpindi. ECOG 1, no brain metastases.",
    contactChannel: "sms",
    contactInfo: "+92-333-4567890",
    registeredAt: "2026-01-28",
    profileCompleteness: 68,
  },
  {
    id: "PAT-005",
    name: "Noor Hussain",
    age: 35,
    sex: "Female",
    city: "Islamabad",
    country: "Pakistan",
    language: "English",
    diagnosis: "BRCA1-Mutated Breast Cancer",
    stage: "Stage IV (Metastatic)",
    story:
      "Noor has a germline BRCA1 mutation and was diagnosed with HER2-negative metastatic breast cancer. She completed first-line chemotherapy with partial response but is looking for targeted therapy options. She works full-time and prefers minimal visit frequency. ECOG 0.",
    contactChannel: "email",
    contactInfo: "noor.h@example.com",
    registeredAt: "2026-02-05",
    profileCompleteness: 88,
  },
];

export const mockMatches: MatchEvaluation[] = [
  {
    id: "MATCH-001",
    patientId: "PAT-001",
    trialId: "NCT06812345",
    patient: mockPatients[0],
    trial: mockTrials[0],
    eligibilityScore: 89,
    feasibilityScore: 92,
    urgencyFlag: "high",
    overallStatus: "Eligible",
    reasonsMatched: [
      "HER2-positive confirmed by IHC/FISH",
      "Prior anti-HER2 therapy (trastuzumab) for metastatic disease",
      "Age 42 within 18+ range",
      "ECOG 1 within 0-1 requirement",
      "Metastatic disease confirmed",
    ],
    reasonsFailed: [],
    missingInfo: [
      "Organ function labs (ANC, platelets, bilirubin, creatinine)",
      "Current LVEF measurement",
      "Confirm no active brain metastases",
    ],
    doctorChecklist: [
      "Order CBC with differential",
      "Order hepatic function panel",
      "Schedule echocardiogram for LVEF",
      "Brain MRI to rule out CNS metastases",
    ],
    outreachStatus: "pending",
    lastEvaluated: "2026-02-08",
    isNew: true,
  },
  {
    id: "MATCH-002",
    patientId: "PAT-002",
    trialId: "NCT07234567",
    patient: mockPatients[1],
    trial: mockTrials[1],
    eligibilityScore: 82,
    feasibilityScore: 65,
    urgencyFlag: "medium",
    overallStatus: "Possibly Eligible",
    reasonsMatched: [
      "TNBC diagnosis confirmed",
      "Locally advanced (Stage IIIB) within IIB-IIIC range",
      "PD-L1 CPS 15 meets >= 10 threshold",
      "No prior systemic therapy for breast cancer",
      "Age 55 within 18-70 range",
    ],
    reasonsFailed: ["ECOG status not confirmed (arthritis noted)"],
    missingInfo: [
      "Formal ECOG performance status assessment",
      "Complete staging workup",
      "Cardiac function baseline",
    ],
    doctorChecklist: [
      "Assess ECOG score formally",
      "Complete baseline staging CT",
      "Order baseline ECG and echocardiogram",
      "Review arthritis medications for contraindications",
    ],
    outreachStatus: "draft",
    lastEvaluated: "2026-02-08",
    isNew: true,
  },
  {
    id: "MATCH-003",
    patientId: "PAT-003",
    trialId: "NCT07456789",
    patient: mockPatients[2],
    trial: mockTrials[4],
    eligibilityScore: 94,
    feasibilityScore: 88,
    urgencyFlag: "medium",
    overallStatus: "Eligible",
    reasonsMatched: [
      "PIK3CA mutation confirmed by liquid biopsy",
      "HR+/HER2- confirmed",
      "Progressed on prior aromatase inhibitor (letrozole)",
      "ECOG 0 meets requirement",
      "Age 38 within 18+ range",
    ],
    reasonsFailed: [],
    missingInfo: [
      "HbA1c level (requirement < 6.5%)",
      "Fasting glucose level (requirement < 140 mg/dL)",
    ],
    doctorChecklist: [
      "Order HbA1c test",
      "Order fasting blood glucose",
      "Review full metabolic panel",
    ],
    outreachStatus: "sent",
    lastEvaluated: "2026-02-07",
    isNew: false,
  },
  {
    id: "MATCH-004",
    patientId: "PAT-004",
    trialId: "DRAP-2026-0042",
    patient: mockPatients[3],
    trial: mockTrials[3],
    eligibilityScore: 78,
    feasibilityScore: 95,
    urgencyFlag: "high",
    overallStatus: "Possibly Eligible",
    reasonsMatched: [
      "At least 2 prior lines of chemotherapy for metastatic disease",
      "ECOG 1 within 0-2 requirement",
      "No active brain metastases",
      "Currently treated at CMH Rawalpindi (trial site)",
    ],
    reasonsFailed: [],
    missingInfo: [
      "Measurable disease assessment per RECIST 1.1",
      "Complete organ function labs",
      "Confirm breast cancer subtype (TNBC vs HR+/HER2-)",
    ],
    doctorChecklist: [
      "Order CT scan for RECIST assessment",
      "Order CBC, CMP, LFTs",
      "Confirm receptor status from original pathology",
    ],
    outreachStatus: "pending",
    lastEvaluated: "2026-02-08",
    isNew: true,
  },
  {
    id: "MATCH-005",
    patientId: "PAT-005",
    trialId: "DRAP-2026-0058",
    patient: mockPatients[4],
    trial: mockTrials[5],
    eligibilityScore: 91,
    feasibilityScore: 72,
    urgencyFlag: "low",
    overallStatus: "Eligible",
    reasonsMatched: [
      "Germline BRCA1 mutation confirmed",
      "HER2-negative confirmed",
      "Prior chemotherapy for metastatic disease completed",
      "ECOG 0 meets 0-1 requirement",
      "Age 35 within 18+ range",
    ],
    reasonsFailed: [],
    missingInfo: ["Confirm adequate organ function labs"],
    doctorChecklist: [
      "Order CBC, CMP, hepatic panel",
      "Confirm most recent imaging results",
    ],
    outreachStatus: "delivered",
    lastEvaluated: "2026-02-06",
    isNew: false,
  },
  {
    id: "MATCH-006",
    patientId: "PAT-001",
    trialId: "DRAP-2026-0042",
    patient: mockPatients[0],
    trial: mockTrials[3],
    eligibilityScore: 71,
    feasibilityScore: 85,
    urgencyFlag: "high",
    overallStatus: "Possibly Eligible",
    reasonsMatched: [
      "At least 1 prior therapy line (trastuzumab + chemo)",
      "ECOG 1 within 0-2 requirement",
      "Located in Karachi (trial site city)",
    ],
    reasonsFailed: [
      "Requires at least 2 prior lines - patient has had 1 confirmed",
    ],
    missingInfo: [
      "Confirm total number of prior therapy lines",
      "Measurable disease per RECIST 1.1",
      "Brain metastasis status",
    ],
    doctorChecklist: [
      "Review complete treatment history",
      "Order brain MRI",
      "Order staging CT for RECIST",
    ],
    outreachStatus: "no_response",
    lastEvaluated: "2026-02-07",
    isNew: false,
  },
];

export const dashboardStats = {
  newMatches: 3,
  highUrgency: 2,
  awaitingInfo: 4,
  outreachPending: 2,
  repliestoday: 1,
  totalPatients: 5,
  totalTrials: 6,
  avgEligibility: 84,
};
