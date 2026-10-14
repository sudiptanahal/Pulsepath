import { hasGeminiApiKeyConfigured, probeGeminiAvailability } from "./geminiAnalyzer.js";
import { hasNvidiaApiKeyConfigured, probeNvidiaAvailability } from "./nvidiaAnalyzer.js";

const HEALTH_TTL_MS = 5 * 60 * 1000;

const state = {
  checking: false,
  checkedAt: "",
  aiConfigured: false,
  aiProvider: "heuristic-fallback",
  statusLabel: "Checking AI...",
  providers: {
    nvidia: {
      configured: false,
      reachable: false
    },
    gemini: {
      configured: false,
      reachable: false
    }
  }
};

let activeProbe = null;

function cloneState() {
  return JSON.parse(JSON.stringify(state));
}

function updateProvider(name, details) {
  state.providers[name] = {
    ...state.providers[name],
    ...details
  };
}

function applySummary() {
  if (state.providers.nvidia.reachable) {
    state.aiConfigured = true;
    state.aiProvider = "nvidia";
    state.statusLabel = "DeepSeek Ready";
    return;
  }

  if (state.providers.gemini.reachable) {
    state.aiConfigured = true;
    state.aiProvider = "gemini";
    state.statusLabel = "Gemini Ready";
    return;
  }

  state.aiConfigured = false;
  state.aiProvider = "heuristic-fallback";
  state.statusLabel = "Instant Text Triage";
}

export function getAiHealthSnapshot() {
  return cloneState();
}

export function isNvidiaHealthy() {
  return Boolean(state.providers.nvidia?.reachable);
}

export async function refreshAiHealth({ force = false } = {}) {
  const now = Date.now();

  if (!force && state.checkedAt && now - new Date(state.checkedAt).getTime() < HEALTH_TTL_MS) {
    return cloneState();
  }

  if (activeProbe) {
    return activeProbe;
  }

  state.checking = true;
  state.statusLabel = "Checking AI...";

  activeProbe = (async () => {
    updateProvider("nvidia", {
      configured: hasNvidiaApiKeyConfigured(),
      reachable: false
    });
    updateProvider("gemini", {
      configured: hasGeminiApiKeyConfigured(),
      reachable: false
    });

    if (state.providers.nvidia.configured) {
      updateProvider("nvidia", {
        reachable: await probeNvidiaAvailability()
      });
    }

    if (state.providers.gemini.configured) {
      updateProvider("gemini", {
        reachable: await probeGeminiAvailability()
      });
    }

    state.checkedAt = new Date().toISOString();
    state.checking = false;
    applySummary();

    return cloneState();
  })();

  try {
    return await activeProbe;
  } finally {
    activeProbe = null;
  }
}
