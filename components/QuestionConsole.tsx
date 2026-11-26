"use client";

import GraphFigure from "./GraphFigure";
import OptionList from "./OptionList";
import QuestionRail from "./QuestionRail";
import ReasoningBox from "./ReasoningBox";
import type { GraphSpec } from "@/lib/pack";
import { letterFor } from "@/lib/scoring";

type Props = {
  qid: string;
  index: number;
  total: number;
  setLabel: string;
  phaseLabel: string;
  studentId: string;
  languageLabel: string;
  stem: string;
  options: string[];
  graph?: GraphSpec;
  choice: number | null;
  reason: string;
  showReasoning: boolean;
  qids: string[];
  answered: (number | null)[];
  since: number;
  dir: "forward" | "back";
  busy: boolean;
  nextLabel: string;
  note: string;
  onSelect: (index: number) => void;
  onReasonChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  onJump: (index: number) => void;
};

/**
 * The two column question console: rail on the left, question pane on the right.
 * It only lays things out. All state lives in TestRunner.
 */
export default function QuestionConsole(props: Props) {
  const figureNumber = String(props.index + 1).padStart(2, "0");

  return (
    <section className="console" aria-label={`${props.phaseLabel} question ${props.index + 1}`}>
        <QuestionRail
          index={props.index}
          total={props.total}
          setLabel={props.setLabel}
          phaseLabel={props.phaseLabel}
          studentId={props.studentId}
          languageLabel={props.languageLabel}
          qids={props.qids}
          answered={props.answered}
          since={props.since}
          dir={props.dir}
          onJump={props.onJump}
        />

        <div className="pane">
          {/* key={qid} remounts the pane so the slide animation plays on every question. */}
          <div className="pane-body" key={props.qid} data-dir={props.dir}>
            <div className="pane-top">
              <span className="tag">
                {props.phaseLabel} · Q{figureNumber}
              </span>
              <span className="kbd-hint">A B C D to choose · Enter next · Esc back</span>
            </div>

            <h1 className="stem" id="stem">
              {props.stem}
            </h1>

            {props.graph ? <GraphFigure spec={props.graph} figureNumber={figureNumber} /> : null}

            <OptionList options={props.options} choice={props.choice} onSelect={props.onSelect} />

            {props.showReasoning ? (
              <ReasoningBox
                value={props.reason}
                onChange={props.onReasonChange}
                locked={props.choice === null}
                isGraph={Boolean(props.graph)}
              />
            ) : null}

            <footer className="console-footer">
              <button
                type="button"
                className="btn-quiet"
                onClick={props.onBack}
                disabled={props.index === 0 || props.busy}
              >
                <span className="back-arrow" aria-hidden="true">
                  ←
                </span>{" "}
                Back
              </button>
              <span className="status-line" aria-live="polite">
                {props.choice === null ? "Awaiting answer" : `Locked · ${letterFor(props.choice)}`}
              </span>
              <button
                type="button"
                className="btn-primary"
                onClick={props.onNext}
                disabled={props.choice === null || props.busy}
              >
                {props.busy ? "Saving" : props.nextLabel} <span className="arr" aria-hidden="true">→</span>{" "}
                <kbd className="kbd" aria-hidden="true">
                  ↵
                </kbd>
              </button>
            </footer>

            {props.note ? (
              <p className="note" role="status">
                {props.note}
              </p>
            ) : null}
          </div>
        </div>
    </section>
  );
}
