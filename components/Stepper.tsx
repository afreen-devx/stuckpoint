"use client";

import { usePathname } from "next/navigation";

const STEPS = [
  { slug: "pretest", label: "Pre-test" },
  { slug: "diagnosis", label: "Diagnosis" },
  { slug: "tutor", label: "Tutoring" },
  { slug: "posttest", label: "Post-test" },
  { slug: "results", label: "Results" },
];

/**
 * The five step track. The yellow fill moves to the step in the URL.
 * Tutoring and mastery share step 03.
 */
export default function Stepper() {
  const pathname = usePathname();
  const segment = pathname.split("/").filter(Boolean).pop() ?? "";
  const current = Math.max(
    0,
    STEPS.findIndex((step) => step.slug === segment || (segment === "mastery" && step.slug === "tutor")),
  );
  const fill = (current / (STEPS.length - 1)) * 100;

  return (
    <nav className="stepper" aria-label="Session progress">
      <div className="stepper-track" role="progressbar" aria-valuemin={1} aria-valuemax={5} aria-valuenow={current + 1}>
        <div className="stepper-fill" style={{ width: `${fill}%` }} />
      </div>
      <ol className="stepper-steps">
        {STEPS.map((step, index) => (
          <li
            key={step.slug}
            className="step"
            data-state={index === current ? "current" : index < current ? "done" : "todo"}
          >
            <span className="step-num">{String(index + 1).padStart(2, "0")}</span>
            <span className="step-label">{step.label}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
