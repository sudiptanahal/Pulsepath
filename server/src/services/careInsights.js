function normalizeText(value = "") {
  return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function splitList(value = "") {
  return String(value)
    .split(/[,;\n/]+/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function listIncludesAny(values, keywords) {
  return values.some((value) =>
    keywords.some((keyword) => value.includes(keyword) || keyword.includes(value))
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createSafetyCheck(collection, seen, id, severity, title, detail) {
  if (seen.has(id)) {
    return;
  }

  seen.add(id);
  collection.push({
    severity,
    title,
    detail
  });
}

function buildSuitabilityReason(reasons) {
  return reasons.slice(0, 2).join(", ") || "Useful nearby option";
}

export function buildSafetyChecks({ message = "", symptoms = [], profile = null }) {
  const normalizedMessage = normalizeText(message);
  const normalizedSymptoms = symptoms.map((item) => normalizeText(item));
  const symptomText = [normalizedMessage, ...normalizedSymptoms].filter(Boolean).join(" ");
  const medicines = splitList(profile?.currentMedicines);
  const allergies = splitList(profile?.allergies);
  const chronicConditions = splitList(profile?.chronicConditions);
  const notes = normalizeText(profile?.notes);
  const safetyChecks = [];
  const seen = new Set();

  if (
    listIncludesAny(medicines, [
      "warfarin",
      "blood thinner",
      "apixaban",
      "rivaroxaban",
      "dabigatran",
      "heparin",
      "clopidogrel",
      "aspirin"
    ]) &&
    includesAny(symptomText, [
      "bleeding",
      "blood",
      "head injury",
      "fall",
      "black stool",
      "blood in urine",
      "vomit blood"
    ])
  ) {
    createSafetyCheck(
      safetyChecks,
      seen,
      "blood-thinner-risk",
      "High",
      "Bleeding risk with blood thinners",
      "The saved medicine list suggests blood-thinner use, so bleeding, falls, or head injury need faster clinician review."
    );
  }

  if (
    (listIncludesAny(medicines, ["insulin", "metformin", "glimepiride", "gliclazide"]) ||
      listIncludesAny(chronicConditions, ["diabetes"])) &&
    includesAny(symptomText, ["dizziness", "sweating", "confusion", "fainting", "shaking", "weakness"])
  ) {
    createSafetyCheck(
      safetyChecks,
      seen,
      "diabetes-low-sugar",
      "Medium",
      "Possible low blood sugar or diabetes-related risk",
      "Because diabetes medicines or diabetes history are recorded, dizziness, sweating, confusion, or fainting should be checked sooner."
    );
  }

  if (
    (listIncludesAny(medicines, ["prednisone", "steroid", "methotrexate", "chemotherapy", "immunosuppressant"]) ||
      listIncludesAny(chronicConditions, ["cancer", "transplant", "low immunity", "immunocompromised"])) &&
    includesAny(symptomText, ["fever", "cough", "wound", "infection", "redness", "swelling"])
  ) {
    createSafetyCheck(
      safetyChecks,
      seen,
      "immune-risk",
      "Medium",
      "Lower immunity may raise infection risk",
      "Steroids, chemotherapy, or low-immunity conditions can make fever, cough, wounds, or redness more important to review early."
    );
  }

  if (
    listIncludesAny(medicines, ["ibuprofen", "diclofenac", "naproxen", "ketorolac"]) &&
    includesAny(symptomText, ["stomach pain", "abdominal pain", "vomiting", "black stool", "blood"])
  ) {
    createSafetyCheck(
      safetyChecks,
      seen,
      "nsaid-stomach-risk",
      "Medium",
      "Pain medicines may worsen stomach irritation",
      "With NSAID-type medicines on file, stomach pain, vomiting, or bleeding symptoms deserve more caution."
    );
  }

  if (
    allergies.length &&
    includesAny(symptomText, [
      "rash",
      "itching",
      "swelling",
      "hives",
      "shortness of breath",
      "breathing difficulty",
      "lip swelling",
      "face swelling"
    ])
  ) {
    const severeReaction = includesAny(symptomText, [
      "shortness of breath",
      "breathing difficulty",
      "lip swelling",
      "face swelling"
    ]);

    createSafetyCheck(
      safetyChecks,
      seen,
      "allergy-risk",
      severeReaction ? "High" : "Medium",
      severeReaction ? "Possible severe allergy reaction" : "Symptoms may match a recorded allergy",
      severeReaction
        ? "Because allergies are recorded and breathing or facial swelling is mentioned, urgent allergy-safe medical review is important."
        : "The saved allergy history may be relevant to the current rash, itching, or swelling."
    );
  }

  if (
    (listIncludesAny(chronicConditions, ["asthma", "copd"]) || notes.includes("asthma")) &&
    includesAny(symptomText, ["shortness of breath", "breathing difficulty", "wheezing", "chest tightness", "cough"])
  ) {
    createSafetyCheck(
      safetyChecks,
      seen,
      "breathing-risk",
      "High",
      "Breathing symptoms with asthma or lung disease history",
      "Recorded asthma or lung disease makes breathing symptoms more concerning and worth earlier review."
    );
  }

  if (
    (listIncludesAny(chronicConditions, ["pregnancy", "pregnant"]) || notes.includes("pregnan")) &&
    includesAny(symptomText, ["bleeding", "abdominal pain", "dizziness", "fainting"])
  ) {
    createSafetyCheck(
      safetyChecks,
      seen,
      "pregnancy-risk",
      "High",
      "Pregnancy-related caution",
      "Because pregnancy is mentioned in the saved profile, bleeding, abdominal pain, dizziness, or fainting should not be ignored."
    );
  }

  return safetyChecks.slice(0, 4);
}

export function refineUrgencyWithSafetyChecks(urgency, safetyChecks) {
  if (!urgency || !Array.isArray(safetyChecks) || !safetyChecks.length) {
    return urgency;
  }

  const hasHighRisk = safetyChecks.some((item) => item.severity === "High");
  const hasSevereAllergyRisk = safetyChecks.some((item) =>
    item.title.toLowerCase().includes("severe allergy")
  );

  if (hasSevereAllergyRisk) {
    return {
      level: "Emergency",
      advice: "The saved allergy profile plus current symptoms may indicate a severe reaction. Use emergency care immediately."
    };
  }

  if (hasHighRisk && urgency.level === "Normal") {
    return {
      level: "Urgent",
      advice: "The symptom pattern plus saved medicines or conditions suggest earlier clinician review is safer."
    };
  }

  return urgency;
}

export function enrichCareOptions(items = [], { urgencyLevel = "Normal", recommendedSpecialty = "" } = {}) {
  const specialtyText = normalizeText(recommendedSpecialty);

  return items.map((item) => {
    const normalizedType = normalizeText(item.type || "Hospital");
    const specialties = Array.isArray(item.specialties) ? item.specialties : [];
    const normalizedSpecialties = specialties.map((entry) => normalizeText(entry));
    const distanceKm = Number(item.distanceKm);
    const reasons = [];
    let score = 42;

    if (
      specialtyText &&
      specialtyText !== "general physician" &&
      normalizedSpecialties.some(
        (entry) => entry.includes(specialtyText) || specialtyText.includes(entry)
      )
    ) {
      score += 24;
      reasons.push(`matches ${recommendedSpecialty.toLowerCase()} care`);
    } else if (specialtyText === "general physician") {
      score += 10;
      reasons.push("works for first-contact review");
    }

    if (item.emergencyReady) {
      score += urgencyLevel === "Emergency" ? 22 : 10;
      reasons.push("emergency-ready");
    } else if (urgencyLevel === "Emergency") {
      score -= 10;
    }

    if (normalizedType === "hospital") {
      score += 10;
      reasons.push("hospital-level facility");
    } else {
      score += 4;
    }

    if (Number.isFinite(distanceKm)) {
      score += clamp(24 - Math.round(distanceKm * 3), 4, 24);

      if (distanceKm <= 1.5) {
        reasons.push("very close to current location");
      } else if (distanceKm <= 4) {
        reasons.push("close to current location");
      }
    }

    const suitabilityScore = clamp(Math.round(score), 28, 99);
    const suitabilityLabel =
      suitabilityScore >= 82 ? "Strong match" : suitabilityScore >= 68 ? "Good match" : "Nearby option";

    return {
      ...item,
      suitabilityScore,
      suitabilityLabel,
      suitabilityReason: buildSuitabilityReason(reasons)
    };
  });
}
