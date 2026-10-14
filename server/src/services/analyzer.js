import { canAttemptProvider, recordProviderFailure, recordProviderSuccess } from "./providerCircuit.js";
import { analyzeWithGemini, hasGeminiApiKeyConfigured } from "./geminiAnalyzer.js";
import { analyzeHeuristically } from "./heuristicAnalyzer.js";
import {
  analyzeWithNvidia,
  analyzeWithNvidiaQuickText,
  hasNvidiaApiKeyConfigured
} from "./nvidiaAnalyzer.js";
import { analyzeWithOpenRouter } from "./openrouterAnalyzer.js";
import { resolveNearbyCare } from "./nearbyCareSearch.js";
import { isNvidiaHealthy } from "./providerHealth.js";

function preferArray(candidate, fallback) {
  return Array.isArray(candidate) && candidate.length ? candidate : fallback;
}

function isValidUrgency(level) {
  return ["Normal", "Urgent", "Emergency"].includes(level);
}

function mergeWithFallback(aiResult, fallback) {
  const merged = {
    ...fallback,
    ...aiResult,
    symptoms: preferArray(aiResult?.symptoms, fallback.symptoms),
    possibleConditions: preferArray(aiResult?.possibleConditions, fallback.possibleConditions),
    followUpQuestions: preferArray(aiResult?.followUpQuestions, fallback.followUpQuestions),
    imageObservations: preferArray(aiResult?.imageObservations, fallback.imageObservations),
    nextSteps: preferArray(aiResult?.nextSteps, fallback.nextSteps),
    safetyChecks: preferArray(aiResult?.safetyChecks, fallback.safetyChecks),
    recommendedDoctor:
      aiResult?.recommendedDoctor?.specialty && aiResult?.recommendedDoctor?.reason
        ? aiResult.recommendedDoctor
        : fallback.recommendedDoctor,
    urgency: isValidUrgency(aiResult?.urgency?.level) ? aiResult.urgency : fallback.urgency,
    disclaimer: aiResult?.disclaimer || fallback.disclaimer,
    nearbyHospitals: fallback.nearbyHospitals,
    locationContext: fallback.locationContext
  };

  if (!merged.summary || merged.summary.length < 20) {
    merged.summary = fallback.summary;
  }

  return merged;
}

async function buildFallbackResult(payload, heuristicFallback = analyzeHeuristically(payload)) {
  try {
    const nearbyCare = await resolveNearbyCare({
      location: payload?.location,
      urgencyLevel: heuristicFallback.urgency.level,
      recommendedSpecialty: heuristicFallback.recommendedDoctor.specialty
    });

    return {
      ...heuristicFallback,
      nearbyHospitals: nearbyCare.nearbyHospitals.length
        ? nearbyCare.nearbyHospitals
        : heuristicFallback.nearbyHospitals,
      locationContext: nearbyCare.locationContext,
      source: "heuristic"
    };
  } catch {
    return {
      ...heuristicFallback,
      source: "heuristic"
    };
  }
}

function getProviderOrder(payload, { preferGemini = false } = {}) {
  const providers = [];
  const canUseNvidia =
    hasNvidiaApiKeyConfigured() && (!payload?.imageDataUrl || Boolean(process.env.NVIDIA_VISION_MODEL));
  const preferNvidia =
    !payload?.imageDataUrl && canUseNvidia && (isNvidiaHealthy() || !hasGeminiApiKeyConfigured());

  if (preferGemini && hasGeminiApiKeyConfigured()) {
    providers.push("gemini");
  }

  if (!preferGemini && preferNvidia) {
    providers.push("nvidia");
  }

  if (hasGeminiApiKeyConfigured()) {
    providers.push("gemini");
  }

  if (canUseNvidia && (!preferNvidia || preferGemini)) {
    providers.push("nvidia");
  }

  if (process.env.OPENROUTER_API_KEY) {
    providers.push("openrouter");
  }

  return providers.filter((provider, index, list) => list.indexOf(provider) === index);
}

