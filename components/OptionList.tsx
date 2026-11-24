"use client";

import { letterFor } from "@/lib/scoring";

/** Hard edged answer tiles in a 2 by 2 grid. */
export default function OptionList({
  options,
  choice,
  onSelect,
}: {
  options: string[];
  choice: number | null;
  onSelect: (index: number) => void;
}) {
  return (
    <div
      className="options"
      role="radiogroup"
      aria-labelledby="stem"
      data-answered={choice !== null}
    >
      {options.map((text, index) => (
        <button
          key={index}
          type="button"
          role="radio"
          aria-checked={choice === index}
          className="option"
          onClick={() => onSelect(index)}
        >
          <span className="option-letter" aria-hidden="true">
            {letterFor(index)}
          </span>
          <span className="option-text">{text}</span>
          <span className="option-indicator" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
