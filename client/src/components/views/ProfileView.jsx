import { SharedCard } from "../SharedCard";
import { buildEmergencyCard } from "../../utils/profile";

export function ProfileView({
  profile,
  profileAvatar,
  profileReady,
  bmi,
  onChangeField,
  onDownloadEmergencyCard,
  onRegenerateIdentity
}) {
  const emergencyCard = buildEmergencyCard(profile);

  return (
    <section className="profile-layout">
      <div className="profile-identity-card">
        <img src={profileAvatar} alt={`${profile.displayName} avatar`} className="profile-identity-card__avatar" />
        <div>
          <p className="eyebrow">Local Profile</p>
          <h3>{profile.displayName}</h3>
          <p>Stored only on this device.</p>
        </div>
        <button type="button" className="button button--ghost" onClick={onRegenerateIdentity}>
          Refresh Identity
        </button>
      </div>

      <div className="profile-grid profile-grid--details">
        <div className="profile-form">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Editable Details</p>
              <h3>Profile details used in triage</h3>
            </div>
          </div>

          <div className="profile-form__sections">
            <section className="profile-form__section">
              <div className="profile-form__section-copy">
                <p className="eyebrow">Identity</p>
                <h4>Basic details</h4>
                <p>Saved locally and reused in future checks.</p>
              </div>

              <div className="profile-form__grid">
                <label className="field">
                  <span>Name</span>
                  <input
                    type="text"
                    value={profile.displayName}
                    onChange={(event) => onChangeField("displayName", event.target.value)}
                    placeholder="Your display name"
                  />
                </label>

                <label className="field">
                  <span>Age</span>
                  <input
                    type="number"
                    min="0"
                    value={profile.age}
                    onChange={(event) => onChangeField("age", event.target.value)}
                    placeholder="26"
                  />
                </label>

                <label className="field">
                  <span>Height (cm)</span>
                  <input
                    type="number"
                    min="0"
                    value={profile.heightCm}
                    onChange={(event) => onChangeField("heightCm", event.target.value)}
                    placeholder="172"
                  />
                </label>

                <label className="field">
                  <span>Weight (kg)</span>
                  <input
                    type="number"
                    min="0"
                    value={profile.weightKg}
                    onChange={(event) => onChangeField("weightKg", event.target.value)}
                    placeholder="68"
                  />
                </label>

                <label className="field">
                  <span>Gender</span>
                  <select value={profile.gender} onChange={(event) => onChangeField("gender", event.target.value)}>
                    <option value="">Select</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Non-binary</option>
                    <option>Prefer not to say</option>
                  </select>
                </label>

                <label className="field">
                  <span>Blood group</span>
                  <select value={profile.bloodGroup} onChange={(event) => onChangeField("bloodGroup", event.target.value)}>
                    <option value="">Select</option>
                    <option>A+</option>
                    <option>A-</option>
                    <option>B+</option>
                    <option>B-</option>
                    <option>AB+</option>
                    <option>AB-</option>
                    <option>O+</option>
                    <option>O-</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="profile-form__section">
              <div className="profile-form__section-copy">
                <p className="eyebrow">Medical Context</p>
                <h4>Risks and medicines</h4>
                <p>Used for safety checks and doctor handoff notes.</p>
              </div>

              <div className="profile-form__grid">
                <label className="field field--full">
                  <span>Allergies</span>
                  <textarea
                    rows={3}
                    value={profile.allergies}
                    onChange={(event) => onChangeField("allergies", event.target.value)}
                    placeholder="Example: penicillin, peanuts, dust"
                  />
                </label>

                <label className="field field--full">
                  <span>Current medicines</span>
                  <textarea
                    rows={3}
                    value={profile.currentMedicines}
                    onChange={(event) => onChangeField("currentMedicines", event.target.value)}
                    placeholder="Example: insulin, amlodipine, warfarin"
                  />
                </label>

                <label className="field field--full">
                  <span>Chronic conditions</span>
                  <textarea
                    rows={3}
                    value={profile.chronicConditions}
                    onChange={(event) => onChangeField("chronicConditions", event.target.value)}
                    placeholder="Example: asthma, diabetes, hypertension"
                  />
                </label>

                <label className="field field--full">
                  <span>Medical notes</span>
                  <textarea
                    rows={4}
                    value={profile.notes}
                    onChange={(event) => onChangeField("notes", event.target.value)}
                    placeholder="Optional: pregnancy, recent surgery, implant, mobility issues, or anything clinicians should know."
                  />
                </label>
              </div>
            </section>

            <section className="profile-form__section">
              <div className="profile-form__section-copy">
                <p className="eyebrow">Emergency Contact</p>
                <h4>Emergency contact</h4>
                <p>Shown on the emergency card.</p>
              </div>

              <div className="profile-form__grid">
                <label className="field">
                  <span>Contact name</span>
                  <input
                    type="text"
                    value={profile.emergencyContactName}
                    onChange={(event) => onChangeField("emergencyContactName", event.target.value)}
                    placeholder="Parent, spouse, sibling"
                  />
                </label>

                <label className="field">
                  <span>Relation</span>
                  <input
                    type="text"
                    value={profile.emergencyContactRelation}
                    onChange={(event) => onChangeField("emergencyContactRelation", event.target.value)}
                    placeholder="Mother"
                  />
                </label>

                <label className="field field--full">
                  <span>Phone number</span>
                  <input
                    type="tel"
                    value={profile.emergencyContactPhone}
                    onChange={(event) => onChangeField("emergencyContactPhone", event.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </label>
              </div>
            </section>
          </div>
        </div>

        <div className="profile-side-stack">
          <section className="emergency-card">
            <div className="panel-heading panel-heading--tight">
              <div>
                <p className="eyebrow">Offline Emergency Card</p>
                <h3>Emergency card preview</h3>
              </div>
              <button type="button" className="button button--ghost" onClick={onDownloadEmergencyCard}>
                Download PDF
              </button>
            </div>

            <div className="emergency-card__grid">
              <div className="emergency-card__line">
                <span>Name</span>
                <strong>{emergencyCard.displayName}</strong>
              </div>
              <div className="emergency-card__line">
                <span>Age / Gender</span>
                <strong>{`${emergencyCard.age} / ${emergencyCard.gender}`}</strong>
              </div>
              <div className="emergency-card__line">
                <span>Blood group</span>
                <strong>{emergencyCard.bloodGroup}</strong>
              </div>
              <div className="emergency-card__line emergency-card__line--full">
                <span>Allergies</span>
                <strong>{emergencyCard.allergies}</strong>
              </div>
              <div className="emergency-card__line emergency-card__line--full">
                <span>Current medicines</span>
                <strong>{emergencyCard.currentMedicines}</strong>
              </div>
              <div className="emergency-card__line emergency-card__line--full">
                <span>Chronic conditions</span>
                <strong>{emergencyCard.chronicConditions}</strong>
              </div>
              <div className="emergency-card__line">
                <span>Emergency contact</span>
                <strong>{emergencyCard.emergencyContactName}</strong>
              </div>
              <div className="emergency-card__line">
                <span>Relation</span>
                <strong>{emergencyCard.emergencyContactRelation}</strong>
              </div>
              <div className="emergency-card__line emergency-card__line--full">
                <span>Phone</span>
                <strong>{emergencyCard.emergencyContactPhone}</strong>
              </div>
              <div className="emergency-card__line emergency-card__line--full">
                <span>Notes</span>
                <strong>{emergencyCard.notes}</strong>
              </div>
            </div>
          </section>

          <div className="profile-grid">
            <SharedCard
              eyebrow="Health Snapshot"
              title={bmi ? `BMI ${bmi}` : "Add body details"}
              copy={
                bmi
                  ? "Height and weight are available for future triage context."
                  : "Age, height, and weight improve the quality of routing."
              }
              muted={!profileReady}
            />
            <SharedCard
              eyebrow="Status"
              title={profileReady ? "Profile complete" : "Profile partial"}
              copy={
                profileReady
                  ? "Saved details are ready to use in future analyses."
                  : "You can leave fields blank, but more detail gives better context."
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
}
