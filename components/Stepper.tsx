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
 * The five step track in the top bar, shown only inside a session.
 * Tutoring and the mastery check share step 03.
 */
export default function Stepper() {
  const pathname = usePathname();
  if (!pathname.startsWith("/session/")) return null;

  const segment = pathname.split("/").filter(Boolean).pop() ?? "";
  const current = Math.max(
    0,
    STEPS.findIndex((step) => step.slug === segment || (segment === "mastery" && step.slug === "tutor") || (segment === "retention" && step.slug === "results")),
  );

  return (
    <nav className="stepper" aria-label="Session progress">
      <ol className="stepper-steps">
        {STEPS.map((step, index) => (
          <li
            key={step.slug}
            className="step"
            data-state={index === current ? "current" : index < current ? "done" : "todo"}
            aria-current={index === current ? "step" : undefined}
          >
            <span className="step-num">{String(index + 1).padStart(2, "0")}</span>
            <span className="step-label">{step.label}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
