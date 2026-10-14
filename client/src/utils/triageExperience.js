function normalizeText(value = "") {
  return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function splitList(value = "") {
  return String(value)
    .split(/[,;\n/]+/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

const MEDICINE_CATALOG = [
  {
    ingredient: "paracetamol",
    aliases: ["paracetamol", "acetaminophen", "dolo", "dolo 650", "crocin", "calpol"],
    className: "Pain and fever relief"
  },
  {
    ingredient: "ibuprofen",
    aliases: ["ibuprofen", "brufen", "combiflam"],
    className: "NSAID pain relief"
  },
  {
    ingredient: "amoxicillin clavulanate",
    aliases: ["augmentin", "amoxyclav", "amoxyclav 625", "amoxicillin"],
    className: "Penicillin antibiotic"
  },
  {
    ingredient: "cetirizine",
    aliases: ["cetirizine", "cetcip", "okacet"],
    className: "Antihistamine"
  },
  {
    ingredient: "fexofenadine",
    aliases: ["fexofenadine", "allegra"],
    className: "Antihistamine"
  },
  {
    ingredient: "pantoprazole",
    aliases: ["pantoprazole", "pantocid", "pan"],
    className: "Acid suppression"
  },
  {
    ingredient: "metformin",
    aliases: ["metformin", "glyciphage", "gluformin"],
    className: "Diabetes medicine"
  },
  {
    ingredient: "insulin",
    aliases: ["insulin", "novorapid", "lantus", "huminsulin"],
    className: "Diabetes medicine"
  },
  {
    ingredient: "amlodipine",
    aliases: ["amlodipine", "amlong", "amcard"],
    className: "Blood pressure medicine"
  },
  {
    ingredient: "warfarin",
    aliases: ["warfarin", "nicoumalone", "acenocoumarol", "blood thinner"],
    className: "Blood thinner"
  }
];

const RED_FLAG_RULES = [
  {
    id: "chest-breathing",
    keywords: ["chest pain", "shortness of breath", "difficulty breathing", "breathing trouble", "chest tightness"],
    title: "Chest pain or breathing trouble",
    detail: "This should be treated as urgent emergency triage."
  },
  {
    id: "seizure",
    keywords: ["seizure", "convulsion", "fits"],
    title: "Possible seizure activity",
    detail: "Do not wait for routine review if this is active or recent."
  },
  {
    id: "bleeding",
    keywords: ["heavy bleeding", "bleeding heavily", "blood loss", "vomit blood", "black stool", "blood in stool"],
    title: "Heavy bleeding warning",
    detail: "This may need emergency care immediately."
  }
];

function resolveMedicine(value) {
  const normalized = normalizeText(value);
  const match = MEDICINE_CATALOG.find((item) =>
    item.aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))
  );

  return {
    label: value.trim(),
    ingredient: match?.ingredient || "",
    className: match?.className || "Recorded medicine",
    recognized: Boolean(match)
  };
}

export function buildMedicineComparison(profile) {
  const medicines = splitList(profile?.currentMedicines);
  const allergies = splitList(profile?.allergies);
  const resolvedMedicines = medicines.map(resolveMedicine);
  const alerts = [];
  const ingredientMap = new Map();

  for (const item of resolvedMedicines) {
    if (!item.ingredient) {
      continue;
    }

    const current = ingredientMap.get(item.ingredient) || [];
    current.push(item.label);
    ingredientMap.set(item.ingredient, current);
  }

  for (const [ingredient, labels] of ingredientMap.entries()) {
    if (labels.length > 1) {
      alerts.push({
        severity: "High",
        title: "Duplicate or same-ingredient medicines",
        detail: `${labels.join(" + ")} may overlap because they map to ${ingredient}. Ask a doctor or pharmacist before combining them.`
      });
    }
  }

  if (
    allergies.some((item) => item.includes("penicillin")) &&
    resolvedMedicines.some((item) => item.ingredient === "amoxicillin clavulanate")
  ) {
    alerts.push({
      severity: "High",
      title: "Possible allergy conflict",
      detail: "A penicillin allergy is recorded and Augmentin/amoxicillin-type medicine appears in the saved list."
    });
  }

  if (
    resolvedMedicines.some((item) => item.ingredient === "warfarin") &&
    resolvedMedicines.some((item) => item.ingredient === "ibuprofen")
  ) {
    alerts.push({
      severity: "Medium",
      title: "Blood thinner plus NSAID caution",
      detail: "This combination can increase bleeding risk. Ask a doctor or pharmacist first."
    });
  }

  if (
    resolvedMedicines.filter((item) => item.className === "Antihistamine").length > 1
  ) {
    alerts.push({
      severity: "Medium",
      title: "Multiple antihistamines recorded",
      detail: "Taking more than one allergy medicine together can increase drowsiness. Confirm with a pharmacist."
    });
  }

  return {
    medicines: resolvedMedicines,
    alerts
  };
}

export function getImmediateRedFlags({ message = "", profile = null }) {
  const normalized = normalizeText(message);
  const flags = RED_FLAG_RULES.filter((rule) =>
    rule.keywords.some((keyword) => normalized.includes(keyword))
  );
  const age = Number(profile?.age || 0);
  const highFeverChild =
    age > 0 &&
    age <= 12 &&
    normalized.includes("fever") &&
    (normalized.includes("high fever") ||
      normalized.includes("104") ||
      normalized.includes("103") ||
      normalized.includes("39.5") ||
      normalized.includes("40"));

  if (highFeverChild) {
    flags.push({
      id: "child-fever",
      title: "Child high-fever warning",
      detail: "Because the saved age suggests a child and high fever is mentioned, escalate quickly if the child is weak, confused, or not drinking fluids."
    });
  }

  return flags;
}

export function buildSymptomTimeline({ history = [], currentMessage = "", currentPreview = "", currentPhotoName = "" }) {
  const timelineEntries = [];
  const currentHasContent = Boolean(currentMessage.trim() || currentPreview);

  if (currentHasContent) {
    timelineEntries.push({
      id: "current",
      label: "Now",
      summary: currentMessage.trim() || "Current symptom photo added.",
      symptoms: [],
      photoPreview: currentPreview,
      photoName: currentPhotoName || "Current photo",
      isCurrent: true
    });
  }

  history.slice(0, 4).forEach((entry) => {
    timelineEntries.push({
      id: entry.id,
      label: entry.displayTime || "Saved check",
      summary: entry.result?.summary || entry.input || "Saved symptom check",
      symptoms: entry.result?.symptoms || [],
      photoPreview: entry.photoPreview || "",
      photoName: entry.photoName || "Saved photo",
      isCurrent: false
    });
  });

  const photoMoments = timelineEntries.filter((entry) => entry.photoPreview);
  const comparison =
    photoMoments.length >= 2
      ? {
          before: photoMoments[1],
          after: photoMoments[0]
        }
      : null;

  return {
    entries: timelineEntries,
    comparison
  };
}
