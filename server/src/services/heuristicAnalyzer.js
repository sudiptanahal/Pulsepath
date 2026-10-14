import {
  COMMON_SYMPTOMS,
  CONDITION_RULES,
  EMERGENCY_PATTERNS,
  HOSPITAL_DIRECTORY
} from "../data/medicalKnowledge.js";
import { buildSafetyChecks, enrichCareOptions, refineUrgencyWithSafetyChecks } from "./careInsights.js";

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
    const matches = pattern.keywords.filter((keyword) => normalized.includes(keyword));
    if (matches.length >= 1) {
      return {
        level: "Emergency",
        advice: pattern.advice
      };
    }
  }

  return null;
}

function scoreRule(rule, normalizedText, symptoms) {
  return rule.keywords.reduce((score, keyword) => {
    if (normalizedText.includes(keyword)) {
      return score + 2;
    }

    if (symptoms.includes(keyword)) {
      return score + 1;
    }

    return score;
  }, 0);
}

function chooseRules(message, symptoms) {
  const normalized = normalizeText(message);

  return CONDITION_RULES.map((rule) => ({
    ...rule,
    score: scoreRule(rule, normalized, symptoms)
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

function buildFollowUps(symptoms, message) {
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

  return prompts.slice(0, 3);
}

function buildProfileNotes(profile) {
  if (!profile) {
    return [];
  }

  const notes = [];
  const age = Number(profile.age || 0);

  if (age >= 60) {
    notes.push("Because the user is older, advise earlier clinical review if symptoms persist or worsen.");
  }

  if (age > 0 && age <= 12) {
    notes.push("Because this may involve a child, prompt for faster pediatric review if symptoms are ongoing.");
  }

  if (profile.notes) {
    notes.push("User-added medical notes were provided and should be considered during clinician follow-up.");
  }

  return notes;
}

export function analyzeHeuristically({ message = "", imageDataUrl = "", location = "Kolkata", profile = null }) {
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
          reason: `Suggested because your message matches symptoms commonly routed to ${rule.doctor.toLowerCase()}.`
        }))
      )
    : [
        {
          name: "General Viral or Inflammatory Issue",
          probability: "Low",
          reason: "More information is needed to suggest a narrower care path."
        }
      ];

  const imageObservations = imageDataUrl
    ? [
        "A symptom photo was attached. Visible signs can help route skin, swelling, wound, or redness complaints, but a clinician should confirm findings."
      ]
    : [];

  const nextSteps = primaryRule?.nextSteps || [
    "Share when the symptoms started and whether they are getting worse.",
    "Start with a general physician for an in-person assessment.",
    "Seek urgent care sooner if red-flag symptoms appear."
  ];

  const personalizedNotes = buildProfileNotes(profile);

  const recommendedDoctor = {
    specialty: defaultDoctor,
    reason:
      defaultDoctor === "General Physician"
        ? "This is the safest first contact when symptoms are broad or still unclear."
        : `Your symptom pattern aligns most closely with ${defaultDoctor.toLowerCase()} care.`
  };

  return {
    source: "heuristic-fallback",
    summary:
      urgency.level === "Emergency"
        ? "Your symptom pattern includes possible red flags and should be treated as emergency care."
        : `The current symptom pattern is most consistent with a ${recommendedDoctor.specialty.toLowerCase()} review${profile?.age ? ` for a ${profile.age}-year-old user` : ""}.`,
    symptoms: symptoms.length ? symptoms : ["symptoms require more detail"],
    possibleConditions,
    recommendedDoctor,
    urgency,
    followUpQuestions: [...buildFollowUps(symptoms, message), ...(profile?.age ? [] : ["What is the user's age?"])].slice(0, 4),
    imageObservations,
    safetyChecks,
    nextSteps: [...nextSteps, ...personalizedNotes].slice(0, 5),
    nearbyHospitals: buildNearbyHospitals(location, {
      urgencyLevel: urgency.level,
      recommendedSpecialty: recommendedDoctor.specialty
    }),
    locationContext: buildLocationContext(location),
    disclaimer:
      "PulsePath is a decision-support experience and does not diagnose disease. If symptoms feel severe, rapidly worsen, or involve breathing difficulty, chest pain, confusion, or heavy bleeding, use emergency services immediately."
  };
}
