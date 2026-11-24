import { notFound, redirect } from "next/navigation";
import Panel from "@/components/Panel";
import PhaseButton from "@/components/PhaseButton";
import { getSession } from "@/lib/db";
import type { CodeResult } from "@/lib/diagnosis";
import { getOrRunDiagnosis } from "@/lib/run-diagnosis";
import { phaseHref } from "@/lib/session";

export const dynamic = "force-dynamic";

/** One misconception with the evidence behind it. */
function MisconceptionCard({ result, tutorNow }: { result: CodeResult; tutorNow: boolean }) {
  return (
    <li className="dx-item" data-status={result.status}>
      <div className="dx-head">
        <span className="dx-code">{result.code}</span>
        <span className="dx-name">{result.name}</span>
        <span className={`flag ${result.status === "found" ? "bad" : "warn"}`}>
          {result.status === "found" ? "Found" : "Possible"} · {result.count} {result.count === 1 ? "signal" : "signals"}
        </span>
      </div>
      <p className="dx-belief">You may believe: {result.belief}</p>
      <ul className="dx-evidence">
        {result.evidence.map((item, i) => (
          <li key={`${item.qid}-${item.kind}-${i}`}>
            <span className="dx-q">{item.qid}</span> {item.detail}
          </li>
        ))}
      </ul>
      <p className="dx-plan">{tutorNow ? "Tutoring this session" : "Saved for a later session"}</p>
    </li>
  );
}

export default async function DiagnosisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) notFound();
  if (session.phase !== "diagnosis") redirect(phaseHref(session.id, session.phase));

  // Worked out once and stored. Control sessions are diagnosed too, for the study data,
  // but they are not shown the result.
  const d = await getOrRunDiagnosis(session);

  if (session.study_group === "control") {
    return (
      <Panel>
        <p className="eyebrow">Study · Your next step</p>
        <h1 className="page-title">Study kinematics for 20 minutes, then come back</h1>
        <p className="lede">
          Open ChatGPT, turn on Study Mode, and work on kinematics for 20 minutes: motion graphs,
          velocity and acceleration, falling objects and projectiles. Then return here and take the
          post-test with the same student ID, <span className="mono">{session.student_id}</span>.
        </p>
        <PhaseButton sessionId={session.id} to="posttest">
          I have finished studying, start the post-test
        </PhaseButton>
      </Panel>
    );
  }

  const results = [...d.found, ...d.possible];
  const title =
    d.found.length > 0
      ? `We found ${d.found.length} ${d.found.length === 1 ? "misconception" : "misconceptions"} to work on`
      : d.possible.length > 0
        ? "Nothing certain, but a few things to check"
        : "No misconceptions showed up";

  return (
    <Panel>
      <p className="eyebrow">
        Step 02 · Diagnosis · {d.usedAi ? "Answers and reasons read by AI" : "Answer choices only"}
      </p>
      <h1 className="page-title">{title}</h1>
      <p className="lede">
        Pre-test: {d.score} of {d.total}. A misconception counts as found when two signals agree, such as a wrong
        answer and a reason that point the same way. One signal on its own is marked possible.
      </p>

      {d.note ? <p className="result-flag">{d.note}</p> : null}

      {d.foundations ? (
        <p className="result-flag">
          Your score suggests starting with the basics: position, displacement, velocity and acceleration. The tutor
          will begin with a short foundations review before the misconceptions below.
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul className="dx-list">
          {results.map((r) => (
            <MisconceptionCard key={r.code} result={r} tutorNow={d.tutorQueue.includes(r.code)} />
          ))}
        </ul>
      ) : null}

      <div className="stack" style={{ marginTop: 16 }}>
        {d.guessed.length > 0 ? (
          <p className="hint">
            Not counted as evidence, because they were guesses or answered in under 4 seconds: {d.guessed.join(", ")}.
          </p>
        ) : null}
        {d.slips.length > 0 ? (
          <p className="hint">Calculation slips, not misconceptions: {d.slips.join(", ")}.</p>
        ) : null}
        {d.later.length > 0 ? (
          <p className="hint">
            StuckPoint tutors at most three ideas per session. Saved for next time: {d.later.join(", ")}.
          </p>
        ) : null}
      </div>

      <div className="stack" style={{ marginTop: 20 }}>
        <p className="hint">Tutoring is the next part being built. For now, continue to the post-test.</p>
        <PhaseButton sessionId={session.id} to="posttest">
          Continue to the post-test
        </PhaseButton>
      </div>
    </Panel>
  );
}
