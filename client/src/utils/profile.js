export const HISTORY_KEY = "pulsepath.history";
export const PROFILE_KEY = "pulsepath.profile";

const nameStarts = ["Aarav", "Mira", "Zayan", "Kiara", "Reyansh", "Ira", "Kabir", "Anika"];
const nameEnds = ["Nova", "Vale", "Rune", "Bloom", "Stone", "Ray", "Sage", "Skye"];
const paletteSets = [
  ["#0b65d8", "#54bfa1", "#dff7f0"],
  ["#1162c9", "#ff8e72", "#ffe7df"],
  ["#0e4a96", "#7ee0c4", "#daf8f1"],
  ["#293a8d", "#7ac6ff", "#e8f4ff"],
  ["#0a7ea5", "#78dcb7", "#defaf2"]
];

export function getRandomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `pp-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatTime(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function getUrgencyClass(level) {
  if (level === "Emergency") {
    return "urgency--emergency";
  }
  if (level === "Urgent") {
    return "urgency--urgent";
  }
  return "urgency--normal";
}

function getSafeText(value, fallback = "Not provided") {
  const trimmed = String(value || "").trim();
  return trimmed || fallback;
}

function getTopNearbyCare(result) {
  if (!Array.isArray(result?.nearbyHospitals) || !result.nearbyHospitals.length) {
    return null;
  }

  return result.nearbyHospitals
    .slice()
    .sort((left, right) => {
      const leftScore = Number.isFinite(left?.suitabilityScore) ? left.suitabilityScore : -1;
      const rightScore = Number.isFinite(right?.suitabilityScore) ? right.suitabilityScore : -1;

      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }

      const leftDistance = Number.isFinite(left?.distanceKm) ? left.distanceKm : Number.POSITIVE_INFINITY;
      const rightDistance = Number.isFinite(right?.distanceKm) ? right.distanceKm : Number.POSITIVE_INFINITY;

      return leftDistance - rightDistance;
    })[0];
}

export function getInitials(name) {
  return String(name || "User")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
}

export function generateAvatarDataUrl(seed, name) {
  const safeSeed = String(seed || "pulsepath");
  const hash = Array.from(safeSeed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const colors = paletteSets[hash % paletteSets.length];
  const orbitX = 52 + (hash % 22);
  const orbitY = 46 + (hash % 18);
  const initials = getInitials(name);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${colors[0]}"/>
          <stop offset="100%" stop-color="${colors[1]}"/>
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="32" fill="url(#g)"/>
      <circle cx="${orbitX}" cy="${orbitY}" r="34" fill="${colors[2]}" opacity="0.55"/>
      <circle cx="89" cy="29" r="9" fill="#ffffff" opacity="0.24"/>
      <path d="M24 87c11-12 24-18 38-18s27 6 38 18" fill="none" stroke="#ffffff" stroke-opacity="0.28" stroke-width="8" stroke-linecap="round"/>
      <circle cx="60" cy="47" r="18" fill="#ffffff" opacity="0.2"/>
      <text x="60" y="73" text-anchor="middle" font-family="Space Grotesk, Arial, sans-serif" font-size="30" font-weight="700" fill="#ffffff">${initials}</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function createRandomProfile() {
  const seed = getRandomId();
  const hash = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const start = nameStarts[hash % nameStarts.length];
  const end = nameEnds[(hash * 7) % nameEnds.length];
  const suffix = String((hash % 89) + 11);

  return {
    id: seed,
    avatarSeed: seed.slice(0, 12),
    displayName: `${start} ${end} ${suffix}`,
    age: "",
    heightCm: "",
    weightKg: "",
    gender: "",
    bloodGroup: "",
    allergies: "",
    currentMedicines: "",
    chronicConditions: "",
    emergencyContactName: "",
    emergencyContactRelation: "",
    emergencyContactPhone: "",
    notes: "",
    createdAt: new Date().toISOString()
  };
}

export function normalizeProfile(rawProfile) {
  const base = createRandomProfile();

  if (!rawProfile || typeof rawProfile !== "object") {
    return base;
  }

  return {
    ...base,
    ...rawProfile,
    id: rawProfile.id || base.id,
    avatarSeed: rawProfile.avatarSeed || rawProfile.id || base.avatarSeed,
    displayName: rawProfile.displayName || base.displayName,
    age: rawProfile.age ?? "",
    heightCm: rawProfile.heightCm ?? "",
    weightKg: rawProfile.weightKg ?? "",
    gender: rawProfile.gender ?? "",
    bloodGroup: rawProfile.bloodGroup ?? "",
    allergies: rawProfile.allergies ?? "",
    currentMedicines: rawProfile.currentMedicines ?? "",
    chronicConditions: rawProfile.chronicConditions ?? "",
    emergencyContactName: rawProfile.emergencyContactName ?? "",
    emergencyContactRelation: rawProfile.emergencyContactRelation ?? "",
    emergencyContactPhone: rawProfile.emergencyContactPhone ?? "",
    notes: rawProfile.notes ?? ""
  };
}

export function buildEmergencyCard(profile) {
  return {
    displayName: getSafeText(profile?.displayName, "Local user"),
    age: getSafeText(profile?.age),
    gender: getSafeText(profile?.gender),
    bloodGroup: getSafeText(profile?.bloodGroup),
    allergies: getSafeText(profile?.allergies, "None recorded"),
    currentMedicines: getSafeText(profile?.currentMedicines, "None recorded"),
    chronicConditions: getSafeText(profile?.chronicConditions, "None recorded"),
    emergencyContactName: getSafeText(profile?.emergencyContactName),
    emergencyContactRelation: getSafeText(profile?.emergencyContactRelation),
    emergencyContactPhone: getSafeText(profile?.emergencyContactPhone),
    notes: getSafeText(profile?.notes, "No additional notes")
  };
}

export function toEmergencyCardText(profile) {
  const card = buildEmergencyCard(profile);

  return [
    "PulsePath Offline Emergency Card",
    "",
    `Name: ${card.displayName}`,
    `Age: ${card.age}`,
    `Gender: ${card.gender}`,
    `Blood group: ${card.bloodGroup}`,
    `Allergies: ${card.allergies}`,
    `Current medicines: ${card.currentMedicines}`,
    `Chronic conditions: ${card.chronicConditions}`,
    `Emergency contact: ${card.emergencyContactName}`,
    `Emergency contact relation: ${card.emergencyContactRelation}`,
    `Emergency contact phone: ${card.emergencyContactPhone}`,
    `Notes: ${card.notes}`,
    "",
    "Stored locally for offline access in the installed PulsePath PWA."
  ].join("\n");
}

export function buildDoctorHandoff(result, profile) {
  const topCare = getTopNearbyCare(result);
  const card = buildEmergencyCard(profile);

  return {
    title: `${result?.urgency?.level || "Pending"} handoff summary`,
    lines: [
      { label: "Patient", value: card.displayName },
      { label: "Urgency", value: `${result?.urgency?.level || "Pending"} - ${result?.urgency?.advice || "Awaiting analysis"}` },
      { label: "Symptoms", value: (result?.symptoms || []).join(", ") || "Not captured" },
      { label: "Suggested doctor", value: result?.recommendedDoctor?.specialty || "General Physician" },
      { label: "Possible conditions", value: (result?.possibleConditions || []).slice(0, 3).map((item) => item.name).join(", ") || "None yet" },
      { label: "Allergies", value: card.allergies },
      { label: "Current medicines", value: card.currentMedicines },
      { label: "Chronic conditions", value: card.chronicConditions },
      {
        label: "Best nearby care",
        value: topCare
          ? `${topCare.name}${typeof topCare.distanceKm === "number" ? ` (${topCare.distanceKm.toFixed(1)} km)` : ""}`
          : "No nearby care selected"
      },
      {
        label: "Safety flags",
        value: (result?.safetyChecks || []).length
          ? result.safetyChecks.map((item) => item.title).join(", ")
          : "None flagged"
      },
      { label: "Location", value: result?.locationContext?.label || "Not captured" }
    ]
  };
}

export function toHandoffText(result, profile) {
  if (!result) {
    return "";
  }

  const handoff = buildDoctorHandoff(result, profile);

  return [
    "PulsePath Doctor Handoff Summary",
    "",
    ...handoff.lines.map((item) => `${item.label}: ${item.value}`),
    "",
    `Summary: ${result.summary || "No summary available."}`,
    "",
    "Next steps:",
    ...(result.nextSteps || []).map((item) => `- ${item}`),
    "",
    "Safety checks:",
    ...((result.safetyChecks || []).length
      ? result.safetyChecks.map((item) => `- [${item.severity}] ${item.title}: ${item.detail}`)
      : ["- None flagged"]),
    "",
    "Nearby care:",
    ...(result.nearbyHospitals || []).slice(0, 3).map((item) => {
      const score = typeof item.suitabilityScore === "number" ? `score ${item.suitabilityScore}` : null;
      return `- ${[item.name, item.type, score, item.address || item.area].filter(Boolean).join(" | ")}`;
    })
  ].join("\n");
}

export function normalizeHistoryEntry(entry) {
  if (!entry || typeof entry !== "object" || !entry.result) {
    return null;
  }

  return {
    id: entry.id || getRandomId(),
    createdAt: entry.createdAt || new Date().toISOString(),
    input: entry.input || "",
    location: entry.location || "Unknown",
    language: entry.language || "English",
    photoName: entry.photoName || "",
    photoPreview: entry.photoPreview || "",
    profileSnapshot: normalizeProfile(entry.profileSnapshot || {}),
    result: {
      summary: entry.result.summary || "No summary available.",
      urgency: {
        level: entry.result.urgency?.level || "Normal",
        advice: entry.result.urgency?.advice || "Review the triage output carefully."
      },
      recommendedDoctor: {
        specialty: entry.result.recommendedDoctor?.specialty || "General Physician",
        reason: entry.result.recommendedDoctor?.reason || ""
      },
      symptoms: Array.isArray(entry.result.symptoms) ? entry.result.symptoms : [],
      possibleConditions: Array.isArray(entry.result.possibleConditions)
        ? entry.result.possibleConditions
        : [],
      nextSteps: Array.isArray(entry.result.nextSteps) ? entry.result.nextSteps : [],
      followUpQuestions: Array.isArray(entry.result.followUpQuestions)
        ? entry.result.followUpQuestions
        : [],
      imageObservations: Array.isArray(entry.result.imageObservations)
        ? entry.result.imageObservations
        : [],
      safetyChecks: Array.isArray(entry.result.safetyChecks) ? entry.result.safetyChecks : [],
      nearbyHospitals: Array.isArray(entry.result.nearbyHospitals)
        ? entry.result.nearbyHospitals
        : [],
      locationContext: entry.result.locationContext || null,
      disclaimer: entry.result.disclaimer || ""
    }
  };
}

export function loadStoredHistory() {
  try {
    const stored = window.localStorage.getItem(HISTORY_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeHistoryEntry).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function loadStoredProfile() {
  try {
    const stored = window.localStorage.getItem(PROFILE_KEY);
    return stored ? normalizeProfile(JSON.parse(stored)) : createRandomProfile();
  } catch {
    return createRandomProfile();
  }
}

export function toReportText(result, profile) {
  if (!result) {
    return "";
  }

  return [
    "PulsePath Symptom Routing Report",
    "",
    `User: ${profile.displayName}`,
    `Age: ${profile.age || "Not provided"}`,
    `Height: ${profile.heightCm || "Not provided"} cm`,
    `Weight: ${profile.weightKg || "Not provided"} kg`,
    "",
    `Summary: ${result.summary}`,
    `Urgency: ${result.urgency.level}`,
    `Advice: ${result.urgency.advice}`,
    `Recommended doctor: ${result.recommendedDoctor.specialty}`,
    `Blood group: ${getSafeText(profile?.bloodGroup)}`,
    `Allergies: ${getSafeText(profile?.allergies, "None recorded")}`,
    `Current medicines: ${getSafeText(profile?.currentMedicines, "None recorded")}`,
    result.locationContext?.label ? `Location used: ${result.locationContext.label}` : "",
    result.locationContext?.coordinates
      ? `Coordinates: ${result.locationContext.coordinates.lat}, ${result.locationContext.coordinates.lng}`
      : "",
    "",
    "Detected symptoms:",
    ...(result.symptoms || []).map((item) => `- ${item}`),
    "",
    "Possible conditions:",
    ...(result.possibleConditions || []).map(
      (item) => `- ${item.name} (${item.probability}): ${item.reason}`
    ),
    "",
    "Next steps:",
    ...(result.nextSteps || []).map((item) => `- ${item}`),
    "",
    "Safety checks:",
    ...((result.safetyChecks || []).length
      ? result.safetyChecks.map((item) => `- [${item.severity}] ${item.title}: ${item.detail}`)
      : ["- None flagged"]),
    "",
    "Nearby care:",
    ...(result.nearbyHospitals || []).map((item) => {
      const line = [
        item.name,
        item.type,
        typeof item.distanceKm === "number" ? `${item.distanceKm.toFixed(1)} km` : null,
        typeof item.suitabilityScore === "number" ? `score ${item.suitabilityScore}` : null,
        item.address || item.area
      ].filter(Boolean);

      return `- ${line.join(" | ")}`;
    }),
    "",
    "Disclaimer:",
    result.disclaimer
  ]
    .filter(Boolean)
    .join("\n");
}
