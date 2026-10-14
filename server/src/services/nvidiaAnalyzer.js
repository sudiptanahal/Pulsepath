import OpenAI from "openai";
import { buildPrompt, extractJson, withTimeout } from "./triagePrompt.js";

function normalizeValue(value = "") {
  return String(value).trim();
}

function getNvidiaApiKey() {
  return normalizeValue(process.env.NVIDIA_DEEPSEEK_API_KEY || process.env.NVIDIA_API_KEY);
}

export function hasNvidiaApiKeyConfigured() {
  return Boolean(getNvidiaApiKey());
}

function getClient() {
  return new OpenAI({
    apiKey: getNvidiaApiKey(),
    baseURL: normalizeValue(process.env.NVIDIA_BASE_URL) || "https://integrate.api.nvidia.com/v1"
  });
}

function getNvidiaModel(payload = {}) {
  return normalizeValue(
    payload.imageDataUrl
      ? process.env.NVIDIA_VISION_MODEL || process.env.NVIDIA_MODEL
      : process.env.NVIDIA_TEXT_MODEL || process.env.NVIDIA_MODEL
  ) || "deepseek-ai/deepseek-v3.2";
}

function buildMessages(payload) {
  const prompt = buildPrompt(payload);
  const visionModel = normalizeValue(process.env.NVIDIA_VISION_MODEL);

  if (!payload.imageDataUrl) {
    return [
      {
        role: "user",
        content: prompt
      }
    ];
  }

  if (!visionModel) {
    throw new Error("NVIDIA provider is configured for text analysis only.");
  }

  return [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: prompt
        },
        {
          type: "image_url",
          image_url: {
            url: payload.imageDataUrl
          }
        }
      ]
    }
  ];
}

function buildQuickTextPrompt(payload) {
  const basePrompt = buildPrompt(payload);

  return [
    basePrompt,
    "",
    "Return a smaller fast JSON response for immediate text triage.",
    "Use the baseline to stay safe if unsure.",
    "Required JSON fields:",
    '- "summary": one concise paragraph.',
    '- "symptoms": array of short symptom labels.',
    '- "recommendedDoctor": object with "specialty" and "reason".',
    '- "urgency": object with "level" and "advice".',
    '- "nextSteps": array of 2 or 3 short actions.',
    '- "disclaimer": short safety disclaimer.',
    "Do not include markdown."
  ].join("\n");
}

function extractTextContent(content) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item?.type === "text") {
          return item.text || "";
        }

        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

export async function analyzeWithNvidia(payload) {
  const apiKey = getNvidiaApiKey();
  const model = getNvidiaModel(payload);

  if (!apiKey) {
    throw new Error("No NVIDIA API key configured.");
  }

  const requestTimeout = withTimeout(payload.imageDataUrl ? 24000 : 20000);

  try {
    const client = getClient();
    const completion = await client.chat.completions.create(
      {
        model,
        temperature: 0.2,
        max_tokens: payload.imageDataUrl ? 1400 : 900,
        messages: buildMessages(payload),
        response_format: {
          type: "json_object"
        }
      },
      {
        signal: requestTimeout.signal
      }
    );

    const content = extractTextContent(completion?.choices?.[0]?.message?.content);

    if (!content) {
      throw new Error("NVIDIA returned no message content.");
    }

    return JSON.parse(extractJson(content));
  } catch (error) {
    throw new Error(
      error?.name === "AbortError" ? "NVIDIA request timed out." : `NVIDIA request failed: ${error.message}`
    );
  } finally {
    requestTimeout.clear();
  }
}

export async function analyzeWithNvidiaQuickText(payload) {
  const apiKey = getNvidiaApiKey();

  if (!apiKey) {
    throw new Error("No NVIDIA API key configured.");
  }

  if (payload.imageDataUrl) {
    throw new Error("Quick NVIDIA text mode only supports text triage.");
  }

  const requestTimeout = withTimeout(6500);

  try {
    const client = getClient();
    const completion = await client.chat.completions.create(
      {
        model: getNvidiaModel(payload),
        temperature: 0.1,
        max_tokens: 420,
        messages: [
          {
            role: "user",
            content: buildQuickTextPrompt(payload)
          }
        ],
        response_format: {
          type: "json_object"
        }
      },
      {
        signal: requestTimeout.signal
      }
    );

    const content = extractTextContent(completion?.choices?.[0]?.message?.content);

    if (!content) {
      throw new Error("NVIDIA quick mode returned no message content.");
    }

    return JSON.parse(extractJson(content));
  } catch (error) {
    throw new Error(
      error?.name === "AbortError"
        ? "NVIDIA quick text request timed out."
        : `NVIDIA quick text request failed: ${error.message}`
    );
  } finally {
    requestTimeout.clear();
  }
}

export async function probeNvidiaAvailability() {
  if (!hasNvidiaApiKeyConfigured()) {
    return false;
  }

  const requestTimeout = withTimeout(8000);

  try {
    const client = getClient();
    const completion = await client.chat.completions.create(
      {
        model: getNvidiaModel(),
        temperature: 0,
        max_tokens: 24,
        messages: [
          {
            role: "user",
            content: 'Return a tiny JSON object like {"ok":true}.'
          }
        ],
        response_format: {
          type: "json_object"
        }
      },
      {
        signal: requestTimeout.signal
      }
    );

    return Boolean(extractTextContent(completion?.choices?.[0]?.message?.content));
  } catch {
    return false;
  } finally {
    requestTimeout.clear();
  }
}
