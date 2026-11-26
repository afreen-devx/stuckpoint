"use client";

import { useRef } from "react";
import { GUESS_CHIP, STARTER_CHIPS } from "@/lib/reasons";

const MAX_LENGTH = 160;

/**
 * The one line reasoning box. It stays locked until an answer is chosen.
 * Chips are sentence starters the student finishes; they never hint at an answer.
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
  const input = useRef<HTMLInputElement>(null);
  const starters = STARTER_CHIPS.filter((chip) => isGraph || !chip.startsWith("On the graph"));

  function insert(text: string) {
    if (locked) return;
    const base = value.trim();
    const next = (base.length === 0 ? text : `${base}. ${text}`).slice(0, MAX_LENGTH);
    onChange(next);
    // Put the cursor at the end so the student can finish the sentence.
    requestAnimationFrame(() => {
      const el = input.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.length, next.length);
    });
  }

  return (
    <div className={`reason ${locked ? "is-locked" : ""}`}>
      <div className="reason-head">
        <span>Your reasoning</span>
        {locked ? (
          <span className="reason-lock">Pick an answer to unlock</span>
        ) : (
          <span className="reason-count">
            {value.length}/{MAX_LENGTH} · any language
          </span>
        )}
      </div>

      <div className="reason-row">
        <span className="reason-prompt" aria-hidden="true">
          ›
        </span>
        <input
          ref={input}
          className="reason-input"
          type="text"
          value={value}
          maxLength={MAX_LENGTH}
          disabled={locked}
          onChange={(event) => onChange(event.target.value)}
          placeholder={locked ? "" : "Why? One line, your own words"}
          aria-label="Your one line reason for this answer"
        />
      </div>

      <div className="chips" aria-label="Sentence starters">
        {[GUESS_CHIP, ...starters].map((chip) => (
          <button key={chip} type="button" className="chip" disabled={locked} onClick={() => insert(chip.trim() === GUESS_CHIP ? GUESS_CHIP : chip)}>
            {chip.trim() === GUESS_CHIP ? chip : `${chip.trim()}…`}
          </button>
        ))}
      </div>
    </div>
  );
}
