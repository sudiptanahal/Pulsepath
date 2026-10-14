import { buildSafetyChecks, enrichCareOptions, refineUrgencyWithSafetyChecks } from "./careInsights.js";

const COMMON_SYMPTOMS = [
  "fever",
  "headache",
  "cough",
  "fatigue",
  "shortness of breath",
  "breathing difficulty",
  "chest pain",
  "rash",
  "itching",
  "vomiting",
  "nausea",
  "diarrhea",
  "stomach pain",
  "abdominal pain",
  "sore throat",
  "dizziness",
  "swelling",
  "redness",
  "burning urination",
  "joint pain",
  "back pain",
  "eye redness"
];

const EMERGENCY_PATTERNS = [
  {
    keywords: ["chest pain", "shortness of breath", "difficulty breathing"],
    advice: "Seek emergency care immediately or call local emergency services."
  },
  {
    keywords: ["stroke", "face drooping", "slurred speech", "arm weakness"],
    advice: "This may indicate a stroke. Go to emergency care immediately."
  },
  {
    keywords: ["severe bleeding", "unconscious", "fainted", "seizure"],
    advice: "Emergency evaluation is needed immediately."
  }
];

const CONDITION_RULES = [
  {
    doctor: "General Physician",
    urgency: "Normal",
    conditions: [
      { name: "Viral Fever", probability: "High" },
      { name: "Seasonal Flu", probability: "Medium" }
    ],
    keywords: ["fever", "headache", "fatigue", "body pain", "cough", "sore throat"],
    nextSteps: [
      "Monitor temperature, hydration, and breathing changes.",
      "Consult a physician if symptoms worsen or last more than 2 to 3 days.",
      "Use local emergency care sooner if breathing becomes difficult."
    ]
  },
  {
    doctor: "Dermatologist",
    urgency: "Normal",
    conditions: [
      { name: "Allergic Rash", probability: "High" },
      { name: "Contact Dermatitis", probability: "Medium" }
    ],
    keywords: ["rash", "itching", "redness", "skin", "spots", "blisters"],
    nextSteps: [
      "Keep the area clean and avoid new creams unless prescribed.",
      "Share how quickly the rash spread and whether there is fever.",
      "Urgent review is needed if swelling affects lips, eyes, or breathing."
    ]
  },
  {
    doctor: "Cardiologist",
    urgency: "Emergency",
    conditions: [
      { name: "Acute Cardiac Issue", probability: "High" },
      { name: "Severe Respiratory Distress", probability: "Medium" }
    ],
    keywords: ["chest pain", "shortness of breath", "pressure", "left arm", "tightness"],
    nextSteps: [
      "Do not wait for an outpatient appointment.",
      "Go to emergency services immediately.",
      "Avoid exertion while arranging urgent transport."
    ]
  },
  {
    doctor: "Gastroenterologist",
    urgency: "Urgent",
    conditions: [
      { name: "Gastroenteritis", probability: "High" },
      { name: "Food Poisoning", probability: "Medium" }
    ],
    keywords: ["vomiting", "diarrhea", "stomach pain", "abdominal pain", "nausea"],
    nextSteps: [
      "Watch for dehydration, reduced urination, or persistent vomiting.",
      "Consult a doctor within 24 hours if symptoms are moderate or ongoing.",
      "Emergency care is needed for blood in vomit or severe weakness."
    ]
  },
  {
    doctor: "Urologist",
    urgency: "Urgent",
    conditions: [
      { name: "Urinary Tract Infection", probability: "High" },
      { name: "Kidney Irritation", probability: "Medium" }
    ],
    keywords: ["burning urination", "urination", "pelvic pain", "frequent urination", "urine"],
    nextSteps: [
      "Share if there is fever, flank pain, or blood in urine.",
      "Plan a consultation within 24 hours.",
      "Urgent care is needed sooner for fever with severe back pain."
    ]
  },
  {
    doctor: "Ophthalmologist",
    urgency: "Urgent",
    conditions: [
      { name: "Conjunctival Irritation", probability: "Medium" },
      { name: "Eye Infection", probability: "Medium" }
    ],
    keywords: ["eye redness", "eye pain", "blurred vision", "watery eye"],
    nextSteps: [
      "Avoid rubbing the eye and do not share eye products.",
      "Seek urgent review if vision is reduced or pain is severe.",
      "Mention discharge, trauma, or contact lens use."
    ]
  }
];

