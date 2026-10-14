export function SharedCard({ eyebrow, title, copy, action, muted = false }) {
  return (
    <article className={`app-card ${muted ? "app-card--muted" : ""}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
      <p>{copy}</p>
      {action}
    </article>
  );
}
