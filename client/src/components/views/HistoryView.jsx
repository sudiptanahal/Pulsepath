import { SharedCard } from "../SharedCard";

export function HistoryView({ history, onClearHistory, onOpenHistory }) {
  return (
    <section className="history-layout">
      <div className="history-layout__header">
        <SharedCard
          eyebrow="History"
          title={`${history.length} saved sessions`}
          copy="Saved locally in this browser for quick return."
          action={
            history.length ? (
              <button type="button" className="button button--ghost" onClick={onClearHistory}>
                Clear History
              </button>
            ) : null
          }
        />
      </div>

      <div className="history-list">
        {history.length ? (
          history.map((entry) => (
            <article key={entry.id} className="history-item">
              <div className="history-item__top">
                <div>
                  <p className="eyebrow">{entry.displayTime}</p>
                  <h3>{entry.result.recommendedDoctor.specialty}</h3>
                </div>
                <span className={`urgency-pill ${entry.urgencyClass}`}>{entry.result.urgency.level}</span>
              </div>
              <p>{entry.result.summary}</p>
              <div className="history-meta">
                <span>{entry.location}</span>
                <span>{entry.language}</span>
                <span>{entry.result.symptoms.slice(0, 3).join(", ")}</span>
              </div>
              <div className="history-actions">
                <button type="button" className="button button--ghost" onClick={() => onOpenHistory(entry)}>
                  Open In Triage
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <p className="eyebrow">No history yet</p>
            <h3>Complete one triage flow to populate this screen.</h3>
          </div>
        )}
      </div>
    </section>
  );
}