const HOSPITAL_DIRECTORY = {
  kolkata: [
    {
      name: "Apollo Multispeciality Hospital",
      distanceKm: 2.4,
      area: "Canal Circular Road",
      specialties: ["General Physician", "Cardiologist", "Dermatologist"]
    },
    {
      name: "AMRI Salt Lake",
      distanceKm: 4.1,
      area: "Salt Lake",
      specialties: ["Gastroenterologist", "General Physician", "Emergency"]
    },
    {
      name: "Medica Superspecialty Hospital",
      distanceKm: 5.3,
      area: "Mukundapur",
      specialties: ["Cardiologist", "Urologist", "Emergency"]
    }
  ],
  delhi: [
    {
      name: "Max Super Speciality Hospital",
      distanceKm: 2.8,
      area: "Saket",
      specialties: ["General Physician", "Cardiologist", "Dermatologist"]
    },
    {
      name: "Apollo Hospital Delhi",
      distanceKm: 5.4,
      area: "Sarita Vihar",
      specialties: ["Emergency", "Gastroenterologist", "Urologist"]
    }
  ],
  bangalore: [
    {
      name: "Manipal Hospital",
      distanceKm: 3.1,
      area: "Old Airport Road",
      specialties: ["General Physician", "Cardiologist", "Dermatologist"]
    },
    {
      name: "Aster CMI Hospital",
      distanceKm: 6.2,
      area: "Hebbal",
      specialties: ["Emergency", "Gastroenterologist", "Ophthalmologist"]
    }
  ],
  default: [
    {
      name: "City Care Multispeciality Clinic",
      distanceKm: 2.2,
      area: "Central District",
      specialties: ["General Physician", "Dermatologist", "Gastroenterologist"]
    },
    {
      name: "Sunrise Emergency Hospital",
      distanceKm: 5,
      area: "North Avenue",
      specialties: ["Emergency", "Cardiologist", "General Physician"]
    },
    {
      name: "HealthBridge Specialty Center",
      distanceKm: 6.8,
      area: "Lake Road",
      specialties: ["Urologist", "Ophthalmologist", "Dermatologist"]
    }
  ]
};

function normalizeText(value = "") {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function extractSymptoms(text) {
  const normalized = normalizeText(text);
  const detected = COMMON_SYMPTOMS.filter((symptom) => normalized.includes(symptom));

  if (normalized.includes("body pain")) {
    detected.push("body pain");
  }

  return [...new Set(detected)];
}

function detectEmergency(text) {
  const normalized = normalizeText(text);

  for (const pattern of EMERGENCY_PATTERNS) {
    if (pattern.keywords.some((keyword) => normalized.includes(keyword))) {
      return {
        level: "Emergency",
        advice: pattern.advice
      };
    }
  }

  return null;
}

function chooseRules(message, symptoms) {
  const normalized = normalizeText(message);

  return CONDITION_RULES.map((rule) => ({
    ...rule,
    score: rule.keywords.reduce((score, keyword) => {
      if (normalized.includes(keyword)) {
        return score + 2;
      }

      if (symptoms.includes(keyword)) {
        return score + 1;
      }

      return score;
    }, 0)
  }))
    .filter((rule) => rule.score > 0)
    .sort((left, right) => right.score - left.score);
}

function buildNearbyHospitals(location, { urgencyLevel = "Normal", recommendedSpecialty = "" } = {}) {
  const locationText =
    typeof location === "string"
      ? location
      : location?.city || location?.label || "default";

  const key = normalizeText(locationText).split(",")[0];
  const pool = HOSPITAL_DIRECTORY[key] || HOSPITAL_DIRECTORY.default;

  const enriched = pool.map((item) => ({
      ...item,
      type: item.name.toLowerCase().includes("clinic") ? "Clinic" : "Hospital",
      address: item.area,
      emergencyReady: item.specialties.includes("Emergency"),
      source: "Static fallback",
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name}, ${item.area}`)}`
    }));

  return enrichCareOptions(enriched, { urgencyLevel, recommendedSpecialty }).sort(
    (left, right) => left.distanceKm - right.distanceKm
  );
}

