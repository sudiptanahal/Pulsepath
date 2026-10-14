import { useEffect, useState } from "react";

const navItems = [
  { id: "home", label: "Home" },
  { id: "triage", label: "Triage" },
  { id: "history", label: "History" },
  { id: "profile", label: "Profile" }
];

function NavIcon({ id }) {
  if (id === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 11.5 12 5l8 6.5" />
        <path d="M6.5 10.5V19h11v-8.5" />
      </svg>
    );
  }

  if (id === "triage") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="7.5" />
        <path d="M12 8.5v7" />
        <path d="M8.5 12h7" />
      </svg>
    );
  }

  if (id === "history") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
        <path d="M4.5 5.5v3.7h3.7" />
        <path d="M12 8.5v4l2.7 1.8" />
      </svg>
    );
  }

  if (id === "emergency") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4.5v15" />
        <path d="M4.5 12h15" />
        <path d="M7.5 7.5h9v9h-9Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8.2" r="3.2" />
      <path d="M5.5 19c1.5-3.2 4-4.8 6.5-4.8S17 15.8 18.5 19" />
    </svg>
  );
}

function EmergencyOption({
  eyebrow,
  title,
  detail,
  actionLabel,
  tone = "service",
  disabled = false,
  onClick
}) {
  return (
    <button
      type="button"
      className={`emergency-option emergency-option--${tone}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="emergency-option__eyebrow">{eyebrow}</span>
      <strong>{title}</strong>
      <p>{detail}</p>
      <span className="emergency-option__action">{actionLabel}</span>
    </button>
  );
}

export function BottomNav({
  activeTab,
  onChange,
  emergencyService,
  savedEmergencyContact,
  onEmergencyCall
}) {
  const [isEmergencyMenuOpen, setIsEmergencyMenuOpen] = useState(false);

  useEffect(() => {
    if (!isEmergencyMenuOpen || typeof window === "undefined") {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsEmergencyMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEmergencyMenuOpen]);

  const handleEmergencyOptionClick = (contact) => {
    if (!contact?.number) {
      return;
    }

    setIsEmergencyMenuOpen(false);
    onEmergencyCall(contact);
  };

  return (
    <>
      {isEmergencyMenuOpen ? (
        <button
          type="button"
          className="emergency-sheet__backdrop"
          aria-label="Close emergency options"
          onClick={() => setIsEmergencyMenuOpen(false)}
        />
      ) : null}

      {isEmergencyMenuOpen ? (
        <section
          className="emergency-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="emergency-sheet-title"
        >
          <div className="emergency-sheet__header">
            <div>
              <p className="eyebrow">Emergency Options</p>
              <h2 id="emergency-sheet-title">Choose who to call</h2>
            </div>
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() => setIsEmergencyMenuOpen(false)}
            >
              Close
            </button>
          </div>

          <div className="emergency-sheet__options">
            <EmergencyOption
              eyebrow="Emergency services"
              title={emergencyService?.service || "Emergency services"}
              detail={
                emergencyService?.hint || "Use your local emergency response number for urgent help."
              }
              actionLabel={emergencyService?.number || "112"}
              tone="service"
              onClick={() => handleEmergencyOptionClick(emergencyService)}
            />

            <EmergencyOption
              eyebrow="Saved contact"
              title={savedEmergencyContact?.label || "No emergency contact saved"}
              detail={
                savedEmergencyContact?.hint ||
                "Add a name and phone number in Profile to call a personal emergency contact from here."
              }
              actionLabel={savedEmergencyContact?.number || "Add in Profile"}
              tone="contact"
              disabled={!savedEmergencyContact?.number}
              onClick={() => handleEmergencyOptionClick(savedEmergencyContact)}
            />
          </div>
        </section>
      ) : null}

      <nav className="bottom-nav" aria-label="Primary">
        <div className="bottom-nav__tabs">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`bottom-nav__item ${item.id === activeTab ? "is-active" : ""}`}
              onClick={() => onChange(item.id)}
              aria-current={item.id === activeTab ? "page" : undefined}
            >
              <span className="bottom-nav__icon" aria-hidden="true">
                <NavIcon id={item.id} />
              </span>
              <span className="bottom-nav__label">{item.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="bottom-nav__item bottom-nav__item--emergency"
          onClick={() => setIsEmergencyMenuOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={isEmergencyMenuOpen}
          aria-label="Open emergency call options"
          title={`Open emergency options for ${emergencyService?.service || "emergency services"}`}
        >
          <span className="bottom-nav__icon" aria-hidden="true">
            <NavIcon id="emergency" />
          </span>
          <span className="bottom-nav__emergency-copy">
            <span className="bottom-nav__emergency-label">Emergency</span>
            <small>{emergencyService?.number || "112"}</small>
          </span>
          <span className="bottom-nav__emergency-short">SOS</span>
        </button>
      </nav>
    </>
  );
}
