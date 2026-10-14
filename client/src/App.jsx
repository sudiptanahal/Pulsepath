import { useEffect, useMemo, useRef, useState } from "react";
import { BottomNav } from "./components/BottomNav";
import { HomeView } from "./components/views/HomeView";
import { HistoryView } from "./components/views/HistoryView";
import { ProfileView } from "./components/views/ProfileView";
import { TriageView } from "./components/views/TriageView";
import { quickPrompts, trustHighlights } from "./data/mockData";
import { usePwaInstallPrompt } from "./hooks/usePwaInstallPrompt";
import { resolveEmergencyContact, startEmergencyCall } from "./utils/emergency.js";
import { analyzeLocally } from "./utils/localTriage";
import {
  buildMedicineComparison,
  buildSymptomTimeline,
  getImmediateRedFlags
} from "./utils/triageExperience";
import {
  createRandomProfile,
  formatTime,
  generateAvatarDataUrl,
  getRandomId,
  getUrgencyClass,
  HISTORY_KEY,
  loadStoredHistory,
  loadStoredProfile,
  normalizeProfile,
  PROFILE_KEY
} from "./utils/profile";

const API_BASE = import.meta.env.VITE_API_BASE || "";
const REMOTE_TRIAGE_ENABLED = import.meta.env.VITE_ENABLE_REMOTE_TRIAGE !== "false";
const THEME_KEY = "pulsepath.theme";

const initialMessages = [
  {
    role: "assistant",
    content: "Share symptoms, timing, and an optional photo. I will suggest the safest next care step."
  }
];

const viewCopy = {
  home: {
    eyebrow: "Smart Care Routing",
    title: "A calmer way to check symptoms and find the right care.",
    blurb: "Check symptoms, add a photo, and move to the next step faster."
  },
  triage: {
    eyebrow: "Triage Workspace",
    title: "Describe symptoms and review the next care step.",
    blurb: "Type symptoms, attach a photo, and see urgency with nearby care."
  },
  history: {
    eyebrow: "Care History",
    title: "Open previous results without starting again.",
    blurb: "Recent checks stay in this browser for quick return."
  },
  profile: {
    eyebrow: "Profile And Settings",
    title: "Manage the saved profile and app settings.",
    blurb: "Body details and preferences stay local to this device."
  }
};

function getAnalysisSourceMeta(source, phase = "live") {
  if (source === "nvidia") {
    return {
      configured: true,
      label: phase === "ready" ? "DeepSeek Ready" : "DeepSeek Live"
    };
  }

  if (source === "gemini") {
    return {
      configured: true,
      label: phase === "ready" ? "Gemini Ready" : "Gemini Live"
    };
  }

  if (source === "openrouter") {
    return {
      configured: true,
      label: phase === "ready" ? "OpenRouter Ready" : "OpenRouter Live"
    };
  }

  return {
    configured: false,
    label: "Instant Text Triage"
  };
}

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function getSpeechLanguage(language) {
  if (language === "Hindi") {
    return "hi-IN";
  }

  if (language === "Bengali") {
    return "bn-IN";
  }

  return "en-IN";
}

function getVoiceErrorMessage(code = "") {
  if (code === "not-allowed" || code === "service-not-allowed") {
    return "Microphone access was blocked. Please allow microphone permission to use voice input.";
  }

  if (code === "no-speech") {
    return "No speech was detected. Try speaking a little closer to the phone.";
  }

  if (code === "audio-capture") {
    return "No microphone was found on this device.";
  }

  return "Voice input is unavailable right now on this device.";
}