function buildLocationContext(location) {
  if (typeof location === "string") {
    return {
      label: location,
      displayName: location,
      coordinates: null,
      accuracyMeters: null,
      mapUrl: "",
      dataSource: "Static fallback",
      searchRadiusKm: null,
      mode: "manual"
    };
  }

  const coords =
    location?.coords?.lat !== undefined && location?.coords?.lng !== undefined
      ? {
          lat: Number(location.coords.lat),
          lng: Number(location.coords.lng)
        }
      : null;

  return {
    label: location?.city || location?.label || "Current location",
    displayName: location?.city || location?.label || "Current location",
    coordinates: coords,
    accuracyMeters:
      Number.isFinite(Number(location?.coords?.accuracyMeters))
        ? Math.round(Number(location.coords.accuracyMeters))
        : null,
    mapUrl: coords
      ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`
      : "",
    dataSource: "Static fallback",
    searchRadiusKm: null,
    mode: coords ? "gps" : "manual"
  };
}

function buildFollowUps(symptoms, message, profile) {
  const prompts = [];
  const normalized = normalizeText(message);

  if (!normalized.includes("day") && !normalized.includes("week") && !normalized.includes("month")) {
    prompts.push("How long have these symptoms been present?");
  }

  if (!normalized.includes("severe") && !normalized.includes("mild")) {
    prompts.push("Would you describe the discomfort as mild, moderate, or severe?");
  }

  if (symptoms.includes("fever")) {
    prompts.push("What is the highest temperature you recorded, if any?");
  }

  if (symptoms.includes("rash") || symptoms.includes("itching")) {
    prompts.push("Is the rash spreading, painful, or associated with swelling or fever?");
  }

  if (!profile?.age) {
    prompts.push("What is the user's age?");
  }

  return prompts.slice(0, 4);
}

function buildProfileNotes(profile) {
  if (!profile) {
    return [];
  }

  const notes = [];
  const age = Number(profile.age || 0);

  if (age >= 60) {
    notes.push("Because the user is older, arrange earlier clinical review if symptoms persist or worsen.");
  }

  if (age > 0 && age <= 12) {
    notes.push("Because this may involve a child, consider faster pediatric review if symptoms continue.");
  }

  if (profile.notes) {
    notes.push("Use the saved medical notes during clinician follow-up.");
  }

  return notes;
}

export function analyzeLocally({ message = "", imageDataUrl = "", location = "Kolkata", profile = null }) {
  const normalized = normalizeText(message);
  const symptoms = extractSymptoms(normalized);
  const emergency = detectEmergency(normalized);
  const matchedRules = chooseRules(message, symptoms);
  const primaryRule = matchedRules[0];
  const defaultDoctor = primaryRule?.doctor || "General Physician";

  const baseUrgency =
    emergency ||
    (primaryRule
      ? {
          level: primaryRule.urgency,
          advice:
            primaryRule.urgency === "Urgent"
              ? "Consult a doctor within 24 hours."
              : "Schedule a consultation soon and monitor for changes."
        }
      : {
          level: "Normal",
          advice: "Start with a general physician and answer follow-up questions for better routing."
        });
  const safetyChecks = buildSafetyChecks({ message, symptoms, profile });
  const urgency = refineUrgencyWithSafetyChecks(baseUrgency, safetyChecks);

  const possibleConditions = matchedRules.length
    ? matchedRules.slice(0, 3).flatMap((rule) =>
        rule.conditions.map((condition) => ({
          ...condition,
          reason: `Suggested because your symptoms align with ${rule.doctor.toLowerCase()} routing patterns.`
        }))
      )
    : [
        {
          name: "General Viral or Inflammatory Issue",
          probability: "Low",
          reason: "More detail is needed to narrow the care path."
        }
      ];

  const recommendedDoctor = {
    specialty: defaultDoctor,
    reason:
      defaultDoctor === "General Physician"
        ? "This is the safest first contact when symptoms are still broad or unclear."
        : `Your symptom pattern aligns most closely with ${defaultDoctor.toLowerCase()} care.`
  };

  return {
    source: "client-fallback",
    summary:
      urgency.level === "Emergency"
        ? "This symptom pattern includes possible red flags and should be treated as emergency care."
        : `The current symptom pattern is most consistent with a ${defaultDoctor.toLowerCase()} review${profile?.age ? ` for a ${profile.age}-year-old user` : ""}.`,
    symptoms: symptoms.length ? symptoms : ["symptoms require more detail"],
    possibleConditions,
    recommendedDoctor,
    urgency,
    followUpQuestions: buildFollowUps(symptoms, message, profile),
    imageObservations: imageDataUrl
      ? [
        "A symptom photo was attached. Visible clues can help with skin, swelling, redness, or wound routing, but a clinician should confirm findings."
        ]
      : [],
    safetyChecks,
    nextSteps: [...(primaryRule?.nextSteps || [
      "Share when the symptoms started and whether they are getting worse.",
      "Start with a general physician for an in-person assessment.",
      "Seek urgent care sooner if red-flag symptoms appear."
    ]), ...buildProfileNotes(profile)].slice(0, 5),
    nearbyHospitals: buildNearbyHospitals(location, {
      urgencyLevel: urgency.level,
      recommendedSpecialty: recommendedDoctor.specialty
    }),
    locationContext: buildLocationContext(location),
    disclaimer:
      "PulsePath is giving an on-device fallback triage result because the live analysis service is unavailable. This does not diagnose disease, and emergency symptoms should always be escalated immediately."
  };
}