async function runProvider(provider, payload, heuristicFallback) {
  if (!canAttemptProvider(provider)) {
    throw new Error(`${provider} circuit is cooling down.`);
  }

  try {
    let aiResult;

    if (provider === "nvidia") {
      aiResult = await analyzeWithNvidia({
        ...payload,
        baseline: heuristicFallback
      });
    } else if (provider === "gemini") {
      aiResult = await analyzeWithGemini({
        ...payload,
        baseline: heuristicFallback
      });
    } else {
      aiResult = await analyzeWithOpenRouter({
        ...payload,
        baseline: heuristicFallback
      });
    }

    recordProviderSuccess(provider);

    return {
      aiResult,
      source: provider
    };
  } catch (error) {
    recordProviderFailure(provider, error);
    throw error;
  }
}

async function runQuickNvidiaText(payload, heuristicFallback) {
  if (!canAttemptProvider("nvidia")) {
    throw new Error("nvidia circuit is cooling down.");
  }

  try {
    const aiResult = await analyzeWithNvidiaQuickText({
      ...payload,
      baseline: heuristicFallback
    });
    recordProviderSuccess("nvidia");

    return {
      aiResult,
      source: "nvidia"
    };
  } catch (error) {
    recordProviderFailure("nvidia", error);
    throw error;
  }
}

export async function analyzeWithProviders(
  payload,
  heuristicFallback = analyzeHeuristically(payload),
  options = {}
) {
  let lastProviderError = "";

  for (const provider of getProviderOrder(payload, options)) {
    try {
      return await runProvider(provider, payload, heuristicFallback);
    } catch (error) {
      lastProviderError = `${lastProviderError ? `${lastProviderError} | ` : ""}${provider}: ${error.message}`;
      console.error(`${provider} analysis failed, trying the next provider.`, error.message);
    }
  }

  throw new Error(lastProviderError || "No live AI provider is available right now.");
}

export async function analyzeSymptoms(payload, { responseWindowMs = 5000 } = {}) {
  const heuristicFallback = analyzeHeuristically(payload);
  const fallbackPromise = buildFallbackResult(payload, heuristicFallback);
  const wantsQuickNvidiaText =
    !payload?.imageDataUrl && hasNvidiaApiKeyConfigured() && canAttemptProvider("nvidia");
  const refinementProviderHint =
    getProviderOrder(payload, {
      preferGemini: wantsQuickNvidiaText
    })[0] || "";

  if (!refinementProviderHint) {
    return {
      result: await fallbackPromise,
      pendingRefinement: false,
      livePromise: null,
      refinementProviderHint: ""
    };
  }

  const fullLivePromise = Promise.all([
    fallbackPromise,
    analyzeWithProviders(payload, heuristicFallback, {
      preferGemini: wantsQuickNvidiaText
    })
  ]).then(([fallbackResult, liveResult]) => ({
    ...mergeWithFallback(liveResult.aiResult, fallbackResult),
    source: liveResult.source
  }));
  const fullLiveOutcomePromise = fullLivePromise.then((result) => ({
    status: "live",
    result
  }));

  const quickTextPromise = wantsQuickNvidiaText
    ? Promise.all([fallbackPromise, runQuickNvidiaText(payload, heuristicFallback)]).then(
        ([fallbackResult, quickResult]) => ({
          ...mergeWithFallback(quickResult.aiResult, fallbackResult),
          source: quickResult.source,
          quickMode: true
        })
      )
    : null;

  const timedCandidates = [fullLiveOutcomePromise.catch(() => new Promise(() => {}))];

  if (quickTextPromise) {
    timedCandidates.push(
      quickTextPromise
        .then((result) => ({
          status: "quick",
          result
        }))
        .catch(() => new Promise(() => {}))
    );
  }

  timedCandidates.push(
    new Promise((resolve) =>
      setTimeout(() => {
        resolve({ status: "timeout" });
      }, responseWindowMs)
    )
  );

  const timedOutcome = await Promise.race(timedCandidates);

  if (timedOutcome.status === "live") {
    return {
      result: timedOutcome.result,
      pendingRefinement: false,
      livePromise: null,
      refinementProviderHint
    };
  }

  if (timedOutcome.status === "quick") {
    return {
      result: {
        ...timedOutcome.result,
        pendingRefinement: true
      },
      pendingRefinement: true,
      livePromise: fullLivePromise,
      refinementProviderHint
    };
  }

  const fallbackResult = await fallbackPromise;

  return {
    result: {
      ...fallbackResult,
      pendingRefinement: true
    },
    pendingRefinement: true,
    livePromise: fullLivePromise,
    refinementProviderHint
  };
}
