import {
  buildPrompt,
  parseImageDataUrl,
  parseStructuredJson,
  TRIAGE_RESPONSE_JSON_SCHEMA,
  withTimeout
} from "./triagePrompt.js";

function buildParts(payload) {
  const prompt = buildPrompt(payload);
  const parts = [];
  const image = parseImageDataUrl(payload.imageDataUrl);

  if (image) {
    parts.push({
      inline_data: {
        mime_type: image.mimeType,
        data: image.data
      }
    });
  }

  parts.push({ text: prompt });

  return parts;
}

function extractTextFromCandidate(candidate) {
  const parts = candidate?.content?.parts || [];

  return parts
    .map((part) => part?.text || "")
    .join("\n")
    .trim();
}

function normalizeApiKey(value = "") {
  return String(value).trim();
}

export function getGeminiApiKeys() {
  return [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2]
    .map(normalizeApiKey)
    .filter(Boolean)
    .filter((value, index, items) => items.indexOf(value) === index);
}

export function hasGeminiApiKeyConfigured() {
  return getGeminiApiKeys().length > 0;
}

function getModelCandidates(payload) {
  const primaryModel = payload.imageDataUrl
    ? process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || "gemini-3-flash-preview"
    : process.env.GEMINI_TEXT_MODEL || process.env.GEMINI_MODEL || "gemini-3-flash-preview";

  const fallbackModel = payload.imageDataUrl
    ? process.env.GEMINI_VISION_FALLBACK_MODEL || "gemini-2.5-flash"
    : process.env.GEMINI_TEXT_FALLBACK_MODEL || "gemini-2.5-flash";

  return [primaryModel, fallbackModel].filter((value, index, items) => value && items.indexOf(value) === index);
}

function getGeminiTextModel() {
  return process.env.GEMINI_TEXT_MODEL || process.env.GEMINI_MODEL || "gemini-3-flash-preview";
}

export async function analyzeWithGemini(payload) {
  const apiKeys = getGeminiApiKeys();
  const maxOutputTokens = payload.imageDataUrl ? 1800 : 1400;
  const requestTimeoutMs = payload.imageDataUrl ? 18000 : 12000;
  let lastError = null;

  if (!apiKeys.length) {
    throw new Error("No Gemini API key configured.");
  }

  try {
    for (const model of getModelCandidates(payload)) {
      for (const [keyIndex, apiKey] of apiKeys.entries()) {
        const requestTimeout = withTimeout(requestTimeoutMs);

        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: "POST",
              headers: {
                "x-goog-api-key": apiKey,
                "Content-Type": "application/json"
              },
              signal: requestTimeout.signal,
              body: JSON.stringify({
                contents: [
                  {
                    role: "user",
                    parts: buildParts(payload)
                  }
                ],
                generationConfig: {
                  temperature: 0.2,
                  maxOutputTokens,
                  responseMimeType: "application/json",
                  responseJsonSchema: TRIAGE_RESPONSE_JSON_SCHEMA
                }
              })
            }
          );

          if (!response.ok) {
            const errorBody = await response.text();
            lastError = new Error(`key ${keyIndex + 1} / ${model}: Gemini error ${response.status}: ${errorBody}`);
            continue;
          }

          const data = await response.json();
          const candidate = data?.candidates?.[0];
          const content = extractTextFromCandidate(candidate);

          if (!content) {
            lastError = new Error(`key ${keyIndex + 1} / ${model}: Gemini returned no text content.`);
            continue;
          }

          try {
            return parseStructuredJson(content);
          } catch (error) {
            lastError = new Error(
              `key ${keyIndex + 1} / ${model}: Gemini returned malformed JSON: ${error.message}\nRAW_RESPONSE:\n${content}`
            );
          }
        } catch (error) {
          lastError = new Error(
            error?.name === "AbortError"
              ? `key ${keyIndex + 1} / ${model}: Gemini request timed out.`
              : `key ${keyIndex + 1} / ${model}: ${error.message}${error?.cause?.message ? ` (${error.cause.message})` : ""}`
          );
        } finally {
          requestTimeout.clear();
        }
      }
    }

    throw lastError || new Error("Gemini request failed.");
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function probeGeminiAvailability() {
  const apiKeys = getGeminiApiKeys();

  if (!apiKeys.length) {
    return false;
  }

  const requestTimeout = withTimeout(8000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiTextModel()}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKeys[0],
          "Content-Type": "application/json"
        },
        signal: requestTimeout.signal,
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: 'Return a tiny JSON object like {"ok":true}.'
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 32,
            responseMimeType: "application/json",
            responseJsonSchema: {
              type: "object",
              properties: {
                ok: {
                  type: "boolean"
                }
              },
              required: ["ok"]
            }
          }
        })
      }
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    const content = extractTextFromCandidate(data?.candidates?.[0]);

    return Boolean(content);
  } catch {
    return false;
  } finally {
    requestTimeout.clear();
  }
}
