import { useEffect, useRef, useState } from "react";
import { flowSteps } from "../../data/mockData";
import { buildDoctorHandoff, getUrgencyClass } from "../../utils/profile";

const MOBILE_MEDIA_QUERY = "(max-width: 720px)";

function formatDistance(distanceKm) {
  if (typeof distanceKm === "number" && Number.isFinite(distanceKm)) {
    return `${distanceKm.toFixed(1)} km`;
  }

  return distanceKm ? `${distanceKm} km` : "Distance unavailable";
}

function formatCoordinates(coords) {
  if (!coords || typeof coords.lat !== "number" || typeof coords.lng !== "number") {
    return "";
  }

  return `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
}

function createCollapsedState(isMobile) {
  return {
    conversation: isMobile,
    prompts: isMobile,
    medicine: isMobile,
    safety: isMobile,
    followUp: isMobile,
    handoff: isMobile,
    photo: isMobile,
    hospitals: isMobile,
    timeline: isMobile
  };
}

function ChevronIcon({ open }) {
  return (
    <svg
      className={`section-toggle__chevron ${open ? "is-open" : ""}`}
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path d="m5 7 5 6 5-6" />
    </svg>
  );
}

function SectionToggle({ title, subtitle, open, onToggle, badge }) {
  return (
    <button type="button" className="section-toggle" onClick={onToggle} aria-expanded={open}>
      <div>
        <strong>{title}</strong>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="section-toggle__meta">
        {badge ? <span className="subsection-count">{badge}</span> : null}
        <ChevronIcon open={open} />
      </div>
    </button>
  );
}

export function TriageView({
  profile,
  profileAvatar,
  language,
  location,
  preview,
  photoName,
  messages,
  message,
  error,
  loading,
  refining,
  immediateRedFlags,
  medicineComparison,
  result,
  symptomTimeline,
  nearbyHospitals,
  locationContext,
  aiConfigured,
  voiceSupported,
  voiceListening,
  voiceError,
  onLanguageChange,
  onLocationChange,
  onMessageChange,
  onPromptSelect,
  onImageSelect,
  onClearImage,
  onAnalyze,
  onUseGps,
  onGoProfile,
  onDownloadReport,
  onDownloadHandoff,
  onToggleVoiceInput,
  quickPrompts,
  gpsLinked
}) {
  const urgencyClass = getUrgencyClass(result?.urgency?.level);
  const analysisMode = aiConfigured ? "Live AI" : "Instant text triage";
  const streamRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_MEDIA_QUERY).matches : false
  );
  const [collapsedSections, setCollapsedSections] = useState(() => createCollapsedState(isMobile));
  const locationDetails = [
    formatCoordinates(locationContext?.coordinates),
    locationContext?.accuracyMeters ? `Accuracy ~${locationContext.accuracyMeters}m` : "",
    locationContext?.searchRadiusKm ? `${locationContext.searchRadiusKm} km search radius` : ""
  ].filter(Boolean);
  const locationSummary =
    locationContext?.label || (gpsLinked ? "Current GPS linked" : location || "Add a city or use GPS");
  const locationSource =
    locationContext?.dataSource ||
    (nearbyHospitals[0]?.source ? nearbyHospitals[0].source : "Location-aware care suggestions");
  const doctorHandoff = result ? buildDoctorHandoff(result, profile) : null;
  const followUpQuestions = result?.followUpQuestions || [];
  const safetyChecks = result?.safetyChecks || [];
  const imageObservations = result?.imageObservations || [];
  const medicineAlerts = medicineComparison?.alerts || [];
  const medicineEntries = medicineComparison?.medicines || [];
  const timelineEntries = symptomTimeline?.entries || [];
  const photoComparison = symptomTimeline?.comparison || null;

  useEffect(() => {
    if (!streamRef.current) {
      return;
    }

    streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const updateMobileState = (event) => {
      setIsMobile(event.matches);
    };

    setIsMobile(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateMobileState);

      return () => mediaQuery.removeEventListener("change", updateMobileState);
    }

    mediaQuery.addListener(updateMobileState);

    return () => mediaQuery.removeListener(updateMobileState);
  }, []);

  useEffect(() => {
    setCollapsedSections(createCollapsedState(isMobile));
  }, [isMobile]);

  const toggleSection = (key) => {
    setCollapsedSections((current) => ({
      ...current,
      [key]: !current[key]
    }));
  };

  return (
    <section className="workspace workspace--triage">
      <div className="workspace__main workspace__main--triage">
        <div className="panel-heading panel-heading--tight">
          <div>
            <p className="eyebrow">Symptom Workspace</p>
            <h3>Capture symptoms and send the clearest version of the case</h3>
          </div>
          <div className="field field--compact">
            <label htmlFor="language">Language</label>
            <select id="language" value={language} onChange={(event) => onLanguageChange(event.target.value)}>
              <option>English</option>
              <option>Hindi</option>
              <option>Bengali</option>
            </select>
          </div>
        </div>

        <div className="triage-profile-banner triage-profile-banner--compact">
          <img src={profileAvatar} alt={`${profile.displayName} avatar`} />
          <div>
            <strong>{profile.displayName}</strong>
            <p>{`Age ${profile.age || "--"} • ${profile.heightCm || "--"} cm • ${profile.weightKg || "--"} kg`}</p>
          </div>
          <button type="button" className="button button--ghost" onClick={onGoProfile}>
            Edit
          </button>
        </div>

        <div className="triage-main-grid">
          <div className="composer composer--dense">
            {immediateRedFlags?.length ? (
              <div className="red-flag-strip" role="alert" aria-live="polite">
                <div className="red-flag-strip__header">
                  <span className="eyebrow">Red-flag symptoms</span>
                  <strong>Escalate this case faster</strong>
                </div>
                <div className="red-flag-strip__list">
                  {immediateRedFlags.map((flag) => (
                    <article key={flag.id} className="red-flag-pill">
                      <strong>{flag.title}</strong>
                      <p>{flag.detail}</p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="subsection-heading subsection-heading--compact">
              <div>
                <h4>Symptoms</h4>
                <p>Describe the symptom, timing, and anything getting worse.</p>
              </div>
              {voiceSupported ? (
                <button
                  type="button"
                  className={`button button--ghost button--small ${voiceListening ? "button--live" : ""}`}
                  onClick={onToggleVoiceInput}
                >
                  {voiceListening ? "Stop Voice" : "Voice Input"}
                </button>
              ) : null}
            </div>
            <label className="field field--full">
              <span>Symptom summary</span>
              <textarea
                value={message}
                onChange={(event) => onMessageChange(event.target.value)}
                placeholder="Example: Fever and cough for 2 days. Throat looks red and swallowing hurts."
                rows={5}
              />
            </label>

            <div className="triage-support-grid">
              <label className="upload-tile upload-tile--media">
                <input
                  className="upload-tile__input"
                  type="file"
                  accept="image/*"
                  onChange={onImageSelect}
                />
                <span>Symptom photo</span>
                <strong>{photoName || "Upload photo"}</strong>
                <p>{photoName ? "Tap to replace the image." : "Choose from gallery or files."}</p>
              </label>

              <div className="upload-tile upload-tile--media mobile-only-upload">
                <input
                  ref={cameraInputRef}
                  className="upload-tile__input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={onImageSelect}
                />
                <span>Camera capture</span>
                <strong>Take photo</strong>
                <p>Open the phone camera directly.</p>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  Open Camera
                </button>
              </div>

              <div className="location-stack location-stack--card">
                <div className="subsection-heading subsection-heading--compact">
                  <div>
                    <h4>Location</h4>
                    <p>GPS helps rank nearby care faster.</p>
                  </div>
                  {gpsLinked ? <span className="subsection-count">GPS on</span> : null}
                </div>
                <label className="field">
                  <span>City or area</span>
                  <input type="text" value={location} onChange={(event) => onLocationChange(event.target.value)} />
                </label>
                <div className="location-actions">
                  <button type="button" className="button button--ghost" onClick={onUseGps}>
                    {gpsLinked ? "Refresh Exact GPS" : "Use Exact GPS"}
                  </button>
                  <p className="inline-note">{gpsLinked ? "Using exact location." : "Use GPS for better routing."}</p>
                </div>
              </div>
            </div>

            {preview ? (
              <div className="preview-tile">
                <img src={preview} alt="Symptom preview" />
                <div>
                  <p>Attached photo</p>
                  <strong>{photoName || "Symptom image"}</strong>
                  <button type="button" className="link-button" onClick={onClearImage}>
                    Remove photo
                  </button>
                </div>
              </div>
            ) : null}

            {error ? <p className="error-text">{error}</p> : null}
            {voiceError ? <p className="status-note status-note--voice">{voiceError}</p> : null}
            {voiceListening ? (
              <p className="status-note" aria-live="polite">
                Listening for your symptom description...
              </p>
            ) : null}
            {loading ? (
              <p className="status-note" aria-live="polite">
                Preparing your triage result...
              </p>
            ) : null}
            {refining ? (
              <p className="status-note" aria-live="polite">
                Quick result is shown now. A live AI refinement is still running in the background.
              </p>
            ) : null}

            <div className="composer__actions composer__actions--split">
              <button type="button" className="button" onClick={onAnalyze} disabled={loading}>
                {loading ? "Analyzing..." : "Analyze Symptoms"}
              </button>
              <p className="inline-note inline-note--support">Text, photo, and location are used together.</p>
            </div>
          </div>

          <section className="conversation-panel">
            <SectionToggle
              title="Conversation"
              subtitle="Review the latest messages."
              badge={`${messages.length} updates`}
              open={!collapsedSections.conversation}
              onToggle={() => toggleSection("conversation")}
            />

            {!collapsedSections.conversation ? (
              <div className="message-stream message-stream--workspace" ref={streamRef}>
                {messages.map((entry, index) => (
                  <article key={`${entry.role}-${index}`} className={`message-bubble message-bubble--${entry.role}`}>
                    <span className="message-bubble__role">
                      {entry.role === "assistant" ? "PulsePath" : "You"}
                    </span>
                    <p>{entry.content}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          <section className="prompt-panel">
            <SectionToggle
              title="Quick prompts"
              subtitle="Tap to prefill the symptom box."
              open={!collapsedSections.prompts}
              onToggle={() => toggleSection("prompts")}
            />

            {!collapsedSections.prompts ? (
              <div className="quick-prompts quick-prompts--grid quick-prompts--panel">
                {quickPrompts.map((prompt) => (
                  <button key={prompt.label} type="button" onClick={() => onPromptSelect(prompt.prompt)}>
                    <strong>{prompt.label}</strong>
                    <small>{prompt.description}</small>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <aside className="workspace__side workspace__side--triage" id="triage-result">
        <div className={`result-hero result-hero--compact ${urgencyClass}`}>
          <div className="result-hero__top">
            <div>
              <p className="eyebrow">Live Triage Result</p>
              <h3>{result?.urgency?.level || "Awaiting analysis"}</h3>
            </div>
            {result ? (
              <div className="button-row">
                <button type="button" className="button button--ghost button--small" onClick={onDownloadReport}>
                  Export PDF
                </button>
                <button type="button" className="button button--ghost button--small" onClick={onDownloadHandoff}>
                  Handoff PDF
                </button>
              </div>
            ) : null}
          </div>
          <p>
            {result?.urgency?.advice ||
              "Urgency, doctor type, and next actions will appear here after analysis."}
          </p>
          <div className="result-hero__chips">
            <span className="signal-pill">{analysisMode}</span>
            <span className="signal-pill signal-pill--soft">
              {result?.recommendedDoctor?.specialty || "Doctor recommendation pending"}
            </span>
          </div>
        </div>

        <div className="result-panel result-panel--triage">
          <section className="location-card">
            <div>
              <p className="eyebrow">Location Match</p>
              <h4>{locationSummary}</h4>
              <p>{locationContext?.displayName || "Add a city or use GPS to rank nearby care."}</p>
            </div>
            <div className="location-card__meta">
              {locationDetails.map((detail) => (
                <span key={detail}>{detail}</span>
              ))}
              <span>{locationSource}</span>
            </div>
            {locationContext?.mapUrl ? (
              <a href={locationContext.mapUrl} target="_blank" rel="noreferrer">
                Open current location
              </a>
            ) : null}
          </section>

          <p className="summary-copy">
            {result?.summary ||
              "PulsePath uses symptom text, optional photo context, and caution-first routing logic."}
          </p>

          <div className="result-grid result-grid--triage">
            <section>
              <h4>Likely causes</h4>
              <ul className="stack-list">
                {(result?.possibleConditions || flowSteps.map((step) => ({ name: step, probability: "" }))).map(
                  (item) => (
                    <li key={item.name}>
                      <strong>{item.name}</strong>
                      {item.probability ? <span>{item.probability}</span> : null}
                      {item.reason ? <p>{item.reason}</p> : null}
                    </li>
                  )
                )}
              </ul>
            </section>

            <section>
              <h4>Detected symptoms</h4>
              <ul className="tag-list">
                {(result?.symptoms || ["fever", "rash", "breathing issues", "stomach pain"]).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h4>Next steps</h4>
              <ul className="stack-list">
                {(result?.nextSteps || [
                  "Review urgency guidance",
                  "Check the suggested doctor type",
                  "Open nearby care options"
                ]).map((item) => (
                  <li key={item}>
                    <strong>{item}</strong>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="result-section">
            <SectionToggle
              title="Medicine comparison"
              subtitle={
                medicineAlerts.length
                  ? "Duplicate ingredients and ask-first warnings from the saved profile."
                  : medicineEntries.length
                    ? "Saved medicines were checked for obvious ingredient overlap."
                    : "Add current medicines in the profile to enable this check."
              }
              open={!collapsedSections.medicine}
              onToggle={() => toggleSection("medicine")}
              badge={
                medicineAlerts.length
                  ? `${medicineAlerts.length} alerts`
                  : medicineEntries.length
                    ? `${medicineEntries.length} meds`
                    : "Empty"
              }
            />

            {!collapsedSections.medicine ? (
              <div className="medicine-panel">
                {medicineEntries.length ? (
                  <div className="medicine-grid">
                    {medicineEntries.map((item) => (
                      <div key={`${item.label}-${item.ingredient || item.className}`} className="medicine-tile">
                        <strong>{item.label}</strong>
                        <span>{item.ingredient || "Ingredient not mapped yet"}</span>
                        <small>{item.className}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="inline-note">No saved medicines yet.</p>
                )}

                {medicineAlerts.length ? (
                  <ul className="stack-list stack-list--safety">
                    {medicineAlerts.map((item) => (
                      <li key={`${item.severity}-${item.title}`} className="safety-item">
                        <div className="hospital-list__topline">
                          <strong>{item.title}</strong>
                          <span className={`safety-pill safety-pill--${item.severity.toLowerCase()}`}>{item.severity}</span>
                        </div>
                        <p>{item.detail}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="result-section">
            <SectionToggle
              title="Medicine and allergy safety"
              subtitle={
                safetyChecks.length
                  ? "Open to review profile-based safety flags."
                  : "No extra profile-based safety risks were flagged."
              }
              open={!collapsedSections.safety}
              onToggle={() => toggleSection("safety")}
              badge={safetyChecks.length ? `${safetyChecks.length} checks` : "Clear"}
            />

            {!collapsedSections.safety ? (
              <ul className="stack-list stack-list--safety">
                {safetyChecks.length ? (
                  safetyChecks.map((item) => (
                    <li key={`${item.severity}-${item.title}`} className="safety-item">
                      <div className="hospital-list__topline">
                        <strong>{item.title}</strong>
                        <span className={`safety-pill safety-pill--${item.severity.toLowerCase()}`}>{item.severity}</span>
                      </div>
                      <p>{item.detail}</p>
                    </li>
                  ))
                ) : (
                  <li>
                    <strong>No extra medicine or allergy risks were flagged.</strong>
                  </li>
                )}
              </ul>
            ) : null}
          </section>

          {followUpQuestions.length ? (
            <section className="result-section">
              <SectionToggle
                title="Follow-up questions"
                subtitle="Open if you want to refine the case."
                open={!collapsedSections.followUp}
                onToggle={() => toggleSection("followUp")}
                badge={`${followUpQuestions.length} items`}
              />

              {!collapsedSections.followUp ? (
                <ul className="stack-list">
                  {followUpQuestions.map((item) => (
                    <li key={item}>
                      <strong>{item}</strong>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {doctorHandoff ? (
            <section className="handoff-card">
              <SectionToggle
                title="Doctor handoff summary"
                subtitle="Use this when sharing the case with a clinician."
                open={!collapsedSections.handoff}
                onToggle={() => toggleSection("handoff")}
              />

              {!collapsedSections.handoff ? (
                <div className="handoff-card__grid">
                  {doctorHandoff.lines.map((item) => (
                    <div key={item.label} className="handoff-card__line">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {imageObservations.length ? (
            <section className="result-section">
              <SectionToggle
                title="Photo notes"
                subtitle="Open to review visible symptom observations."
                open={!collapsedSections.photo}
                onToggle={() => toggleSection("photo")}
                badge={`${imageObservations.length} notes`}
              />

              {!collapsedSections.photo ? (
                <ul className="stack-list">
                  {imageObservations.map((item) => (
                    <li key={item}>
                      <strong>{item}</strong>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          <section className="result-section">
            <SectionToggle
              title="Symptom timeline"
              subtitle="Track changes across checks and compare photos."
              open={!collapsedSections.timeline}
              onToggle={() => toggleSection("timeline")}
              badge={timelineEntries.length ? `${timelineEntries.length} moments` : "Empty"}
            />

            {!collapsedSections.timeline ? (
              <div className="timeline-panel">
                {photoComparison ? (
                  <div className="photo-compare">
                    <article>
                      <span>Before</span>
                      <img src={photoComparison.before.photoPreview} alt={photoComparison.before.photoName} />
                      <strong>{photoComparison.before.label}</strong>
                    </article>
                    <article>
                      <span>After</span>
                      <img src={photoComparison.after.photoPreview} alt={photoComparison.after.photoName} />
                      <strong>{photoComparison.after.label}</strong>
                    </article>
                  </div>
                ) : null}

                {timelineEntries.length ? (
                  <ul className="stack-list">
                    {timelineEntries.map((entry) => (
                      <li key={entry.id} className="timeline-item">
                        <div className="timeline-item__top">
                          <strong>{entry.label}</strong>
                          {entry.isCurrent ? <span className="subsection-count">Current</span> : null}
                        </div>
                        <p>{entry.summary}</p>
                        {entry.symptoms?.length ? (
                          <div className="hospital-tags">
                            {entry.symptoms.slice(0, 4).map((item) => (
                              <span key={`${entry.id}-${item}`}>{item}</span>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="inline-note">Your current symptom notes and saved checks will appear here.</p>
                )}
              </div>
            ) : null}
          </section>

          <section className="care-panel">
            <SectionToggle
              title="Nearby hospitals and clinics"
              subtitle="Open to review local options."
              open={!collapsedSections.hospitals}
              onToggle={() => toggleSection("hospitals")}
              badge={nearbyHospitals.length ? `${nearbyHospitals.length} places` : "Pending"}
            />

            {!collapsedSections.hospitals ? (
              <ul className="hospital-list hospital-list--dense">
                {nearbyHospitals.length ? (
                  nearbyHospitals.map((item) => (
                    <li key={item.id || `${item.name}-${item.distanceKm}`}>
                      <div className="hospital-list__body">
                        <div className="hospital-list__topline">
                          <strong>{item.name}</strong>
                          <span className="distance-pill">{formatDistance(item.distanceKm)}</span>
                        </div>
                        <p>{[item.type, item.address || item.area].filter(Boolean).join(" / ")}</p>
                        <div className="hospital-tags">
                          {item.emergencyReady ? <span>Emergency</span> : null}
                          {typeof item.suitabilityScore === "number" ? (
                            <span>{`${item.suitabilityLabel || "Match"} ${item.suitabilityScore}`}</span>
                          ) : null}
                          {(Array.isArray(item.specialties) ? item.specialties : []).slice(0, 3).map((tag) => (
                            <span key={`${item.name}-${tag}`}>{tag}</span>
                          ))}
                        </div>
                        {item.suitabilityReason ? <p>{item.suitabilityReason}</p> : null}
                      </div>
                      <div className="hospital-list__actions">
                        {formatCoordinates(item.coordinates) ? (
                          <span className="hospital-coords">{formatCoordinates(item.coordinates)}</span>
                        ) : null}
                        <a href={item.mapUrl} target="_blank" rel="noreferrer">
                          Open route
                        </a>
                      </div>
                    </li>
                  ))
                ) : (
                  <li>
                    <div>
                      <strong>Care options will appear after analysis</strong>
                      <p>Nearby clinics and hospitals show here.</p>
                    </div>
                  </li>
                )}
              </ul>
            ) : null}
          </section>

          <p className="disclaimer">
            {result?.disclaimer ||
              "This experience does not diagnose disease. Emergency symptoms should always be escalated to local medical services immediately."}
          </p>
          {!aiConfigured ? (
            <p className="disclaimer disclaimer--setup">
              The app can still give text triage instantly even when live AI is unavailable.
            </p>
          ) : null}
        </div>
      </aside>
    </section>
  );
}
