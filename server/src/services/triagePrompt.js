function buildProfileSummary(profile) {
  if (!profile) {
    return "No stored user profile.";
  }

  return [
    `Display name: ${profile.displayName || "Unknown"}`,
    `Age: ${profile.age || "Not provided"}`,
    `Height cm: ${profile.heightCm || "Not provided"}`,
    `Weight kg: ${profile.weightKg || "Not provided"}`,
    `Gender: ${profile.gender || "Not provided"}`,
    `Blood group: ${profile.bloodGroup || "Not provided"}`,
    `Allergies: ${profile.allergies || "None recorded"}`,
    `Current medicines: ${profile.currentMedicines || "None recorded"}`,
    `Chronic conditions: ${profile.chronicConditions || "None recorded"}`,
    `Notes: ${profile.notes || "None"}`
  ].join("\n");
}

function buildBaselineSummary(baseline) {
  if (!baseline) {
    return "No heuristic baseline available.";
  }

  return [
    `Baseline summary: ${baseline.summary || "None"}`,
    `Baseline doctor: ${baseline.recommendedDoctor?.specialty || "Unknown"}`,
    `Baseline urgency: ${baseline.urgency?.level || "Unknown"} - ${baseline.urgency?.advice || "No advice"}`,
    `Baseline symptoms: ${(baseline.symptoms || []).join(", ") || "None"}`,
    `Baseline conditions: ${(baseline.possibleConditions || []).map((item) => item.name).join(", ") || "None"}`,
    `Baseline safety checks: ${(baseline.safetyChecks || []).map((item) => `${item.severity} ${item.title}`).join(", ") || "None"}`
  ].join("\n");
}

export function buildPrompt({ message, language, location, conversation, profile, baseline }) {
  const conversationText = (conversation || [])
    .map((entry) => `${entry.role}: ${entry.content}`)
    .join("\n");

  const locationSummary =
    typeof location === "string"
      ? location
      : `${location?.label || ""} ${location?.city || ""}`.trim();

  return [
    `Language preference: ${language || "English"}.`,
    `Location context: ${locationSummary || "Unknown"}.`,
    "User profile:",
    buildProfileSummary(profile),
    "",
    "Safety baseline from deterministic triage rules:",
    buildBaselineSummary(baseline),
    "",
    "User symptom description:",
    message || "No symptom text provided, rely on image cautiously.",
    "",
    "Recent conversation:",
    conversationText || "No prior messages.",
    "",
    "Rules:",
    "- Never claim a confirmed diagnosis or guaranteed treatment.",
    "- Give careful symptom-to-doctor routing, urgency, and practical next-step guidance.",
    "- If symptoms suggest danger like chest pain with breathing trouble, use Emergency urgency.",
    "- If an image is attached, use it only for visible symptom context like rash, redness, swelling, or wounds.",
    "- If age, allergies, current medicines, chronic conditions, or medical notes matter, personalize the summary and next steps.",
    "- Include medicine or allergy safety warnings only when the stored profile clearly makes the symptom pattern riskier.",
    "- Keep each reason and next step concise."
  ].join("\n");
}

export const TRIAGE_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string"
    },
    symptoms: {
      type: "array",
      items: {
        type: "string"
      }
    },
    possibleConditions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          probability: {
            type: "string",
            enum: ["High", "Medium", "Low"]
          },
          reason: { type: "string" }
        },
        required: ["name", "probability", "reason"]
      }
    },
    recommendedDoctor: {
      type: "object",
      properties: {
        specialty: { type: "string" },
        reason: { type: "string" }
      },
      required: ["specialty", "reason"]
    },
    urgency: {
      type: "object",
      properties: {
        level: {
          type: "string",
          enum: ["Normal", "Urgent", "Emergency"]
        },
        advice: { type: "string" }
      },
      required: ["level", "advice"]
    },
    followUpQuestions: {
      type: "array",
      items: {
        type: "string"
      }
    },
    imageObservations: {
      type: "array",
      items: {
        type: "string"
      }
    },
    nextSteps: {
      type: "array",
      items: {
        type: "string"
      }
    },
    safetyChecks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string" },
          title: { type: "string" },
          detail: { type: "string" }
        },
        required: ["severity", "title", "detail"]
      }
    },
    disclaimer: {
      type: "string"
    }
  },
  required: [
    "summary",
    "symptoms",
    "possibleConditions",
    "recommendedDoctor",
    "urgency",
    "followUpQuestions",
    "imageObservations",
    "nextSteps",
    "disclaimer"
  ]
};

function normalizeJsonText(text = "") {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .replace(/,\s*([}\]])/g, "$1");
}

export function extractJson(text = "") {
  const trimmed = normalizeJsonText(text);

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  throw new Error("Model response did not contain valid JSON.");
}

export function parseStructuredJson(text = "") {
  const jsonText = extractJson(text);

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    const compact = jsonText.replace(/\n/g, " ");

    try {
      return JSON.parse(compact);
    } catch {
      throw error;
    }
  }
}

export function withTimeout(timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout)
  };
}

export function parseImageDataUrl(imageDataUrl = "") {
  const match = imageDataUrl.match(/^data:(.*?);base64,(.*)$/);

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    data: match[2]
  };
}
