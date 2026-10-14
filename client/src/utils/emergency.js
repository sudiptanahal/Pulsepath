const EMERGENCY_DIRECTORY = {
  in: {
    number: "112",
    service: "National Emergency Response Support System",
    country: "India"
  },
  us: {
    number: "911",
    service: "Emergency Services",
    country: "United States"
  },
  ca: {
    number: "911",
    service: "Emergency Services",
    country: "Canada"
  }
};

const INDIA_HINTS = [
  "india",
  "kolkata",
  "delhi",
  "bangalore",
  "bengaluru",
  "mumbai",
  "chennai",
  "hyderabad",
  "pune",
  "west bengal",
  "karnataka",
  "maharashtra"
];

const US_HINTS = [
  "united states",
  "usa",
  "new york",
  "california",
  "texas",
  "florida",
  "washington",
  "new jersey",
  "illinois"
];

const CANADA_HINTS = ["canada", "toronto", "ontario", "british columbia", "vancouver", "alberta"];

function normalizeText(value = "") {
  return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function includesAny(text, list) {
  return list.some((item) => text.includes(item));
}

function inferCountryCodeFromText(text = "") {
  const normalized = normalizeText(text);

  if (!normalized) {
    return "";
  }

  if (includesAny(normalized, INDIA_HINTS)) {
    return "in";
  }

  if (includesAny(normalized, US_HINTS)) {
    return "us";
  }

  if (includesAny(normalized, CANADA_HINTS)) {
    return "ca";
  }

  return "";
}

function inferCountryCodeFromDevice() {
  if (typeof navigator === "undefined" || typeof Intl === "undefined") {
    return "";
  }

  const locale = normalizeText(navigator.language || "");
  const timeZone = normalizeText(Intl.DateTimeFormat().resolvedOptions().timeZone || "");

  if (locale.endsWith("-in") || locale.includes("en-in") || timeZone.includes("asia/kolkata")) {
    return "in";
  }

  if (locale.endsWith("-us") || locale.includes("en-us") || timeZone.startsWith("america/")) {
    return "us";
  }

  if (locale.endsWith("-ca") || locale.includes("en-ca") || timeZone.includes("canada")) {
    return "ca";
  }

  return "";
}

function toDialableNumber(value = "") {
  return String(value).replace(/[^\d+*#]/g, "");
}

export function resolveEmergencyContact({ locationContext = null, location = "" } = {}) {
  const countryCode =
    normalizeText(locationContext?.countryCode) ||
    inferCountryCodeFromText(
      [
        locationContext?.displayName,
        locationContext?.label,
        locationContext?.country,
        location
      ]
        .filter(Boolean)
        .join(" ")
    ) ||
    inferCountryCodeFromDevice() ||
    "in";
  const entry = EMERGENCY_DIRECTORY[countryCode] || EMERGENCY_DIRECTORY.in;

  return {
    ...entry,
    countryCode,
    telHref: `tel:${toDialableNumber(entry.number)}`,
    hint:
      locationContext?.country
        ? `Based on ${locationContext.country}`
        : countryCode === "in"
          ? "Based on your India region settings"
          : countryCode === "us"
            ? "Based on your United States region settings"
            : "Based on your device region settings"
  };
}

export function startEmergencyCall(contact) {
  if (!contact?.number || typeof window === "undefined") {
    return;
  }

  window.location.href = contact.telHref || `tel:${toDialableNumber(contact.number)}`;
}
