"use client";

import { useEffect, useState } from "react";
import { letterFor } from "@/lib/scoring";

type Props = {
  index: number;
  total: number;
  setLabel: string;
  phaseLabel: string;
  studentId: string;
  languageLabel: string;
  qids: string[];
  answered: (number | null)[];
  since: number;
  dir: "forward" | "back";
  onJump: (index: number) => void;
};

function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Live question timer. Starts at 00:00 so the server and browser markup match. */
function Timer({ since }: { since: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = () => setElapsed(Date.now() - since);
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [since]);

  return <>{formatClock(elapsed)}</>;
}

/** Left rail: big question number, readouts and the question list. */
export default function QuestionRail({
  index,
  total,
  setLabel,
  phaseLabel,
  studentId,
  languageLabel,
  qids,
  answered,
  since,
  dir,
  onJump,
}: Props) {
  return (
    <aside className="rail">
      <div className="rail-top">
        <span className="odo" aria-hidden="true">
          <span key={index} className="odo-in" data-dir={dir}>
            {String(index + 1).padStart(2, "0")}
          </span>
        </span>
        <p className="rail-meta">
          of {String(total).padStart(2, "0")} · {setLabel}
        </p>
        <span className="sr-only">
          Question {index + 1} of {total}
        </span>
      </div>

      <dl className="readouts">
        <div className="readout">
          <dt>Phase</dt>
          <dd>{phaseLabel}</dd>
        </div>
        <div className="readout">
          <dt>Time</dt>
          <dd>
            <Timer since={since} />
          </dd>
        </div>
        <div className="readout">
          <dt>Student</dt>
          <dd>{studentId}</dd>
        </div>
        <div className="readout">
          <dt>Language</dt>
          <dd>{languageLabel}</dd>
        </div>
      </dl>

      <ol className="qlist" aria-label="Questions">
        {qids.map((qid, i) => {
          const choice = answered[i];
          const isCurrent = i === index;
          return (
            <li key={qid}>
              <button
                type="button"
                className="qrow"
                aria-current={isCurrent ? "true" : undefined}
                disabled={choice === null && !isCurrent}
                onClick={() => onJump(i)}
              >
                <span className="qrow-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="sr-only">{isCurrent ? "Current question" : "Go to question"}</span>
                <span className="qrow-letter">{choice === null ? "·" : letterFor(choice)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
