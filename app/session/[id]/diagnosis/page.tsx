import { notFound, redirect } from "next/navigation";
import MisconceptionMap, { type MapTile } from "@/components/MisconceptionMap";
import Panel from "@/components/Panel";
import PhaseButton from "@/components/PhaseButton";
import { getAnswers, getSession } from "@/lib/db";
import type { CodeResult, Diagnosis } from "@/lib/diagnosis";
import { questionLabel } from "@/lib/labels";
import { loadPack, type Pack } from "@/lib/pack";
import { getOrRunDiagnosis } from "@/lib/run-diagnosis";
import { phaseHref } from "@/lib/session";

export const dynamic = "force-dynamic";

const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

function headline(d: Diagnosis): { text: string; em: string } {
  const n = d.found.length;
  if (n > 0) {
    return {
      text: `${NUMBER_WORDS[n] ?? n} ${n === 1 ? "idea is" : "ideas are"} `,
      em: "holding you back.",
    };
  }
  if (d.possible.length > 0) return { text: "Nothing certain yet, but ", em: "worth a check." };
  // Nothing found because almost everything was set aside as a guess: say so instead of "all clear".
  if (d.guessed.length >= Math.max(3, Math.ceil(d.total / 2))) return { text: "Not enough ", em: "evidence yet." };
  return { text: "No misconceptions ", em: "showed up." };
}

/** One misconception with the evidence behind it. */
function MisconceptionCard({ result, tutorNow, pack }: { result: CodeResult; tutorNow: boolean; pack: Pack }) {
  return (
    <li className="dx-item" data-status={result.status} data-plan={tutorNow ? "now" : "later"}>
      <div className="dx-head">
        <span className="dx-flag">
          {result.code} · {result.status === "found" ? "Found" : "Possible"} · {result.count}{" "}
          {result.count === 1 ? "signal" : "signals"}
        </span>
        <h2 className="dx-name">{result.name}</h2>
      </div>
      <p className="dx-belief">You may believe: {result.belief}</p>
      <ul className="dx-evidence">
        {result.evidence.map((item, i) => (
          <li key={`${item.qid}-${item.kind}-${i}`}>
            <span className="dx-q">{questionLabel(pack, item.qid)}</span>
            {item.detail}
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
  const pack = loadPack();

  if (session.study_group === "control") {
    return (
      <Panel>
        <p className="eyebrow">Study · Your next step</p>
        <h1 className="page-title">
          Study kinematics for <em>20 minutes</em>, then come back.
        </h1>
        <p className="lede">
          Open ChatGPT, turn on Study Mode, and work on kinematics for 20 minutes: motion graphs, velocity and
          acceleration, falling objects and projectiles. Then return here and take the post-test with the same
          student ID, <span className="mono">{session.student_id}</span>.
        </p>
        <div className="page-foot">
          <PhaseButton sessionId={session.id} to="posttest">
            I have finished studying, start the post-test
          </PhaseButton>
        </div>
      </Panel>
    );
  }

  // The ten pre-test answers in the order the student saw them.
  const answers = new Map(getAnswers(session.id, "pretest").map((a) => [a.qid, a]));
  const scan = pack.sets.A_pre.map((qid) => {
    const a = answers.get(qid);
    if (!a || a.choice === null) return { qid, cls: "", text: "Blank" };
    if (a.guess === 1) return { qid, cls: "", text: "Guess" };
    if (a.correct === 1) return { qid, cls: "is-right", text: "Right" };
    if (a.option_tag === "C0") return { qid, cls: "is-slip", text: "Slip" };
    return { qid, cls: "is-wrong", text: "Wrong" };
  });

  const byCode = new Map([...d.found, ...d.possible].map((r) => [r.code, r]));
  const tiles: MapTile[] = Object.entries(pack.misconceptions).map(([code, m]) => {
    const r = byCode.get(code);
    if (r?.status === "found") return { code, name: m.name, state: "found", label: "Found" };
    if (r) return { code, name: m.name, state: "possible", label: "Possible" };
    return { code, name: m.name, state: "clear", label: "Clear" };
  });

  const results = [...d.found, ...d.possible];
  const title = headline(d);
  const label = (qids: string[]) => qids.map((q) => questionLabel(pack, q)).join(", ");
  const canTutor = d.tutorQueue.length > 0 || d.foundations;

  return (
    <>
      <Panel>
        <p className="eyebrow">
          Step 02 · Diagnosis · {d.usedAi ? "reasons read by AI" : "answer choices only"}
        </p>
        <h1 className="page-title">
          {title.text}
          <em>{title.em}</em>
        </h1>
        <p className="lede">
          Pre-test {d.score} of {d.total}. A misconception counts as found when two signals agree, such as a wrong
          answer and a reason that point the same way. One signal on its own is marked possible.
        </p>
        {d.note ? <p className="result-flag">{d.note}</p> : null}
        {d.foundations ? (
          <p className="result-flag">
            Your score suggests starting with the basics: position, displacement, velocity and acceleration. The
            tutor begins with a short foundations review.
          </p>
        ) : null}
      </Panel>

      <ol className="scan" aria-label="Your ten pre-test answers">
        {scan.map((s, i) => (
          <li key={s.qid} className={s.cls} style={{ animationDelay: `${0.25 + i * 0.05}s` }}>
            <b>{questionLabel(pack, s.qid)}</b>
            {s.text}
          </li>
        ))}
      </ol>

      <MisconceptionMap
        tiles={tiles}
        label="Misconception map"
        legend={[
          { label: "Found · 2+ signals", colour: "var(--bad)" },
          { label: "Possible · 1 signal", colour: "var(--warn)" },
          { label: "Clear", colour: "", outline: true },
        ]}
      />

      {results.length > 0 ? (
        <ul className="dx-list">
          {results.map((r) => (
            <MisconceptionCard key={r.code} result={r} tutorNow={d.tutorQueue.includes(r.code)} pack={pack} />
          ))}
        </ul>
      ) : null}

      <div className="page-foot">
        <div className="stack">
          {d.guessed.length > 0 ? (
            <p className="hint">Not counted as evidence (guessed or answered in under 4 seconds): {label(d.guessed)}.</p>
          ) : null}
          {d.slips.length > 0 ? <p className="hint">Calculation slips, not misconceptions: {label(d.slips)}.</p> : null}
          {d.later.length > 0 ? (
            <p className="hint">StuckPoint tutors at most three ideas per session. Saved for next time: {d.later.join(", ")}.</p>
          ) : null}
        </div>
        {canTutor ? (
          <PhaseButton sessionId={session.id} to="tutor">
            Start tutoring
          </PhaseButton>
        ) : (
          <PhaseButton sessionId={session.id} to="posttest">
            Continue to the post-test
          </PhaseButton>
        )}
      </div>
    </>
  );
}
