const FAILURE_THRESHOLD = 2;
const COOLDOWN_MS = 2 * 60 * 1000;

const circuitState = {
  nvidia: {
    failures: 0,
    openUntil: 0,
    lastError: ""
  },
  gemini: {
    failures: 0,
    openUntil: 0,
    lastError: ""
  },
  openrouter: {
    failures: 0,
    openUntil: 0,
    lastError: ""
  }
};

function getProviderState(name) {
  if (!circuitState[name]) {
    circuitState[name] = {
      failures: 0,
      openUntil: 0,
      lastError: ""
    };
  }

  return circuitState[name];
}

export function canAttemptProvider(name) {
  const provider = getProviderState(name);

  return Date.now() >= provider.openUntil;
}

export function recordProviderSuccess(name) {
  const provider = getProviderState(name);

  provider.failures = 0;
  provider.openUntil = 0;
  provider.lastError = "";
}

export function recordProviderFailure(name, error) {
  const provider = getProviderState(name);

  provider.failures += 1;
  provider.lastError = error?.message || "Unknown provider error.";

  if (provider.failures >= FAILURE_THRESHOLD) {
    provider.failures = 0;
    provider.openUntil = Date.now() + COOLDOWN_MS;
  }
}

export function getProviderCircuitSnapshot() {
  return Object.fromEntries(
    Object.entries(circuitState).map(([name, provider]) => [
      name,
      {
        coolingDown: provider.openUntil > Date.now(),
        openUntil: provider.openUntil ? new Date(provider.openUntil).toISOString() : "",
        lastError: provider.lastError
      }
    ])
  );
}