function ThemeIcon({ theme }) {
  if (theme === "dark") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5v2.2" />
        <path d="M12 18.3v2.2" />
        <path d="M5.99 5.99 7.54 7.54" />
        <path d="m16.46 16.46 1.55 1.55" />
        <path d="M3.5 12h2.2" />
        <path d="M18.3 12h2.2" />
        <path d="m5.99 18.01 1.55-1.55" />
        <path d="m16.46 7.54 1.55-1.55" />
        <circle cx="12" cy="12" r="4.1" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 14.2A7.8 7.8 0 1 1 9.8 4a6.4 6.4 0 1 0 10.2 10.2Z" />
    </svg>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [theme, setTheme] = useState(() => {
    const storedTheme = window.localStorage.getItem(THEME_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [profile, setProfile] = useState(() => loadStoredProfile());
  const [message, setMessage] = useState("");
  const [language, setLanguage] = useState("English");
  const [location, setLocation] = useState("Kolkata");
  const [gpsLocation, setGpsLocation] = useState(null);
  const [preview, setPreview] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(() => loadStoredHistory());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiConfigured, setAiConfigured] = useState(false);
  const [analysisLabel, setAnalysisLabel] = useState(
    REMOTE_TRIAGE_ENABLED ? "Checking AI..." : "Instant Text Triage"
  );
  const [refining, setRefining] = useState(false);
  const [refinementJobId, setRefinementJobId] = useState("");
  const [refinementHistoryId, setRefinementHistoryId] = useState("");
  const [refinementSourceHint, setRefinementSourceHint] = useState("");
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const { canInstall, isInstalled, promptInstall } = usePwaInstallPrompt();
  const recognitionRef = useRef(null);
  const voiceSupported = Boolean(getSpeechRecognitionConstructor());

  useEffect(() => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(normalizeProfile(profile)));
  }, [profile]);

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!REMOTE_TRIAGE_ENABLED) {
      setAiConfigured(false);
      setAnalysisLabel("Instant Text Triage");
      return undefined;
    }

    let cancelled = false;
    let attemptCount = 0;
    let retryTimer = null;

    const checkHealth = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/health`);

        if (!response.ok) {
          throw new Error("Health check failed.");
        }

        const data = await response.json();

        if (cancelled) {
          return;
        }

        if (data.checking && attemptCount < 6) {
          attemptCount += 1;
          setAnalysisLabel("Checking AI...");
          retryTimer = window.setTimeout(checkHealth, 1200);
          return;
        }

        const sourceMeta = getAnalysisSourceMeta(data.aiProvider, "ready");
        setAiConfigured(Boolean(data.aiConfigured));
        setAnalysisLabel(data.statusLabel || sourceMeta.label);
      } catch {
        if (!cancelled) {
          setAiConfigured(false);
          setAnalysisLabel("Instant Text Triage");
        }
      }
    };

    checkHealth();

    return () => {
      cancelled = true;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
    };
  }, []);

  useEffect(
    () => () => {
      recognitionRef.current?.stop();
    },
    []
  );

  useEffect(() => {
    if (!refinementJobId) {
      return undefined;
    }

    let cancelled = false;
    let attemptCount = 0;
    let retryTimer = null;

    const pollRefinement = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/refinement/${refinementJobId}`);

        if (!response.ok) {
          throw new Error("Refinement polling failed.");
        }

        const job = await response.json();

        if (cancelled) {
          return;
        }

        if (job.status === "pending" && attemptCount < 18) {
          attemptCount += 1;
          retryTimer = window.setTimeout(pollRefinement, 1600);
          return;
        }

        if (job.status === "ready" && job.result) {
          const refinedResult = job.result;
          const sourceMeta = getAnalysisSourceMeta(refinedResult.source);

          setResult(refinedResult);
          setAiConfigured(sourceMeta.configured);
          setAnalysisLabel(sourceMeta.label);
          setRefining(false);
          setRefinementJobId("");
          setRefinementHistoryId("");
          setRefinementSourceHint("");
          setHistory((current) =>
            current.map((entry) =>
              entry.id === refinementHistoryId
                ? {
                    ...entry,
                    location: refinedResult.locationContext?.label || entry.location,
                    result: refinedResult
                  }
                : entry
            )
          );
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              content: `Refined with ${refinedResult.source === "nvidia" ? "DeepSeek" : refinedResult.source === "gemini" ? "Gemini" : "live AI"}. ${refinedResult.summary} Recommended next stop: ${refinedResult.recommendedDoctor.specialty}.`
            }
          ]);
          return;
        }

        setRefining(false);
        setRefinementJobId("");
        setRefinementHistoryId("");
        setAnalysisLabel(refinementSourceHint === "gemini" ? "Gemini Ready" : "DeepSeek Ready");
      } catch {
        if (cancelled) {
          return;
        }

        if (attemptCount < 18) {
          attemptCount += 1;
          retryTimer = window.setTimeout(pollRefinement, 2200);
          return;
        }

        setRefining(false);
        setRefinementJobId("");
        setRefinementHistoryId("");
        setAnalysisLabel(refinementSourceHint === "gemini" ? "Gemini Ready" : "DeepSeek Ready");
      }
    };

    pollRefinement();

    return () => {
      cancelled = true;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [refinementHistoryId, refinementJobId, refinementSourceHint]);

  const safeActiveTab = viewCopy[activeTab] ? activeTab : "home";
  const activeView = viewCopy[safeActiveTab];
  const profileAvatar = useMemo(
    () => generateAvatarDataUrl(profile.avatarSeed, profile.displayName),
    [profile.avatarSeed, profile.displayName]
  );
  const profileReady = Boolean(profile.age && profile.heightCm && profile.weightKg);
  const nearbyHospitals = result?.nearbyHospitals || [];
  const locationContext = result?.locationContext || null;
  const appSignal = (result?.urgency?.level || "Normal").toLowerCase();
  const emergencyContact = useMemo(
    () =>
      resolveEmergencyContact({
        locationContext,
        location
      }),
    [location, locationContext]
  );
  const savedEmergencyContact = useMemo(() => {
    const number = String(profile.emergencyContactPhone || "").trim();

    if (!number) {
      return null;
    }

    const name = String(profile.emergencyContactName || "").trim();
    const relation = String(profile.emergencyContactRelation || "").trim();

    return {
      number,
      label: name || "Saved emergency contact",
      hint: relation ? `${relation} from your profile` : "Saved from your profile"
    };
  }, [profile.emergencyContactName, profile.emergencyContactPhone, profile.emergencyContactRelation]);

  const activeLocation = useMemo(() => {
    if (gpsLocation) {
      return {
        label: "Current GPS",
        city: location,
        coords: gpsLocation
      };
    }

    return {
      label: location,
      city: location
    };
  }, [gpsLocation, location]);

  const bmi =
    profile.heightCm && profile.weightKg
      ? (
          Number(profile.weightKg) /
          ((Number(profile.heightCm) / 100) * (Number(profile.heightCm) / 100))
        ).toFixed(1)
      : "";

  const decoratedHistory = history.map((entry) => ({
    ...entry,
    displayTime: formatTime(entry.createdAt),
    urgencyClass: getUrgencyClass(entry.result.urgency.level)
  }));

  const latestHistory = decoratedHistory[0];
  const medicineComparison = useMemo(
    () => buildMedicineComparison(profile),
    [profile.allergies, profile.currentMedicines]
  );
  const immediateRedFlags = useMemo(
    () =>
      getImmediateRedFlags({
        message,
        profile
      }),
    [message, profile]
  );
  const symptomTimeline = useMemo(
    () =>
      buildSymptomTimeline({
        history: decoratedHistory,
        currentMessage: message,
        currentPreview: preview,
        currentPhotoName: photoName
      }),
    [decoratedHistory, message, photoName, preview]
  );

  const handleProfileField = (field, value) => {
    setProfile((current) => ({
      ...current,
      [field]: value
    }));
  };

  const regenerateIdentity = () => {
    const fresh = createRandomProfile();
    setProfile((current) => ({
      ...current,
      id: fresh.id,
      avatarSeed: fresh.avatarSeed,
      displayName: fresh.displayName
    }));
  };

  const handlePromptSelect = (prompt) => {
    setMessage(prompt);
    setActiveTab("triage");
  };

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPreview(typeof reader.result === "string" ? reader.result : "");
      setPhotoName(file.name);
      setActiveTab("triage");
    };
    reader.readAsDataURL(file);
  };

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not available on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLocation({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
          accuracyMeters: Math.round(position.coords.accuracy || 0)
        });
        setError("");
      },
      () => {
        setError("Location access was denied. You can still type your city manually.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000
      }
    );
  };

  const handleAnalyze = async () => {
    if (!message.trim() && !preview) {
      setError("Add symptoms or attach a symptom photo before continuing.");
      setActiveTab("triage");
      return;
    }

    const userSummary = message.trim() || "Shared a symptom image for review.";
    const nextMessages = [...messages, { role: "user", content: userSummary }];

    setMessages(nextMessages);
    setLoading(true);
    setError("");
    setRefining(false);
    setRefinementJobId("");
    setRefinementHistoryId("");
    setRefinementSourceHint("");
    setActiveTab("triage");

    try {
      const payload = {
        message,
        language,
        location: activeLocation,
        imageDataUrl: preview,
        conversation: nextMessages.slice(-6),
        profile
      };

      let data;

      if (REMOTE_TRIAGE_ENABLED) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 18000);

        try {
          const response = await fetch(`${API_BASE}/api/analyze`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            signal: controller.signal,
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            throw new Error("Remote triage request failed.");
          }

          data = await response.json();
          const sourceMeta = getAnalysisSourceMeta(data.source);
          setAiConfigured(sourceMeta.configured);
          setAnalysisLabel(sourceMeta.label);
        } catch {
          data = analyzeLocally(payload);
          setAiConfigured(false);
          setAnalysisLabel("Instant Text Triage");
        } finally {
          window.clearTimeout(timeout);
        }
      } else {
        data = analyzeLocally(payload);
        setAiConfigured(false);
        setAnalysisLabel("Instant Text Triage");
      }

      const historyEntryId = getRandomId();
      const historyEntry = {
        id: historyEntryId,
        createdAt: new Date().toISOString(),
        input: userSummary,
        location: data.locationContext?.label || location,
        language,
        photoName,
        photoPreview: preview,
        profileSnapshot: profile,
        result: data
      };

      setResult(data);
      setHistory((current) => [historyEntry, ...current].slice(0, 8));
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `${data.summary} Recommended next stop: ${data.recommendedDoctor.specialty}.`
        }
      ]);

      if (data.pendingRefinement && data.refinementId) {
        const sourceHint = data.refinementProviderHint || (preview ? "gemini" : "nvidia");
        setRefining(true);
        setRefinementJobId(data.refinementId);
        setRefinementHistoryId(historyEntryId);
        setRefinementSourceHint(sourceHint);
        setAiConfigured(true);
        setAnalysisLabel(sourceHint === "gemini" ? "Refining with Gemini..." : "Refining with DeepSeek...");
      }

      setMessage("");
    } catch {
      setError("PulsePath could not analyze the symptoms.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!result || safeActiveTab !== "triage" || window.innerWidth > 1080) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const resultNode = document.getElementById("triage-result");
      resultNode?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [result, safeActiveTab]);

  const handleDownloadReport = async () => {
    try {
      const { downloadReportPdf } = await import("./utils/pdfDocuments.js");
      await downloadReportPdf(result, profile);
    } catch {
      setError("PulsePath could not generate the PDF report right now.");
    }
  };

  const handleDownloadEmergencyCard = async () => {
    try {
      const { downloadEmergencyCardPdf } = await import("./utils/pdfDocuments.js");
      await downloadEmergencyCardPdf(profile);
    } catch {
      setError("PulsePath could not generate the emergency card PDF right now.");
    }
  };

  const handleDownloadHandoff = async () => {
    try {
      const { downloadHandoffPdf } = await import("./utils/pdfDocuments.js");
      await downloadHandoffPdf(result, profile);
    } catch {
      setError("PulsePath could not generate the doctor handoff PDF right now.");
    }
  };

  const handleOpenHistory = (entry) => {
    setRefining(false);
    setRefinementJobId("");
    setRefinementHistoryId("");
    setRefinementSourceHint("");
    setResult(entry.result);
    setMessage(entry.input);
    setPreview(entry.photoPreview || "");
    setPhotoName(entry.photoName || "");
    setLocation(entry.result.locationContext?.label || entry.location || "Kolkata");
    setGpsLocation(
      entry.result.locationContext?.coordinates
        ? {
            ...entry.result.locationContext.coordinates,
            accuracyMeters: entry.result.locationContext.accuracyMeters || null
          }
        : null
    );
    setLanguage(entry.language || "English");
    setActiveTab("triage");
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const clearPreview = () => {
    setPreview("");
    setPhotoName("");
  };

  const handleToggleVoiceInput = () => {
    if (voiceListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = getSpeechRecognitionConstructor();

    if (!SpeechRecognition) {
      setVoiceError("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    const baseMessage = message.trim();

    recognition.lang = getSpeechLanguage(language);
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setVoiceListening(true);
      setVoiceError("");
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results || [])
        .map((resultEntry) => resultEntry[0]?.transcript || "")
        .join(" ")
        .trim();
      const nextMessage = [baseMessage, transcript].filter(Boolean).join(baseMessage ? " " : "");

      setMessage(nextMessage.trim());
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") {
        return;
      }

      setVoiceError(getVoiceErrorMessage(event.error));
    };

    recognition.onend = () => {
      setVoiceListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setVoiceListening(false);
      setVoiceError("Voice input could not start on this device right now.");
    }
  };

  const handleEmergencyCall = (contact) => {
    startEmergencyCall(contact);
  };

  return (
    <div className="app-shell" data-theme={theme} data-signal={appSignal}>
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />

      <header className="topbar">
        <div className="topbar__brand">
          <p className="eyebrow">{activeView.eyebrow}</p>
          <h1>PulsePath</h1>
        </div>

        <div className="topbar__actions">
          <div className="identity-badge">
            <img src={profileAvatar} alt={`${profile.displayName} avatar`} />
            <div>
              <strong>{profile.displayName}</strong>
              <span>{profileReady ? "Profile active" : "Profile partial"}</span>
            </div>
          </div>
          <div className="status-chip">
            <span className="status-dot" />
            {isInstalled ? "Installed" : "PWA Ready"}
          </div>
          <div className={`status-chip ${aiConfigured ? "status-chip--ai" : "status-chip--warn"}`}>
            <span className="status-dot" />
            {analysisLabel}
          </div>
          <button
            type="button"
            className="button button--ghost button--theme"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <ThemeIcon theme={theme} />
          </button>
          {canInstall ? (
            <button type="button" className="button button--ghost" onClick={promptInstall}>
              Install App
            </button>
          ) : null}
        </div>
      </header>

      <main className="dashboard">
        {safeActiveTab !== "home" ? (
          <section className="section-intro">
            <div>
              <p className="eyebrow">{activeView.eyebrow}</p>
              <h2>{activeView.title}</h2>
            </div>
            <p>{activeView.blurb}</p>
          </section>
        ) : null}

        {safeActiveTab === "home" ? (
          <HomeView
            profile={profile}
            profileAvatar={profileAvatar}
            profileReady={profileReady}
            aiConfigured={aiConfigured}
            preview={preview}
            result={result}
            latestHistory={latestHistory}
            quickPrompts={quickPrompts}
            trustHighlights={trustHighlights}
            onGoTriage={() => setActiveTab("triage")}
            onGoProfile={() => setActiveTab("profile")}
            onPromptSelect={handlePromptSelect}
            onOpenLatest={() => handleOpenHistory(latestHistory)}
          />
        ) : null}

        {safeActiveTab === "triage" ? (
          <TriageView
            profile={profile}
            profileAvatar={profileAvatar}
            language={language}
            location={location}
            preview={preview}
            photoName={photoName}
            messages={messages}
            message={message}
            error={error}
            loading={loading}
            refining={refining}
            immediateRedFlags={immediateRedFlags}
            medicineComparison={medicineComparison}
            result={result}
            symptomTimeline={symptomTimeline}
            nearbyHospitals={nearbyHospitals}
            locationContext={locationContext}
            aiConfigured={aiConfigured}
            voiceSupported={voiceSupported}
            voiceListening={voiceListening}
            voiceError={voiceError}
            onLanguageChange={setLanguage}
            onLocationChange={setLocation}
            onMessageChange={setMessage}
            onPromptSelect={handlePromptSelect}
            onImageSelect={handleImageSelect}
            onClearImage={clearPreview}
            onAnalyze={handleAnalyze}
            onUseGps={handleUseGps}
            onGoProfile={() => setActiveTab("profile")}
            onDownloadReport={handleDownloadReport}
            onDownloadHandoff={handleDownloadHandoff}
            onToggleVoiceInput={handleToggleVoiceInput}
            quickPrompts={quickPrompts}
            gpsLinked={Boolean(gpsLocation)}
          />
        ) : null}

        {safeActiveTab === "history" ? (
          <HistoryView
            history={decoratedHistory}
            onClearHistory={clearHistory}
            onOpenHistory={handleOpenHistory}
          />
        ) : null}

        {safeActiveTab === "profile" ? (
          <ProfileView
            profile={profile}
            profileAvatar={profileAvatar}
            profileReady={profileReady}
            bmi={bmi}
            onChangeField={handleProfileField}
            onDownloadEmergencyCard={handleDownloadEmergencyCard}
            onRegenerateIdentity={regenerateIdentity}
          />
        ) : null}
      </main>

      <BottomNav
        activeTab={safeActiveTab}
        onChange={setActiveTab}
        emergencyService={emergencyContact}
        savedEmergencyContact={savedEmergencyContact}
        onEmergencyCall={handleEmergencyCall}
      />
    </div>
  );
}
