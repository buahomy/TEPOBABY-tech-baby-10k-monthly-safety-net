// Heart toggle for saving a job.

type Props = { saved: boolean; label: string; onToggle: () => void };

export default function HeartButton({ saved, label, onToggle }: Props) {
  return (
    <button
      type="button"
      className={`heart-btn${saved ? " is-saved" : ""}`}
      aria-pressed={saved}
      aria-label={saved ? `Unsave ${label}` : `Save ${label}`}
      title={saved ? "Saved — tap to remove" : "Save this job"}
      onClick={onToggle}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.8 1.1-1.7 2.7-2.8 4.7-2.8 3.4 0 5.7 3.1 4.5 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" />
      </svg>
    </button>
  );
}
