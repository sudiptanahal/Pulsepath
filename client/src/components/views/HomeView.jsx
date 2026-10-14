import { SharedCard } from "../SharedCard";

export function HomeView({
  profile,
  profileAvatar,
  profileReady,
  aiConfigured,
  preview,
  result,
  latestHistory,
  quickPrompts,
  trustHighlights,
  onGoTriage,
  onGoProfile,
  onPromptSelect,
  onOpenLatest
}) {
  return (
    <>
      <section className="hero-panel hero-panel--home">
        <div className="hero-panel__copy">
          <p className="eyebrow">Smart Care Routing</p>
          <h2>A calmer way to check symptoms and move to the right care.</h2>
          <p className="hero-text">
            Share symptoms, add a photo when needed, and get the next step without friction.
          </p>

          <div className="hero-badges">
            <span>Photo-aware triage</span>
            <span>Nearby care routing</span>
            <span>{profileReady ? "Profile ready" : "Finish profile for better context"}</span>
          </div>

          <div className="hero-actions">
            <button type="button" className="button" onClick={onGoTriage}>
              Start Triage
            </button>
            <button type="button" className="button button--ghost" onClick={onGoProfile}>
              Open Profile
            </button>
          </div>
        </div>

        <div className="hero-panel__visual">
          <div className="phone-surface">
            <div className="phone-surface__header">
              <div className="profile-mini">
                <img src={profileAvatar} alt={`${profile.displayName} avatar`} />
                <div>
                  <span>{profile.displayName}</span>
                  <strong>{profileReady ? "Profile ready" : "Add core details"}</strong>
                </div>
              </div>
              <div>
                <span>Analysis</span>
                <strong>{aiConfigured ? "Live AI" : "Local fallback"}</strong>
              </div>
            </div>

            <div className="phone-surface__card phone-surface__card--primary">
              <span className="pill">Triage workspace</span>
              <strong>Symptoms, urgency, and doctor match in one flow</strong>
              <p>Built to keep the next action clear on mobile.</p>
            </div>

            <div className="phone-surface__stats">
              <div>
                <span>Photo</span>
                <strong>{preview ? "Attached" : "Ready"}</strong>
              </div>
              <div>
                <span>Latest route</span>
                <strong>{result?.recommendedDoctor?.specialty || "Pending"}</strong>
              </div>
            </div>
            <div className="phone-surface__pulse" />
          </div>
        </div>
      </section>

      <section className="support-strip">
        {trustHighlights.map((item) => (
          <article key={item.label}>
            <p>{item.label}</p>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="overview-grid">
        <SharedCard
          eyebrow="Quick Start"
          title="Start with a prompt"
          copy="Use a prepared symptom starter when you want to move faster."
          action={
            <div className="chip-row">
              {quickPrompts.slice(0, 3).map((prompt) => (
                <button
                  key={prompt.label}
                  type="button"
                  className="chip-button"
                  onClick={() => onPromptSelect(prompt.prompt)}
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          }
        />

        <SharedCard
          eyebrow="Profile"
          title={profileReady ? "Profile is active" : "Add age, height, and weight"}
          copy={
            profileReady
              ? "Saved details are used to tailor routing and safety checks."
              : "A few basic details make triage suggestions more useful."
          }
          action={
            <button type="button" className="button button--ghost" onClick={onGoProfile}>
              Update Profile
            </button>
          }
        />

        <SharedCard
          eyebrow="Latest Result"
          title={latestHistory ? latestHistory.result.recommendedDoctor.specialty : "No recent result"}
          copy={
            latestHistory
              ? `${latestHistory.result.summary} Saved ${latestHistory.displayTime}.`
              : "Your last triage result appears here for quick return."
          }
          action={
            latestHistory ? (
              <button type="button" className="button button--ghost" onClick={onOpenLatest}>
                Open Result
              </button>
            ) : null
          }
        />
      </section>
    </>
  );
}
