import { buildPrompt, extractJson, withTimeout } from "./triagePrompt.js";

function buildMessages(payload) {
  const prompt = buildPrompt(payload);

  if (!payload.imageDataUrl) {
    return [
      {
        role: "user",
        content: prompt
      }
    ];
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

export async function analyzeWithOpenRouter(payload) {
  const defaultTextModel =
    process.env.OPENROUTER_TEXT_MODEL || process.env.OPENROUTER_MODEL || "google/gemma-3n-e4b-it:free";
  const defaultVisionModel = process.env.OPENROUTER_VISION_MODEL || "qwen/qwen2.5-vl-72b-instruct:free";
  const fallbackModel = process.env.OPENROUTER_FALLBACK_MODEL || "openrouter/auto";
  const modelCandidates = payload.imageDataUrl
    ? [defaultVisionModel, fallbackModel].filter((value, index, items) => items.indexOf(value) === index)
    : [defaultTextModel, fallbackModel].filter((value, index, items) => items.indexOf(value) === index);

  let lastError = null;

  for (const model of modelCandidates) {
    try {
      const requestTimeout = withTimeout(payload.imageDataUrl ? 16000 : 9000);

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "HTTP-Referer": process.env.OPENROUTER_REFERER || process.env.CLIENT_ORIGIN || "http://localhost:5173",
            "X-Title": process.env.OPENROUTER_TITLE || "PulsePath",
            "Content-Type": "application/json"
          },
          signal: requestTimeout.signal,
          body: JSON.stringify({
            model,
            temperature: 0.2,
            max_tokens: 900,
            messages: buildMessages(payload),
            response_format: {
              type: "json_object"
            }
          })
        });

        if (!response.ok) {
          const errorBody = await response.text();
          lastError = new Error(`${model}: OpenRouter error ${response.status}: ${errorBody}`);
          continue;
        }

        const data = await response.json();
        const content = extractTextContent(data?.choices?.[0]?.message?.content);

        if (!content) {
          lastError = new Error(`${model}: OpenRouter returned no message content.`);
          continue;
        }

        return JSON.parse(extractJson(content));
      } finally {
        requestTimeout.clear();
      }
    } catch (error) {
      lastError = new Error(
        error?.name === "AbortError"
          ? `${model}: OpenRouter request timed out.`
          : `${model}: ${error.message}`
      );
    }
  }

  throw lastError || new Error("OpenRouter request failed.");
}
