"use client";

const MAX_LENGTH = 160;

/**
 * The one line reasoning box. It stays locked until an answer is chosen.
 * Chips only insert text, they never hint at an answer.
 */
export default function ReasoningBox({
  value,
  onChange,
  locked,
  isGraph,
}: {
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  isGraph: boolean;
}) {
  const chips = [
    "I guessed",
    "I used a formula",
    "I pictured the motion",
    isGraph ? "I read the graph" : "It seemed obvious",
  ];

  function insert(text: string) {
    if (locked) return;
    const next = value.trim().length === 0 ? text : `${value.trim()} ${text}`;
    onChange(next.slice(0, MAX_LENGTH));
  }

  return (
    <div className={`reason ${locked ? "is-locked" : ""}`}>
      <div className="reason-head">
        <span>reasoning.log</span>
        {locked ? (
          <span className="reason-lock">Locked until you choose an answer</span>
        ) : (
          <span className="reason-count">
            {value.length}/{MAX_LENGTH}
          </span>
        )}
      </div>

      <div className="reason-row">
        <span className="reason-prompt" aria-hidden="true">
          ›
        </span>
        <input
          className="reason-input"
          type="text"
          value={value}
          maxLength={MAX_LENGTH}
          disabled={locked}
          onChange={(event) => onChange(event.target.value)}
          placeholder="One line: why did you pick that?"
          aria-label="Your one line reason for this answer"
        />
      </div>

      <div className="chips">
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            className="chip"
            disabled={locked}
            onClick={() => insert(chip)}
          >
            + {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
